// Excel de seguimiento de varias evaluaciones (filtros del Historial); fotos en los hallazgos.
import { handler } from '@/lib/api';
import { leerFiltros } from '@/lib/stats';
import { MIME_XLSX, nombreXlsx, xlsxHistorial } from '@/lib/xlsx';

export const GET = handler(async req => {
  const sp = Object.fromEntries(new URL(req.url).searchParams.entries());
  const f = leerFiltros(sp, { estado: 'finalizada' });
  const hoy = new Date().toISOString().slice(0, 10);
  const name = nombreXlsx(`Seguimiento_Checklist_${f.ro ? f.ro.split(' ')[0] + '_' : ''}${hoy}`);
  return new Response(new Uint8Array(await xlsxHistorial(f)), {
    headers: { 'Content-Type': MIME_XLSX, 'Content-Disposition': `attachment; filename="${name}"` },
  });
});
