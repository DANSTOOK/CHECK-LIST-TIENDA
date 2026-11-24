'use client';
import { u } from '@/lib/base';
import { useState } from 'react';
import { api, Dialog, Icon, useToast, useAppRouter } from '@/components/ui';

type U = { id: string; nombre: string; email: string | null; rol: string; activo: boolean };
type F = { id?: string; nombre: string; email: string; rol: string; activo: boolean };
const ROL: Record<string, string> = { admin: 'Administrador', evaluador: 'Evaluador', consulta: 'Consulta' };

export default function UsuariosAdmin({ usuarios, yo, entra }: { usuarios: U[]; yo: string; entra: boolean }) {
  const router = useAppRouter();
  const toast = useToast();
  const [f, setF] = useState<F | null>(null);
  const guardar = async () => {
    if (!f) return;
    try {
      if (f.id) await api(u(`/api/usuarios/${f.id}`), { method: 'PATCH', body: f }); else await api(u('/api/usuarios'), { body: f });
      toast('Usuario guardado'); setF(null); router.refresh();
    } catch (e) { toast((e as Error).message, true); }
  };
  return (
    <>
      <header className="page-head"><div className="page-row">
        <div className="page-text"><h1>Usuarios</h1><p className="page-sub">{usuarios.filter(u => u.activo).length} activos</p></div>
        <div className="page-actions"><button className="btn btn-primary" type="button" onClick={() => setF({ nombre: '', email: '', rol: 'evaluador', activo: true })}><Icon n="plus" />Agregar usuario</button></div>
      </div></header>
      <div className="hint"><Icon n="info" /><p><b>Evaluador</b>: realiza checklists y consulta. <b>Consulta</b>: solo ve dashboard e historial. <b>Administrador</b>: además edita tiendas, preguntas, destinatarios y usuarios.{entra ? ' Con Microsoft Entra ID, las personas se dan de alta solas al entrar como Evaluador.' : ''}</p></div>
      <section className="panel"><div className="table tbl-users">
        <div className="tr th"><span>Nombre</span><span>Correo</span><span>Rol</span><span>Estado</span><span></span></div>
        {usuarios.map(u => (
          <div className="tr" key={u.id}>
            <span className="c-name"><b>{u.nombre}{u.id === yo ? ' (tú)' : ''}</b></span><span className="mono">{u.email || '—'}</span>
            <span><span className={`state ${u.rol === 'admin' ? 'brand' : ''}`}>{ROL[u.rol]}</span></span>
            <span><span className={`state ${u.activo ? 'done' : ''}`}>{u.activo ? 'Activo' : 'Inactivo'}</span></span>
            <span className="c-end"><button className="icon-btn" type="button" title="Editar" onClick={() => setF({ id: u.id, nombre: u.nombre, email: u.email ?? '', rol: u.rol, activo: u.activo })}><Icon n="edit" /></button></span>
          </div>
        ))}
      </div></section>
      <Dialog open={!!f} onClose={() => setF(null)} title={f?.id ? 'Editar usuario' : 'Nuevo usuario'} size="dlg-narrow" onSubmit={guardar}
        foot={<><button type="button" className="btn" onClick={() => setF(null)}>Cancelar</button><button className="btn btn-primary" type="submit">Guardar</button></>}>
        {f && <>
          <label className="field">Nombre<input required value={f.nombre} onChange={e => setF({ ...f, nombre: e.target.value })} /></label>
          <label className="field">Correo corporativo<input type="email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} placeholder="Necesario para Entra ID" /></label>
          <label className="field">Rol<select value={f.rol} onChange={e => setF({ ...f, rol: e.target.value })}>{Object.entries(ROL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label className="check-line"><input type="checkbox" checked={f.activo} onChange={e => setF({ ...f, activo: e.target.checked })} /> Activo</label>
        </>}
      </Dialog>
    </>
  );
}
