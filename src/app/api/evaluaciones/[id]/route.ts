import { db } from '@/lib/db';
import { handler, ok } from '@/lib/api';
import { editable } from '@/lib/guard';
import { recalcular } from '@/lib/evaluaciones';
import { resultadoDe } from '@/lib/score';
import { storage } from '@/lib/storage';

type Ctx = { params: Promise<{ id: string }> };
const RES = new Set(['cumple', 'no_cumple', 'no_aplica']);

/** Guarda respuestas (autoguardado) y observaciones. */
export const PATCH = handler<Ctx>(async (req, { params }, user) => {
  const { id } = await params;
  const { error } = await editable(id, user);
  if (error) return error;
  const b = (await req.json()) as {
    observaciones?: string | null;
    respuestas?: { id: string; resultado?: string | null; calificacion?: number | null; comentario?: string | null }[];
  };
  await db.transaction().execute(async tx => {
    for (const r of b.respuestas ?? []) {
      const set: { resultado?: string | null; calificacion?: number | null; comentario?: string | null } = {};
      if (r.resultado !== undefined) { set.resultado = r.resultado && RES.has(r.resultado) ? r.resultado : null; set.calificacion = null; }
      // Estrellas 1 a 5: el resultado se deriva (4-5 cumple, 1-3 no cumple).
      if (r.calificacion !== undefined) {
        const n = Number(r.calificacion);
        if (r.calificacion === null) { set.calificacion = null; set.resultado = null; }
        else if (Number.isInteger(n) && n >= 1 && n <= 5) { set.calificacion = n; set.resultado = resultadoDe(n); }
      }
      if (r.comentario !== undefined) set.comentario = r.comentario?.trim() ? r.comentario.slice(0, 2000) : null;
      if (Object.keys(set).length) await tx.updateTable('respuestas').set(set).where('id', '=', r.id).where('evaluacion_id', '=', id).execute();
    }
    if (b.observaciones !== undefined) {
      await tx.updateTable('evaluaciones').set({ observaciones: b.observaciones?.trim() ? b.observaciones.slice(0, 4000) : null }).where('id', '=', id).execute();
    }
  });
  return ok(await recalcular(id));
});

/** Descarta un borrador (con sus fotos). */
export const DELETE = handler<Ctx>(async (_req, { params }, user) => {
  const { id } = await params;
  const { error } = await editable(id, user);
  if (error) return error;
  const fotos = await db.selectFrom('evidencias').select('ruta').where('evaluacion_id', '=', id).execute();
  await db.deleteFrom('evaluaciones').where('id', '=', id).execute();
  await Promise.all(fotos.map(f => storage().remove(f.ruta).catch(() => {})));
  return ok({ ok: true });
});
