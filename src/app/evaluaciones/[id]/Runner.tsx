'use client';
import { u } from '@/lib/base';
/**
 * Ejecución del checklist (pensada para usarse con el celular en tienda).
 * - Cada respuesta se guarda al momento (autoguardado), así no se pierde nada si
 *   se cierra el navegador o se va la señal.
 * - Las fotos se comprimen en el teléfono (JPEG, máx. 1600 px) antes de subirse.
 * - "Finalizar" valida respuestas, fotos obligatorias y comentarios de hallazgos.
 */
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { api, Icon, Lightbox, PctTag, useToast, useAppRouter } from '@/components/ui';
import { calcular, faltaFoto } from '@/lib/score';
import { fmtDateTime, REGLAS_EVIDENCIA } from '@/lib/format';
import type { EvaluacionFull } from '@/lib/evaluaciones';

type Foto = { id: string; mime: string };
type Resp = { id: string; categoria: string; categoria_color: string; texto: string; ayuda: string | null; evidencia_regla: string; peso: number; resultado: string | null; comentario: string | null; fotos: Foto[] };

const OPCIONES = [
  { v: 'cumple', label: 'Cumple', icon: 'check', cls: 'o-done' },
  { v: 'no_cumple', label: 'No cumple', icon: 'x', cls: 'o-danger' },
  { v: 'no_aplica', label: 'No aplica', icon: 'equal', cls: 'o-na' },
];
const ACEPTA = 'image/jpeg,image/png,image/webp';

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

