'use client';
import { u } from '@/lib/base';
// Partes interactivas de la vista de resultado: galería de evidencias y correo.
import { useState } from 'react';
import { api, Dialog, Icon, Lightbox, useToast } from '@/components/ui';

export function Gallery({ ids }: { ids: string[] }) {
  const [i, setI] = useState<number | null>(null);
  const urls = ids.map(id => u(`/api/evidencias/${id}`));
  return (
    <>
      <div className="thumbs">
        {urls.map((u, k) => (
          <div className="thumb" key={u}><button type="button" className="thumb-btn" onClick={() => setI(k)}><img src={u} alt={`Evidencia ${k + 1}`} loading="lazy" /></button></div>
        ))}
      </div>
      <Lightbox urls={urls} index={i} onClose={() => setI(null)} />
    </>
  );
}

type Preview = { to: string[]; cc: string[]; areas: string[]; asunto: string; html: string; graph: boolean };
const split = (s: string) => s.split(/[;,\s]+/).map(x => x.trim()).filter(Boolean);

/**
 * Correo de resultados: muestra destinatarios sugeridos (configurables en
 * Administración > Destinatarios), permite ajustarlos y genera el borrador.
 */
export function MailButton({ id }: { id: string }) {
  const toast = useToast();
  const [p, setP] = useState<Preview | null>(null);
  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [asunto, setAsunto] = useState('');
  const [busy, setBusy] = useState('');

  const abrir = async () => {
    setBusy('load');
    try {
      const d = await api<Preview>(u(`/api/evaluaciones/${id}/correo`));
      setP(d); setTo(d.to.join('; ')); setCc(d.cc.join('; ')); setAsunto(d.asunto);
    } catch (e) { toast((e as Error).message, true); }
    setBusy('');
  };
  const body = (modo: string) => ({ modo, to: split(to), cc: split(cc), asunto });

  const eml = async () => {
    setBusy('eml');
    try {
      const res = await fetch(u(`/api/evaluaciones/${id}/correo`), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body('eml')) });
      if (!res.ok) throw new Error((await res.json()).error);
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${asunto.replace(/[\\/:*?"<>|]+/g, '').slice(0, 90)}.eml`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      toast('Ábrelo con Outlook: queda como correo nuevo con el PDF y las fotos adjuntos');
    } catch (e) { toast((e as Error).message, true); }
    setBusy('');
  };
  const graph = async () => {
    setBusy('graph');
    try {
      const r = await api<{ webLink: string }>(u(`/api/evaluaciones/${id}/correo`), { body: body('graph') });
      window.open(r.webLink, '_blank', 'noopener');
      toast('Borrador creado en tu Outlook (carpeta Borradores)');
    } catch (e) { toast((e as Error).message, true); }
    setBusy('');
  };
  const copiar = async () => {
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([p!.html], { type: 'text/html' }), 'text/plain': new Blob([document.getElementById('mailPreview')!.innerText], { type: 'text/plain' }) })]);
      toast('Resumen copiado: pégalo en el cuerpo de tu correo');
    } catch { toast('Tu navegador no permitió copiar; usa la descarga para Outlook', true); }
  };

  return (
    <>
      <button className="btn btn-primary" type="button" onClick={abrir} disabled={busy === 'load'}><Icon n="mail" />{busy === 'load' ? 'Preparando…' : 'Generar correo'}</button>
      <Dialog open={!!p} onClose={() => setP(null)} title="Correo de resultados" size="dlg-mail"
        foot={<div className="mail-foot-in">
          <button className="btn" type="button" onClick={copiar} title="Copia el resumen con formato para pegarlo en cualquier correo">Copiar resumen</button>
          <button className="btn" type="button" onClick={eml} disabled={!!busy} title="Descarga un correo listo; al abrirlo en Outlook Desktop queda como mensaje nuevo con adjuntos">
            <Icon n="download" />{busy === 'eml' ? 'Generando…' : 'Abrir en Outlook Desktop'}</button>
          {p?.graph && <button className="btn btn-primary" type="button" onClick={graph} disabled={!!busy}><Icon n="send" />{busy === 'graph' ? 'Creando borrador…' : 'Crear borrador en Outlook'}</button>}
        </div>}>
        {p && <>
          <p className="dlg-note">Destinatarios sugeridos: generales{p.areas.length ? <> + áreas con hallazgos (<b>{p.areas.join(', ')}</b>)</> : ''}. Puedes ajustarlos; se separan con punto y coma. Se adjunta el PDF y las fotos.</p>
          <div className="grid-2">
            <label className="field">Para<input value={to} onChange={e => setTo(e.target.value)} placeholder="correo@oxxo.com; …" /></label>
            <label className="field">CC<input value={cc} onChange={e => setCc(e.target.value)} /></label>
          </div>
          <label className="field">Asunto<input value={asunto} onChange={e => setAsunto(e.target.value)} /></label>
          {!p.to.length && <p className="field-hint">No hay destinatarios configurados para esta tienda. Agrégalos en Administración › Destinatarios.</p>}
          <div className="mail-preview" id="mailPreview" dangerouslySetInnerHTML={{ __html: p.html }} />
        </>}
      </Dialog>
    </>
  );
}
