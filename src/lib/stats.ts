// Consultas y agregados para Historial y Dashboard.
import { db, containsCI } from './db';
import { monthKey, monthLabel } from './format';

export interface Filtros {
  q?: string; desde?: string; hasta?: string; estado?: string; responsable?: string; plaza?: string; ro?: string;
}

/** Normaliza los filtros que llegan por la URL (?desde=…&hasta=…). */
export function leerFiltros(sp: Record<string, string | string[] | undefined>, defaults: Partial<Filtros> = {}): Filtros {
  const g = (k: string) => (typeof sp[k] === 'string' && sp[k] ? (sp[k] as string) : undefined);
  return {
    q: g('q'), desde: g('desde') ?? defaults.desde, hasta: g('hasta') ?? defaults.hasta,
    estado: g('estado') ?? defaults.estado, responsable: g('responsable'), plaza: g('plaza'), ro: g('ro'),
  };
}

/** AAAA-MM-DD → ISO del inicio (o fin) de ese día en hora local de la tienda (aprox. UTC-7/-8). */
const isoDia = (d: string, fin = false) => new Date(`${d}T${fin ? '23:59:59' : '00:00:00'}-07:00`).toISOString();

export async function buscarEvaluaciones(f: Filtros, limit = 2000) {
  let q = db.selectFrom('evaluaciones')
    .innerJoin('tiendas', 'tiendas.id', 'evaluaciones.tienda_id')
    .innerJoin('usuarios', 'usuarios.id', 'evaluaciones.evaluador_id')
    .select([
      'evaluaciones.id', 'folio', 'fecha', 'evaluaciones.estado as estado', 'porcentaje', 'total', 'cumple', 'no_cumple', 'no_aplica',
      'tiendas.id as tienda_id', 'tiendas.cr', 'tiendas.nombre as tienda', 'tiendas.plaza', 'tiendas.ro', 'usuarios.nombre as evaluador', 'usuarios.id as evaluador_id',
    ]);
  if (f.estado && f.estado !== 'todas') q = q.where('evaluaciones.estado', '=', f.estado);
  if (f.desde) q = q.where('fecha', '>=', isoDia(f.desde));
  if (f.hasta) q = q.where('fecha', '<=', isoDia(f.hasta, true));
  if (f.responsable) q = q.where('evaluador_id', '=', f.responsable);
  if (f.plaza) q = q.where('tiendas.plaza', '=', f.plaza);
  if (f.ro) q = q.where('tiendas.ro', '=', f.ro);
  if (f.q) q = q.where(eb => eb.or([containsCI('tiendas.cr', f.q!), containsCI('tiendas.nombre', f.q!), containsCI('folio', f.q!)]));
  const rows = await q.orderBy('fecha', 'desc').limit(limit).execute();
  return rows.map(r => ({ ...r, porcentaje: r.porcentaje == null ? null : Number(r.porcentaje) }));
}
export type EvalRow = Awaited<ReturnType<typeof buscarEvaluaciones>>[number];

const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);

export function resumen(rows: EvalRow[]) {
  const fin = rows.filter(r => r.estado === 'finalizada');
  const ps = fin.map(r => r.porcentaje).filter((p): p is number => p != null);
  return {
    total: fin.length,
    promedio: avg(ps),
    hallazgos: fin.reduce((a, r) => a + r.no_cumple, 0),
    tiendas: new Set(fin.map(r => r.tienda_id)).size,
    enMeta: ps.filter(p => p >= 90).length,
    cumple: fin.reduce((a, r) => a + r.cumple, 0),
    noCumple: fin.reduce((a, r) => a + r.no_cumple, 0),
    noAplica: fin.reduce((a, r) => a + r.no_aplica, 0),
  };
}

/** Evolución mensual (cantidad de checklists y % promedio). */
export function porMes(rows: EvalRow[]) {
  const m = new Map<string, number[]>();
  for (const r of rows.filter(x => x.estado === 'finalizada')) {
    const k = monthKey(r.fecha);
    const l = m.get(k) ?? [];
    if (r.porcentaje != null) l.push(r.porcentaje); else l.push(NaN);
    m.set(k, l);
  }
  return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, l]) => ({
    mes: monthLabel(k), checklists: l.length, cumplimiento: avg(l.filter(x => !Number.isNaN(x))),
  }));
}

/** Tiendas con más incumplimientos en el periodo. */
export function rankingTiendas(rows: EvalRow[], n = 8) {
  const m = new Map<string, { cr: string; nombre: string; plaza: string | null; hallazgos: number; ps: number[]; visitas: number }>();
  for (const r of rows.filter(x => x.estado === 'finalizada')) {
    const t = m.get(r.tienda_id) ?? { cr: r.cr, nombre: r.tienda, plaza: r.plaza, hallazgos: 0, ps: [], visitas: 0 };
    t.hallazgos += r.no_cumple; t.visitas++;
    if (r.porcentaje != null) t.ps.push(r.porcentaje);
    m.set(r.tienda_id, t);
  }
  return [...m.values()].filter(t => t.hallazgos > 0)
    .map(t => ({ ...t, promedio: avg(t.ps) }))
    .sort((a, b) => b.hallazgos - a.hallazgos || (a.promedio ?? 0) - (b.promedio ?? 0)).slice(0, n);
}

/** Cumplimiento promedio agrupado por plaza o por RO. */
export function porGrupo(rows: EvalRow[], campo: 'plaza' | 'ro' = 'plaza') {
  const m = new Map<string, number[]>();
  for (const r of rows.filter(x => x.estado === 'finalizada' && x.porcentaje != null)) {
    const k = r[campo] || (campo === 'ro' ? 'Sin RO' : 'Sin plaza');
    m.set(k, [...(m.get(k) ?? []), r.porcentaje!]);
  }
  return [...m.entries()].map(([name, l]) => ({ name, value: avg(l) ?? 0 })).sort((a, b) => b.value - a.value);
}

/** Hallazgos ("No cumple") agrupados por área/categoría y por pregunta. */
export async function hallazgosPorArea(ids: string[]) {
  if (!ids.length) return { areas: [], preguntas: [] };
  const rows: { categoria: string; texto: string }[] = [];
  for (let i = 0; i < ids.length; i += 500) {
    rows.push(...await db.selectFrom('respuestas').select(['categoria', 'texto'])
      .where('evaluacion_id', 'in', ids.slice(i, i + 500)).where('resultado', '=', 'no_cumple').execute());
  }
  const count = (key: (r: (typeof rows)[number]) => string) => {
    const m = new Map<string, number>();
    rows.forEach(r => m.set(key(r), (m.get(key(r)) ?? 0) + 1));
    return [...m.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  };
  return { areas: count(r => r.categoria), preguntas: count(r => r.texto).slice(0, 6) };
}

/** Valores distintos de plaza y RO para los filtros (solo los que tienen datos). */
export async function opcionesFiltro() {
  const [plazas, ros] = await Promise.all([
    db.selectFrom('tiendas').select('plaza').distinct().where('plaza', 'is not', null).orderBy('plaza').execute(),
    db.selectFrom('tiendas').select('ro').distinct().where('ro', 'is not', null).orderBy('ro').execute(),
  ]);
  return { plazas: plazas.map(p => p.plaza!), ros: ros.map(r => r.ro!) };
}
