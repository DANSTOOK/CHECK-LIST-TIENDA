import { db, now } from '@/lib/db';
import { handler, ok } from '@/lib/api';
import { recalcular } from '@/lib/evaluaciones';
import { faltaFoto } from '@/lib/score';
import { editable } from '@/lib/guard';

type Ctx = { params: Promise<{ id: string }> };

/**
 * Cierra la evaluación. Valida que todas las preguntas tengan respuesta, que las
 * que exigen foto la tengan y que cada "No cumple" lleve comentario.
 * Una vez finalizada ya no se puede editar (queda como registro de auditoría).
 */
export const POST = handler<Ctx>(async (_req, { params }, user) => {
  const { id } = await params;
  const { error } = await editable(id, user);
  if (error) return error;
  const resps = await db.selectFrom('respuestas').select(['id', 'orden', 'resultado', 'comentario', 'peso', 'evidencia_regla'])
    .where('evaluacion_id', '=', id).orderBy('orden').execute();
  const fotos = await db.selectFrom('evidencias').select(['respuesta_id']).where('evaluacion_id', '=', id).execute();
  const problemas: { id: string; orden: number; motivo: string }[] = [];
  for (const r of resps) {
    const n = fotos.filter(f => f.respuesta_id === r.id).length;
    if (!r.resultado) problemas.push({ id: r.id, orden: r.orden, motivo: 'Sin respuesta' });
    else if (faltaFoto({ resultado: r.resultado, peso: r.peso, evidenciaRegla: r.evidencia_regla, _fotos: n })) problemas.push({ id: r.id, orden: r.orden, motivo: 'Falta la foto de evidencia' });
    else if (r.resultado === 'no_cumple' && !r.comentario) problemas.push({ id: r.id, orden: r.orden, motivo: 'Describe el hallazgo en el comentario' });
  }
  if (problemas.length) return Response.json({ error: 'Faltan datos para finalizar', problemas }, { status: 422 });
  await recalcular(id);
  const ts = now();
  await db.updateTable('evaluaciones').set({ estado: 'finalizada', finalizada_at: ts, fecha: ts, updated_at: ts }).where('id', '=', id).execute();
  return ok({ ok: true });
});

