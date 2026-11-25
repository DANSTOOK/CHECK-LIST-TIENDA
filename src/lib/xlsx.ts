/**
 * Excel de seguimiento (.xlsx) con las fotos de evidencia junto a cada punto.
 *
 * Un .xlsx es un ZIP con archivos XML (Office Open XML). Se arma a mano con un
 * generador mínimo y `fflate` (compresión ZIP en JavaScript puro), así funciona
 * igual en el servidor y en la versión publicada en GitHub Pages, sin librerías
 * nativas (bloqueadas por el proxy corporativo).
 *
 * Hojas:
 *  - Por evaluación: Resumen, Detalle (cada pregunta con sus fotos) y Hallazgos
 *    (con sus fotos y columnas amarillas para el seguimiento con el RO).
 *  - Historial: Resumen, Hallazgos (con fotos, ordenados por RO) y Por RO.
 */
import { zipSync, strToU8, type Zippable } from 'fflate';
import { cargarEvaluacion, type EvaluacionFull } from './evaluaciones';
import { buscarEvaluaciones, type Filtros } from './stats';
import { etiquetaEstrellas } from './score';
import { fmtDateTime } from './format';
import { storage } from './storage';
import type { EvidenciasT } from './db';

type Celda = string | number | null | undefined;
type Col = { titulo: string; ancho: number; estilo?: 'pct' | 'mono' | 'seg' };
type Fila = { celdas: Celda[]; fotos?: EvidenciasT[] };
type Hoja = { nombre: string; columnas: Col[]; filas: Fila[]; conFotos?: boolean };

// Tamaño de las miniaturas en la hoja.
const FOTO_W = 132, FOTO_H = 99, FOTO_COL_ANCHO = 20; // px, px, caracteres
const MAX_FOTOS_POR_FILA = 6;
const EMU = 9525; // 1 px = 9525 EMU

const ESTILO: Record<string, number> = { normal: 0, th: 1, pct: 2, mono: 3, seg: 4 };
const esc = (s: string) => s
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
  .replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const colLetra = (n: number) => { let s = ''; n++; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };

/** Ancho y alto de una imagen JPEG o PNG (para no deformarla). */
function medidas(b: Uint8Array, mime: string): { w: number; h: number } | null {
  if (mime === 'image/png' && b.length > 24) return { w: (b[16] << 24) | (b[17] << 16) | (b[18] << 8) | b[19], h: (b[20] << 24) | (b[21] << 16) | (b[22] << 8) | b[23] };
  if (mime === 'image/jpeg') {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const m = b[i + 1];
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { h: (b[i + 5] << 8) | b[i + 6], w: (b[i + 7] << 8) | b[i + 8] };
      i += 2 + ((b[i + 2] << 8) | b[i + 3]);
    }
  }
  return null;
}

