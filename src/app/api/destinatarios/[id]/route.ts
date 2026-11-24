import { db } from '@/lib/db';
import { fail, handler, ok, str } from '@/lib/api';

type Ctx = { params: Promise<{ id: string }> };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const PATCH = handler<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const b = await req.json();
  const nombre = str(b.nombre), email = str(b.email)?.toLowerCase();
  if (!nombre || !email || !EMAIL.test(email)) return fail('Escribe nombre y un correo válido');
  await db.updateTable('destinatarios_correo').set({
    nombre, email, tipo: b.tipo === 'cc' ? 'cc' : 'to', categoria_id: str(b.categoriaId), plaza: str(b.plaza),
    activo: b.activo === undefined ? true : !!b.activo,
  }).where('id', '=', id).execute();
  return ok({ id });
}, { admin: true });

export const DELETE = handler<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  await db.deleteFrom('destinatarios_correo').where('id', '=', id).execute();
  return ok({ ok: true });
}, { admin: true });
