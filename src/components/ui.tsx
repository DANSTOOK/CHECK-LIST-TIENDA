'use client';
/**
 * Piezas de interfaz compartidas. Replican los componentes del planificador de
 * aperturas (mismas clases CSS de base.css): íconos, diálogos, aviso flotante,
 * visor de imágenes y etiquetas de estatus.
 */
import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
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
export function PctTag({ value, big = false, animado = false }: { value: number | null | undefined; big?: boolean; animado?: boolean }) {
  const t = tone(value);
  return <span className={`pct-tag t-${t} ${big ? 'big' : ''}`}>{animado ? <CountUp value={value} /> : pct(value, value != null && value % 1 ? 1 : 0)}</span>;
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

const STAR = 'M12 3.2l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 17l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z';
// Paletas de la estrella: dorada (bien), naranja (hallazgo) y apagada.
const TONOS = {
  oro: ['#fff6c2', '#ffd84d', '#f6ac12', '#d17c00', '#a85f00'],
  bajo: ['#ffe3c4', '#ffab5c', '#f37a2c', '#cf5414', '#9c3c0c'],
  off: ['#ffffff', '#f3f1ec', '#e4e1d9', '#d3cfc5', '#bdb8ac'],
};
/**
 * Estrella con relieve: degradado de metal dorado, reflejo de luz arriba a la
 * izquierda, filo más oscuro y sombra (la sombra va en CSS).
 */
export function StarIcon({ on, tono = 'oro' }: { on: boolean; tono?: 'oro' | 'bajo' }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const c = TONOS[on ? tono : 'off'];
  return (
    <svg className={'star-ic' + (on ? ' is-on' : '') + (on && tono === 'bajo' ? ' is-low' : '')} viewBox="0 0 24 24" aria-hidden="true">
      <defs>
        <linearGradient id={'g' + id} x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0" stopColor={c[0]} /><stop offset="0.32" stopColor={c[1]} /><stop offset="0.68" stopColor={c[2]} /><stop offset="1" stopColor={c[3]} />
        </linearGradient>
        <radialGradient id={'h' + id} cx="0.36" cy="0.28" r="0.5">
          <stop offset="0" stopColor="#fff" stopOpacity={on ? 0.95 : 0.9} /><stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <clipPath id={'c' + id}><path d={STAR} /></clipPath>
      </defs>
      <path className="star-base" d={STAR} fill={'url(#g' + id + ')'} stroke={c[4]} strokeWidth="0.7" strokeLinejoin="round" />
      <g clipPath={'url(#c' + id + ')'}>
        {/* faceta inferior derecha más oscura: da volumen */}
        <path d="M12 12 L21 9.6 L16.5 13.8 L17.6 19.9 L12 17 Z" fill={c[3]} opacity={on ? 0.35 : 0.18} />
        {/* reflejo */}
        <ellipse cx="9.2" cy="8.2" rx="6.4" ry="4.4" fill={'url(#h' + id + ')'} />
        <path className="star-shine" d="M3 3 L8 3 L1 14 L-4 14 Z" fill="#fff" opacity="0" />
      </g>
    </svg>
  );
}
/** Calificación de 1 a 5 estrellas en modo lectura. */
export function Stars({ value, small = false }: { value: number | null | undefined; small?: boolean }) {
  return (
    <span className={'stars' + (small ? ' sm' : '')} role="img" aria-label={value ? value + ' de 5 estrellas' : 'Sin calificar'}>
      {[1, 2, 3, 4, 5].map(n => <StarIcon key={n} on={(value ?? 0) >= n} tono={(value ?? 0) <= 3 ? 'bajo' : 'oro'} />)}
    </span>
  );
}

// ---------------------------------------------------------------- Animaciones
/** Respeta la preferencia del sistema de reducir movimiento. */
export const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Celebración con confeti (la misma del planificador de aperturas). */
export function confetti(big = false) {
  if (typeof window === 'undefined' || reduceMotion()) return;
  const cv = document.createElement('canvas'); cv.className = 'confetti'; document.body.append(cv);
  const W = innerWidth, H = innerHeight, dpr = devicePixelRatio || 1;
  cv.width = W * dpr; cv.height = H * dpr; const g = cv.getContext('2d')!; g.scale(dpr, dpr);
  const colors = ['#e82127', '#f6a623', '#16a34a', '#2563eb', '#eab308', '#7c3aed', '#be185d'];
  const ps = Array.from({ length: big ? 220 : 120 }, () => ({ x: W / 2 + (Math.random() - .5) * 240, y: H * .38, vx: (Math.random() - .5) * 14, vy: -Math.random() * 12 - 5, s: Math.random() * 7 + 5, r: Math.random() * 6, vr: (Math.random() - .5) * .35, c: colors[Math.floor(Math.random() * colors.length)] }));
  const t0 = performance.now(), dur = big ? 2600 : 1900;
  (function frame(t: number) {
    const e = t - t0; g.clearRect(0, 0, W, H);
    ps.forEach(p => { p.vy += .32; p.x += p.vx; p.y += p.vy; p.vx *= .985; p.r += p.vr; g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.globalAlpha = Math.max(0, 1 - e / dur); g.fillStyle = p.c; g.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); g.restore(); });
    if (e < dur) requestAnimationFrame(frame); else cv.remove();
  })(t0);
}

/** Número que cuenta desde 0 hasta el valor (para el % de cumplimiento). */
export function CountUp({ value, suffix = '%', ms = 900 }: { value: number | null | undefined; suffix?: string; ms?: number }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (value == null) return;
    if (reduceMotion()) { setV(value); return; }
    let raf = 0; const t0 = performance.now();
    const step = (t: number) => { const k = Math.min(1, (t - t0) / ms); setV(value * (1 - Math.pow(1 - k, 3))); if (k < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  if (value == null) return <>—</>;
  return <>{(value % 1 ? v.toFixed(1) : Math.round(v)) + suffix}</>;
}

/** Esqueleto de carga (reemplaza el texto "Cargando…"). */
export function Skeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="skel" aria-busy="true" aria-label="Cargando">
      <div className="skel-line w40 h24" />
      <div className="skel-line w70" />
      {Array.from({ length: lines }).map((_, i) => <div key={i} className="skel-card" style={{ animationDelay: i * 90 + 'ms' }} />)}
    </div>
  );
}
