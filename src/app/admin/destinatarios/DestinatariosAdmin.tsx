'use client';
import { u } from '@/lib/base';
// Destinatarios del correo de resultados, configurables por área (categoría) y plaza.
import { useState } from 'react';
import { api, Dialog, Empty, Icon, useToast, useAppRouter } from '@/components/ui';

type Dest = { id: string; nombre: string; email: string; tipo: string; categoria_id: string | null; plaza: string | null; activo: boolean };
type F = { id?: string; nombre: string; email: string; tipo: string; categoriaId: string; plaza: string; activo: boolean };

export default function DestinatariosAdmin({ lista, categorias, plazas }: { lista: Dest[]; categorias: { id: string; nombre: string }[]; plazas: string[] }) {
  const router = useAppRouter();
  const toast = useToast();
  const [f, setF] = useState<F | null>(null);
  const area = (id: string | null) => (id ? categorias.find(c => c.id === id)?.nombre ?? '—' : 'General (todas)');
  const guardar = async () => {
    if (!f) return;
    try {
      if (f.id) await api(u(`/api/destinatarios/${f.id}`), { method: 'PATCH', body: f }); else await api(u('/api/destinatarios'), { body: f });
      toast('Destinatario guardado'); setF(null); router.refresh();
    } catch (e) { toast((e as Error).message, true); }
  };
  const borrar = async () => {
    if (!f?.id || !confirm(`¿Quitar a ${f.nombre}?`)) return;
    try { await api(u(`/api/destinatarios/${f.id}`), { method: 'DELETE' }); toast('Destinatario quitado'); setF(null); router.refresh(); }
    catch (e) { toast((e as Error).message, true); }
  };
  const nuevo = () => setF({ nombre: '', email: '', tipo: 'to', categoriaId: '', plaza: '', activo: true });

  return (
    <>
      <header className="page-head"><div className="page-row">
        <div className="page-text"><h1>Destinatarios de correo</h1><p className="page-sub">Quién recibe el resultado de cada checklist</p></div>
        <div className="page-actions"><button className="btn btn-primary" type="button" onClick={nuevo}><Icon n="plus" />Agregar destinatario</button></div>
      </div></header>
      <div className="hint"><Icon n="info" /><p><b>General</b>: recibe todas las evaluaciones. <b>Por área</b>: solo cuando hay hallazgos en esa categoría. Con <b>plaza</b>, solo las tiendas de esa plaza. Siempre se pueden ajustar antes de generar el correo.</p></div>
      <section className="panel">
        {lista.length ? (
          <div className="table tbl-dest">
            <div className="tr th"><span>Nombre</span><span>Correo</span><span>Tipo</span><span>Área</span><span>Plaza</span><span></span></div>
            {lista.map(d => (
              <div className="tr" key={d.id} style={d.activo ? undefined : { opacity: 0.5 }}>
                <span className="c-name"><b>{d.nombre}</b></span><span className="mono">{d.email}</span>
                <span><span className="state">{d.tipo === 'cc' ? 'CC' : 'Para'}</span></span>
                <span>{area(d.categoria_id)}</span><span>{d.plaza || 'Todas'}</span>
                <span className="c-end"><button className="icon-btn" type="button" title="Editar" onClick={() => setF({ id: d.id, nombre: d.nombre, email: d.email, tipo: d.tipo, categoriaId: d.categoria_id ?? '', plaza: d.plaza ?? '', activo: d.activo })}><Icon n="edit" /></button></span>
              </div>
            ))}
          </div>
        ) : <Empty icon="mail" title="Sin destinatarios"><p>Agrega a los responsables de cada área para que el correo se arme solo.</p><button className="btn btn-primary" type="button" onClick={nuevo}><Icon n="plus" />Agregar destinatario</button></Empty>}
      </section>

      <Dialog open={!!f} onClose={() => setF(null)} title={f?.id ? 'Editar destinatario' : 'Nuevo destinatario'} onSubmit={guardar}
        foot={<>{f?.id && <button type="button" className="btn btn-ghost danger push-left" onClick={borrar}><Icon n="trash" />Quitar</button>}
          <button type="button" className="btn" onClick={() => setF(null)}>Cancelar</button><button className="btn btn-primary" type="submit">Guardar</button></>}>
        {f && <>
          <div className="grid-2">
            <label className="field">Nombre<input required value={f.nombre} onChange={e => setF({ ...f, nombre: e.target.value })} placeholder="Ej. Gerente de Operaciones" /></label>
            <label className="field">Correo<input required type="email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} placeholder="nombre@oxxo.com" /></label>
            <label className="field">Área<select value={f.categoriaId} onChange={e => setF({ ...f, categoriaId: e.target.value })}><option value="">General (todas las evaluaciones)</option>{categorias.map(c => <option key={c.id} value={c.id}>{c.nombre} (si hay hallazgos)</option>)}</select></label>
            <label className="field">Plaza<input list="dl-plazas" value={f.plaza} onChange={e => setF({ ...f, plaza: e.target.value })} placeholder="Todas" /></label>
            <label className="field">Enviar como<select value={f.tipo} onChange={e => setF({ ...f, tipo: e.target.value })}><option value="to">Para</option><option value="cc">CC</option></select></label>
          </div>
          <datalist id="dl-plazas">{plazas.map(p => <option key={p} value={p} />)}</datalist>
          <label className="check-line"><input type="checkbox" checked={f.activo} onChange={e => setF({ ...f, activo: e.target.checked })} /> Activo</label>
        </>}
      </Dialog>
    </>
  );
}
