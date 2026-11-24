'use client';
import { u } from '@/lib/base';
// Barra lateral: misma estructura y clases que el planificador de aperturas.
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, Icon, useAppRouter } from './ui';
import type { CurrentUser } from '@/lib/auth';

type Borrador = { id: string; nombre: string; cr: string; avance: number };

const THEMES = ['auto', 'light', 'dark'] as const;
const THEME_LABEL = { auto: 'Tema automático', light: 'Tema claro', dark: 'Tema oscuro' };
const THEME_ICON = { auto: 'auto', light: 'sun', dark: 'moon' };

export default function Sidebar({ user, borradores, entra, version }: { user: CurrentUser; borradores: Borrador[]; entra: boolean; version: string }) {
  const path = usePathname();
  const router = useAppRouter();
  const [theme, setTheme] = useState<(typeof THEMES)[number]>('auto');
  useEffect(() => {
    try { const t = localStorage.getItem('ckl-theme'); if (t === 'light' || t === 'dark') setTheme(t); } catch { /* sin almacenamiento */ }
  }, []);
  const cycle = () => {
    const t = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
    setTheme(t);
    try { if (t === 'auto') localStorage.removeItem('ckl-theme'); else localStorage.setItem('ckl-theme', t); } catch { /* */ }
    if (t === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
  };
  const salir = async () => {
    if (entra) { window.location.href = u('/api/auth/signout'); return; }
    await api(u('/api/sesion'), { method: 'DELETE' });
    router.refresh();
  };
  const active = (href: string) => (href === '/' ? path === '/' : path.startsWith(href)) ? 'is-active' : '';
  const nav = (href: string, icon: string, label: string) => (
    <Link className={`nav ${active(href)}`} href={href}><Icon n={icon} /><span className="nav-text">{label}</span></Link>
  );
  const initials = user.nombre.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();

  return (
    <aside className="sidebar">
      <Link className="brand" href="/">
        <span className="brand-mark" aria-hidden="true"><i></i><i></i><i></i></span>
        <span className="brand-text">Checklist Operativo<small>Evaluación de tiendas</small></span>
      </Link>

      <nav className="nav-list" aria-label="Secciones">
        {nav('/', 'chart', 'Dashboard')}
        {nav('/tiendas', 'store', 'Tiendas')}
        {nav('/evaluaciones', 'history', 'Historial')}
        {user.rol === 'admin' && <>
          <div className="side-label nav-group">Administración</div>
          {nav('/admin/preguntas', 'template', 'Preguntas')}
          {nav('/admin/destinatarios', 'mail', 'Destinatarios')}
          {nav('/admin/usuarios', 'users', 'Usuarios')}
        </>}
      </nav>

      <div className="side-section side-stores">
        <div className="side-label">Checklists en curso</div>
        {borradores.length ? borradores.map(b => (
          <Link key={b.id} href={`/evaluaciones/${b.id}`} className={`side-store ${path === `/evaluaciones/${b.id}` ? 'is-active' : ''}`}>
            <span className="ss-ring" style={{ ['--p' as string]: b.avance }}></span>
            <span className="ss-name">{b.nombre}</span>
            <span className="ss-pct">{b.avance}%</span>
          </Link>
        )) : <p className="side-empty">Sin checklists abiertos</p>}
      </div>

      <div className="side-foot">
        <button className="side-action" type="button" onClick={cycle} title="Cambiar tema">
          <Icon n={THEME_ICON[theme]} /><span>{THEME_LABEL[theme]}</span>
        </button>
        <button className="side-action" type="button" onClick={salir}><Icon n="logout" /><span>{entra ? 'Cerrar sesión' : 'Cambiar de usuario'}</span></button>
        <div className="user-btn" title={user.email || user.nombre}>
          <span className="avatar">{initials}</span>
          <span className="u-txt"><b>{user.nombre}</b><small>{user.rol === 'admin' ? 'Administrador' : user.rol === 'consulta' ? 'Consulta' : 'Evaluador'}</small></span>
        </div>
        <p className="app-version">v{version}</p>
      </div>
    </aside>
  );
}
