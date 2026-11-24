/**
 * Importa el concentrado de tiendas. Acepta:
 *  - texto copiado de Excel (columnas separadas por tabulador), o
 *  - un archivo CSV (coma o punto y coma).
 * La primera fila debe tener encabezados; se reconocen por nombre (sin importar
 * acentos ni mayúsculas): CR (o "CR TIENDA"), Nombre/Tienda, Ciudad, Plaza, Estado, Región, RO (o "Nuevo RO").
 * Las columnas que no vienen en el archivo no se tocan en las tiendas que ya existen.
 * Si el CR ya existe, se actualiza; si no, se crea.
 */
import { db, newId, now } from '@/lib/db';
import { fail, handler, ok } from '@/lib/api';

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');
const ALIAS: Record<string, string[]> = {
  cr: ['cr', 'crtienda', 'centroderesponsabilidad', 'idtienda', 'clave'],
  nombre: ['nombre', 'tienda', 'nombretienda', 'nombredetienda', 'descripcion'],
  ciudad: ['ciudad', 'municipio', 'localidad'],
  plaza: ['plaza', 'nombreplaza'],
  estado: ['estado', 'entidad'],
  region: ['region', 'nombreregion'],
  // Responsable de operación vigente (en la distribución: "Nuevo RO").
  ro: ['nuevoro', 'ro', 'responsabledeoperacion', 'responsable', 'asesor'],
};

function splitLine(line: string, sep: string) {
  if (sep === '\t') return line.split('\t');
  const out: string[] = []; let cur = ''; let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
    else if (c === sep && !q) { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

export const POST = handler(async req => {
  // plaza: se asigna a todas las tiendas del archivo si no trae columna "Plaza" (los concentrados vienen por plaza).
  const { texto, plaza } = (await req.json()) as { texto?: string; plaza?: string };
  const plazaArchivo = plaza?.trim() || null;
  const lines = (texto || '').replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return fail('Incluye la fila de encabezados y al menos una tienda');
  const sep = lines[0].includes('\t') ? '\t' : lines[0].split(';').length > lines[0].split(',').length ? ';' : ',';
  const head = splitLine(lines[0], sep).map(norm);
  const col: Record<string, number> = {};
  for (const [k, al] of Object.entries(ALIAS)) {
    const i = head.findIndex(h => al.includes(h));
    if (i >= 0) col[k] = i;
  }
  if (col.cr === undefined || col.nombre === undefined) {
    return fail('No encontré las columnas CR y Nombre (o Tienda) en la primera fila');
  }

  let creadas = 0, actualizadas = 0;
  const errores: string[] = [];
  const existentes = new Map((await db.selectFrom('tiendas').select(['id', 'cr']).execute()).map(t => [t.cr, t.id]));
  await db.transaction().execute(async tx => {
    for (const [n, line] of lines.slice(1).entries()) {
      const cells = splitLine(line, sep).map(c => c.trim());
      const get = (k: string) => (col[k] === undefined ? null : cells[col[k]] || null);
      const cr = get('cr')?.toUpperCase();
      const nombre = get('nombre');
      if (!cr || !nombre) { errores.push(`Fila ${n + 2}: falta CR o nombre`); continue; }
      const data = { nombre, ciudad: get('ciudad'), plaza: get('plaza') ?? plazaArchivo, estado: get('estado'), region: get('region'), ro: get('ro') };
      const id = existentes.get(cr);
      if (id) {
        // Solo se actualizan las columnas que trae el archivo (no se borra lo capturado a mano).
        const parcial = Object.fromEntries(Object.entries(data).filter(([k]) => k === 'nombre' || col[k] !== undefined || (k === 'plaza' && plazaArchivo)));
        await tx.updateTable('tiendas').set({ ...parcial, activa: true, updated_at: now() }).where('id', '=', id).execute();
        actualizadas++;
      } else {
        const nid = newId();
        await tx.insertInto('tiendas').values({ id: nid, cr, ...data, activa: true, created_at: now(), updated_at: now() }).execute();
        existentes.set(cr, nid);
        creadas++;
      }
    }
  });
  return ok({ creadas, actualizadas, errores: errores.slice(0, 20), columnas: Object.keys(col) });
}, { admin: true });
