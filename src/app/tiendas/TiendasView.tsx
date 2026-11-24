'use client';
import { u } from '@/lib/base';
/**
 * Catálogo de tiendas: búsqueda rápida, filtros, vista en cuadros (como el
 * planificador) o en lista, alta/edición, importación del concentrado e inicio
 * del checklist.
 */
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { api, Dialog, Empty, Icon, PctTag, Trend, useToast, useAppRouter } from '@/components/ui';
import { fmtDate, tone } from '@/lib/format';
import { PLAZAS, etiquetaPlaza } from '@/lib/plazas';

export interface TiendaRow {
  id: string; cr: string; nombre: string; ciudad: string | null; plaza: string | null; estado: string | null; region: string | null; ro: string | null; activa: boolean;
  ultima: { fecha: string; porcentaje: number | null; hallazgos: number } | null; anterior: number | null; evaluaciones: number; borradorId: string | null;
}
type Form = { id?: string; cr: string; nombre: string; ciudad: string; plaza: string; estado: string; region: string; ro: string };
const VACIO: Form = { cr: '', nombre: '', ciudad: '', plaza: '', estado: '', region: '', ro: '' };
const GLOW: Record<string, string> = { done: 'var(--st-done)', warn: 'var(--st-proc)', danger: 'var(--st-block)', na: 'var(--accent)' };
const PAGE = 60;

