'use client';
import Link from 'next/link';
import { fmtDateTime } from '@/lib/format';
import { Icon, PctTag, ResultTag, Stars, Trend } from '@/components/ui';
import { u } from '@/lib/base';
import type { EvaluacionViewData } from '@/lib/vistas/evaluacion';
import Runner from './Runner';
import { Gallery, MailButton } from './Resultado';

export default function EvaluacionView({ ev, puedeEditar, anterior }: EvaluacionViewData) {
  if (puedeEditar) return <Runner key={ev.id} ev={ev} />;
  const hallazgos = ev.respuestas.filter(r => r.resultado === 'no_cumple');
  let cat = '';
  return (
    <>
      <header className="page-head">
        <nav className="crumbs"><Link href="/evaluaciones">Historial</Link><span className="sep"><Icon n="chevron" /></span>
          <Link href={`/tiendas/${encodeURIComponent(ev.tienda.cr)}`}>{ev.tienda.nombre}</Link><span className="sep"><Icon n="chevron" /></span><span aria-current="page">{ev.folio}</span></nav>
        <div className="page-row">
          <div className="page-text">
            <h1>{ev.tienda.nombre} <span className="cr-chip">CR {ev.tienda.cr}</span>
              {ev.estado === 'borrador' && <span className="state warn">Borrador en curso</span>}</h1>
            <p className="page-sub"><span className="mono">{ev.folio}</span><span className="dot-sep" />{fmtDateTime(ev.fecha)}<span className="dot-sep" />{ev.evaluador.nombre}{ev.tienda.plaza && <><span className="dot-sep" />Plaza {ev.tienda.plaza}</>}</p>
          </div>
          {ev.estado === 'finalizada' && (
            <div className="page-actions">
              <a className="btn" href={u(`/api/evaluaciones/${ev.id}/pdf?ver`)} target="_blank" rel="noreferrer"><Icon n="pdf" />Ver PDF</a>
              <a className="btn" href={u(`/api/evaluaciones/${ev.id}/pdf`)}><Icon n="download" />Descargar PDF</a>
              <MailButton id={ev.id} />
            </div>
          )}
        </div>
      </header>

      <section className="overview res-overview">
        <div className="res-main">
          <span className="kpi-l">Cumplimiento</span>
          <PctTag value={ev.porcentaje} big />
          <Trend actual={ev.porcentaje} anterior={anterior?.porcentaje} />
          {anterior && <span className="muted res-prev">Anterior: {anterior.porcentaje == null ? '—' : `${anterior.porcentaje}%`} · <Link className="link" href={`/evaluaciones/${anterior.id}`}>{anterior.folio}</Link></span>}
        </div>
        <div className="kpis res-kpis">
          <div className="kpi"><span className="kpi-l">Preguntas</span><span className="kpi-v">{ev.total}</span></div>
          <div className="kpi"><span className="kpi-l">Bien (4-5★)</span><span className="kpi-v t-done">{ev.cumple}</span></div>
          <div className={`kpi ${ev.noCumple ? 'is-alert' : ''}`}><span className="kpi-l">Hallazgos (1-3★)</span><span className="kpi-v">{ev.noCumple}</span></div>
          <div className="kpi"><span className="kpi-l">No aplican</span><span className="kpi-v">{ev.noAplica}</span></div>
        </div>
      </section>

      {hallazgos.length > 0 && (
        <section className="panel">
          <div className="panel-head"><h2>Hallazgos encontrados</h2><span className="flag"><Icon n="alert" />{hallazgos.length}</span></div>
          <ul className="find-list">
            {hallazgos.map(h => <li key={h.id}><span className="sw" style={{ ['--c' as string]: h.categoria_color }} /><div><b>{h.texto}</b><p>{h.comentario}</p></div><span className="muted">{h.categoria}</span></li>)}
          </ul>
        </section>
      )}
      {ev.observaciones && <section className="panel"><div className="panel-head"><h2>Observaciones</h2></div><p className="obs-text">{ev.observaciones}</p></section>}

      <section className="panel">
        <div className="panel-head"><h2>Detalle por pregunta</h2><span className="muted">{ev.respuestas.reduce((a, r) => a + r.evidencias.length, 0)} fotos de evidencia</span></div>
        <div className="det-list">
          {ev.respuestas.map((r, i) => {
            const head = r.categoria !== cat ? (cat = r.categoria) : null;
            return (
              <div key={r.id}>
                {head && <h3 className="det-cat"><i className="sw" style={{ ['--c' as string]: r.categoria_color }} />{head}</h3>}
                <div className="det-row">
                  <span className="q-n">{i + 1}</span>
                  <div className="det-body">
                    <div className="det-top"><b>{r.texto}</b>{r.calificacion ? <span className="det-rate"><Stars value={r.calificacion} small /><span className={r.calificacion <= 3 ? 't-danger' : 't-done'}>{r.calificacion}/5</span></span> : <ResultTag r={r.resultado} />}</div>
                    {r.comentario && <p className="det-comment">{r.comentario}</p>}
                    {r.evidencias.length > 0 && <Gallery ids={r.evidencias.map(f => f.id)} />}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
