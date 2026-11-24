// Sesión en "modo local" (sin Entra ID): la persona elige o escribe su nombre.
import { cookies } from 'next/headers';
import { db, newId, now } from '@/lib/db';
import { entraEnabled, getCurrentUser, LOCAL_COOKIE } from '@/lib/auth';
import { fail, ok, str } from '@/lib/api';

export async function GET() {
  const usuarios = entraEnabled ? [] : await db.selectFrom('usuarios').select(['id', 'nombre', 'rol']).where('activo', '=', true).orderBy('nombre').execute();
  return ok({ entra: entraEnabled, usuario: await getCurrentUser(), usuarios });
}

export async function POST(req: Request) {
  if (entraEnabled) return fail('La sesión se inicia con tu cuenta Microsoft', 400);
  const body = await req.json();
  let id = str(body.usuarioId);
  if (!id) {
    const nombre = str(body.nombre);
    if (!nombre) return fail('Escribe tu nombre');
    const existe = await db.selectFrom('usuarios').select('id').where('nombre', '=', nombre).executeTakeFirst();
    id = existe?.id ?? newId();
    if (!existe) await db.insertInto('usuarios').values({ id, nombre, email: null, rol: 'evaluador', activo: true, created_at: now() }).execute();
  }
  const u = await db.selectFrom('usuarios').select(['id', 'activo']).where('id', '=', id).executeTakeFirst();
  if (!u || !u.activo) return fail('Usuario no válido', 404);
  (await cookies()).set(LOCAL_COOKIE, id, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 180 });
  return ok({ ok: true });
}

export async function DELETE() {
  (await cookies()).delete(LOCAL_COOKIE);
  return ok({ ok: true });
}
