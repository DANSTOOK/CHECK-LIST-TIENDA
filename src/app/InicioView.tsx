'use client';
/**
 * Inicio: el checklist "Evaluación Tienda Completa" y la elección de la tienda.
 * 1) Elige plaza y busca la tienda por CR o nombre.  2) Revisa las preguntas.
 * 3) "Iniciar checklist" (o "Continuar" si ya tienes uno abierto en esa tienda).
 */
import { useMemo, useState } from 'react';
import { api, Empty, Icon, PctTag, useAppRouter, useToast } from '@/components/ui';
import { u } from '@/lib/base';
import { fmtDate, REGLAS_EVIDENCIA } from '@/lib/format';
import { PLAZAS, etiquetaPlaza } from '@/lib/plazas';
import type { InicioViewData } from '@/lib/vistas/inicio';

const MAX = 40;

export default function InicioView({ checklist, preguntas, tiendas, puedeEvaluar }: InicioViewData) {
  const router = useAppRouter();
  const toast = useToast();
  const plazasConTiendas = [...new Set([...PLAZAS, ...tiendas.map(t => t.plaza).filter(Boolean) as string[]])];
  // Si todas las tiendas son de una sola plaza, se preselecciona.
  const unica = [...new Set(tiendas.map(t => t.plaza))];
  const [plaza, setPlaza] = useState(unica.length === 1 && unica[0] ? unica[0] : '');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const lista = useMemo(() => {
    const s = q.trim().toLowerCase();
    return tiendas.filter(t => (!plaza || t.plaza === plaza) &&
      (!s || t.cr.toLowerCase().includes(s) || t.nombre.toLowerCase().includes(s) || (t.ro || '').toLowerCase().includes(s)));
  }, [tiendas, plaza, q]);
  const tienda = tiendas.find(t => t.id === sel) ?? null;
  const porPlaza = (p: string) => tiendas.filter(t => t.plaza === p).length;

  const iniciar = async () => {
    if (!tienda) return;
    if (tienda.borradorId) { router.push(`/evaluaciones/${tienda.borradorId}`); return; }
    setBusy(true);
    try {
      const r = await api<{ id: string }>(u('/api/evaluaciones'), { body: { tiendaId: tienda.id } });
      router.push(`/evaluaciones/${r.id}`);
      router.refresh();
    } catch (e) { toast((e as Error).message, true); setBusy(false); }
  };

  let cat = '';
  return (
    <>
      <header className="page-head">
        <div className="page-row">
          <div className="page-text">
            <h1>{checklist?.nombre ?? 'Checklist operativo'}</h1>
            <p className="page-sub">{checklist?.descripcion ?? 'Elige la tienda y comienza la evaluación.'}<span className="dot-sep" />{preguntas.length} preguntas</p>
          </div>
        </div>
      </header>

      <div className="inicio-grid">
        <section className="panel inicio-tienda">
          <div className="panel-head"><h2><span className="step-n">1</span>Elige la tienda</h2></div>
          <div className="inicio-body">
            <div className="seg plaza-seg" role="tablist" aria-label="Plaza">
              <button type="button" className={plaza === '' ? 'is-active' : ''} onClick={() => setPlaza('')}>Todas <span className="seg-n">{tiendas.length}</span></button>
              {plazasConTiendas.map(p => (
                <button key={p} type="button" className={plaza === p ? 'is-active' : ''} onClick={() => { setPlaza(p); setSel(null); }}>
                  {etiquetaPlaza(p)} <span className="seg-n">{porPlaza(p)}</span>
                </button>
              ))}
            </div>
            <label className="search"><Icon n="search" /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por CR, nombre o RO" aria-label="Buscar tienda" autoFocus /></label>

            {!tiendas.length ? (
              <Empty icon="store" title="Aún no hay tiendas"><p>Un administrador las carga en Tiendas › Importar concentrado.</p></Empty>
            ) : !lista.length ? (
              <Empty icon="search" title="Ninguna tienda coincide"><p>{plaza ? `No hay tiendas cargadas en ${etiquetaPlaza(plaza)}.` : 'Prueba con otro CR o nombre.'}</p></Empty>
            ) : (
              <div className="pick-list" role="listbox" aria-label="Tiendas">
                {lista.slice(0, MAX).map(t => (
                  <button key={t.id} type="button" role="option" aria-selected={sel === t.id} className={`pick ${sel === t.id ? 'is-on' : ''}`} onClick={() => setSel(t.id)}>
                    <span className="pick-main"><b>{t.nombre}</b><span className="mono">CR {t.cr}{t.plaza ? ` · ${etiquetaPlaza(t.plaza)}` : ''}</span>{t.ro && <span className="muted">RO {t.ro}</span>}</span>
                    <span className="pick-side">
                      {t.borradorId ? <span className="state warn">En curso</span> : t.ultima ? <><PctTag value={t.ultima.porcentaje} /><span className="muted">{fmtDate(t.ultima.fecha, { day: 'numeric', month: 'short' })}</span></> : <span className="muted">Sin evaluar</span>}
                    </span>
                  </button>
                ))}
                {lista.length > MAX && <p className="pick-more">Mostrando {MAX} de {lista.length}. Escribe el CR o parte del nombre para encontrarla.</p>}
              </div>
            )}
          </div>
        </section>

        <section className="panel inicio-preg">
          <div className="panel-head"><h2><span className="step-n">2</span>Preguntas del checklist</h2></div>
          <ol className="preg-list">
            {preguntas.map((p, i) => {
              const head = p.categoria !== cat ? (cat = p.categoria) : null;
              return (
                <li key={p.id}>
                  {head && <h3 className="det-cat"><i className="sw" style={{ ['--c' as string]: p.color }} />{head}</h3>}
                  <div className="preg"><span className="q-n">{i + 1}</span><div><b>{p.texto}</b>{p.ayuda && <p>{p.ayuda}</p>}
                    <span className="q-rule"><Icon n="camera" />{REGLAS_EVIDENCIA[p.evidencia]}</span></div></div>
                </li>
              );
            })}
          </ol>
        </section>
      </div>

      <div className="inicio-bar">
        <div className="inicio-sel">
          {tienda ? <><span className="muted">Tienda seleccionada</span><b>{tienda.nombre}</b><span className="mono">CR {tienda.cr}</span></> : <span className="muted">Selecciona una tienda para comenzar</span>}
        </div>
        {puedeEvaluar
          ? <button className="btn btn-primary btn-lg" type="button" disabled={!tienda || busy} onClick={iniciar}>
              <Icon n={tienda?.borradorId ? 'edit' : 'check'} /><span className="step-n inv">3</span>{busy ? 'Abriendo…' : tienda?.borradorId ? 'Continuar checklist' : 'Iniciar checklist'}
            </button>
          : <span className="state">Tu perfil es solo de consulta</span>}
      </div>
    </>
  );
}
