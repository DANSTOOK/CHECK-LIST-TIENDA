'use client';
/**
 * Navegación.
 * - Escritorio: barra lateral (misma estructura y clases que el planificador de aperturas).
 * - Celular (≤ 860 px): barra superior compacta + barra inferior de pestañas al alcance
 *   del pulgar, y un panel "Más" con checklists en curso, administración y sesión.
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, Icon, useAppRouter } from './ui';
import { u } from '@/lib/base';
import type { CurrentUser } from '@/lib/auth';

type Borrador = { id: string; nombre: string; cr: string; avance: number };

export default function Sidebar({ user, borradores, entra, version }: { user: CurrentUser; borradores: Borrador[]; entra: boolean; version: string }) {
  const path = usePathname();
  const router = useAppRouter();
  const [mas, setMas] = useState(false);
  useEffect(() => setMas(false), [path]);

  const salir = async () => {
    if (entra) { window.location.href = u('/api/auth/signout'); return; }
    await api(u('/api/sesion'), { method: 'DELETE' });
    router.refresh();
  };
  const isActive = (href: string) => (href === '/' ? path === '/' : path.startsWith(href));
  const nav = (href: string, icon: string, label: string) => (
    <Link className={`nav ${isActive(href) ? 'is-active' : ''}`} href={href}><Icon n={icon} /><span className="nav-text">{label}</span></Link>
  );
  const tab = (href: string, icon: string, label: string) => (
    <Link className={`tab-item ${isActive(href) ? 'is-active' : ''}`} href={href} aria-current={isActive(href) ? 'page' : undefined}><Icon n={icon} /><span>{label}</span></Link>
  );
  const initials = user.nombre.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const rol = user.rol === 'admin' ? 'Administrador' : user.rol === 'consulta' ? 'Consulta' : 'Evaluador';
  const enCurso = borradores.map(b => (
    <Link key={b.id} href={`/evaluaciones/${b.id}`} className={`side-store ${path === `/evaluaciones/${b.id}` ? 'is-active' : ''}`}>
      <span className="ss-ring" style={{ ['--p' as string]: b.avance }}></span>
      <span className="ss-name">{b.nombre}</span>
      <span className="ss-pct">{b.avance}%</span>
    </Link>
  ));

  return (
    <>
      {/* Escritorio */}
      <aside className="sidebar">
        <Link className="brand" href="/">
          <span className="brand-mark" aria-hidden="true"><i></i><i></i><i></i></span>
          <span className="brand-text">Checklist Operativo<small>Evaluación de tiendas</small></span>
        </Link>
        <nav className="nav-list" aria-label="Secciones">
          {nav('/', 'check', 'Checklist')}
          {nav('/evaluaciones', 'history', 'Historial')}
          {nav('/tiendas', 'store', 'Tiendas')}
          {nav('/dashboard', 'chart', 'Dashboard')}
          {user.rol === 'admin' && <>
            <div className="side-label nav-group">Administración</div>
            {nav('/admin/preguntas', 'template', 'Preguntas')}
            {nav('/admin/destinatarios', 'mail', 'Destinatarios')}
            {nav('/admin/usuarios', 'users', 'Usuarios')}
          </>}
        </nav>
        <div className="side-section side-stores">
          <div className="side-label">Checklists en curso</div>
          {borradores.length ? enCurso : <p className="side-empty">Sin checklists abiertos</p>}
        </div>
        <div className="side-foot">
          <button className="side-action" type="button" onClick={salir}><Icon n="logout" /><span>{entra ? 'Cerrar sesión' : 'Cambiar de usuario'}</span></button>
          <div className="user-btn" title={user.email || user.nombre}>
            <span className="avatar">{initials}</span>
            <span className="u-txt"><b>{user.nombre}</b><small>{rol}</small></span>
          </div>
          <p className="app-version">v{version}</p>
        </div>
      </aside>

      {/* Celular: barra superior */}
      <header className="topbar">
        <Link className="brand" href="/">
          <span className="brand-mark" aria-hidden="true"><i></i><i></i><i></i></span>
          <span className="brand-text">Checklist Operativo</span>
        </Link>
        <button type="button" className="topbar-user" onClick={() => setMas(true)} aria-label="Mi cuenta y más opciones">
          {borradores.length > 0 && <span className="topbar-badge">{borradores.length}</span>}
          <span className="avatar sm">{initials}</span>
        </button>
      </header>

      {/* Celular: pestañas inferiores */}
      <nav className="tabbar" aria-label="Secciones">
        {tab('/', 'check', 'Checklist')}
        {tab('/evaluaciones', 'history', 'Historial')}
        {tab('/tiendas', 'store', 'Tiendas')}
        {tab('/dashboard', 'chart', 'Tablero')}
        <button type="button" className={`tab-item ${mas ? 'is-active' : ''}`} onClick={() => setMas(true)}><Icon n="more" /><span>Más</span></button>
      </nav>

      {/* Celular: panel "Más" */}
      {mas && (
        <div className="sheet-backdrop" onClick={() => setMas(false)}>
          <div className="sheet" role="dialog" aria-label="Más opciones" onClick={e => e.stopPropagation()}>
            <span className="sheet-grip" aria-hidden="true" />
            <div className="sheet-user"><span className="avatar">{initials}</span><span className="u-txt"><b>{user.nombre}</b><small>{rol}</small></span></div>
            <div className="sheet-sec">
              <p className="side-label">Checklists en curso</p>
              {borradores.length ? enCurso : <p className="side-empty">Sin checklists abiertos</p>}
            </div>
            {user.rol === 'admin' && (
              <div className="sheet-sec">
                <p className="side-label">Administración</p>
                {nav('/admin/preguntas', 'template', 'Preguntas')}
                {nav('/admin/destinatarios', 'mail', 'Destinatarios')}
                {nav('/admin/usuarios', 'users', 'Usuarios')}
              </div>
            )}
            <div className="sheet-sec">
              <button className="nav" type="button" onClick={salir}><Icon n="logout" /><span className="nav-text">{entra ? 'Cerrar sesión' : 'Cambiar de usuario'}</span></button>
            </div>
            <p className="app-version">v{version}</p>
          </div>
        </div>
      )}
    </>
  );
}