export default function Runner({ ev }: { ev: EvaluacionFull }) {
  const router = useAppRouter();
  const toast = useToast();
  const [resps, setResps] = useState<Resp[]>(() => ev.respuestas.map(r => ({
    id: r.id, categoria: r.categoria, categoria_color: r.categoria_color, texto: r.texto, ayuda: r.ayuda, evidencia_regla: r.evidencia_regla,
    peso: r.peso, resultado: r.resultado, comentario: r.comentario, fotos: r.evidencias.map(f => ({ id: f.id, mime: f.mime })),
  })));
  const [obs, setObs] = useState(ev.observaciones || '');
  const [saving, setSaving] = useState(0);
  const [subiendo, setSubiendo] = useState<Record<string, number>>({});
  const [problemas, setProblemas] = useState<Record<string, string>>({});
  const [lb, setLb] = useState<{ urls: string[]; i: number } | null>(null);
  const [finalizando, setFinalizando] = useState(false);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const stats = useMemo(() => calcular(resps.map(r => ({ resultado: r.resultado, peso: r.peso, evidenciaRegla: r.evidencia_regla }))), [resps]);
  const contestadas = stats.total - stats.pendientes;

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
  const setResultado = (r: Resp, v: string) => {
    const nuevo = r.resultado === v ? null : v; // tocar de nuevo la misma opción la quita
    upd(r.id, { resultado: nuevo });
    guardar({ respuestas: [{ id: r.id, resultado: nuevo }] });
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
      } catch (e) { toast(`No se subió la foto: ${(e as Error).message}`, true); }
      finally { setSubiendo(s => ({ ...s, [r.id]: s[r.id] - 1 })); }
    }
  };
  const quitarFoto = async (r: Resp, fotoId: string) => {
    try {
      await api(u(`/api/evidencias/${fotoId}`), { method: 'DELETE' });
      setResps(rs => rs.map(x => (x.id === r.id ? { ...x, fotos: x.fotos.filter(f => f.id !== fotoId) } : x)));
    } catch (e) { toast((e as Error).message, true); }
  };

  const finalizar = async () => {
    // Validación local primero (misma regla que el servidor) para señalar todo de una vez.
    const p: Record<string, string> = {};
    for (const r of resps) {
      if (!r.resultado) p[r.id] = 'Elige una respuesta';
      else if (faltaFoto({ resultado: r.resultado, peso: r.peso, evidenciaRegla: r.evidencia_regla, _fotos: r.fotos.length })) p[r.id] = 'Falta la foto de evidencia';
      else if (r.resultado === 'no_cumple' && !r.comentario?.trim()) p[r.id] = 'Describe el hallazgo en el comentario';
    }
    setProblemas(p);
    const first = Object.keys(p)[0];
    if (first) {
      document.getElementById(`q-${first}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      toast(`Faltan ${Object.keys(p).length} pregunta${Object.keys(p).length > 1 ? 's' : ''} por completar`, true);
      return;
    }
    if (!confirm('¿Finalizar la evaluación? Después ya no se podrá modificar.')) return;
    setFinalizando(true);
    Object.values(timers.current).forEach(clearTimeout);
    try {
      await api(u(`/api/evaluaciones/${ev.id}`), { method: 'PATCH', body: { observaciones: obs, respuestas: resps.map(r => ({ id: r.id, comentario: r.comentario })) } });
      await api(u(`/api/evaluaciones/${ev.id}/finalizar`), { body: {} });
      toast('Evaluación finalizada');
      router.refresh();
    } catch (e) {
      const d = (e as { data?: { problemas?: { id: string; motivo: string }[] } }).data;
      if (d?.problemas) setProblemas(Object.fromEntries(d.problemas.map(x => [x.id, x.motivo])));
      toast((e as Error).message, true);
      setFinalizando(false);
    }
  };
  const descartar = async () => {
    if (!confirm('¿Descartar este checklist? Se borran sus respuestas y fotos.')) return;
    try { await api(u(`/api/evaluaciones/${ev.id}`), { method: 'DELETE' }); router.push('/tiendas'); router.refresh(); }
    catch (e) { toast((e as Error).message, true); }
  };

  let cat = '';
  let n = 0;
  return (
    <>
      <header className="page-head">
        <nav className="crumbs"><Link href="/tiendas">Tiendas</Link><span className="sep"><Icon n="chevron" /></span>
          <Link href={`/tiendas/${encodeURIComponent(ev.tienda.cr)}`}>{ev.tienda.nombre}</Link><span className="sep"><Icon n="chevron" /></span><span aria-current="page">Checklist</span></nav>
        <div className="page-row">
          <div className="page-text">
            <h1>{ev.tienda.nombre} <span className="cr-chip">CR {ev.tienda.cr}</span></h1>
            <p className="page-sub"><span className="mono">{ev.folio}</span><span className="dot-sep" />{ev.evaluador.nombre}<span className="dot-sep" />Iniciado {fmtDateTime(ev.fecha)}</p>
          </div>
          <div className="page-actions"><button type="button" className="btn btn-ghost danger" onClick={descartar}><Icon n="trash" />Descartar</button></div>
        </div>
      </header>

      <div className="run-bar">
        <div className="run-prog">
          <div className="run-nums"><b>{contestadas}</b> de {stats.total} contestadas<span className="save-state">{saving > 0 ? 'Guardando…' : 'Guardado'}</span></div>
          <div className="bar lg stack"><span className="s-done" style={{ width: `${(stats.cumple / stats.total) * 100}%` }} /><span className="s-block" style={{ width: `${(stats.noCumple / stats.total) * 100}%` }} /><span className="s-na" style={{ width: `${(stats.noAplica / stats.total) * 100}%` }} /></div>
        </div>
        <div className="run-pct"><span className="kpi-l">Cumplimiento</span><PctTag value={stats.porcentaje} big /></div>
        <button className="btn btn-primary" type="button" onClick={finalizar} disabled={finalizando || saving > 0}><Icon n="check" />{finalizando ? 'Finalizando…' : 'Finalizar'}</button>
      </div>

      <div className="q-list">
        {resps.map(r => {
          n++;
          const head = r.categoria !== cat ? (cat = r.categoria) : null;
          const prob = problemas[r.id];
          const necesitaFoto = faltaFoto({ resultado: r.resultado, peso: r.peso, evidenciaRegla: r.evidencia_regla, _fotos: r.fotos.length });
          const urls = r.fotos.map(f => u(`/api/evidencias/${f.id}`));
          return (
            <div key={r.id}>
              {head && <h2 className="q-cat"><i className="sw lg" style={{ ['--c' as string]: r.categoria_color }} />{head}</h2>}
              <article id={`q-${r.id}`} className={`q-card ${prob ? 'has-problem' : ''} ${r.resultado ? `is-${r.resultado}` : ''}`}>
                <div className="q-head">
                  <span className="q-n">{n}</span>
                  <div className="q-text"><h3>{r.texto}</h3>{r.ayuda && <p>{r.ayuda}</p>}</div>
                </div>
                <div className="q-opts" role="radiogroup" aria-label="Respuesta">
                  {OPCIONES.map(o => (
                    <button key={o.v} type="button" role="radio" aria-checked={r.resultado === o.v} className={`q-opt ${o.cls} ${r.resultado === o.v ? 'is-on' : ''}`} onClick={() => setResultado(r, o.v)}>
                      <Icon n={o.icon} />{o.label}
                    </button>
                  ))}
                </div>
                <textarea className="q-comment" rows={2} value={r.comentario || ''} onChange={e => setComentario(r, e.target.value)}
                  placeholder={r.resultado === 'no_cumple' ? 'Describe el hallazgo (obligatorio)' : 'Comentarios (opcional)'} aria-label="Comentarios" />
                <div className="q-evid">
                  <div className="thumbs">
                    {r.fotos.map((f, i) => (
                      <div className="thumb" key={f.id}>
                        <button type="button" className="thumb-btn" onClick={() => setLb({ urls, i })}><img src={urls[i]} alt={`Evidencia ${i + 1}`} loading="lazy" /></button>
                        <button type="button" className="rm" aria-label="Quitar foto" onClick={() => quitarFoto(r, f.id)}><Icon n="x" /></button>
                      </div>
                    ))}
                    {Array.from({ length: subiendo[r.id] ?? 0 }).map((_, i) => <div className="thumb is-loading" key={`l${i}`} />)}
                    <label className="thumb add"><Icon n="camera" /><span>Tomar foto</span>
                      <input type="file" accept={ACEPTA} capture="environment" hidden onChange={e => { subir(r, e.target.files); e.target.value = ''; }} /></label>
                    <label className="thumb add"><Icon n="image" /><span>Galería</span>
                      <input type="file" accept={ACEPTA} multiple hidden onChange={e => { subir(r, e.target.files); e.target.value = ''; }} /></label>
                  </div>
                  <span className={`q-rule ${necesitaFoto ? 'is-need' : ''}`}><Icon n="camera" />{REGLAS_EVIDENCIA[r.evidencia_regla]}</span>
                </div>
                {prob && <p className="q-problem"><Icon n="alert" />{prob}</p>}
              </article>
            </div>
          );
        })}
      </div>

      <section className="panel obs-panel">
        <div className="panel-head"><h2>Observaciones generales</h2><span className="muted">Se incluyen en el PDF y en el correo</span></div>
        <textarea className="q-comment obs" rows={4} value={obs} onChange={e => setObservaciones(e.target.value)} placeholder="Resumen de la visita, acuerdos con el encargado, seguimiento…" />
      </section>
      <div className="run-end">
        <button className="btn btn-primary btn-lg" type="button" onClick={finalizar} disabled={finalizando || saving > 0}><Icon n="check" />{finalizando ? 'Finalizando…' : 'Finalizar evaluación'}</button>
      </div>
      <Lightbox urls={lb?.urls ?? []} index={lb?.i ?? null} onClose={() => setLb(null)} />
    </>
  );
}
