/**
 * Reporte PDF de una evaluación (pdf-lib: JavaScript puro, sin Chrome ni binarios,
 * funciona igual en Windows, Linux y Azure).
 * Logo: si existe public/img/logo.png (o .jpg) se usa en el encabezado. Coloca ahí
 * el logo oficial de OXXO autorizado por Mercadotecnia.
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type PDFImage, type RGB } from 'pdf-lib';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { EvaluacionFull } from './evaluaciones';
import { storage } from './storage';
import { fmtDate, fmtDateTime, RESULTADOS, type Resultado } from './format';

const W = 612, H = 792, M = 42; // Carta
const INK = rgb(0.11, 0.106, 0.094), MUTED = rgb(0.43, 0.416, 0.384), LINE = rgb(0.906, 0.898, 0.875);
const BODY = rgb(0.29, 0.286, 0.263), ACCENT = rgb(0.114, 0.42, 0.31);
const TONES: Record<string, [RGB, RGB]> = {
  cumple: [rgb(0.906, 0.945, 0.918), rgb(0.141, 0.376, 0.247)],
  no_cumple: [rgb(0.984, 0.914, 0.898), rgb(0.659, 0.212, 0.122)],
  no_aplica: [rgb(0.945, 0.941, 0.925), rgb(0.522, 0.51, 0.478)],
  pend: [rgb(0.984, 0.949, 0.867), rgb(0.541, 0.373, 0.024)],
};

// Las fuentes estándar del PDF usan WinAnsi: reemplazamos lo que no se puede dibujar
// (emojis, flechas…) para que un comentario con un emoji no rompa el reporte.
const EXTRA = new Set([0x20ac, 0x201a, 0x192, 0x201e, 0x2026, 0x2020, 0x2021, 0x2c6, 0x2030, 0x160, 0x2039, 0x152, 0x17d, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x2dc, 0x2122, 0x161, 0x203a, 0x153, 0x17e, 0x178]);
export const safe = (s: string) =>
  [...(s ?? '').replace(/\r/g, '').replace(/\t/g, ' ').replace(/↑/g, '+').replace(/↓/g, '-')]
    .map(ch => {
      const c = ch.codePointAt(0)!;
      return c === 10 || (c >= 32 && c <= 126) || (c >= 160 && c <= 255) || EXTRA.has(c) ? ch : '';
    })
    .join('');

function wrap(text: string, font: PDFFont, size: number, maxW: number) {
  const out: string[] = [];
  for (const para of safe(text).split('\n')) {
    let line = '';
    for (const word of para.split(/\s+/)) {
      const t = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(t, size) <= maxW) line = t;
      else { if (line) out.push(line); line = word; }
    }
    out.push(line);
  }
  return out;
}

async function loadLogo(doc: PDFDocument): Promise<PDFImage | null> {
  for (const f of ['logo.png', 'logo.jpg']) {
    try {
      const b = await fs.readFile(path.join(process.cwd(), 'public', 'img', f));
      return f.endsWith('png') ? await doc.embedPng(b) : await doc.embedJpg(b);
    } catch { /* sin logo */ }
  }
  return null;
}

