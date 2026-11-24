import { db } from '@/lib/db';
import { fail, handler, ok, str } from '@/lib/api';

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handler<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const b = await req.json();
  const nombre = str(b.nombre);
  if (!nombre) return fail('Escribe el nombre de la categoría');
  if (await db.selectFrom('categorias').select('id').where('nombre', '=', nombre).where('id', '!=', id).executeTakeFirst()) return fail('Ya existe esa categoría', 409);
  await db.updateTable('categorias').set({ nombre, color: str(b.color) || '#1d6b4f' }).where('id', '=', id).execute();
  return ok({ id });
}, { admin: true });

export const DELETE = handler<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  const { n } = await db.selectFrom('preguntas').select(db.fn.countAll<number>().as('n')).where('categoria_id', '=', id).executeTakeFirstOrThrow();
  if (Number(n) > 0) return fail('La categoría tiene preguntas. Muévelas o elimínalas primero.', 409);
  await db.deleteFrom('categorias').where('id', '=', id).execute();
  return ok({ ok: true });
}, { admin: true });
