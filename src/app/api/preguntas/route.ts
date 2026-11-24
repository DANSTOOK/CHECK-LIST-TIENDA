import { db, newId, now } from '@/lib/db';
import { fail, handler, ok, str } from '@/lib/api';

const REGLAS = ['siempre', 'no_cumple', 'opcional'];

function datosPregunta(b: Record<string, unknown>) {
  const texto = str(b.texto);
  const categoria_id = str(b.categoriaId);
  if (!texto || !categoria_id) return null;
  return {
    texto, categoria_id, ayuda: str(b.ayuda),
    evidencia: REGLAS.includes(String(b.evidencia)) ? String(b.evidencia) : 'no_cumple',
    peso: Math.min(10, Math.max(1, Number(b.peso) || 1)),
  };
}

/** Las preguntas nuevas aplican a las evaluaciones que se inicien desde ahora. */
export const POST = handler(async req => {
  const d = datosPregunta(await req.json());
  if (!d) return fail('Escribe la pregunta y elige su categoría');
  const checklist = await db.selectFrom('checklist').select('id').where('activo', '=', true).orderBy('created_at').executeTakeFirstOrThrow();
  const { m } = await db.selectFrom('preguntas').select(db.fn.max('orden').as('m')).where('categoria_id', '=', d.categoria_id).executeTakeFirstOrThrow();
  const id = newId();
  await db.insertInto('preguntas').values({ id, checklist_id: checklist.id, ...d, orden: Number(m ?? 0) + 1, activa: true, created_at: now() }).execute();
  return ok({ id }, 201);
}, { admin: true });
