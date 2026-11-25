// Excel de seguimiento de una evaluación, con las fotos junto a cada punto.
import { fail, handler } from '@/lib/api';
import { cargarEvaluacion } from '@/lib/evaluaciones';
import { MIME_XLSX, nombreXlsx, xlsxEvaluacion } from '@/lib/xlsx';

type Ctx = { params: Promise<{ id: string }> };

export const GET = handler<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  const ev = await cargarEvaluacion(id);
  if (!ev) return fail('Evaluación no encontrada', 404);
  const name = nombreXlsx(`Seguimiento_${ev.tienda.cr}_${ev.folio}`);
  return new Response(new Uint8Array(await xlsxEvaluacion(ev)), {
    headers: { 'Content-Type': MIME_XLSX, 'Content-Disposition': `attachment; filename="${name}"` },
  });
});
