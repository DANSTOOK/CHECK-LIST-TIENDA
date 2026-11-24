'use client';
/**
 * Marco de la app (barra lateral + contenido, o pantalla de acceso).
 * DemoShell: versión para GitHub Pages; instala el service worker que hace de
 * servidor dentro del navegador y pide los datos del marco a esa "API".
 */
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import Sidebar from './Sidebar';
import Login from './Login';
import { api, Icon } from './ui';
import { u } from '@/lib/base';
import type { ShellData } from '@/lib/vistas/shell';

export function Shell({ user, borradores, entra, version, children }: ShellData & { children: ReactNode }) {
  if (!user) return <Login entra={entra} />;
  return (
    <div className="app">
      <Sidebar user={user} borradores={borradores} entra={entra} version={version} />
      <main className="main" id="main" tabIndex={-1}>{children}</main>
    </div>
  );
}

export function DemoShell({ children }: { children: ReactNode }) {
  const [data, setData] = useState<ShellData | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(() => api<ShellData>(u('/api/vista/shell')).then(setData).catch(e => setError(String(e.message || e))), []);
  useEffect(() => {
    if (!('serviceWorker' in navigator)) { setError('Este navegador no permite la versión de prueba (service workers).'); return; }
    const first = !navigator.serviceWorker.controller;
    // Cuando se publica una versión nueva, el service worker nuevo toma el control y la
    // página se recarga una vez para mostrar los datos y pantallas actualizados.
    // (También aplica en la primera visita o al abrir un enlace directo.)
    navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true });
    navigator.serviceWorker.register(u('/sw.js'), { scope: u('/'), updateViaCache: 'none' })
      .then(r => r.update())
      .catch(e => setError(String(e)));
    if (first) return;
    load();
    window.addEventListener('ckl-refresh', load);
    return () => window.removeEventListener('ckl-refresh', load);
  }, [load]);
  if (error) return <div className="login"><div className="login-card panel"><Icon n="alert" /><p>{error}</p></div></div>;
  if (!data) return <div className="login"><div className="boot"><span className="brand-mark boot-mark" aria-hidden="true"><i></i><i></i><i></i></span><p className="muted">Preparando la aplicación…</p></div></div>;
  return (
    <>
      <Shell {...data}>{children}</Shell>
      <div className="demo-badge" title="Los datos se guardan solo en este navegador">Prueba · datos en este navegador</div>
    </>
  );
}
