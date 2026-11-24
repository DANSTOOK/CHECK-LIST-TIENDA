import { db } from '@/lib/db';
import { entraEnabled, getCurrentUser } from '@/lib/auth';

/** Solo administradores: devuelve null para cualquier otro rol. */
export async function loadAdminPreguntas() {
  const user = await getCurrentUser();
  if (user?.rol !== 'admin') return null;
  void entraEnabled;
  const [categorias, preguntas, usadas] = await Promise.all([
    db.selectFrom('categorias').selectAll().orderBy('orden').execute(),
    db.selectFrom('preguntas').selectAll().orderBy('orden').execute(),
    db.selectFrom('respuestas').select(['pregunta_id', db.fn.countAll<number>().as('n')]).where('pregunta_id', 'is not', null).groupBy('pregunta_id').execute(),
  ]);
  const uso = Object.fromEntries(usadas.map(u => [u.pregunta_id, Number(u.n)]));
  return { categorias, preguntas: preguntas.map(p => ({ ...p, activa: !!p.activa, usos: uso[p.id] ?? 0 })) };
}
