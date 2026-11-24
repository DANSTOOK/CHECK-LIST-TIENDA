// Sesión del modo demo: igual que el "modo local" (la persona elige su nombre).
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
export const entraEnabled = false;
export const LOCAL_COOKIE = 'ckl-uid';
export const authOptions = {};
export type CurrentUser = { id: string; nombre: string; email: string | null; rol: string };
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const id = (await cookies()).get(LOCAL_COOKIE)?.value;
  if (!id) return null;
  const u = await db.selectFrom('usuarios').select(['id', 'nombre', 'email', 'rol', 'activo']).where('id', '=', id).executeTakeFirst();
  return u && u.activo ? { id: u.id, nombre: u.nombre, email: u.email, rol: u.rol } : null;
}
