import { db } from '@/lib/db';
import { entraEnabled, getCurrentUser } from '@/lib/auth';

/** Solo administradores: devuelve null para cualquier otro rol. */
export async function loadAdminUsuarios() {
  const user = await getCurrentUser();
  if (user?.rol !== 'admin') return null;
  void entraEnabled;
  const usuarios = await db.selectFrom('usuarios').selectAll().orderBy('nombre').execute();
  return { usuarios: usuarios.map(u => ({ ...u, activo: !!u.activo })), yo: user.id, entra: entraEnabled };
}