function celdaXml(ref: string, v: Celda, estilo: number) {
  const s = estilo ? ` s="${estilo}"` : '';
  if (v == null || v === '') return estilo ? `<c r="${ref}"${s}/>` : '';
  if (typeof v === 'number' && Number.isFinite(v)) return `<c r="${ref}"${s}><v>${v}</v></c>`;
  return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${esc(String(v))}</t></is></c>`;
}

async function armar(hojas: Hoja[], nombreDoc: string) {
  const files: Zippable = {};
  let imgN = 0;
  const ct: string[] = [];
  const definidos: string[] = [];

  for (const [hi, h] of hojas.entries()) {
    const n = hi + 1;
    const maxF = h.conFotos ? Math.min(MAX_FOTOS_POR_FILA, Math.max(1, ...h.filas.map(f => f.fotos?.length ?? 0))) : 0;
    const columnas: Col[] = [...h.columnas, ...Array.from({ length: maxF }, (_, i) => ({ titulo: `Foto ${i + 1}`, ancho: FOTO_COL_ANCHO * 7 }))];
    const ultima = colLetra(columnas.length - 1);
    const anchors: string[] = [];
    const rels: string[] = [];

    const rows: string[] = [];
    rows.push(`<row r="1" ht="24" customHeight="1">${columnas.map((c, i) => celdaXml(`${colLetra(i)}1`, c.titulo, ESTILO.th)).join('')}</row>`);
    for (const [ri, f] of h.filas.entries()) {
      const r = ri + 2;
      const fotos = (f.fotos ?? []).slice(0, maxF);
      const alto = fotos.length ? ` ht="${Math.round((FOTO_H + 10) * 0.75)}" customHeight="1"` : '';
      rows.push(`<row r="${r}"${alto}>${columnas.map((c, i) => celdaXml(`${colLetra(i)}${r}`, i < f.celdas.length ? f.celdas[i] : null, c.estilo ? ESTILO[c.estilo] : 0)).join('')}</row>`);
      // Fotos de esta fila, cada una en su columna "Foto n"
      for (const [k, foto] of fotos.entries()) {
        if (foto.mime !== 'image/jpeg' && foto.mime !== 'image/png') continue;
        let data: Uint8Array;
        try { data = new Uint8Array(await storage().get(foto.ruta)); } catch { continue; }
        imgN++;
        const ext = foto.mime === 'image/png' ? 'png' : 'jpeg';
        files[`xl/media/image${imgN}.${ext}`] = [data, { level: 0 }];
        const rid = `rId${rels.length + 1}`;
        rels.push(`<Relationship Id="${rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image${imgN}.${ext}"/>`);
        const m = medidas(data, foto.mime) ?? { w: 4, h: 3 };
        const s = Math.min(FOTO_W / m.w, FOTO_H / m.h);
        const cx = Math.round(m.w * s * EMU), cy = Math.round(m.h * s * EMU);
        anchors.push(`<xdr:oneCellAnchor><xdr:from><xdr:col>${h.columnas.length + k}</xdr:col><xdr:colOff>${4 * EMU}</xdr:colOff><xdr:row>${r - 1}</xdr:row><xdr:rowOff>${5 * EMU}</xdr:rowOff></xdr:from><xdr:ext cx="${cx}" cy="${cy}"/><xdr:pic><xdr:nvPicPr><xdr:cNvPr id="${anchors.length + 2}" name="Foto ${esc(String(f.celdas[0] ?? ''))} ${k + 1}"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr><xdr:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:oneCellAnchor>`);
      }
    }

    const cols = columnas.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${Math.max(6, Math.round(c.ancho / 7))}" customWidth="1"/>`).join('');
    const filtro = `A1:${ultima}${h.filas.length + 1}`;
    files[`xl/worksheets/sheet${n}.xml`] = strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetViews><sheetView workbookViewId="0"${hi === 0 ? ' tabSelected="1"' : ''}><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/><cols>${cols}</cols><sheetData>${rows.join('')}</sheetData><autoFilter ref="${filtro}"/><pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/>${anchors.length ? '<drawing r:id="rId1"/>' : ''}</worksheet>`);
    definidos.push(`<definedName name="_xlnm._FilterDatabase" localSheetId="${hi}" hidden="1">'${esc(h.nombre.replace(/'/g, "''"))}'!$A$1:$${ultima}$${h.filas.length + 1}</definedName>`);
    ct.push(`<Override PartName="/xl/worksheets/sheet${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`);

    if (anchors.length) {
      files[`xl/worksheets/_rels/sheet${n}.xml.rels`] = strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing${n}.xml"/></Relationships>`);
      files[`xl/drawings/drawing${n}.xml`] = strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${anchors.join('')}</xdr:wsDr>`);
      files[`xl/drawings/_rels/drawing${n}.xml.rels`] = strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels.join('')}</Relationships>`);
      ct.push(`<Override PartName="/xl/drawings/drawing${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`);
    }
  }

  files['[Content_Types].xml'] = strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="jpeg" ContentType="image/jpeg"/><Default Extension="png" ContentType="image/png"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>${ct.join('')}</Types>`);
  files['_rels/.rels'] = strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`);
  files['docProps/core.xml'] = strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${esc(nombreDoc)}</dc:title><dc:creator>Checklist Operativo</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString().slice(0, 19)}Z</dcterms:created></cp:coreProperties>`);
  files['xl/workbook.xml'] = strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets>${hojas.map((h, i) => `<sheet name="${esc(h.nombre.slice(0, 31))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets><definedNames>${definidos.join('')}</definedNames></workbook>`);
  files['xl/_rels/workbook.xml.rels'] = strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${hojas.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${hojas.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
  files['xl/styles.xml'] = strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="0.0&quot;%&quot;"/></numFmts><fonts count="3"><font><sz val="11"/><name val="Calibri"/><family val="2"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font><font><sz val="10"/><name val="Consolas"/><family val="3"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1D6B4F"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFF6D6"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment vertical="top"/></xf><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="top"/></xf><xf numFmtId="0" fontId="0" fillId="3" borderId="0" xfId="0" applyFill="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`);

  return zipSync(files, { level: 6 });
}

// ---------------------------------------------------------------- Contenido
const resultadoTexto = (r: { resultado: string | null }) =>
  r.resultado === 'no_aplica' ? 'No aplica' : r.resultado === 'no_cumple' ? 'Hallazgo' : r.resultado === 'cumple' ? 'Bien' : 'Sin respuesta';
const calif = (r: { calificacion: number | null; resultado: string | null }) =>
  r.calificacion ? `${r.calificacion}/5 ${etiquetaEstrellas(r.calificacion)}` : resultadoTexto(r);

const SEGUIMIENTO: Col[] = [
  { titulo: 'Estatus seguimiento', ancho: 110, estilo: 'seg' }, { titulo: 'Responsable seguimiento', ancho: 140, estilo: 'seg' },
  { titulo: 'Fecha compromiso', ancho: 95, estilo: 'seg' }, { titulo: 'Comentario seguimiento', ancho: 200, estilo: 'seg' },
];
const COLS_RESUMEN: Col[] = [
  { titulo: 'Folio', ancho: 105, estilo: 'mono' }, { titulo: 'Fecha', ancho: 120 }, { titulo: 'CR', ancho: 60, estilo: 'mono' },
  { titulo: 'Tienda', ancho: 150 }, { titulo: 'Plaza', ancho: 85 }, { titulo: 'RO', ancho: 170 }, { titulo: 'Evaluador', ancho: 130 },
  { titulo: '% Cumplimiento', ancho: 95, estilo: 'pct' }, { titulo: 'Preguntas', ancho: 70 }, { titulo: 'Bien (4-5)', ancho: 70 },
  { titulo: 'Hallazgos (1-3)', ancho: 80 }, { titulo: 'No aplican', ancho: 70 }, { titulo: 'Observaciones', ancho: 220 },
];
const COLS_HALLAZGOS: Col[] = [
  { titulo: 'Folio', ancho: 105, estilo: 'mono' }, { titulo: 'Fecha', ancho: 120 }, { titulo: 'CR', ancho: 60, estilo: 'mono' },
  { titulo: 'Tienda', ancho: 150 }, { titulo: 'Plaza', ancho: 85 }, { titulo: 'RO', ancho: 170 }, { titulo: 'Área', ancho: 90 },
  { titulo: 'Pregunta', ancho: 250 }, { titulo: 'Estrellas', ancho: 65 }, { titulo: 'Calificación', ancho: 90 }, { titulo: 'Comentario del hallazgo', ancho: 220 },
  ...SEGUIMIENTO,
];

const filaResumen = (ev: EvaluacionFull): Fila => ({
  celdas: [ev.folio, fmtDateTime(ev.fecha), ev.tienda.cr, ev.tienda.nombre, ev.tienda.plaza, ev.tienda.ro, ev.evaluador.nombre,
    ev.porcentaje, ev.total, ev.cumple, ev.noCumple, ev.noAplica, ev.observaciones],
});
const filasHallazgos = (ev: EvaluacionFull): Fila[] => ev.respuestas.filter(r => r.resultado === 'no_cumple').map(r => ({
  celdas: [ev.folio, fmtDateTime(ev.fecha), ev.tienda.cr, ev.tienda.nombre, ev.tienda.plaza, ev.tienda.ro, r.categoria, r.texto,
    r.calificacion, calif(r), r.comentario, '', '', '', ''],
  fotos: r.evidencias,
}));

/** Excel de una evaluación: Resumen, Detalle (con fotos) y Hallazgos (con fotos y seguimiento). */
export async function xlsxEvaluacion(ev: EvaluacionFull) {
  return armar([
    { nombre: 'Resumen', columnas: COLS_RESUMEN, filas: [filaResumen(ev)] },
    {
      nombre: 'Detalle', conFotos: true,
      columnas: [{ titulo: '#', ancho: 30 }, { titulo: 'Área', ancho: 90 }, { titulo: 'Pregunta', ancho: 260 }, { titulo: 'Estrellas', ancho: 65 },
        { titulo: 'Calificación', ancho: 90 }, { titulo: 'Resultado', ancho: 80 }, { titulo: 'Comentario', ancho: 220 }],
      filas: ev.respuestas.map((r, i) => ({ celdas: [i + 1, r.categoria, r.texto, r.calificacion, calif(r), resultadoTexto(r), r.comentario], fotos: r.evidencias })),
    },
    { nombre: 'Hallazgos', columnas: COLS_HALLAZGOS, filas: filasHallazgos(ev), conFotos: true },
  ], `Seguimiento ${ev.tienda.cr} ${ev.folio}`);
}

/** Excel de varias evaluaciones (Historial con filtros); fotos solo en los hallazgos. */
export async function xlsxHistorial(f: Filtros) {
  const rows = (await buscarEvaluaciones({ ...f, estado: f.estado || 'finalizada' }, 2000)).filter(r => r.estado === 'finalizada');
  const evs: EvaluacionFull[] = [];
  for (const r of rows) { const ev = await cargarEvaluacion(r.id); if (ev) evs.push(ev); }
  const hallazgos = evs.flatMap(filasHallazgos).sort((a, b) => String(a.celdas[5] ?? '').localeCompare(String(b.celdas[5] ?? '')) || String(a.celdas[3]).localeCompare(String(b.celdas[3])));
  const porRo = new Map<string, { evals: number; ps: number[]; hall: number; tiendas: Set<string> }>();
  for (const ev of evs) {
    const k = ev.tienda.ro || 'Sin RO';
    const x = porRo.get(k) ?? { evals: 0, ps: [], hall: 0, tiendas: new Set<string>() };
    x.evals++; x.hall += ev.noCumple; x.tiendas.add(ev.tienda.cr);
    if (ev.porcentaje != null) x.ps.push(ev.porcentaje);
    porRo.set(k, x);
  }
  return armar([
    { nombre: 'Resumen', columnas: COLS_RESUMEN, filas: evs.map(filaResumen) },
    { nombre: 'Hallazgos', columnas: COLS_HALLAZGOS, filas: hallazgos, conFotos: true },
    {
      nombre: 'Por RO',
      columnas: [{ titulo: 'RO', ancho: 190 }, { titulo: 'Tiendas evaluadas', ancho: 100 }, { titulo: 'Evaluaciones', ancho: 85 }, { titulo: '% Cumplimiento promedio', ancho: 130, estilo: 'pct' }, { titulo: 'Hallazgos', ancho: 75 }],
      filas: [...porRo.entries()].sort((a, b) => b[1].hall - a[1].hall).map(([ro, x]) => ({ celdas: [ro, x.tiendas.size, x.evals, x.ps.length ? Math.round((x.ps.reduce((s, p) => s + p, 0) / x.ps.length) * 10) / 10 : null, x.hall] })),
    },
  ], 'Seguimiento Checklist Operativo');
}

export const nombreXlsx = (base: string) => `${base.replace(/[\\/:*?"<>|]+/g, '').slice(0, 90)}.xlsx`;
export const MIME_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
