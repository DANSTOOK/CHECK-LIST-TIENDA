'use client';
/**
 * Piezas de interfaz compartidas. Replican los componentes del planificador de
 * aperturas (mismas clases CSS de base.css): íconos, diálogos, aviso flotante,
 * visor de imágenes y etiquetas de estatus.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { IS_DEMO } from '@/lib/base';
import { ICONS } from './icons';
import { pct, tone, trend } from '@/lib/format';

export function Icon({ n, className = '' }: { n: string; className?: string }) {
  return (
    <svg className={`ic ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" dangerouslySetInnerHTML={{ __html: ICONS[n] || '' }} />
  );
}

// ---------------------------------------------------------------- Llamadas a la API
/** En modo demo, espera a que el service worker (la "API" en el navegador) controle la página. */
export async function swListo() {
  if (!IS_DEMO || !('serviceWorker' in navigator)) return;
  await navigator.serviceWorker.ready;
  if (!navigator.serviceWorker.controller) {
    await new Promise(r => navigator.serviceWorker.addEventListener('controllerchange', r, { once: true }));
  }
}

/** Igual que useRouter, pero refresh() también recarga los datos de las vistas del modo demo. */
export function useAppRouter() {
  const r = useRouter();
  return useMemo(() => ({
    push: (href: string) => r.push(href),
    refresh: () => { window.dispatchEvent(new Event('ckl-refresh')); r.refresh(); },
  }), [r]);
}

export async function api<T = unknown>(url: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  await swListo();
  const isForm = opts.body instanceof FormData;
  const res = await fetch(url, {
    method: opts.method || (opts.body ? 'POST' : 'GET'),
    headers: opts.body && !isForm ? { 'Content-Type': 'application/json' } : undefined,
    body: opts.body ? (isForm ? (opts.body as FormData) : JSON.stringify(opts.body)) : undefined,
  });
  const data = res.headers.get('content-type')?.includes('json') ? await res.json() : null;
  if (!res.ok) throw Object.assign(new Error(data?.error || `Error ${res.status}`), { data, status: res.status });
  return data as T;
}

// ---------------------------------------------------------------- Aviso flotante
const ToastCtx = createContext<(msg: string, error?: boolean) => void>(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [t, setT] = useState<{ msg: string; error: boolean; on: boolean }>({ msg: '', error: false, on: false });
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const show = useCallback((msg: string, error = false) => {
    setT({ msg, error, on: true });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setT(x => ({ ...x, on: false })), error ? 4200 : 2600);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div className={`toast ${t.on ? 'is-on' : ''} ${t.error ? 'is-error' : ''}`} role="status" aria-live="polite">{t.msg}</div>
    </ToastCtx.Provider>
  );
}

// ---------------------------------------------------------------- Diálogo
export function Dialog({ open, onClose, title, children, foot, size = '', onSubmit }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; foot?: ReactNode;
  size?: '' | 'dlg-wide' | 'dlg-narrow' | 'dlg-mail'; onSubmit?: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className={`dlg ${size}`} onClose={onClose} onCancel={e => { e.preventDefault(); onClose(); }}>
      <form method="dialog" onSubmit={e => { e.preventDefault(); onSubmit?.(); }}>
        <header className="dlg-head">
          <h2>{title}</h2>
          <button type="button" className="x" aria-label="Cerrar" onClick={onClose}><Icon n="x" /></button>
        </header>
        <div className="dlg-body">{children}</div>
        {foot && <footer className="dlg-foot">{foot}</footer>}
      </form>
    </dialog>
  );
}

// ---------------------------------------------------------------- Visor de imágenes
export function Lightbox({ urls, index, onClose }: { urls: string[]; index: number | null; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [i, setI] = useState(0);
  useEffect(() => {
    if (index != null) { setI(index); if (!ref.current?.open) ref.current?.showModal(); }
    else if (ref.current?.open) ref.current.close();
  }, [index]);
  const go = (d: number) => setI(x => (x + d + urls.length) % urls.length);
  return (
    <dialog ref={ref} className="lightbox" aria-label="Imagen" onClose={onClose}
      onKeyDown={e => { if (e.key === 'ArrowLeft') go(-1); if (e.key === 'ArrowRight') go(1); }}
      onClick={e => { if (e.target === ref.current) onClose(); }}>
      <button className="lb-btn lb-close" type="button" aria-label="Cerrar" onClick={onClose}><Icon n="x" /></button>
      {urls.length > 1 && <button className="lb-btn lb-prev" type="button" aria-label="Anterior" onClick={() => go(-1)}>‹</button>}
      {index != null && urls[i] && <img src={urls[i]} alt="" />}
      {urls.length > 1 && <button className="lb-btn lb-next" type="button" aria-label="Siguiente" onClick={() => go(1)}>›</button>}
      {urls.length > 1 && <p className="lb-count">{i + 1} / {urls.length}</p>}
    </dialog>
  );
}

// ---------------------------------------------------------------- Indicadores
export function PctTag({ value, big = false }: { value: number | null | undefined; big?: boolean }) {
  const t = tone(value);
  return <span className={`pct-tag t-${t} ${big ? 'big' : ''}`}>{pct(value, value != null && value % 1 ? 1 : 0)}</span>;
}

export function Trend({ actual, anterior, compact = false }: { actual: number | null | undefined; anterior: number | null | undefined; compact?: boolean }) {
  const t = trend(actual, anterior);
  if (!t) return <span className="trend t-none">{compact ? '—' : 'Primera evaluación'}</span>;
  const icon = t.dir === 'up' ? 'arrowUp' : t.dir === 'down' ? 'arrowDown' : 'equal';
  return (
    <span className={`trend t-${t.dir}`} title={`${t.label} respecto a la evaluación anterior`}>
      <Icon n={icon} />{compact ? (t.dir === 'eq' ? '=' : `${t.diff > 0 ? '+' : ''}${t.diff}`) : `${t.label}${t.dir === 'eq' ? '' : ` ${t.diff > 0 ? '+' : ''}${t.diff} pts`}`}
    </span>
  );
}

export function ResultTag({ r }: { r: string | null }) {
  const map: Record<string, [string, string]> = { cumple: ['done', 'Cumple'], no_cumple: ['danger', 'No cumple'], no_aplica: ['na', 'No aplica'] };
  const [t, l] = r ? map[r] : ['pend', 'Sin respuesta'];
  return <span className={`res-tag r-${t}`}>{l}</span>;
}

export function Empty({ icon = 'info', title, children }: { icon?: string; title: string; children?: ReactNode }) {
  return (
    <div className="empty"><Icon n={icon} className="empty-ic" /><h3>{title}</h3>{children}</div>
  );
}
