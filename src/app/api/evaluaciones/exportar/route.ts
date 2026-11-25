// XML de seguimiento de varias evaluaciones, con los mismos filtros del Historial.
import { handler } from '@/lib/api';
import { leerFiltros } from '@/lib/stats';
import { nombreXml, xmlHistorial } from '@/lib/xml';

export const GET = handler(async req => {
  const sp = Object.fromEntries(new URL(req.url).searchParams.entries());
  const f = leerFiltros(sp, { estado: 'finalizada' });
  const hoy = new Date().toISOString().slice(0, 10);
  const name = nombreXml(`Seguimiento_Checklist_${f.ro ? f.ro.split(' ')[0] + '_' : ''}${hoy}`);
  return new Response(await xmlHistorial(f), {
    headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Content-Disposition': `attachment; filename="${name}"` },
  });
});
