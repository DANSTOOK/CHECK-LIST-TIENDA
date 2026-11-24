import { db } from '@/lib/db';
import { fail, handler, ok, str } from '@/lib/api';

type Ctx = { params: Promise<{ id: string }> };
const ROLES = ['evaluador', 'admin', 'consulta'];

export const PATCH = handler<Ctx>(async (req, { params }, user) => {
  const { id } = await params;
  const b = await req.json();
  const nombre = str(b.nombre);
  if (!nombre) return fail('Escribe el nombre');
  const rol = ROLES.includes(b.rol) ? b.rol : 'evaluador';
  const activo = b.activo === undefined ? true : !!b.activo;
  if (id === user.id && (rol !== 'admin' || !activo)) return fail('No puedes quitarte el rol de administrador ni desactivarte a ti mismo');
  await db.updateTable('usuarios').set({ nombre, email: str(b.email)?.toLowerCase() ?? null, rol, activo }).where('id', '=', id).execute();
  return ok({ id });
}, { admin: true });
