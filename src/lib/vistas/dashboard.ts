// Datos de la vista "dashboard" (los usa la página en el servidor y el modo demo).
import { buscarEvaluaciones, hallazgosPorArea, leerFiltros, opcionesFiltro, porGrupo, porMes, rankingTiendas, resumen } from '@/lib/stats';

const iso = (d: Date) => d.toISOString().slice(0, 10);
export async function loadDashboard(sp: Record<string, string | string[] | undefined>) {
  const hoy = new Date();
  const inicio = new Date(hoy.getFullYear(), hoy.getMonth() - 5, 1);
  const f = leerFiltros(sp, { desde: iso(inicio), hasta: iso(hoy), estado: 'finalizada' });
  const [rows, { plazas, ros }] = await Promise.all([buscarEvaluaciones(f, 20000), opcionesFiltro()]);
  const s = resumen(rows);
  const meses = porMes(rows);
  const ranking = rankingTiendas(rows);
  // Si las tiendas tienen RO, el comparativo es por RO (así está organizada la distribución); si no, por plaza.
  const porRo = ros.length > 0;
  const grupoData = porGrupo(rows, porRo ? 'ro' : 'plaza');
  const { areas, preguntas } = await hallazgosPorArea(rows.map(r => r.id));
  const maxH = Math.max(1, ...ranking.map(r => r.hallazgos));

  return { f, plazas, ros, s, meses, ranking, porRo, grupoData, areas, preguntas, maxH };
}
export type DashboardViewData = NonNullable<Awaited<ReturnType<typeof loadDashboard>>>;
