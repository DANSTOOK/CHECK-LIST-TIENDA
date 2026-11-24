// Datos de la vista de evaluación: modo captura (Runner) o resultado.
import { getCurrentUser } from '@/lib/auth';
import { cargarEvaluacion, evaluacionAnterior } from '@/lib/evaluaciones';

export async function loadEvaluacion(id: string) {
  const [ev, user] = await Promise.all([cargarEvaluacion(id), getCurrentUser()]);
  if (!ev || !user) return null;
  const puedeEditar = ev.estado === 'borrador' && (ev.evaluador.id === user.id || user.rol === 'admin');
  const anterior = puedeEditar ? null : await evaluacionAnterior(ev);
  return { ev, puedeEditar, anterior };
}
export type EvaluacionViewData = NonNullable<Awaited<ReturnType<typeof loadEvaluacion>>>;
