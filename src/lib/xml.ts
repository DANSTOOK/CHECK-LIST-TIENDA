/**
 * XML de seguimiento (formato "Hoja de cálculo XML 2003" / SpreadsheetML).
 * Es un archivo .xml que Excel abre directamente con varias hojas, encabezados con
 * formato y columnas listas para dar seguimiento con los RO (estatus, responsable,
 * fecha compromiso y comentario de seguimiento, que quedan en blanco para llenar).
 * No requiere librerías: es texto XML, funciona igual en el servidor y en la versión
 * publicada en GitHub Pages.
 */
import { cargarEvaluacion, type EvaluacionFull } from './evaluaciones';
import { buscarEvaluaciones, type Filtros } from './stats';
import { etiquetaEstrellas } from './score';
import { fmtDateTime } from './format';

type Celda = string | number | null | undefined;
type Hoja = { nombre: string; columnas: { titulo: string; ancho: number; estilo?: string }[]; filas: Celda[][] };

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))
  // caracteres de control no válidos en XML
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');

function celda(v: Celda, estilo?: string) {
  const s = estilo ? ` ss:StyleID="${estilo}"` : '';
  if (v == null || v === '') return `<Cell${s}/>`;
  if (typeof v === 'number' && Number.isFinite(v)) return `<Cell${s}><Data ss:Type="Number">${v}</Data></Cell>`;
  return `<Cell${s}><Data ss:Type="String">${esc(String(v))}</Data></Cell>`;
}

