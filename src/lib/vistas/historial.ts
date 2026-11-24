// Datos de la vista "historial" (los usa la página en el servidor y el modo demo).
import { db } from '@/lib/db';
import { buscarEvaluaciones, leerFiltros, opcionesFiltro, porMes, resumen } from '@/lib/stats';

export async function loadHistorial(sp: Record<string, string | string[] | undefined>) {
  const f = leerFiltros(sp, { estado: 'finalizada' });
  const [rows, usuarios, { plazas, ros }] = await Promise.all([
    buscarEvaluaciones(f, 1000),
    db.selectFrom('usuarios').select(['id', 'nombre']).orderBy('nombre').execute(),
    opcionesFiltro(),
  ]);
  const s = resumen(rows);
  const meses = porMes(rows);

  return { f, rows, usuarios, plazas, ros, s, meses };
}
export type HistorialViewData = NonNullable<Awaited<ReturnType<typeof loadHistorial>>>;
