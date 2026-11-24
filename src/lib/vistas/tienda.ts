// Datos de la vista "tienda" (los usa la página en el servidor y el modo demo).
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { fmtDate, trend } from '@/lib/format';

export async function loadTienda(crParam: string) {
  const cr = decodeURIComponent(crParam);
  const tienda = await db.selectFrom('tiendas').selectAll().where('cr', '=', cr).executeTakeFirst();
  if (!tienda) return null;
  const user = await getCurrentUser();
  if (!user) return null;
  const evals = (await db.selectFrom('evaluaciones').innerJoin('usuarios', 'usuarios.id', 'evaluaciones.evaluador_id')
    .select(['evaluaciones.id', 'folio', 'fecha', 'estado', 'porcentaje', 'cumple', 'no_cumple', 'no_aplica', 'total', 'usuarios.nombre as evaluador', 'evaluador_id'])
    .where('tienda_id', '=', tienda.id).orderBy('fecha', 'desc').execute())
    .map(e => ({ ...e, porcentaje: e.porcentaje == null ? null : Number(e.porcentaje) }));
  const fin = evals.filter(e => e.estado === 'finalizada');
  const borrador = evals.find(e => e.estado === 'borrador' && e.evaluador_id === user.id);
  const [ultima, anterior] = fin;
  const t = trend(ultima?.porcentaje, anterior?.porcentaje);
  const primera = fin[fin.length - 1];
  const areas = fin.length
    ? (await db.selectFrom('respuestas').select(['categoria']).where('evaluacion_id', 'in', fin.map(e => e.id)).where('resultado', '=', 'no_cumple').execute())
    : [];
  const areaData = [...areas.reduce((m, r) => m.set(r.categoria, (m.get(r.categoria) ?? 0) + 1), new Map<string, number>())].map(([name, value]) => ({ name, value }));
  const serie = [...fin].reverse().map(e => ({ fecha: fmtDate(e.fecha, { day: 'numeric', month: 'short', year: '2-digit' }), cumplimiento: e.porcentaje }));

  return { tienda, user, evals, fin, borrador, ultima, anterior, t, primera, areaData, serie };
}
export type TiendaViewData = NonNullable<Awaited<ReturnType<typeof loadTienda>>>;
