import { db, newId, now } from '@/lib/db';
import { fail, handler, ok, str } from '@/lib/api';

const ROLES = ['evaluador', 'admin', 'consulta'];

export const POST = handler(async req => {
  const b = await req.json();
  const nombre = str(b.nombre);
  if (!nombre) return fail('Escribe el nombre');
  const email = str(b.email)?.toLowerCase() ?? null;
  if (email && (await db.selectFrom('usuarios').select('id').where('email', '=', email).executeTakeFirst())) return fail('Ese correo ya está registrado', 409);
  const id = newId();
  await db.insertInto('usuarios').values({ id, nombre, email, rol: ROLES.includes(b.rol) ? b.rol : 'evaluador', activo: true, created_at: now() }).execute();
  return ok({ id }, 201);
}, { admin: true });
