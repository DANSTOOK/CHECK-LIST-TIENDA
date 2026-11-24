'use client';
/**
 * Página del modo demo: pide sus datos a la "API" del service worker
 * (/api/vista/<vista>) y los dibuja con la misma vista que usa el servidor.
 */
import { Suspense, useEffect, useState, type ComponentType } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { api, Empty } from './ui';
import { u } from '@/lib/base';

type Props = { vista: string; param?: string; View: ComponentType<any> }; // eslint-disable-line @typescript-eslint/no-explicit-any

function Inner({ vista, param, View }: Props) {
  const pathname = usePathname();
  const sp = useSearchParams();
  const [data, setData] = useState<object | null | undefined>(undefined);
  const valor = param ? decodeURIComponent(pathname.split('/').filter(Boolean).pop() || '') : '';
  const qs = new URLSearchParams(sp.toString());
  if (param) qs.set(param, valor);
  const url = u(`/api/vista/${vista}?${qs}`);
  useEffect(() => {
    let vivo = true;
    const load = () => api<object | null>(url).then(d => vivo && setData(d)).catch(() => vivo && setData(null));
    setData(undefined);
    load();
    window.addEventListener('ckl-refresh', load);
    return () => { vivo = false; window.removeEventListener('ckl-refresh', load); };
  }, [url]);
  if (data === undefined) return <p className="muted">Cargando…</p>;
  if (data === null) return <div className="panel"><Empty icon="alert" title="No disponible" ><p>No existe o tu rol no tiene acceso.</p></Empty></div>;
  return <View key={url} {...data} />;
}

export default function DemoPage(props: Props) {
  return <Suspense fallback={<p className="muted">Cargando…</p>}><Inner {...props} /></Suspense>;
}
