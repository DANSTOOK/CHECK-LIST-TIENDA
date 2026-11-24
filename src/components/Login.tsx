'use client';
import { u } from '@/lib/base';
// Pantalla de acceso. Con Entra ID: botón de Microsoft. En modo local: "¿Quién está evaluando?"
// (mismo flujo que "¿Quién está actualizando?" del planificador).
import { useEffect, useState } from 'react';
import { api, Icon, useToast, useAppRouter } from './ui';

export default function Login({ entra }: { entra: boolean }) {
  const router = useAppRouter();
  const toast = useToast();
  const [usuarios, setUsuarios] = useState<{ id: string; nombre: string; rol: string }[]>([]);
  const [nombre, setNombre] = useState('');
  useEffect(() => { if (!entra) api<{ usuarios: typeof usuarios }>(u('/api/sesion')).then(d => setUsuarios(d.usuarios)); }, [entra]);

  const entrar = async (body: { usuarioId?: string; nombre?: string }) => {
    try { await api(u('/api/sesion'), { body }); router.refresh(); } catch (e) { toast((e as Error).message, true); }
  };

  return (
    <div className="login">
      <div className="login-card panel">
        <div className="brand"><span className="brand-mark" aria-hidden="true"><i></i><i></i><i></i></span>
          <span className="brand-text">Checklist Operativo<small>Evaluación de tiendas</small></span></div>
        {entra ? (
          <>
            <p className="dlg-note">Entra con tu cuenta corporativa de Microsoft.</p>
            <a className="btn btn-primary" href={u("/api/auth/signin/azure-ad?callbackUrl=/")}>Entrar con Microsoft</a>
          </>
        ) : (
          <>
            <h1>¿Quién está evaluando?</h1>
            <p className="dlg-note">Tu nombre aparece en cada evaluación, foto y reporte.</p>
            {usuarios.length > 0 && (
              <div className="login-users">
                {usuarios.map(u => (
                  <button key={u.id} type="button" className="login-user" onClick={() => entrar({ usuarioId: u.id })}>
                    <span className="avatar sm">{u.nombre.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase()}</span>
                    <span>{u.nombre}</span><Icon n="chevron" className="chev" />
                  </button>
                ))}
              </div>
            )}
            <form className="pp-add" onSubmit={e => { e.preventDefault(); if (nombre.trim()) entrar({ nombre }); }}>
              <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Soy nuevo: escribe tu nombre" autoComplete="name" />
              <button className="btn btn-sm btn-primary" type="submit">Entrar</button>
            </form>
            <p className="field-hint login-hint">Modo local sin contraseña. En producción se activa el acceso con Microsoft Entra ID.</p>
          </>
        )}
      </div>
    </div>
  );
}
