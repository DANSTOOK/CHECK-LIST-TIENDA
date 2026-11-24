import { db, newId } from '@/lib/db';
import { fail, handler, ok, str } from '@/lib/api';

export const POST = handler(async req => {
  const b = await req.json();
  const nombre = str(b.nombre);
  if (!nombre) return fail('Escribe el nombre de la categoría');
  if (await db.selectFrom('categorias').select('id').where('nombre', '=', nombre).executeTakeFirst()) return fail('Ya existe esa categoría', 409);
  const { m } = await db.selectFrom('categorias').select(db.fn.max('orden').as('m')).executeTakeFirstOrThrow();
  const id = newId();
  await db.insertInto('categorias').values({ id, nombre, color: str(b.color) || '#1d6b4f', orden: Number(m ?? 0) + 1 }).execute();
  return ok({ id }, 201);
}, { admin: true });
