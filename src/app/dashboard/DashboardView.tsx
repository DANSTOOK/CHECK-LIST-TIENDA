'use client';
import Link from 'next/link';
import { pct } from '@/lib/format';
import { Empty, Icon, PctTag } from '@/components/ui';
import { HBars, MonthlyChart, ResultsPie } from '@/components/Charts';
import { u } from '@/lib/base';
import type { DashboardViewData } from '@/lib/vistas/dashboard';

export default function DashboardView({ f, plazas, ros, s, meses, ranking, porRo, grupoData, areas, preguntas, maxH }: DashboardViewData) {
  return (
    <>
      <header className="page-head">
        <div className="page-row">
          <div className="page-text"><h1>Dashboard</h1><p className="page-sub">Seguimiento del checklist operativo en tiendas</p></div>
          <div className="page-actions"><Link className="btn" href="/evaluaciones"><Icon n="history" />Ver historial</Link><Link className="btn btn-primary" href="/"><Icon n="check" />Nuevo checklist</Link></div>
        </div>
      </header>

      <form className="filters-bar" method="get">
        <label className="field">Desde<input type="date" name="desde" defaultValue={f.desde} /></label>
        <label className="field">Hasta<input type="date" name="hasta" defaultValue={f.hasta} /></label>
        {ros.length > 0 && <label className="field">RO<select name="ro" defaultValue={f.ro ?? ''}><option value="">Todos</option>{ros.map(r => <option key={r}>{r}</option>)}</select></label>}
        {plazas.length > 0 && <label className="field">Plaza<select name="plaza" defaultValue={f.plaza ?? ''}><option value="">Todas</option>{plazas.map(p => <option key={p}>{p}</option>)}</select></label>}
        <button className="btn" type="submit"><Icon n="search" />Aplicar</button>
        <Link className="btn btn-ghost" href="/dashboard">Últimos 6 meses</Link>
      </form>

      <div className="kpis k5">
        <div className="kpi"><span className="kpi-l">Checklists realizados</span><span className="kpi-v">{s.total}</span><span className="kpi-s">{s.tiendas} tiendas evaluadas</span></div>
        <div className="kpi"><span className="kpi-l">Cumplimiento promedio</span><span className="kpi-v"><PctTag value={s.promedio} big /></span><span className="kpi-s">Meta: 90 %</span></div>
        <div className="kpi"><span className="kpi-l">En meta (≥ 90 %)</span><span className="kpi-v">{s.enMeta}<small> / {s.total}</small></span><span className="kpi-s">{s.total ? pct((s.enMeta / s.total) * 100) : '—'} de las visitas</span></div>
        <div className={`kpi ${s.hallazgos ? 'is-alert' : ''}`}><span className="kpi-l">Hallazgos</span><span className="kpi-v">{s.hallazgos}</span><span className="kpi-s">Respuestas &ldquo;No cumple&rdquo;</span></div>
        <div className="kpi"><span className="kpi-l">Área con más incidencia</span><span className="kpi-v kpi-txt">{areas[0]?.name ?? '—'}</span><span className="kpi-s">{areas[0] ? `${areas[0].value} hallazgos` : 'Sin hallazgos'}</span></div>
      </div>

      {!s.total ? (
        <div className="panel"><Empty icon="chart" title="Sin evaluaciones en el periodo"><p>Cambia las fechas o inicia un checklist desde Tiendas.</p></Empty></div>
      ) : (
        <div className="dash-grid">
          <section className="panel span-2">
            <div className="panel-head"><h2>Evolución mensual</h2><span className="muted">Checklists realizados y cumplimiento promedio</span></div>
            <div className="chart-box"><MonthlyChart data={meses} /></div>
          </section>
          <section className="panel">
            <div className="panel-head"><h2>Tiendas con más incumplimientos</h2></div>
            {ranking.length ? (
              <ol className="rank">{ranking.map((t, i) => (
                <li key={t.cr}>
                  <span className="rk">{i + 1}</span>
                  <Link className="nm" href={`/tiendas/${encodeURIComponent(t.cr)}`}><b>{t.nombre}</b><span>CR {t.cr} · {t.visitas} visita{t.visitas > 1 ? 's' : ''} · prom. {pct(t.promedio)}</span></Link>
                  <span className="bar"><span style={{ width: `${(t.hallazgos / maxH) * 100}%` }} /></span>
                  <span className="val">{t.hallazgos}</span>
                </li>))}
              </ol>
            ) : <Empty icon="check" title="Sin incumplimientos" />}
          </section>
          <section className="panel">
            <div className="panel-head"><h2>Resultados de las respuestas</h2></div>
            <div className="chart-box sm"><ResultsPie cumple={s.cumple} noCumple={s.noCumple} noAplica={s.noAplica} /></div>
          </section>
          <section className="panel">
            <div className="panel-head"><h2>Áreas con mayor incidencia</h2><span className="muted">Hallazgos por categoría</span></div>
            <div className="chart-box sm">{areas.length ? <HBars data={areas} /> : <Empty icon="check" title="Sin hallazgos" />}</div>
          </section>
          <section className="panel">
            <div className="panel-head"><h2>Comparativo por {porRo ? 'RO' : 'plaza'}</h2><span className="muted">Cumplimiento promedio</span></div>
            <div className="chart-box sm"><HBars data={grupoData} unit="%" color="accent" max={100} /></div>
          </section>
          {preguntas.length > 0 && (
            <section className="panel span-2">
              <div className="panel-head"><h2>Puntos que más fallan</h2></div>
              <ol className="rank">{preguntas.map((p, i) => (
                <li key={p.name}><span className="rk">{i + 1}</span><span className="nm"><b>{p.name}</b></span>
                  <span className="bar"><span style={{ width: `${(p.value / preguntas[0].value) * 100}%` }} /></span><span className="val">{p.value}</span></li>))}
              </ol>
            </section>
          )}
        </div>
      )}
    </>
  );
}
