'use client';
import Link from 'next/link';
import { fmtDateTime } from '@/lib/format';
import { Empty, Icon, PctTag } from '@/components/ui';
import { MonthlyChart } from '@/components/Charts';
import { u } from '@/lib/base';
import type { HistorialViewData } from '@/lib/vistas/historial';

export default function HistorialView({ f, rows, usuarios, plazas, ros, s, meses }: HistorialViewData) {
  return (
    <>
      <header className="page-head">
        <div className="page-row"><div className="page-text"><h1>Historial de evaluaciones</h1>
          <p className="page-sub">{rows.length === 1000 ? 'Mostrando las 1,000 más recientes' : `${rows.length} evaluaciones`}</p></div></div>
      </header>

      <form className="filters-bar" method="get">
        <label className="field">Tienda, CR o folio<input name="q" defaultValue={f.q} placeholder="Ej. 50ABC" /></label>
        <label className="field">Fecha inicial<input type="date" name="desde" defaultValue={f.desde} /></label>
        <label className="field">Fecha final<input type="date" name="hasta" defaultValue={f.hasta} /></label>
        <label className="field">Estado<select name="estado" defaultValue={f.estado}><option value="finalizada">Finalizadas</option><option value="borrador">En curso</option><option value="todas">Todas</option></select></label>
        <label className="field">Responsable<select name="responsable" defaultValue={f.responsable ?? ''}><option value="">Todos</option>{usuarios.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}</select></label>
        {ros.length > 0 && <label className="field">RO<select name="ro" defaultValue={f.ro ?? ''}><option value="">Todos</option>{ros.map(r => <option key={r}>{r}</option>)}</select></label>}
        {plazas.length > 0 && <label className="field">Plaza<select name="plaza" defaultValue={f.plaza ?? ''}><option value="">Todas</option>{plazas.map(p => <option key={p}>{p}</option>)}</select></label>}
        <button className="btn btn-primary" type="submit"><Icon n="search" />Filtrar</button>
        <Link className="btn btn-ghost" href="/evaluaciones">Limpiar</Link>
        <a className="btn" href={u(`/api/evaluaciones/exportar?${new URLSearchParams(Object.entries(f).filter(([, v]) => v) as [string, string][])}`)} title="Excel con resumen, cada hallazgo con sus fotos y totales por RO"><Icon n="table" />Exportar Excel de seguimiento</a>
      </form>

      <div className="kpis">
        <div className="kpi"><span className="kpi-l">Total de inspecciones</span><span className="kpi-v">{s.total}</span><span className="kpi-s">{s.tiendas} tiendas</span></div>
        <div className="kpi"><span className="kpi-l">% de cumplimiento</span><span className="kpi-v"><PctTag value={s.promedio} big /></span><span className="kpi-s">Promedio del periodo</span></div>
        <div className={`kpi ${s.hallazgos ? 'is-alert' : ''}`}><span className="kpi-l">Hallazgos encontrados</span><span className="kpi-v">{s.hallazgos}</span><span className="kpi-s">Respuestas &ldquo;No cumple&rdquo;</span></div>
        <div className="kpi"><span className="kpi-l">En meta (≥ 90 %)</span><span className="kpi-v">{s.enMeta}<small> / {s.total}</small></span><span className="kpi-s">Evaluaciones</span></div>
      </div>

      {meses.length > 1 && (
        <section className="panel"><div className="panel-head"><h2>Tendencia</h2><span className="muted">Por mes, con los filtros aplicados</span></div>
          <div className="chart-box sm"><MonthlyChart data={meses} /></div></section>
      )}

      <section className="panel">
        {rows.length ? (
          <div className="table tbl-hist">
            <div className="tr th"><span>Folio</span><span>Tienda</span><span>Responsable</span><span>Cumplimiento</span><span>Hallazgos</span><span>Estado</span><span></span></div>
            {rows.map(r => (
              <Link key={r.id} href={`/evaluaciones/${r.id}`} className="tr">
                <span className="c-date"><span className="mono">{r.folio}</span><span className="muted">{fmtDateTime(r.fecha)}</span></span>
                <span className="c-name"><b>{r.tienda}</b><span className="mono">CR {r.cr}{r.ro ? ` · RO ${r.ro}` : r.plaza ? ` · ${r.plaza}` : ''}</span></span>
                <span>{r.evaluador}</span>
                <span>{r.estado === 'finalizada' ? <PctTag value={r.porcentaje} /> : '—'}</span>
                <span>{r.no_cumple ? <span className="flag"><Icon n="alert" />{r.no_cumple}</span> : <span className="muted">0</span>}</span>
                <span><span className={`state ${r.estado === 'finalizada' ? 'done' : 'warn'}`}>{r.estado === 'finalizada' ? 'Finalizada' : 'En curso'}</span></span>
                <Icon n="chevron" className="chev" />
              </Link>
            ))}
          </div>
        ) : <Empty icon="search" title="No hay evaluaciones con esos filtros"><p>Ajusta las fechas, el estado o el responsable.</p></Empty>}
      </section>
    </>
  );
}
