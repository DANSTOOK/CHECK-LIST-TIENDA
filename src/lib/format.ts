// Utilidades de formato compartidas por servidor y cliente.
export const RESULTADOS = {
  cumple: { label: 'Cumple', short: 'C', tone: 'done' },
  no_cumple: { label: 'No cumple', short: 'NC', tone: 'danger' },
  no_aplica: { label: 'No aplica', short: 'NA', tone: 'na' },
} as const;
export type Resultado = keyof typeof RESULTADOS;

export const REGLAS_EVIDENCIA: Record<string, string> = {
  siempre: 'Foto obligatoria siempre',
  no_cumple: 'Foto obligatoria con 3 estrellas o menos',
  opcional: 'Foto opcional',
};

// Zona horaria para mostrar fechas (configurable con APP_TZ / NEXT_PUBLIC_APP_TZ).
const TZ = process.env.NEXT_PUBLIC_APP_TZ || 'America/Tijuana';
export function fmtDate(d: Date | string | null | undefined, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) {
  if (!d) return '';
  return new Intl.DateTimeFormat('es-MX', { timeZone: TZ, ...opts }).format(new Date(d));
}
export const fmtDateTime = (d: Date | string | null | undefined) =>
  fmtDate(d, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
export const fmtMonth = (d: Date | string) => fmtDate(d, { month: 'short', year: 'numeric' });
/** Clave AAAA-MM en zona horaria local, para agrupar por mes. */
export function monthKey(d: Date | string) {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit' }).formatToParts(new Date(d));
  return `${p.find(x => x.type === 'year')!.value}-${p.find(x => x.type === 'month')!.value}`;
}
export function monthLabel(key: string) {
  const [y, m] = key.split('-').map(Number);
  return new Intl.DateTimeFormat('es-MX', { month: 'short', year: '2-digit', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, 15)));
}
export const pct = (n: number | null | undefined, digits = 0) => (n == null ? '—' : `${n.toFixed(digits)}%`);

/** Tono visual según % de cumplimiento (mismos colores de estatus del planificador). */
export function tone(p: number | null | undefined) {
  if (p == null) return 'na';
  if (p >= 90) return 'done';
  if (p >= 75) return 'warn';
  return 'danger';
}

/** Tendencia entre dos evaluaciones: ↑ mejoró, ↓ empeoró, = se mantuvo. */
export function trend(actual: number | null | undefined, anterior: number | null | undefined) {
  if (actual == null || anterior == null) return null;
  const diff = Math.round((actual - anterior) * 10) / 10;
  if (Math.abs(diff) < 0.5) return { dir: 'eq' as const, diff: 0, label: 'Se mantuvo', arrow: '=' };
  return diff > 0
    ? { dir: 'up' as const, diff, label: 'Mejoró', arrow: '↑' }
    : { dir: 'down' as const, diff, label: 'Empeoró', arrow: '↓' };
}
