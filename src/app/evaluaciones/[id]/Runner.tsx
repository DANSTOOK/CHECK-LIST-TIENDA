'use client';
/**
 * Ejecución del checklist, pensada para validarse con el celular en tienda.
 *
 * Dos modos (se recuerda la preferencia en el dispositivo):
 *  - Paso a paso (predeterminado en celular): una pregunta por pantalla, botones
 *    grandes, foto con un toque, avance automático, deslizar ← → para moverse y un
 *    resumen final con observaciones y "Finalizar".
 *  - Lista (predeterminado en escritorio): todas las preguntas en una sola página.
 *
 * Cada respuesta y foto se guarda al momento (autoguardado), así no se pierde nada
 * si se cierra el navegador o se va la señal. Las fotos se comprimen en el teléfono
 * (JPEG, máx. 1600 px) antes de subirse. "Finalizar" valida respuestas, fotos
 * obligatorias y comentarios de hallazgos.
 */
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState, type TouchEvent } from 'react';
import { api, confetti, CountUp, Icon, Lightbox, PctTag, StarIcon, Stars, reduceMotion, useToast, useAppRouter } from '@/components/ui';
import { u } from '@/lib/base';
import { calcular, ESTRELLAS, etiquetaEstrellas, faltaFoto, resultadoDe } from '@/lib/score';
import { fmtDateTime, REGLAS_EVIDENCIA } from '@/lib/format';
import type { EvaluacionFull } from '@/lib/evaluaciones';

type Foto = { id: string; mime: string };
type Resp = { id: string; categoria: string; categoria_color: string; texto: string; ayuda: string | null; evidencia_regla: string; peso: number; resultado: string | null; calificacion: number | null; comentario: string | null; fotos: Foto[] };
type Modo = 'paso' | 'lista';

const ACEPTA = 'image/jpeg,image/png,image/webp';
const vibrar = (ms = 12) => { try { navigator.vibrate?.(ms); } catch { /* sin vibración */ } };

/** Reduce la foto a máx. 1600 px y la convierte a JPEG (también convierte WEBP/PNG). */
async function comprimir(file: File): Promise<File> {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const s = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise<Blob | null>(r => c.toBlob(r, 'image/jpeg', 0.82));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch { return file; }
}

/** Qué le falta a una respuesta para poder finalizar (o null si está completa). */
function pendiente(r: Resp) {
  if (!r.resultado) return 'Falta calificar';
  if (faltaFoto({ resultado: r.resultado, peso: r.peso, evidenciaRegla: r.evidencia_regla, _fotos: r.fotos.length })) return 'Falta la foto de evidencia';
  if (r.resultado === 'no_cumple' && !r.comentario?.trim()) return 'Describe el hallazgo';
  return null;
}

