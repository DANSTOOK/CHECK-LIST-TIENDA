// XML de seguimiento de una evaluación (se abre en Excel).
import { fail, handler } from '@/lib/api';
import { cargarEvaluacion } from '@/lib/evaluaciones';
import { nombreXml, xmlEvaluacion } from '@/lib/xml';

type Ctx = { params: Promise<{ id: string }> };

export const GET = handler<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  const ev = await cargarEvaluacion(id);
  if (!ev) return fail('Evaluación no encontrada', 404);
  const name = nombreXml(`Seguimiento_${ev.tienda.cr}_${ev.folio}`);
  return new Response(xmlEvaluacion(ev), {
    headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Content-Disposition': `attachment; filename="${name}"` },
  });
});
