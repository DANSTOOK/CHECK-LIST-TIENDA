import { db, newId, now } from '@/lib/db';
import { fail, handler, ok, str } from '@/lib/api';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function datosDestinatario(b: Record<string, unknown>) {
  const nombre = str(b.nombre), email = str(b.email)?.toLowerCase();
  if (!nombre || !email || !EMAIL.test(email)) return null;
  return { nombre, email, tipo: b.tipo === 'cc' ? 'cc' : 'to', categoria_id: str(b.categoriaId), plaza: str(b.plaza), activo: b.activo === undefined ? true : !!b.activo };
}

export const POST = handler(async req => {
  const d = datosDestinatario(await req.json());
  if (!d) return fail('Escribe nombre y un correo válido');
  const id = newId();
  await db.insertInto('destinatarios_correo').values({ id, ...d, created_at: now() }).execute();
  return ok({ id }, 201);
}, { admin: true });