export default function Runner({ ev }: { ev: EvaluacionFull }) {
  const router = useAppRouter();
  const toast = useToast();
  const [resps, setResps] = useState<Resp[]>(() => ev.respuestas.map(r => ({
    id: r.id, categoria: r.categoria, categoria_color: r.categoria_color, texto: r.texto, ayuda: r.ayuda, evidencia_regla: r.evidencia_regla,
    peso: r.peso, resultado: r.resultado, calificacion: r.calificacion, comentario: r.comentario, fotos: r.evidencias.map(f => ({ id: f.id, mime: f.mime })),
  })));
  const [obs, setObs] = useState(ev.observaciones || '');
  const [saving, setSaving] = useState(0);
  const [subiendo, setSubiendo] = useState<Record<string, number>>({});
  const [problemas, setProblemas] = useState<Record<string, string>>({});
  const [lb, setLb] = useState<{ urls: string[]; i: number } | null>(null);
  const [finalizando, setFinalizando] = useState(false);
  const [modo, setModo] = useState<Modo>('paso');
  // Paso actual: 0..n-1 = preguntas, n = resumen. Arranca en la primera sin terminar.
  const [paso, setPaso] = useState(() => { const i = ev.respuestas.findIndex(r => !r.resultado); return i < 0 ? ev.respuestas.length : i; });
  const [dir, setDir] = useState<'next' | 'prev'>('next');
  const [destello, setDestello] = useState<string | null>(null); // pregunta que recibió 5 estrellas
  const [exito, setExito] = useState<number | null | undefined>(undefined); // pantalla de éxito al finalizar
  const [pista, setPista] = useState(false); // pista de "desliza" la primera vez
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const comentarioRef = useRef<HTMLTextAreaElement>(null);
  const toque = useRef<{ x: number; y: number } | null>(null);

  // Modo según el dispositivo (o lo que la persona eligió antes).
  useEffect(() => {
    let m: Modo = window.matchMedia('(max-width: 860px)').matches ? 'paso' : 'lista';
    try { const g = localStorage.getItem('ckl-modo'); if (g === 'paso' || g === 'lista') m = g; } catch { /* */ }
    setModo(m);
  }, []);
  useEffect(() => {
    if (modo !== 'paso') return;
    try { if (localStorage.getItem('ckl-pista-desliza')) return; } catch { return; }
    setPista(true);
    const t = setTimeout(() => cerrarPista(), 4200);
    return () => clearTimeout(t);
  }, [modo]);
  const cerrarPista = () => { setPista(false); try { localStorage.setItem('ckl-pista-desliza', '1'); } catch { /* */ } };
  const cambiarModo = (m: Modo) => { setModo(m); try { localStorage.setItem('ckl-modo', m); } catch { /* */ } };
  // Pantalla de captura sin distracciones en celular (oculta la barra de pestañas).
  useEffect(() => { document.body.classList.add('is-running'); return () => document.body.classList.remove('is-running'); }, []);

  const stats = useMemo(() => calcular(resps.map(r => ({ resultado: r.resultado, calificacion: r.calificacion, peso: r.peso, evidenciaRegla: r.evidencia_regla }))), [resps]);
  const contestadas = stats.total - stats.pendientes;
  const total = resps.length;

  const guardar = async (body: object) => {
    setSaving(n => n + 1);
    try { await api(u(`/api/evaluaciones/${ev.id}`), { method: 'PATCH', body }); }
    catch (e) { toast(`No se guardó: ${(e as Error).message}`, true); }
    finally { setSaving(n => n - 1); }
  };
  const upd = (id: string, patch: Partial<Resp>) => {
    setResps(rs => rs.map(r => (r.id === id ? { ...r, ...patch } : r)));
    setProblemas(p => { const { [id]: _, ...rest } = p; return rest; });
  };

  const ir = useCallback((i: number) => {
    const destino = Math.max(0, Math.min(total, i));
    setDir(destino >= paso ? 'next' : 'prev');
    setPaso(destino);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [paso, total]);

  /** Avance automático si ya no falta nada; si es hallazgo, pide el comentario. */
  const despues = (r: Resp, nuevo: string | null, idx: number) => {
    if (modo !== 'paso' || !nuevo) return;
    const siguiente = { ...r, resultado: nuevo };
    // Avance automático si ya no falta nada; si es hallazgo, pide el comentario.
    if (!pendiente(siguiente)) setTimeout(() => ir(idx + 1), 420);
    else if (nuevo === 'no_cumple' && !faltaFoto({ resultado: nuevo, peso: r.peso, evidenciaRegla: r.evidencia_regla, _fotos: r.fotos.length })) setTimeout(() => comentarioRef.current?.focus(), 150);
  };
  /** Calificación con estrellas: 4-5 cumple, 1-3 es hallazgo. */
  const calificar = (r: Resp, n: number, idx: number) => {
    vibrar();
    const resultado = resultadoDe(n);
    upd(r.id, { calificacion: n, resultado });
    guardar({ respuestas: [{ id: r.id, calificacion: n }] });
    if (n === 5) { setDestello(r.id); setTimeout(() => setDestello(d => (d === r.id ? null : d)), 900); }
    despues(r, resultado, idx);
  };
  /** "No aplica" (tocar de nuevo lo quita). */
  const noAplica = (r: Resp, idx: number) => {
    vibrar();
    const nuevo = r.resultado === 'no_aplica' ? null : 'no_aplica';
    upd(r.id, { calificacion: null, resultado: nuevo });
    guardar({ respuestas: [{ id: r.id, resultado: nuevo }] });
    despues(r, nuevo, idx);
  };
  const setComentario = (r: Resp, txt: string) => {
    upd(r.id, { comentario: txt });
    clearTimeout(timers.current[r.id]);
    timers.current[r.id] = setTimeout(() => guardar({ respuestas: [{ id: r.id, comentario: txt }] }), 700);
  };
  const setObservaciones = (txt: string) => {
    setObs(txt);
    clearTimeout(timers.current.obs);
    timers.current.obs = setTimeout(() => guardar({ observaciones: txt }), 800);
  };
  useEffect(() => () => Object.values(timers.current).forEach(clearTimeout), []);

  const subir = async (r: Resp, files: FileList | null) => {
    if (!files?.length) return;
    const lista = [...files].filter(f => ACEPTA.split(',').includes(f.type));
    if (lista.length < files.length) toast('Solo se aceptan fotos JPG, PNG o WEBP', true);
    for (const f of lista) {
      setSubiendo(s => ({ ...s, [r.id]: (s[r.id] ?? 0) + 1 }));
      try {
        const fd = new FormData();
        fd.append('respuestaId', r.id);
        fd.append('file', await comprimir(f));
        const foto = await api<Foto>(u(`/api/evaluaciones/${ev.id}/evidencias`), { body: fd });
        setResps(rs => rs.map(x => (x.id === r.id ? { ...x, fotos: [...x.fotos, foto] } : x)));
        setProblemas(p => { const { [r.id]: _, ...rest } = p; return rest; });
        vibrar(18);
        toast('Foto guardada');
      } catch (e) { toast(`No se subió la foto: ${(e as Error).message}`, true); }
      finally { setSubiendo(s => ({ ...s, [r.id]: s[r.id] - 1 })); }
    }
  };
  const quitarFoto = async (r: Resp, fotoId: string) => {
    if (!confirm('¿Quitar esta foto?')) return;
    try {
      await api(u(`/api/evidencias/${fotoId}`), { method: 'DELETE' });
      setResps(rs => rs.map(x => (x.id === r.id ? { ...x, fotos: x.fotos.filter(f => f.id !== fotoId) } : x)));
    } catch (e) { toast((e as Error).message, true); }
  };

  const finalizar = async () => {
    // Validación local primero (misma regla que el servidor) para señalar todo de una vez.
    const p: Record<string, string> = {};
    for (const r of resps) { const m = pendiente(r); if (m) p[r.id] = m; }
    setProblemas(p);
    const faltan = Object.keys(p);
    if (faltan.length) {
      vibrar(60);
      toast(`Faltan ${faltan.length} pregunta${faltan.length > 1 ? 's' : ''} por completar`, true);
      if (modo === 'paso') ir(resps.findIndex(r => r.id === faltan[0]));
      else document.getElementById(`q-${faltan[0]}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (!confirm('¿Finalizar la evaluación? Después ya no se podrá modificar.')) return;
    setFinalizando(true);
    Object.values(timers.current).forEach(clearTimeout);
    try {
      await api(u(`/api/evaluaciones/${ev.id}`), { method: 'PATCH', body: { observaciones: obs, respuestas: resps.map(r => ({ id: r.id, comentario: r.comentario })) } });
      await api(u(`/api/evaluaciones/${ev.id}/finalizar`), { body: {} });
      vibrar(30);
      setExito(stats.porcentaje);
      confetti((stats.porcentaje ?? 0) >= 90);
      setTimeout(() => router.refresh(), reduceMotion() ? 300 : 2200);
    } catch (e) {
      const d = (e as { data?: { problemas?: { id: string; motivo: string }[] } }).data;
      if (d?.problemas) setProblemas(Object.fromEntries(d.problemas.map(x => [x.id, x.motivo])));
      toast((e as Error).message, true);
      setFinalizando(false);
    }
  };
  const descartar = async () => {
    if (!confirm('¿Descartar este checklist? Se borran sus respuestas y fotos.')) return;
    try { await api(u(`/api/evaluaciones/${ev.id}`), { method: 'DELETE' }); router.push('/'); router.refresh(); }
    catch (e) { toast((e as Error).message, true); }
  };

  // Deslizar a la izquierda/derecha para cambiar de pregunta (modo paso a paso).
  const onTouchStart = (e: TouchEvent) => { const t = e.touches[0]; toque.current = { x: t.clientX, y: t.clientY }; };
  const onTouchEnd = (e: TouchEvent) => {
    const s = toque.current; toque.current = null;
    if (!s || (e.target as HTMLElement).closest('textarea, input, .thumbs')) return;
    const t = e.changedTouches[0]; const dx = t.clientX - s.x; const dy = t.clientY - s.y;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) ir(paso + (dx < 0 ? 1 : -1));
  };

  /** Tarjeta de una pregunta (se usa en ambos modos; "grande" para paso a paso). */
  const tarjeta = (r: Resp, idx: number, grande: boolean) => {
    const prob = problemas[r.id];
    const necesitaFoto = faltaFoto({ resultado: r.resultado, peso: r.peso, evidenciaRegla: r.evidencia_regla, _fotos: r.fotos.length });
    const urls = r.fotos.map(f => u(`/api/evidencias/${f.id}`));
    const cargando = subiendo[r.id] ?? 0;
    return (
      <article id={`q-${r.id}`} className={`q-card ${grande ? 'q-big' : ''} ${prob ? 'has-problem' : ''} ${r.resultado ? `is-${r.resultado}` : ''}`}>
        <div className="q-head">
          <span className="q-n">{idx + 1}</span>
          <div className="q-text">
            {grande && <span className="q-catname"><i className="sw" style={{ ['--c' as string]: r.categoria_color }} />{r.categoria}</span>}
            <h3>{r.texto}</h3>{r.ayuda && <p>{r.ayuda}</p>}
          </div>
        </div>
        <div className={'rate' + (r.resultado === 'no_aplica' ? ' is-na' : '') + (destello === r.id ? ' is-burst' : '')}>
          <div className="rate-stars" role="radiogroup" aria-label="Calificación de 1 a 5 estrellas">
            {ESTRELLAS.map(e => (
              <button key={e.n} type="button" role="radio" aria-checked={r.calificacion === e.n} aria-label={e.n + (e.n > 1 ? ' estrellas: ' : ' estrella: ') + e.label}
                className={'rate-star' + ((r.calificacion ?? 0) >= e.n ? ' is-on' : '') + (r.calificacion != null && r.calificacion <= 3 ? ' is-low' : '')} onClick={() => calificar(r, e.n, idx)}>
                <StarIcon on={(r.calificacion ?? 0) >= e.n} />
              </button>
            ))}
          </div>
          <div className="rate-foot">
            <span className={'rate-label' + (r.calificacion != null ? (r.calificacion <= 3 ? ' t-danger' : ' t-done') : '')}>
              {r.resultado === 'no_aplica' ? 'No aplica en esta tienda' : r.calificacion ? r.calificacion + ' de 5 · ' + etiquetaEstrellas(r.calificacion) + (r.calificacion <= 3 ? ' · hallazgo' : '') : 'Toca las estrellas para calificar'}
            </span>
            <button type="button" className={'na-btn' + (r.resultado === 'no_aplica' ? ' is-on' : '')} onClick={() => noAplica(r, idx)}>No aplica</button>
          </div>
        </div>
        <div className={`q-evid ${necesitaFoto ? 'is-need' : ''}`}>
          <div className="q-evid-head">
            <span className={`q-rule ${necesitaFoto ? 'is-need' : ''}`}><Icon n="camera" />{necesitaFoto ? 'Toma la foto de evidencia para continuar' : REGLAS_EVIDENCIA[r.evidencia_regla]}</span>
            {r.fotos.length > 0 && <span className="q-count">{r.fotos.length} foto{r.fotos.length > 1 ? 's' : ''}</span>}
          </div>
          <div className="cam-row">
            <label className={`btn cam-btn ${necesitaFoto ? 'btn-primary' : ''}`}><Icon n="camera" />Tomar foto
              <input type="file" accept={ACEPTA} capture="environment" hidden onChange={e => { subir(r, e.target.files); e.target.value = ''; }} /></label>
            <label className="btn cam-btn"><Icon n="image" />Galería
              <input type="file" accept={ACEPTA} multiple hidden onChange={e => { subir(r, e.target.files); e.target.value = ''; }} /></label>
          </div>
          {(r.fotos.length > 0 || cargando > 0) && (
            <div className="thumbs">
              {r.fotos.map((f, i) => (
                <div className="thumb" key={f.id}>
                  <button type="button" className="thumb-btn" onClick={() => setLb({ urls, i })}><img src={urls[i]} alt={`Evidencia ${i + 1}`} loading="lazy" /></button>
                  <button type="button" className="rm" aria-label="Quitar foto" onClick={() => quitarFoto(r, f.id)}><Icon n="x" /></button>
                </div>
              ))}
              {Array.from({ length: cargando }).map((_, i) => <div className="thumb is-loading" key={`l${i}`} />)}
            </div>
          )}
        </div>
        <textarea ref={grande ? comentarioRef : undefined} className={`q-comment ${r.resultado === 'no_cumple' && !r.comentario?.trim() ? 'is-need' : ''}`} rows={grande ? 3 : 2}
          value={r.comentario || ''} onChange={e => setComentario(r, e.target.value)}
          placeholder={r.resultado === 'no_cumple' ? 'Describe el hallazgo (obligatorio)' : 'Comentarios (opcional)'} aria-label="Comentarios" />
        {prob && <p className="q-problem"><Icon n="alert" />{prob}</p>}
      </article>
    );
  };

  const estadoPaso = (r: Resp) => (problemas[r.id] ? 'prob' : !r.resultado ? 'pend' : pendiente(r) ? 'falta' : r.resultado);
  const enResumen = paso >= total;
  const actual = resps[paso];
  let cat = '';

  return (
    <div className={`runner modo-${modo}`}>
      <header className="run-head">
        <div className="run-title">
          <Link href="/" className="icon-btn run-exit" aria-label="Salir (se guarda lo avanzado)"><Icon n="x" /></Link>
          <div className="run-store">
            <b>{ev.tienda.nombre}</b>
            <span className="mono">CR {ev.tienda.cr} · {ev.folio}</span>
          </div>
          <span className={`save-dot ${saving > 0 ? 'is-saving' : ''}`} title={saving > 0 ? 'Guardando…' : 'Guardado'}>{saving > 0 ? 'Guardando…' : 'Guardado'}</span>
        </div>
        <div className="run-progress" aria-hidden="true"><span style={{ width: `${(contestadas / total) * 100}%` }} /></div>
        <div className="run-steps" role="tablist" aria-label="Preguntas">
          {resps.map((r, i) => (
            <button key={r.id + estadoPaso(r)} type="button" role="tab" aria-selected={modo === 'paso' && paso === i} aria-label={`Pregunta ${i + 1}`}
              className={`step s-${estadoPaso(r)} ${modo === 'paso' && paso === i ? 'is-current' : ''}`}
              onClick={() => (modo === 'paso' ? ir(i) : document.getElementById(`q-${r.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }))}>
              {i + 1}
            </button>
          ))}
          <button type="button" className={`step s-fin ${modo === 'paso' && enResumen ? 'is-current' : ''}`} aria-label="Resumen y finalizar" onClick={() => (modo === 'paso' ? ir(total) : document.getElementById('run-fin')?.scrollIntoView({ behavior: 'smooth' }))}>
            <Icon n="check" />
          </button>
        </div>
        <div className="run-meta">
          <span><b>{contestadas}</b>/{total} contestadas</span>
          <span className="run-pctmini">Cumplimiento <PctTag value={stats.porcentaje} /></span>
          <div className="seg seg-sm" aria-label="Vista">
            <button type="button" className={modo === 'paso' ? 'is-active' : ''} onClick={() => cambiarModo('paso')}>Paso a paso</button>
            <button type="button" className={modo === 'lista' ? 'is-active' : ''} onClick={() => cambiarModo('lista')}>Lista</button>
          </div>
        </div>
      </header>

      {modo === 'paso' ? (
        <div className="run-stage" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          {!enResumen && actual ? (
            <div key={actual.id} className={`slide slide-${dir}`}>{tarjeta(actual, paso, true)}</div>
          ) : (
            <div key="fin" className={`slide slide-${dir}`}>
              <section className="panel resumen">
                <div className="panel-head"><h2>Resumen</h2><span className="muted">Revisa antes de finalizar</span></div>
                <div className="res-big"><PctTag value={stats.porcentaje} big animado /><span className="muted">{stats.cumple} bien (4-5★) · {stats.noCumple} hallazgos (1-3★) · {stats.noAplica} no aplican</span></div>
                <ul className="res-list">
                  {resps.map((r, i) => {
                    const m = problemas[r.id] || pendiente(r);
                    return (
                      <li key={r.id}>
                        <button type="button" onClick={() => ir(i)} className={m ? 'is-bad' : ''}>
                          <span className={`dot d-${r.resultado ?? 'pend'}`} />
                          <span className="rl-txt"><b>{i + 1}. {r.texto}</b>{r.calificacion ? <Stars value={r.calificacion} small /> : r.resultado === 'no_aplica' ? <span>No aplica</span> : null}{m ? <em>{m}</em> : <span>{r.fotos.length} foto{r.fotos.length === 1 ? '' : 's'}{r.comentario ? ' · con comentario' : ''}</span>}</span>
                          <Icon n="chevron" className="chev" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
              <section className="panel obs-panel">
                <div className="panel-head"><h2>Observaciones generales</h2><span className="muted">Van en el PDF y el correo</span></div>
                <textarea className="q-comment obs" rows={4} value={obs} onChange={e => setObservaciones(e.target.value)} placeholder="Resumen de la visita, acuerdos con el encargado, seguimiento…" />
              </section>
              <button type="button" className="btn btn-ghost danger run-discard" onClick={descartar}><Icon n="trash" />Descartar checklist</button>
            </div>
          )}
          <div className="run-nav">
            <button type="button" className="btn run-prev" onClick={() => ir(paso - 1)} disabled={paso === 0} aria-label="Anterior"><Icon n="chevron" />Anterior</button>
            {enResumen
              ? <button type="button" className="btn btn-primary run-next" onClick={finalizar} disabled={finalizando || saving > 0}><Icon n="check" />{finalizando ? 'Finalizando…' : 'Finalizar evaluación'}</button>
              : <button type="button" className={`btn run-next ${actual && !pendiente(actual) ? 'btn-primary is-ready' : ''}`} onClick={() => ir(paso + 1)}>{paso === total - 1 ? 'Ir al resumen' : 'Siguiente'}<Icon n="chevron" /></button>}
          </div>
        </div>
      ) : (
        <>
          <div className="q-list">
            {resps.map((r, i) => {
              const head = r.categoria !== cat ? (cat = r.categoria) : null;
              return (
                <div key={r.id}>
                  {head && <h2 className="q-cat"><i className="sw lg" style={{ ['--c' as string]: r.categoria_color }} />{head}</h2>}
                  {tarjeta(r, i, false)}
                </div>
              );
            })}
          </div>
          <section className="panel obs-panel" id="run-fin">
            <div className="panel-head"><h2>Observaciones generales</h2><span className="muted">Se incluyen en el PDF y en el correo</span></div>
            <textarea className="q-comment obs" rows={4} value={obs} onChange={e => setObservaciones(e.target.value)} placeholder="Resumen de la visita, acuerdos con el encargado, seguimiento…" />
          </section>
          <div className="run-end">
            <button type="button" className="btn btn-ghost danger" onClick={descartar}><Icon n="trash" />Descartar</button>
            <button className="btn btn-primary btn-lg" type="button" onClick={finalizar} disabled={finalizando || saving > 0}><Icon n="check" />{finalizando ? 'Finalizando…' : 'Finalizar evaluación'}</button>
          </div>
          <p className="run-foot muted">Iniciado {fmtDateTime(ev.fecha)} por {ev.evaluador.nombre}</p>
        </>
      )}
      <Lightbox urls={lb?.urls ?? []} index={lb?.i ?? null} onClose={() => setLb(null)} />
      {pista && modo === 'paso' && (
        <button type="button" className="swipe-hint" onClick={cerrarPista} aria-label="Cerrar pista">
          <span className="swipe-hand" aria-hidden="true">👆</span>
          <b>Desliza a la izquierda o derecha</b>
          <span>para cambiar de pregunta</span>
        </button>
      )}
      {exito !== undefined && (
        <div className="exito" role="status">
          <div className="exito-card">
            <svg className="exito-check" viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="24" /><path d="M15 27l7 7 15-16" /></svg>
            <h2>¡Evaluación finalizada!</h2>
            <p className="exito-pct"><CountUp value={exito} /></p>
            <p className="muted">{ev.tienda.nombre} · CR {ev.tienda.cr}</p>
          </div>
        </div>
      )}
    </div>
  );
}
