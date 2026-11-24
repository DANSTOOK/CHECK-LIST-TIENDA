'use client';
import Link from 'next/link';
import { fmtDate, pct } from '@/lib/format';
import { Empty, Icon, PctTag, Trend } from '@/components/ui';
import { StoreTrend, HBars } from '@/components/Charts';
import StartButton from './StartButton';
import { u } from '@/lib/base';
import type { TiendaViewData } from '@/lib/vistas/tienda';

export default function TiendaView({ tienda, user, evals, fin, borrador, ultima, anterior, t, primera, areaData, serie }: TiendaViewData) {
  return (
    <>
      <header className="page-head">
        <nav className="crumbs"><Link href="/tiendas">Tiendas</Link><span className="sep"><Icon n="chevron" /></span><span aria-current="page">{tienda.nombre}</span></nav>
        <div className="page-row">
          <div className="page-text">
            <h1>{tienda.nombre} <span className="cr-chip">CR {tienda.cr}</span>{!tienda.activa && <span className="state">Inactiva</span>}</h1>
            <p className="page-sub">{[tienda.ro && `RO ${tienda.ro}`, tienda.plaza && `Plaza ${tienda.plaza}`, tienda.ciudad, tienda.estado, tienda.region && `Región ${tienda.region}`].filter(Boolean).join(' · ') || 'Sin datos de ubicación'}</p>
          </div>
          {user.rol !== 'consulta' && !!tienda.activa && <div className="page-actions"><StartButton tiendaId={tienda.id} borradorId={borrador?.id} /></div>}
        </div>
      </header>

      <div className="kpis">
        <div className="kpi"><span className="kpi-l">Última evaluación</span><span className="kpi-v"><PctTag value={ultima?.porcentaje} big /></span><span className="kpi-s">{ultima ? fmtDate(ultima.fecha) : 'Sin evaluar'}</span></div>
        <div className="kpi"><span className="kpi-l">Evaluación anterior</span><span className="kpi-v"><PctTag value={anterior?.porcentaje} big /></span><span className="kpi-s">{anterior ? fmtDate(anterior.fecha) : '—'}</span></div>
        <div className={`kpi ${t?.dir === 'down' ? 'is-alert' : ''}`}><span className="kpi-l">{t?.dir === 'down' ? '% de retroceso' : '% de mejora'}</span>
          <span className="kpi-v">{t ? <Trend actual={ultima.porcentaje} anterior={anterior.porcentaje} compact /> : '—'}</span><span className="kpi-s">{t ? `${t.arrow} ${t.label}` : 'Se necesitan 2 evaluaciones'}</span></div>
        <div className="kpi"><span className="kpi-l">Desde la primera visita</span><span className="kpi-v">{fin.length > 1 ? <Trend actual={ultima.porcentaje} anterior={primera.porcentaje} compact /> : '—'}</span><span className="kpi-s">{fin.length} evaluaci{fin.length === 1 ? 'ón' : 'ones'} · prom. {pct(fin.length ? fin.reduce((a, e) => a + (e.porcentaje ?? 0), 0) / fin.length : null)}</span></div>
      </div>

      {fin.length === 0 ? (
        <div className="panel"><Empty icon="check" title="Esta tienda aún no tiene evaluaciones"><p>Inicia el checklist para registrar su primera visita.</p></Empty></div>
      ) : (
        <>
          <div className="dash-grid">
            <section className="panel"><div className="panel-head"><h2>Evolución histórica</h2><span className="muted">Cumplimiento por visita</span></div>
              <div className="chart-box sm"><StoreTrend data={serie} /></div></section>
            <section className="panel"><div className="panel-head"><h2>Hallazgos por área</h2><span className="muted">Todas las visitas</span></div>
              <div className="chart-box sm">{areaData.length ? <HBars data={areaData} /> : <Empty icon="check" title="Sin hallazgos registrados" />}</div></section>
          </div>
          <section className="panel">
            <div className="panel-head"><h2>Visitas</h2></div>
            <div className="table tbl-seg">
              <div className="tr th"><span>Fecha</span><span>Folio</span><span>Responsable</span><span>Resultado</span><span>Vs. anterior</span><span>Respuestas</span><span></span></div>
              {evals.map(e => {
                const prev = fin[fin.indexOf(e) + 1];
                return (
                  <Link key={e.id} href={`/evaluaciones/${e.id}`} className="tr">
                    <span>{fmtDate(e.fecha)}</span><span className="mono">{e.folio}</span><span>{e.evaluador}</span>
                    <span>{e.estado === 'finalizada' ? <PctTag value={e.porcentaje} /> : <span className="state warn">En curso</span>}</span>
                    <span>{e.estado === 'finalizada' ? <Trend actual={e.porcentaje} anterior={prev?.porcentaje} /> : null}</span>
                    <span className="muted">{e.cumple} C · {e.no_cumple} NC · {e.no_aplica} NA</span>
                    <Icon n="chevron" className="chev" />
                  </Link>
                );
              })}
            </div>
          </section>
        </>
      )}
    </>
  );
}
