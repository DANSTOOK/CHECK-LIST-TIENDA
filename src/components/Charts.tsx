'use client';
/**
 * Gráficas (Recharts). Los colores se leen de los tokens CSS del sistema visual,
 * así respetan tema claro/oscuro igual que el resto de la app.
 */
import { useEffect, useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine,
} from 'recharts';

const TOKENS = ['--accent', '--st-done', '--st-block', '--st-proc', '--st-na', '--line', '--muted', '--ink-2', '--surface', '--line-2', '--info-ink'] as const;
type Theme = Record<(typeof TOKENS)[number], string>;

function useTheme(): Theme | null {
  const [t, setT] = useState<Theme | null>(null);
  useEffect(() => {
    const read = () => {
      const cs = getComputedStyle(document.documentElement);
      setT(Object.fromEntries(TOKENS.map(k => [k, cs.getPropertyValue(k).trim()])) as Theme);
    };
    read();
    const mo = new MutationObserver(read);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    const mq = matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', read);
    return () => { mo.disconnect(); mq.removeEventListener('change', read); };
  }, []);
  return t;
}

const tip = (t: Theme) => ({
  contentStyle: { background: t['--surface'], border: `1px solid ${t['--line']}`, borderRadius: 7, fontSize: 12.5 },
  labelStyle: { color: t['--ink-2'], fontWeight: 600 },
  cursor: { fill: t['--line'], opacity: 0.4 },
});
const axis = (t: Theme) => ({ tick: { fill: t['--muted'], fontSize: 11.5 }, axisLine: { stroke: t['--line'] }, tickLine: false });

/** Evolución mensual: barras = número de checklists, línea = % de cumplimiento promedio. */
export function MonthlyChart({ data }: { data: { mes: string; checklists: number; cumplimiento: number | null }[] }) {
  const t = useTheme();
  if (!t) return null;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 10, right: 8, left: -14, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={t['--line']} />
        <XAxis dataKey="mes" {...axis(t)} />
        <YAxis yAxisId="n" allowDecimals={false} {...axis(t)} />
        <YAxis yAxisId="p" orientation="right" domain={[0, 100]} unit="%" {...axis(t)} />
        <Tooltip {...tip(t)} formatter={(v: number, n: string) => (n === 'Cumplimiento' ? `${v}%` : v)} />
        <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} />
        <Bar yAxisId="n" dataKey="checklists" name="Checklists" fill={t['--line-2']} radius={[4, 4, 0, 0]} maxBarSize={34} />
        <Line yAxisId="p" dataKey="cumplimiento" name="Cumplimiento" stroke={t['--accent']} strokeWidth={2.5} dot={{ r: 3.5 }} connectNulls />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** Distribución de respuestas (pie). */
export function ResultsPie({ cumple, noCumple, noAplica }: { cumple: number; noCumple: number; noAplica: number }) {
  const t = useTheme();
  if (!t) return null;
  const data = [
    { name: 'Cumple', value: cumple, c: t['--st-done'] },
    { name: 'No cumple', value: noCumple, c: t['--st-block'] },
    { name: 'No aplica', value: noAplica, c: t['--st-na'] },
  ].filter(d => d.value > 0);
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="82%" paddingAngle={2} stroke={t['--surface']}>
          {data.map(d => <Cell key={d.name} fill={d.c} />)}
        </Pie>
        <Tooltip {...tip(t)} />
        <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} />
      </PieChart>
    </ResponsiveContainer>
  );
}

/** Barras horizontales: hallazgos por área o cumplimiento por plaza. */
export function HBars({ data, unit = '', color = 'block', max }: { data: { name: string; value: number }[]; unit?: string; color?: 'block' | 'accent'; max?: number }) {
  const t = useTheme();
  if (!t) return null;
  const c = color === 'block' ? t['--st-block'] : t['--accent'];
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 30, left: 6, bottom: 0 }}>
        <CartesianGrid horizontal={false} stroke={t['--line']} />
        <XAxis type="number" domain={[0, max ?? 'auto']} unit={unit} {...axis(t)} allowDecimals={false} />
        <YAxis type="category" dataKey="name" width={110} {...axis(t)} />
        <Tooltip {...tip(t)} formatter={(v: number) => `${v}${unit}`} />
        <Bar dataKey="value" name={unit === '%' ? 'Cumplimiento' : 'Hallazgos'} fill={c} radius={[0, 4, 4, 0]} maxBarSize={22}
          label={{ position: 'right', fill: t['--ink-2'], fontSize: 11.5, formatter: (v: number) => `${v}${unit}` }} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Tendencia de una tienda: % por evaluación con línea de meta (90 %). */
export function StoreTrend({ data }: { data: { fecha: string; cumplimiento: number | null }[] }) {
  const t = useTheme();
  if (!t) return null;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 14, right: 16, left: -14, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={t['--line']} />
        <XAxis dataKey="fecha" {...axis(t)} />
        <YAxis domain={[0, 100]} unit="%" {...axis(t)} />
        <ReferenceLine y={90} stroke={t['--st-done']} strokeDasharray="4 4" label={{ value: 'Meta 90%', fill: t['--muted'], fontSize: 11, position: 'insideTopLeft' }} />
        <Tooltip {...tip(t)} formatter={(v: number) => `${v}%`} />
        <Line dataKey="cumplimiento" name="Cumplimiento" stroke={t['--accent']} strokeWidth={2.5} dot={{ r: 4 }} connectNulls
          label={{ position: 'top', fill: t['--ink-2'], fontSize: 11, formatter: (v: number) => `${v}%` }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