function libro(hojas: Hoja[]) {
  const ws = hojas.map(h => `
 <Worksheet ss:Name="${esc(h.nombre.slice(0, 31))}">
  <Table>
${h.columnas.map(c => `   <Column ss:Width="${c.ancho}"/>`).join('\n')}
   <Row ss:Height="22">${h.columnas.map(c => celda(c.titulo, 'th')).join('')}</Row>
${h.filas.map(f => `   <Row>${f.map((v, i) => celda(v, h.columnas[i]?.estilo)).join('')}</Row>`).join('\n')}
  </Table>
  <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
   <FreezePanes/><FrozenNoSplit/><SplitHorizontal>1</SplitHorizontal><TopRowBottomPane>1</TopRowBottomPane><ActivePane>2</ActivePane>
  </WorksheetOptions>
  <AutoFilter x:Range="R1C1:R${h.filas.length + 1}C${h.columnas.length}" xmlns="urn:schemas-microsoft-com:office:excel"/>
 </Worksheet>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet" xmlns:html="http://www.w3.org/TR/REC-html40">
 <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office"><Title>Seguimiento Checklist Operativo</Title><Created>${new Date().toISOString().slice(0, 19)}Z</Created></DocumentProperties>
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal"><Alignment ss:Vertical="Top" ss:WrapText="1"/><Font ss:FontName="Calibri" ss:Size="11"/></Style>
  <Style ss:ID="th"><Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#1D6B4F" ss:Pattern="Solid"/><Alignment ss:Vertical="Center" ss:WrapText="1"/></Style>
  <Style ss:ID="pct"><NumberFormat ss:Format="0.0&quot;%&quot;"/></Style>
  <Style ss:ID="mono"><Font ss:FontName="Consolas" ss:Size="10"/></Style>
  <Style ss:ID="seg"><Interior ss:Color="#FFF6D6" ss:Pattern="Solid"/></Style>
  <Style ss:ID="b"><Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1"/></Style>
 </Styles>${ws}
</Workbook>
`;
}

const resultadoTexto = (r: { resultado: string | null; calificacion: number | null }) =>
  r.resultado === 'no_aplica' ? 'No aplica' : r.resultado === 'no_cumple' ? 'Hallazgo' : r.resultado === 'cumple' ? 'Bien' : 'Sin respuesta';

// Columnas para que quien da seguimiento las llene (resaltadas en amarillo).
const SEGUIMIENTO = [
  { titulo: 'Estatus seguimiento', ancho: 110, estilo: 'seg' },
  { titulo: 'Responsable seguimiento', ancho: 140, estilo: 'seg' },
  { titulo: 'Fecha compromiso', ancho: 95, estilo: 'seg' },
  { titulo: 'Comentario seguimiento', ancho: 200, estilo: 'seg' },
];

const COLS_RESUMEN = [
  { titulo: 'Folio', ancho: 105, estilo: 'mono' }, { titulo: 'Fecha', ancho: 115 }, { titulo: 'CR', ancho: 60, estilo: 'mono' },
  { titulo: 'Tienda', ancho: 150 }, { titulo: 'Plaza', ancho: 85 }, { titulo: 'RO', ancho: 170 }, { titulo: 'Evaluador', ancho: 130 },
  { titulo: '% Cumplimiento', ancho: 90, estilo: 'pct' }, { titulo: 'Preguntas', ancho: 65 }, { titulo: 'Bien (4-5)', ancho: 65 },
  { titulo: 'Hallazgos (1-3)', ancho: 75 }, { titulo: 'No aplican', ancho: 65 }, { titulo: 'Observaciones', ancho: 220 },
];
const COLS_HALLAZGOS = [
  { titulo: 'Folio', ancho: 105, estilo: 'mono' }, { titulo: 'Fecha', ancho: 115 }, { titulo: 'CR', ancho: 60, estilo: 'mono' },
  { titulo: 'Tienda', ancho: 150 }, { titulo: 'Plaza', ancho: 85 }, { titulo: 'RO', ancho: 170 }, { titulo: 'Área', ancho: 90 },
  { titulo: 'Pregunta', ancho: 260 }, { titulo: 'Estrellas', ancho: 60 }, { titulo: 'Calificación', ancho: 85 }, { titulo: 'Comentario del hallazgo', ancho: 230 },
  { titulo: 'Fotos', ancho: 45 }, ...SEGUIMIENTO,
];

function filaResumen(ev: EvaluacionFull) {
  return [ev.folio, fmtDateTime(ev.fecha), ev.tienda.cr, ev.tienda.nombre, ev.tienda.plaza, ev.tienda.ro, ev.evaluador.nombre,
    ev.porcentaje, ev.total, ev.cumple, ev.noCumple, ev.noAplica, ev.observaciones];
}
function filasHallazgos(ev: EvaluacionFull) {
  return ev.respuestas.filter(r => r.resultado === 'no_cumple').map(r => [
    ev.folio, fmtDateTime(ev.fecha), ev.tienda.cr, ev.tienda.nombre, ev.tienda.plaza, ev.tienda.ro, r.categoria, r.texto,
    r.calificacion, r.calificacion ? `${r.calificacion}/5 ${etiquetaEstrellas(r.calificacion)}` : 'No cumple', r.comentario, r.evidencias.length, '', '', '', '',
  ]);
}

/** XML de una evaluación: Resumen, Detalle por pregunta y Hallazgos para seguimiento. */
export function xmlEvaluacion(ev: EvaluacionFull) {
  return libro([
    { nombre: 'Resumen', columnas: COLS_RESUMEN, filas: [filaResumen(ev)] },
    {
      nombre: 'Detalle',
      columnas: [
        { titulo: '#', ancho: 30 }, { titulo: 'Área', ancho: 90 }, { titulo: 'Pregunta', ancho: 280 }, { titulo: 'Estrellas', ancho: 60 },
        { titulo: 'Calificación', ancho: 85 }, { titulo: 'Resultado', ancho: 80 }, { titulo: 'Comentario', ancho: 240 }, { titulo: 'Fotos', ancho: 45 },
      ],
      filas: ev.respuestas.map((r, i) => [i + 1, r.categoria, r.texto, r.calificacion, r.calificacion ? `${r.calificacion}/5 ${etiquetaEstrellas(r.calificacion)}` : resultadoTexto(r), resultadoTexto(r), r.comentario, r.evidencias.length]),
    },
    { nombre: 'Hallazgos', columnas: COLS_HALLAZGOS, filas: filasHallazgos(ev) },
  ]);
}

/**
 * XML de varias evaluaciones (Historial con filtros): Resumen por evaluación,
 * Hallazgos (una fila por hallazgo, ordenados por RO) y Por RO (totales).
 */
export async function xmlHistorial(f: Filtros) {
  const rows = (await buscarEvaluaciones({ ...f, estado: f.estado || 'finalizada' }, 2000)).filter(r => r.estado === 'finalizada');
  const evs: EvaluacionFull[] = [];
  for (const r of rows) { const ev = await cargarEvaluacion(r.id); if (ev) evs.push(ev); }
  const hallazgos = evs.flatMap(filasHallazgos).sort((a, b) => String(a[5] ?? '').localeCompare(String(b[5] ?? '')) || String(a[3]).localeCompare(String(b[3])));
  const porRo = new Map<string, { evals: number; ps: number[]; hall: number; tiendas: Set<string> }>();
  for (const ev of evs) {
    const k = ev.tienda.ro || 'Sin RO';
    const x = porRo.get(k) ?? { evals: 0, ps: [], hall: 0, tiendas: new Set<string>() };
    x.evals++; x.hall += ev.noCumple; x.tiendas.add(ev.tienda.cr);
    if (ev.porcentaje != null) x.ps.push(ev.porcentaje);
    porRo.set(k, x);
  }
  return libro([
    { nombre: 'Resumen', columnas: COLS_RESUMEN, filas: evs.map(filaResumen) },
    { nombre: 'Hallazgos', columnas: COLS_HALLAZGOS, filas: hallazgos },
    {
      nombre: 'Por RO',
      columnas: [{ titulo: 'RO', ancho: 190 }, { titulo: 'Tiendas evaluadas', ancho: 95 }, { titulo: 'Evaluaciones', ancho: 80 }, { titulo: '% Cumplimiento promedio', ancho: 120, estilo: 'pct' }, { titulo: 'Hallazgos', ancho: 70 }],
      filas: [...porRo.entries()].sort((a, b) => b[1].hall - a[1].hall).map(([ro, x]) => [ro, x.tiendas.size, x.evals, x.ps.length ? Math.round((x.ps.reduce((s, p) => s + p, 0) / x.ps.length) * 10) / 10 : null, x.hall]),
    },
  ]);
}

export const nombreXml = (base: string) => `${base.replace(/[\\/:*?"<>|]+/g, '').slice(0, 90)}.xml`;