export default function TiendasView({ tiendas, admin, puedeEvaluar }: { tiendas: TiendaRow[]; admin: boolean; puedeEvaluar: boolean }) {
  const router = useAppRouter();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [plaza, setPlaza] = useState('');
  const [estado, setEstado] = useState('');
  const [region, setRegion] = useState('');
  const [ro, setRo] = useState('');
  const [seg, setSeg] = useState<'todas' | 'sin' | 'hallazgos'>('todas');
  const [vista, setVista] = useState<'cuadros' | 'lista'>('cuadros');
  const [limit, setLimit] = useState(PAGE);
  const [form, setForm] = useState<Form | null>(null);
  const [imp, setImp] = useState<string | null>(null);
  const [impPlaza, setImpPlaza] = useState('');
  const [busy, setBusy] = useState('');

  const opts = (k: 'plaza' | 'estado' | 'region' | 'ro') => [...new Set(tiendas.map(t => t[k]).filter(Boolean) as string[])].sort();
  const plazasOpts = [...new Set([...PLAZAS, ...opts('plaza')])];
  const activas = tiendas.filter(t => t.activa);
  const filtradas = useMemo(() => {
    const s = q.trim().toLowerCase();
    return activas.filter(t =>
      (!s || t.cr.toLowerCase().includes(s) || t.nombre.toLowerCase().includes(s) || (t.ciudad || '').toLowerCase().includes(s) || (t.ro || '').toLowerCase().includes(s)) &&
      (!plaza || t.plaza === plaza) && (!estado || t.estado === estado) && (!region || t.region === region) && (!ro || t.ro === ro) &&
      (seg === 'todas' || (seg === 'sin' ? !t.ultima : (t.ultima?.hallazgos ?? 0) > 0)));
  }, [activas, q, plaza, estado, region, ro, seg]);
  const sinEval = activas.filter(t => !t.ultima).length;
  const conHall = activas.filter(t => (t.ultima?.hallazgos ?? 0) > 0).length;

  const iniciar = async (t: TiendaRow) => {
    if (t.borradorId) { router.push(`/evaluaciones/${t.borradorId}`); return; }
    setBusy(t.id);
    try {
      const r = await api<{ id: string; retomada?: boolean }>(u('/api/evaluaciones'), { body: { tiendaId: t.id } });
      router.push(`/evaluaciones/${r.id}`);
      router.refresh();
    } catch (e) { toast((e as Error).message, true); setBusy(''); }
  };

  const guardar = async () => {
    if (!form) return;
    try {
      if (form.id) await api(u(`/api/tiendas/${form.id}`), { method: 'PATCH', body: form });
      else await api(u('/api/tiendas'), { body: form });
      toast(form.id ? 'Tienda actualizada' : 'Tienda agregada');
      setForm(null); router.refresh();
    } catch (e) { toast((e as Error).message, true); }
  };
  const quitar = async () => {
    if (!form?.id || !confirm(`¿Quitar ${form.nombre} del catálogo? Si tiene evaluaciones solo se desactiva y se conserva su historial.`)) return;
    try { await api(u(`/api/tiendas/${form.id}`), { method: 'DELETE' }); toast('Tienda quitada'); setForm(null); router.refresh(); }
    catch (e) { toast((e as Error).message, true); }
  };
  const importar = async () => {
    try {
      const r = await api<{ creadas: number; actualizadas: number; errores: string[] }>(u('/api/tiendas/importar'), { body: { texto: imp, plaza: impPlaza } });
      toast(`${r.creadas} tiendas nuevas, ${r.actualizadas} actualizadas${r.errores.length ? `, ${r.errores.length} filas con error` : ''}`, r.errores.length > 0);
      if (r.errores.length) console.warn(r.errores);
      setImp(null); router.refresh();
    } catch (e) { toast((e as Error).message, true); }
  };
  const leerArchivo = (f: File) => {
    const rd = new FileReader();
    rd.onload = () => setImp(String(rd.result));
    rd.readAsText(f, 'utf-8');
  };
  const edit = (t: TiendaRow) => setForm({ id: t.id, cr: t.cr, nombre: t.nombre, ciudad: t.ciudad || '', plaza: t.plaza || '', estado: t.estado || '', region: t.region || '', ro: t.ro || '' });
  const F = (k: keyof Form, label: string, extra: Record<string, unknown> = {}) => (
    <label className="field">{label}<input value={form?.[k] || ''} onChange={e => setForm(f => f && { ...f, [k]: e.target.value })} autoComplete="off" {...extra} /></label>
  );

  const startBtn = (t: TiendaRow, sm = true) => puedeEvaluar && (
    <button type="button" className={`btn ${sm ? 'btn-sm' : ''} ${t.borradorId ? '' : 'btn-primary'}`} disabled={busy === t.id}
      onClick={e => { e.preventDefault(); e.stopPropagation(); iniciar(t); }}>
      <Icon n={t.borradorId ? 'edit' : 'check'} />{busy === t.id ? 'Abriendo…' : t.borradorId ? 'Continuar' : 'Iniciar checklist'}
    </button>
  );

  return (
    <>
      <div className="home-head">
        <h1>Tiendas</h1>
        <div className="hh-stats">
          <span className="hs"><b>{activas.length}</b> en catálogo</span>
          <span className="hs"><b>{activas.length - sinEval}</b> evaluadas</span>
          <span className={`hs ${conHall ? 'is-alert' : ''}`}><b>{conHall}</b> con hallazgos</span>
        </div>
        {admin && <>
          <button className="btn" type="button" onClick={() => setImp('')}><Icon n="upload" />Importar concentrado</button>
          <button className="btn btn-primary" type="button" onClick={() => setForm({ ...VACIO })}><Icon n="plus" />Nueva tienda</button>
        </>}
      </div>

      <div className="home-bar">
        <label className="search"><Icon n="search" /><input value={q} onChange={e => { setQ(e.target.value); setLimit(PAGE); }} placeholder="Buscar por CR, nombre, ciudad o RO" aria-label="Buscar tienda" /></label>
        {opts('ro').length > 0 && <select className="sel" value={ro} onChange={e => setRo(e.target.value)} aria-label="RO"><option value="">Todos los RO</option>{opts('ro').map(o => <option key={o}>{o}</option>)}</select>}
        <select className="sel" value={plaza} onChange={e => setPlaza(e.target.value)} aria-label="Plaza"><option value="">Todas las plazas</option>{plazasOpts.map(o => <option key={o} value={o}>{etiquetaPlaza(o)}</option>)}</select>
        {opts('estado').length > 0 && <select className="sel" value={estado} onChange={e => setEstado(e.target.value)} aria-label="Estado"><option value="">Todos los estados</option>{opts('estado').map(o => <option key={o}>{o}</option>)}</select>}
        {opts('region').length > 0 && <select className="sel" value={region} onChange={e => setRegion(e.target.value)} aria-label="Región"><option value="">Todas las regiones</option>{opts('region').map(o => <option key={o}>{o}</option>)}</select>}
        <div className="seg" role="tablist">
          <button className={seg === 'todas' ? 'is-active' : ''} onClick={() => setSeg('todas')} type="button">Todas</button>
          <button className={seg === 'sin' ? 'is-active' : ''} onClick={() => setSeg('sin')} type="button">Sin evaluar <span className="seg-n">{sinEval}</span></button>
          <button className={seg === 'hallazgos' ? 'is-active' : ''} onClick={() => setSeg('hallazgos')} type="button">Con hallazgos <span className="seg-n">{conHall}</span></button>
        </div>
        <div className="seg" aria-label="Vista">
          <button className={vista === 'cuadros' ? 'is-active' : ''} onClick={() => setVista('cuadros')} type="button" title="Cuadros"><Icon n="layers" /></button>
          <button className={vista === 'lista' ? 'is-active' : ''} onClick={() => setVista('lista')} type="button" title="Lista"><Icon n="list" /></button>
        </div>
      </div>

      {!activas.length ? (
        <div className="panel"><Empty icon="store" title="Aún no hay tiendas en el catálogo">
          <p>{admin ? 'Importa el concentrado de tiendas (CR y nombre) desde Excel o CSV, o agrégalas una por una.' : 'Pide a un administrador que cargue el concentrado de tiendas.'}</p>
          {admin && <button className="btn btn-primary" type="button" onClick={() => setImp('')}><Icon n="upload" />Importar concentrado</button>}
        </Empty></div>
      ) : !filtradas.length ? (
        <div className="panel"><Empty icon="search" title="Ninguna tienda coincide"><p>Prueba con otro CR, nombre o quita filtros.</p></Empty></div>
      ) : vista === 'cuadros' ? (
        <div className="store-grid">
          {filtradas.slice(0, limit).map((t, i) => {
            const p = t.ultima?.porcentaje;
            return (
              <Link key={t.id} href={`/tiendas/${encodeURIComponent(t.cr)}`} className="store-tile" style={{ ['--i' as string]: i % 12, ['--glow' as string]: GLOW[tone(p)] }}>
                <div className="tile-top">
                  {(t.ultima?.hallazgos ?? 0) > 0 && <span className="flag"><Icon n="alert" />{t.ultima!.hallazgos}</span>}
                  <span className="tile-ic"><img src={u('/img/tienda.png')} alt="" /></span>
                </div>
                <div className="tile-id"><span className="tile-name">{t.nombre}</span><span className="tile-cr">CR {t.cr}{t.plaza ? ` · ${t.plaza}` : ''}</span>{t.ro && <span className="tile-ro">RO {t.ro}</span>}</div>
                <div className="tile-act">{startBtn(t)}</div>
                <div className="tile-stats">
                  <div className="ts"><span className="ts-l">Cumplimiento</span>
                    <span className={`ts-v t-${tone(p)}`}>{p == null ? '—' : Math.round(p)}{p != null && <small>%</small>}</span>
                    {t.ultima && <Trend actual={p} anterior={t.anterior} compact />}
                  </div>
                  <div className="ts ts-date"><span className="ts-l">Última visita</span>
                    <span className="ts-v">{t.ultima ? fmtDate(t.ultima.fecha, { day: 'numeric', month: 'short' }) : '—'}</span>
                    <span className="days">{t.evaluaciones ? `${t.evaluaciones} evaluaci${t.evaluaciones === 1 ? 'ón' : 'ones'}` : 'Sin evaluar'}</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="panel"><div className="table tbl-tiendas">
          <div className="tr th"><span>Tienda</span><span>RO / ubicación</span><span>Última evaluación</span><span>Tendencia</span><span></span></div>
          {filtradas.slice(0, limit).map(t => (
            <Link key={t.id} href={`/tiendas/${encodeURIComponent(t.cr)}`} className="tr">
              <span className="c-name"><b>{t.nombre}</b><span className="mono">CR {t.cr}</span></span>
              <span className="c-date"><span>{t.ro || '—'}</span><span className="muted">{[t.plaza, t.ciudad, t.estado].filter(Boolean).join(', ')}</span></span>
              <span className="c-date">{t.ultima ? <><PctTag value={t.ultima.porcentaje} /><span className="muted">{fmtDate(t.ultima.fecha)}</span></> : <span className="muted">Sin evaluar</span>}</span>
              <span>{t.ultima ? <Trend actual={t.ultima.porcentaje} anterior={t.anterior} compact /> : null}</span>
              <span className="c-end">{startBtn(t)}{admin && <button type="button" className="icon-btn" title="Editar" onClick={e => { e.preventDefault(); edit(t); }}><Icon n="edit" /></button>}</span>
            </Link>
          ))}
        </div></div>
      )}
      {filtradas.length > limit && (
        <div className="more-row"><button className="btn" type="button" onClick={() => setLimit(l => l + PAGE * 2)}>Mostrar más ({filtradas.length - limit} restantes)</button></div>
      )}

      <Dialog open={!!form} onClose={() => setForm(null)} title={form?.id ? 'Editar tienda' : 'Nueva tienda'} size="dlg-wide" onSubmit={guardar}
        foot={<>{form?.id && <button type="button" className="btn btn-ghost danger push-left" onClick={quitar}><Icon n="trash" />Quitar</button>}
          <button type="button" className="btn" onClick={() => setForm(null)}>Cancelar</button><button className="btn btn-primary" type="submit">Guardar tienda</button></>}>
        <div className="grid-3">
          {F('cr', 'CR (Centro de Responsabilidad)', { required: true, placeholder: '50ABC', className: 'mono' })}
          <div className="span-2">{F('nombre', 'Nombre de la tienda', { required: true, placeholder: 'OXXO Ameyalli' })}</div>
          {F('ciudad', 'Ciudad')}<label className="field">Plaza<select value={form?.plaza || ''} onChange={e => setForm(f => f && { ...f, plaza: e.target.value })}><option value="">Sin plaza</option>{plazasOpts.map(o => <option key={o} value={o}>{etiquetaPlaza(o)}</option>)}</select></label>{F('estado', 'Estado', { list: 'dl-estado' })}{F('region', 'Región', { list: 'dl-region' })}<div className="span-2">{F('ro', 'RO (responsable de operación)', { list: 'dl-ro' })}</div>
        </div>
                <datalist id="dl-estado">{opts('estado').map(o => <option key={o} value={o} />)}</datalist>
        <datalist id="dl-ro">{opts('ro').map(o => <option key={o} value={o} />)}</datalist>
        <datalist id="dl-region">{opts('region').map(o => <option key={o} value={o} />)}</datalist>
      </Dialog>

      <Dialog open={imp !== null} onClose={() => setImp(null)} title="Importar concentrado de tiendas" size="dlg-wide" onSubmit={importar}
        foot={<><button type="button" className="btn" onClick={() => setImp(null)}>Cancelar</button><button className="btn btn-primary" type="submit" disabled={!imp?.trim()}>Importar</button></>}>
        <p className="dlg-note">Copia las columnas desde Excel (incluyendo la fila de encabezados) y pégalas abajo, o elige un archivo CSV. Se reconocen las columnas <b>CR</b> (o CR TIENDA), <b>Nombre</b> (o Tienda), <b>Ciudad</b>, <b>Plaza</b>, <b>Estado</b>, <b>Región</b> y <b>RO</b> (o Nuevo RO). Si el CR ya existe, se actualiza solo con las columnas que traiga el archivo.</p>
        <label className="field">Plaza de estas tiendas<select value={impPlaza} onChange={e => setImpPlaza(e.target.value)}><option value="">La que indique la columna Plaza del archivo</option>{PLAZAS.map(o => <option key={o} value={o}>{etiquetaPlaza(o)}</option>)}</select></label>
        <textarea className="paste-area" rows={10} value={imp ?? ''} onChange={e => setImp(e.target.value)} placeholder={'CR\tNombre\tCiudad\tPlaza\tEstado\tRegión\n50ABC\tOXXO Ameyalli\tTijuana\tTijuana Este\tBaja California\tNoroeste'} />
        <label className="btn btn-sm file-btn"><Icon n="upload" />Elegir archivo CSV<input type="file" accept=".csv,.txt,text/csv" hidden onChange={e => e.target.files?.[0] && leerArchivo(e.target.files[0])} /></label>
      </Dialog>
    </>
  );
}
