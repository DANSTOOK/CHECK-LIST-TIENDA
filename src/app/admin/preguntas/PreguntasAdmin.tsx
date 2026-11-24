'use client';
import { u } from '@/lib/base';
/**
 * Administración de preguntas y categorías, sin tocar código.
 * Los cambios aplican a los checklists que se inicien después; los ya iniciados o
 * finalizados conservan su propia copia de las preguntas.
 */
import { useState } from 'react';
import { api, Dialog, Icon, useToast, useAppRouter } from '@/components/ui';
import { REGLAS_EVIDENCIA } from '@/lib/format';

type Cat = { id: string; nombre: string; color: string; orden: number };
type Preg = { id: string; categoria_id: string; texto: string; ayuda: string | null; evidencia: string; peso: number; orden: number; activa: boolean; usos: number };
type PForm = { id?: string; texto: string; ayuda: string; categoriaId: string; evidencia: string; peso: number };

export default function PreguntasAdmin({ categorias, preguntas }: { categorias: Cat[]; preguntas: Preg[] }) {
  const router = useAppRouter();
  const toast = useToast();
  const [pf, setPf] = useState<PForm | null>(null);
  const [cf, setCf] = useState<{ id?: string; nombre: string; color: string } | null>(null);
  const run = async (fn: () => Promise<unknown>, msg: string) => {
    try { await fn(); toast(msg); router.refresh(); return true; } catch (e) { toast((e as Error).message, true); return false; }
  };
  const guardarP = async () => {
    if (!pf) return;
    if (await run(() => pf.id ? api(u(`/api/preguntas/${pf.id}`), { method: 'PATCH', body: pf }) : api(u('/api/preguntas'), { body: pf }), pf.id ? 'Pregunta actualizada' : 'Pregunta agregada')) setPf(null);
  };
  const guardarC = async () => {
    if (!cf) return;
    if (await run(() => cf.id ? api(u(`/api/categorias/${cf.id}`), { method: 'PATCH', body: cf }) : api(u('/api/categorias'), { body: cf }), 'Categoría guardada')) setCf(null);
  };
  const eliminarP = (p: Preg) => {
    const msg = p.usos ? 'Esta pregunta ya se usó en evaluaciones: se desactivará y el historial la conserva. ¿Continuar?' : '¿Eliminar esta pregunta?';
    if (confirm(msg)) run(() => api(u(`/api/preguntas/${p.id}`), { method: 'DELETE' }), p.usos ? 'Pregunta desactivada' : 'Pregunta eliminada');
  };
  const activas = preguntas.filter(p => p.activa).length;

  return (
    <>
      <header className="page-head">
        <div className="page-row">
          <div className="page-text"><h1>Preguntas del checklist</h1><p className="page-sub">{activas} preguntas activas en {categorias.length} categorías</p></div>
          <div className="page-actions">
            <button className="btn" type="button" onClick={() => setCf({ nombre: '', color: '#36608f' })}><Icon n="plus" />Categoría</button>
            <button className="btn btn-primary" type="button" onClick={() => setPf({ texto: '', ayuda: '', categoriaId: categorias[0]?.id ?? '', evidencia: 'no_cumple', peso: 1 })}><Icon n="plus" />Nueva pregunta</button>
          </div>
        </div>
      </header>
      <div className="hint"><Icon n="info" /><p>Los cambios aplican a los checklists que se inicien a partir de ahora. Las evaluaciones anteriores conservan las preguntas tal como se hicieron.</p></div>

      <section className="panel">
        {categorias.map(c => {
          const ps = preguntas.filter(p => p.categoria_id === c.id);
          return (
            <div className="adm-cat" key={c.id}>
              <div className="adm-cat-head">
                <i className="sw lg" style={{ ['--c' as string]: c.color }} /><h3>{c.nombre}</h3><span className="c-count">{ps.filter(p => p.activa).length} activas</span>
                <button className="icon-btn" type="button" title="Editar categoría" onClick={() => setCf({ id: c.id, nombre: c.nombre, color: c.color })}><Icon n="edit" /></button>
                {!ps.length && <button className="icon-btn danger" type="button" title="Eliminar categoría" onClick={() => confirm(`¿Eliminar la categoría ${c.nombre}?`) && run(() => api(u(`/api/categorias/${c.id}`), { method: 'DELETE' }), 'Categoría eliminada')}><Icon n="trash" /></button>}
              </div>
              {ps.length === 0 && <p className="empty sm">Sin preguntas. <button type="button" className="link-btn" onClick={() => setPf({ texto: '', ayuda: '', categoriaId: c.id, evidencia: 'no_cumple', peso: 1 })}>Agregar una</button></p>}
              {ps.map((p, i) => (
                <div className={`adm-q ${p.activa ? '' : 'is-off'}`} key={p.id}>
                  <span className="q-n">{i + 1}</span>
                  <div>
                    <b>{p.texto}</b>{p.ayuda && <p>{p.ayuda}</p>}
                    <div className="adm-meta">
                      <span className="state">{REGLAS_EVIDENCIA[p.evidencia]}</span>
                      {p.peso > 1 && <span className="state info">Peso {p.peso}</span>}
                      {!p.activa && <span className="state warn">Inactiva</span>}
                      {p.usos > 0 && <span className="state">Usada en {p.usos} evaluaci{p.usos === 1 ? 'ón' : 'ones'}</span>}
                    </div>
                  </div>
                  <div className="adm-acts">
                    <button className="icon-btn" type="button" title="Subir" disabled={i === 0} onClick={() => run(() => api(u(`/api/preguntas/${p.id}`), { method: 'PATCH', body: { mover: 'up' } }), 'Orden actualizado')}><Icon n="up" /></button>
                    <button className="icon-btn" type="button" title="Bajar" disabled={i === ps.length - 1} onClick={() => run(() => api(u(`/api/preguntas/${p.id}`), { method: 'PATCH', body: { mover: 'down' } }), 'Orden actualizado')}><Icon n="down" /></button>
                    <button className="icon-btn" type="button" title="Editar" onClick={() => setPf({ id: p.id, texto: p.texto, ayuda: p.ayuda ?? '', categoriaId: p.categoria_id, evidencia: p.evidencia, peso: p.peso })}><Icon n="edit" /></button>
                    {p.activa
                      ? <button className="icon-btn danger" type="button" title="Eliminar" onClick={() => eliminarP(p)}><Icon n="trash" /></button>
                      : <button className="btn btn-sm" type="button" onClick={() => run(() => api(u(`/api/preguntas/${p.id}`), { method: 'PATCH', body: { activa: true } }), 'Pregunta activada')}>Activar</button>}
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </section>

      <Dialog open={!!pf} onClose={() => setPf(null)} title={pf?.id ? 'Editar pregunta' : 'Nueva pregunta'} size="dlg-wide" onSubmit={guardarP}
        foot={<><button type="button" className="btn" onClick={() => setPf(null)}>Cancelar</button><button className="btn btn-primary" type="submit">Guardar pregunta</button></>}>
        {pf && <>
          <label className="field">Pregunta<textarea rows={2} required value={pf.texto} onChange={e => setPf({ ...pf, texto: e.target.value })} placeholder="Ej. Verifica que los extintores estén vigentes y accesibles" /></label>
          <label className="field">Detalle o criterio (lo ve el evaluador)<textarea rows={2} value={pf.ayuda} onChange={e => setPf({ ...pf, ayuda: e.target.value })} placeholder="Qué revisar y cómo calificar" /></label>
          <div className="grid-3">
            <label className="field">Categoría<select value={pf.categoriaId} onChange={e => setPf({ ...pf, categoriaId: e.target.value })}>{categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></label>
            <label className="field">Foto de evidencia<select value={pf.evidencia} onChange={e => setPf({ ...pf, evidencia: e.target.value })}>
              <option value="siempre">Obligatoria siempre</option><option value="no_cumple">Obligatoria con 3 estrellas o menos</option><option value="opcional">Opcional</option></select></label>
            <label className="field">Peso en el %<input type="number" min={1} max={10} value={pf.peso} onChange={e => setPf({ ...pf, peso: Number(e.target.value) })} /></label>
          </div>
          <p className="field-hint">Peso: 1 = normal. Una pregunta con peso 2 cuenta el doble en el % de cumplimiento.</p>
        </>}
      </Dialog>

      <Dialog open={!!cf} onClose={() => setCf(null)} title={cf?.id ? 'Editar categoría' : 'Nueva categoría'} size="dlg-narrow" onSubmit={guardarC}
        foot={<><button type="button" className="btn" onClick={() => setCf(null)}>Cancelar</button><button className="btn btn-primary" type="submit">Guardar</button></>}>
        {cf && <div className="grid-2 cat-form">
          <label className="field span-2">Nombre<input required value={cf.nombre} onChange={e => setCf({ ...cf, nombre: e.target.value })} placeholder="Ej. Seguridad" /></label>
          <label className="field">Color<input type="color" className="color-in" value={cf.color} onChange={e => setCf({ ...cf, color: e.target.value })} /></label>
        </div>}
        <p className="field-hint">La categoría también es el &ldquo;área&rdquo; a la que se envía el correo cuando hay hallazgos.</p>
      </Dialog>
    </>
  );
}
