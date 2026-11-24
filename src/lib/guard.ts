import { db } from './db';
import { fail } from './api';
import type { CurrentUser } from './auth';

/** Solo el evaluador (o un admin) puede modificar, y solo mientras está en borrador. */
export async function editable(id: string, user: CurrentUser) {
  const ev = await db.selectFrom('evaluaciones').select(['id', 'estado', 'evaluador_id', 'folio', 'tienda_id']).where('id', '=', id).executeTakeFirst();
  if (!ev) return { error: fail('Evaluación no encontrada', 404) };
  if (ev.estado !== 'borrador') return { error: fail('La evaluación ya está finalizada y no se puede modificar', 409) };
  if (ev.evaluador_id !== user.id && user.rol !== 'admin') return { error: fail('Solo quien realiza la evaluación puede modificarla', 403) };
  return { ev };
}
