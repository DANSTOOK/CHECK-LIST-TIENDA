import { db } from '@/lib/db';
import { fail, handler, ok, str } from '@/lib/api';

type Ctx = { params: Promise<{ id: string }> };
const REGLAS = ['siempre', 'no_cumple', 'opcional'];

/**
 * Edita una pregunta, la activa/desactiva o la mueve (mover: 'up' | 'down').
 * Editar NO cambia evaluaciones pasadas: cada respuesta guardó su propia copia.
 */
export const PATCH = handler<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const b = await req.json();
  const p = await db.selectFrom('preguntas').selectAll().where('id', '=', id).executeTakeFirst();
  if (!p) return fail('Pregunta no encontrada', 404);

  if (b.mover === 'up' || b.mover === 'down') {
    const vecino = await db.selectFrom('preguntas').select(['id', 'orden'])
      .where('categoria_id', '=', p.categoria_id).where('checklist_id', '=', p.checklist_id)
      .where('orden', b.mover === 'up' ? '<' : '>', p.orden)
      .orderBy('orden', b.mover === 'up' ? 'desc' : 'asc').executeTakeFirst();
    if (vecino) {
      await db.updateTable('preguntas').set({ orden: vecino.orden }).where('id', '=', p.id).execute();
      await db.updateTable('preguntas').set({ orden: p.orden }).where('id', '=', vecino.id).execute();
    }
    return ok({ id });
  }
  if (typeof b.activa === 'boolean' && b.texto === undefined) {
    await db.updateTable('preguntas').set({ activa: b.activa }).where('id', '=', id).execute();
    return ok({ id });
  }
  const texto = str(b.texto), categoria_id = str(b.categoriaId);
  if (!texto || !categoria_id) return fail('Escribe la pregunta y elige su categoría');
  let orden = p.orden;
  if (categoria_id !== p.categoria_id) {
    const { m } = await db.selectFrom('preguntas').select(db.fn.max('orden').as('m')).where('categoria_id', '=', categoria_id).executeTakeFirstOrThrow();
    orden = Number(m ?? 0) + 1;
  }
  await db.updateTable('preguntas').set({
    texto, categoria_id, orden, ayuda: str(b.ayuda),
    evidencia: REGLAS.includes(String(b.evidencia)) ? String(b.evidencia) : 'no_cumple',
    peso: Math.min(10, Math.max(1, Number(b.peso) || 1)),
  }).where('id', '=', id).execute();
  return ok({ id });
}, { admin: true });

/** Si ya se usó en evaluaciones se desactiva (el historial la conserva); si no, se borra. */
export const DELETE = handler<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  const { n } = await db.selectFrom('respuestas').select(db.fn.countAll<number>().as('n')).where('pregunta_id', '=', id).executeTakeFirstOrThrow();
  if (Number(n) > 0) {
    await db.updateTable('preguntas').set({ activa: false }).where('id', '=', id).execute();
    return ok({ desactivada: true });
  }
  await db.deleteFrom('preguntas').where('id', '=', id).execute();
  return ok({ eliminada: true });
}, { admin: true });
