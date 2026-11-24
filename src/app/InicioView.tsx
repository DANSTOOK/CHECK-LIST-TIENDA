'use client';
/**
 * Inicio: el checklist "Evaluación Tienda Completa" y la elección de la tienda.
 * 1) Elige plaza y busca la tienda por CR o nombre.  2) Revisa las preguntas.
 * 3) "Iniciar checklist" (o "Continuar" si ya tienes uno abierto en esa tienda).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { api, Empty, Icon, PctTag, useAppRouter, useToast } from '@/components/ui';
import { u } from '@/lib/base';
import { fmtDate, REGLAS_EVIDENCIA } from '@/lib/format';
import { etiquetaPlaza } from '@/lib/plazas';
import type { InicioViewData } from '@/lib/vistas/inicio';

const MAX = 8;
/** Minúsculas y sin acentos, para buscar "guillen" y encontrar "Guillén". */
const norm = (x: string | null | undefined) => (x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export default function InicioView({ checklist, preguntas, tiendas, puedeEvaluar }: InicioViewData) {
  const router = useAppRouter();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const buscador = useRef<HTMLInputElement>(null);
  // En celular las preguntas empiezan plegadas para dejar el buscador a la mano.
  const [verPreg, setVerPreg] = useState(true);
  useEffect(() => { if (window.matchMedia('(max-width: 860px)').matches) setVerPreg(false); }, []);

  // Sugerencias conforme se escribe (CR, nombre de tienda o RO). Primero las que empiezan igual.
  const sugerencias = useMemo(() => {
    const t = norm(q.trim());
    if (!t) return [];
    const rank = (x: typeof tiendas[number]) => (norm(x.cr).startsWith(t) || norm(x.nombre).startsWith(t) ? 0 : 1);
    return tiendas
      .filter(x => norm(x.cr).includes(t) || norm(x.nombre).includes(t) || norm(x.ro).includes(t))
      .sort((a, b) => rank(a) - rank(b) || a.nombre.localeCompare(b.nombre));
  }, [tiendas, q]);
  const tienda = tiendas.find(t => t.id === sel) ?? null;
  const elegir = (id: string) => { setSel(id); setQ(''); try { navigator.vibrate?.(10); } catch { /* */ } };
  const cambiar = () => { setSel(null); setTimeout(() => buscador.current?.focus(), 50); };

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
            {!tiendas.length ? (
              <Empty icon="store" title="Aún no hay tiendas"><p>Un administrador las carga en Tiendas › Importar concentrado.</p></Empty>
            ) : tienda ? (
              <div className="pick is-on pick-sel">
                <span className="pick-check" aria-hidden="true"><Icon n="check" /></span>
                <span className="pick-main"><b>{tienda.nombre}</b><span className="mono">CR {tienda.cr}{tienda.plaza ? ` · ${etiquetaPlaza(tienda.plaza)}` : ''}</span>{tienda.ro && <span className="muted">RO {tienda.ro}</span>}</span>
                <button type="button" className="btn btn-sm" onClick={cambiar}>Cambiar</button>
              </div>
            ) : (
              <div className="buscador">
                <label className="search"><Icon n="search" />
                  <input ref={buscador} value={q} onChange={e => setQ(e.target.value)} placeholder="Escribe el CR, nombre de la tienda o RO" aria-label="Buscar tienda"
                    autoComplete="off" autoCorrect="off" autoCapitalize="characters" enterKeyHint="search"
                    onKeyDown={e => { if (e.key === 'Enter' && sugerencias[0]) elegir(sugerencias[0].id); }} />
                  {q && <button type="button" className="icon-btn search-clear" aria-label="Borrar" onClick={() => { setQ(''); buscador.current?.focus(); }}><Icon n="x" /></button>}
                </label>
                {q.trim() && (
                  sugerencias.length ? (
                    <div className="pick-list sugerencias" role="listbox" aria-label="Tiendas encontradas">
                      {sugerencias.slice(0, MAX).map((t, i) => (
                        <button key={t.id} type="button" role="option" aria-selected={false} className="pick" style={{ ['--i' as string]: i }} onClick={() => elegir(t.id)}>
                          <span className="pick-main"><b>{t.nombre}</b><span className="mono">CR {t.cr}{t.plaza ? ` · ${etiquetaPlaza(t.plaza)}` : ''}</span>{t.ro && <span className="muted">RO {t.ro}</span>}</span>
                          <span className="pick-side">
                            {t.borradorId ? <span className="state warn">En curso</span> : t.ultima ? <><PctTag value={t.ultima.porcentaje} /><span className="muted">{fmtDate(t.ultima.fecha, { day: 'numeric', month: 'short' })}</span></> : <span className="muted">Sin evaluar</span>}
                          </span>
                        </button>
                      ))}
                      {sugerencias.length > MAX && <p className="pick-more">{sugerencias.length - MAX} más… sigue escribiendo para acotar.</p>}
                    </div>
                  ) : <p className="sug-vacio">Ninguna tienda coincide con “{q.trim()}”.</p>
                )}
                {!q.trim() && <p className="sug-ayuda">{tiendas.length} tiendas disponibles. Ejemplo: <b>50KXK</b> o <b>Abraham</b>.</p>}
              </div>
            )}
          </div>
        </section>

        <details className="panel inicio-preg" open={verPreg} onToggle={e => setVerPreg((e.target as HTMLDetailsElement).open)}>
          <summary><div className="panel-head"><h2><span className="step-n">2</span>Preguntas del checklist</h2><span className="muted">{preguntas.length}</span><Icon n="chevron" className="sum-chev" /></div></summary>
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
        </details>
      </div>

      <div className="inicio-bar">
        <div className="inicio-sel">
          {tienda ? <><span className="muted">Tienda seleccionada</span><b>{tienda.nombre}</b><span className="mono">CR {tienda.cr}</span></> : <span className="muted">Selecciona una tienda para comenzar</span>}
        </div>
        {puedeEvaluar
          ? <button className={`btn btn-primary btn-lg inicio-go ${tienda ? 'is-ready' : ''}`} type="button" disabled={!tienda || busy} onClick={iniciar}>
              <Icon n={tienda?.borradorId ? 'edit' : 'check'} /><span className="step-n inv">3</span>{busy ? 'Abriendo…' : tienda?.borradorId ? 'Continuar checklist' : 'Iniciar checklist'}
            </button>
          : <span className="state">Tu perfil es solo de consulta</span>}
      </div>
    </>
  );
}
