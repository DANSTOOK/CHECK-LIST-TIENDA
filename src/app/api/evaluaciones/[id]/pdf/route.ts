import { fail, handler } from '@/lib/api';
import { cargarEvaluacion, evaluacionAnterior } from '@/lib/evaluaciones';
import { generarPdf } from '@/lib/pdf';

type Ctx = { params: Promise<{ id: string }> };

export const GET = handler<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const ev = await cargarEvaluacion(id);
  if (!ev) return fail('Evaluación no encontrada', 404);
  const pdf = await generarPdf(ev, await evaluacionAnterior(ev));
  const name = `Checklist_${ev.tienda.cr}_${ev.folio}.pdf`;
  const inline = new URL(req.url).searchParams.has('ver');
  return new Response(new Uint8Array(pdf), {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${name}"` },
  });
});
