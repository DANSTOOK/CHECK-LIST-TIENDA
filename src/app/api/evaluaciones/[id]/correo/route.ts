/**
 * Correo de resultados.
 *  GET  -> vista previa: destinatarios sugeridos, asunto y cuerpo HTML.
 *  POST -> { modo: 'eml' | 'graph', to, cc, asunto }
 *          eml:   descarga un .eml para abrir en Outlook o compartir (fotos dentro del cuerpo; PDF y Excel adjuntos)
 *          graph: crea el borrador en el buzón (Outlook Web/Desktop) y devuelve su enlace
 */
import { getToken } from 'next-auth/jwt';
import type { NextRequest } from 'next/server';
import { fail, handler, ok } from '@/lib/api';
import { entraEnabled } from '@/lib/auth';
import { cargarEvaluacion, destinatariosPara, evaluacionAnterior, type EvaluacionFull } from '@/lib/evaluaciones';
import { asunto, cidFoto, construirEml, crearBorradorGraph, cuerpoHtml, type Adjunto } from '@/lib/mail';
import { generarPdf } from '@/lib/pdf';
import { storage } from '@/lib/storage';
import { MIME_XLSX, nombreXlsx, xlsxEvaluacion } from '@/lib/xlsx';

type Ctx = { params: Promise<{ id: string }> };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Prefijo del sitio (en GitHub Pages /NOMBRE-DEL-REPO) tomado de la URL de la petición. */
const prefijo = (req: Request) => { const p = new URL(req.url).pathname; return p.slice(0, p.indexOf('/api/')); };
const appUrl = (req: Request, id: string) => `${process.env.NEXTAUTH_URL || new URL(req.url).origin + prefijo(req)}/evaluaciones/${id}`;

async function load(id: string) {
  const ev = await cargarEvaluacion(id);
  if (!ev) return null;
  if (ev.estado !== 'finalizada') return 'borrador' as const;
  return { ev, anterior: await evaluacionAnterior(ev) };
}

export const GET = handler<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const d = await load(id);
  if (!d) return fail('Evaluación no encontrada', 404);
  if (d === 'borrador') return fail('Finaliza la evaluación antes de generar el correo', 409);
  const dest = await destinatariosPara(d.ev);
  // En la vista previa las fotos se ven desde la app; en el correo van incrustadas.
  return ok({ ...dest, asunto: asunto(d.ev), html: cuerpoHtml(d.ev, d.anterior, appUrl(req, id), fid => `${prefijo(req)}/api/evidencias/${fid}`), graph: entraEnabled });
});

async function adjuntos(ev: EvaluacionFull, anterior: { porcentaje: number | null } | null): Promise<Adjunto[]> {
  const out: Adjunto[] = [
    { nombre: `Checklist_${ev.tienda.cr}_${ev.folio}.pdf`, mime: 'application/pdf', data: await generarPdf(ev, anterior) },
    // Excel para quien valida y da seguimiento con el RO (cada punto con sus fotos).
    { nombre: nombreXlsx(`Seguimiento_${ev.tienda.cr}_${ev.folio}`), mime: MIME_XLSX, data: Buffer.from(await xlsxEvaluacion(ev)) },
  ];
  // Fotos dentro del cuerpo, debajo de su pregunta (cid:)
  for (const [i, r] of ev.respuestas.entries()) {
    for (const [k, f] of r.evidencias.entries()) {
      if (f.mime !== 'image/jpeg' && f.mime !== 'image/png') continue;
      const ext = f.mime === 'image/png' ? 'png' : 'jpg';
      try { out.push({ nombre: `${ev.tienda.cr}_P${i + 1}_${k + 1}.${ext}`, mime: f.mime, data: await storage().get(f.ruta), inlineId: cidFoto(f.id) }); } catch { /* omitida */ }
    }
  }
  return out;
}

export const POST = handler<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const d = await load(id);
  if (!d) return fail('Evaluación no encontrada', 404);
  if (d === 'borrador') return fail('Finaliza la evaluación antes de generar el correo', 409);
  const b = (await req.json()) as { modo: 'eml' | 'graph'; to?: string[]; cc?: string[]; asunto?: string };
  const clean = (xs?: string[]) => (xs ?? []).map(x => x.trim()).filter(x => EMAIL.test(x));
  const msg = {
    to: clean(b.to), cc: clean(b.cc), subject: b.asunto?.trim() || asunto(d.ev),
    html: cuerpoHtml(d.ev, d.anterior, appUrl(req, id), fid => `cid:${cidFoto(fid)}`), adjuntos: await adjuntos(d.ev, d.anterior),
  };

  if (b.modo === 'graph') {
    if (!entraEnabled) return fail('Para crear el borrador en Outlook Web configura Microsoft Entra ID', 400);
    const token = await getToken({ req: req as unknown as NextRequest, secret: process.env.NEXTAUTH_SECRET });
    if (!token?.accessToken || Date.now() > Number(token.accessTokenExpires || 0)) {
      return fail('Tu sesión de Microsoft expiró. Cierra sesión y vuelve a entrar.', 401);
    }
    return ok({ webLink: await crearBorradorGraph(String(token.accessToken), msg) });
  }

  const eml = construirEml(msg);
  const name = `${msg.subject.replace(/[\\/:*?"<>|]+/g, '').slice(0, 90)}.eml`;
  return new Response(eml, {
    headers: { 'Content-Type': 'message/rfc822', 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(name)}` },
  });
});