export async function generarPdf(ev: EvaluacionFull, anterior?: { porcentaje: number | null } | null) {
  const doc = await PDFDocument.create();
  doc.setTitle(`Checklist ${ev.tienda.cr} ${ev.folio}`);
  doc.setAuthor(ev.evaluador.nombre);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const logo = await loadLogo(doc);

  let page: PDFPage = doc.addPage([W, H]);
  let y = H - M;
  const text = (s: string, x: number, yy: number, size = 10, f = font, color = INK) =>
    page.drawText(safe(s), { x, y: yy, size, font: f, color });
  const newPage = () => { page = doc.addPage([W, H]); y = H - M; };
  const need = (h: number) => { if (y - h < M + 20) newPage(); };

  // ---------- Encabezado ----------
  let tx = M;
  if (logo) {
    const s = 34 / logo.height;
    page.drawImage(logo, { x: M, y: y - 34, width: logo.width * s, height: 34 });
    tx = M + logo.width * s + 14;
  }
  text('Resultado Checklist Operativo', tx, y - 14, 16, bold);
  text(`${ev.checklist.nombre} · Folio ${ev.folio}`, tx, y - 30, 9.5, font, MUTED);
  y -= 50;
  page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 1, color: LINE });
  y -= 22;

  const info: [string, string][] = [
    ['Tienda', ev.tienda.nombre], ['CR', ev.tienda.cr],
    ['Fecha', fmtDateTime(ev.fecha)], ['Evaluador', ev.evaluador.nombre],
    ['RO (responsable de operación)', ev.tienda.ro || '—'], ['Plaza', ev.tienda.plaza || '—'], ['Ciudad / Estado', [ev.tienda.ciudad, ev.tienda.estado].filter(Boolean).join(', ') || '—'],
  ];
  const colW = (W - 2 * M) / 2;
  info.forEach(([k, v], i) => {
    const x = M + (i % 2) * colW, yy = y - Math.floor(i / 2) * 30;
    text(k.toUpperCase(), x, yy, 7.5, bold, MUTED);
    text(v, x, yy - 12, 11, bold);
  });
  y -= 30 * Math.ceil(info.length / 2) + 6;

  // ---------- Resumen ----------
  const boxH = 74;
  page.drawRectangle({ x: M, y: y - boxH, width: W - 2 * M, height: boxH, color: rgb(0.98, 0.976, 0.969), borderColor: LINE, borderWidth: 1 });
  const p = ev.porcentaje;
  const pc = p == null ? INK : p >= 90 ? TONES.cumple[1] : p >= 75 ? TONES.pend[1] : TONES.no_cumple[1];
  text('CUMPLIMIENTO', M + 16, y - 20, 7.5, bold, MUTED);
  text(p == null ? '—' : `${p.toFixed(1)}%`, M + 16, y - 50, 28, bold, pc);
  if (anterior?.porcentaje != null && p != null) {
    const d = Math.round((p - anterior.porcentaje) * 10) / 10;
    const t = Math.abs(d) < 0.5 ? '= Se mantuvo vs anterior' : d > 0 ? `+${d} pts vs anterior` : `${d} pts vs anterior`;
    text(t, M + 16, y - 64, 8, font, MUTED);
  }
  const stats: [string, number][] = [['Total preguntas', ev.total], ['Cumplen', ev.cumple], ['No cumplen', ev.noCumple], ['No aplican', ev.noAplica]];
  stats.forEach(([k, v], i) => {
    const x = M + 175 + i * 92;
    text(k.toUpperCase(), x, y - 20, 7, bold, MUTED);
    text(String(v), x, y - 48, 20, bold, i === 2 && v > 0 ? TONES.no_cumple[1] : INK);
  });
  y -= boxH + 22;

  if (ev.observaciones) {
    const lines = wrap(ev.observaciones, font, 10, W - 2 * M);
    need(18 + lines.length * 13);
    text('Observaciones generales', M, y, 11, bold); y -= 15;
    for (const l of lines) { text(l, M, y, 10, font, BODY); y -= 13; }
    y -= 10;
  }

  // ---------- Preguntas por categoría ----------
  let cat = '';
  let n = 0;
  for (const r of ev.respuestas) {
    n++;
    if (r.categoria !== cat) {
      cat = r.categoria;
      need(60);
      y -= 4;
      text(cat, M, y, 12.5, bold, ACCENT);
      y -= 8;
      page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.8, color: LINE });
      y -= 16;
    }
    const tagW = 74;
    const qLines = wrap(`${n}. ${r.texto}`, bold, 10.5, W - 2 * M - tagW - 10);
    const aLines = r.ayuda ? wrap(r.ayuda, font, 8.5, W - 2 * M - tagW - 10) : [];
    const cLines = r.comentario ? wrap(`Comentario: ${r.comentario}`, font, 9.5, W - 2 * M - 12) : [];
    // La pregunta y su primera fila de fotos se mantienen en la misma página.
    const fotoH = r.evidencias.length ? ((W - 2 * M - 16) / 3) * 0.72 + 8 : 0;
    need(qLines.length * 13 + aLines.length * 11 + cLines.length * 12 + 20 + fotoH);

    const key = r.resultado ?? 'pend';
    const [bg, fg] = TONES[key] ?? TONES.pend;
    const label = r.resultado ? RESULTADOS[r.resultado as Resultado].label : 'Sin respuesta';
    page.drawRectangle({ x: W - M - tagW, y: y - 5, width: tagW, height: 17, color: bg });
    text(label, W - M - tagW + (tagW - bold.widthOfTextAtSize(label, 8.5)) / 2, y, 8.5, bold, fg);

    for (const l of qLines) { text(l, M, y, 10.5, bold); y -= 13; }
    for (const l of aLines) { text(l, M, y, 8.5, font, MUTED); y -= 11; }
    if (cLines.length) {
      y -= 3;
      const h = cLines.length * 12 + 4;
      page.drawRectangle({ x: M, y: y - h + 12, width: 2, height: h, color: fg });
      for (const l of cLines) { text(l, M + 10, y, 9.5, font, BODY); y -= 12; }
    }
    y -= 6;

    // Evidencias fotográficas: 3 por fila
    const fotos = r.evidencias;
    if (fotos.length) {
      const gap = 8, cw = (W - 2 * M - gap * 2) / 3, ch = cw * 0.72;
      for (let i = 0; i < fotos.length; i += 3) {
        need(ch + 8);
        for (let j = 0; j < 3 && i + j < fotos.length; j++) {
          const f = fotos[i + j];
          const x = M + j * (cw + gap);
          page.drawRectangle({ x, y: y - ch, width: cw, height: ch, color: rgb(0.945, 0.941, 0.925) });
          try {
            const bytes = await storage().get(f.ruta);
            const img = f.mime === 'image/png' ? await doc.embedPng(bytes) : f.mime === 'image/jpeg' ? await doc.embedJpg(bytes) : null;
            if (img) {
              const s = Math.min(cw / img.width, ch / img.height);
              const iw = img.width * s, ih = img.height * s;
              page.drawImage(img, { x: x + (cw - iw) / 2, y: y - ch + (ch - ih) / 2, width: iw, height: ih });
            }
          } catch { /* foto no disponible: se deja el recuadro vacío */ }
        }
        y -= ch + gap;
      }
    }
    y -= 4;
    page.drawLine({ start: { x: M, y: y + 6 }, end: { x: W - M, y: y + 6 }, thickness: 0.5, color: LINE });
    y -= 10;
  }

  // ---------- Pie de página ----------
  const pages = doc.getPages();
  pages.forEach((pg, i) => {
    pg.drawText(safe(`${ev.folio} · CR ${ev.tienda.cr} · Generado ${fmtDate(new Date())}`), { x: M, y: 22, size: 7.5, font, color: MUTED });
    const t = safe(`Página ${i + 1} de ${pages.length}`);
    pg.drawText(t, { x: W - M - font.widthOfTextAtSize(t, 7.5), y: 22, size: 7.5, font, color: MUTED });
  });
  return Buffer.from(await doc.save());
}
