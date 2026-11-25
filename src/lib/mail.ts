/**
 * Correo de resultados.
 * Dos caminos (el usuario elige en la pantalla de resultado):
 *  1. Archivo .eml con "X-Unsent: 1": Outlook Desktop lo abre como correo NUEVO,
 *     con formato, las fotos de evidencia DENTRO del cuerpo (debajo de cada
 *     pregunta), el PDF y el Excel adjuntos, listo para enviar o compartir.
 *     No requiere permisos.
 *     (Es el mismo mecanismo "Abrir en Outlook" del planificador de aperturas).
 *  2. Microsoft Graph: crea el BORRADOR directamente en el buzón del usuario
 *     (aparece en Borradores de Outlook Web y Desktop). Requiere Entra ID con el
 *     permiso delegado Mail.ReadWrite.
 * Nunca se envía solo: siempre queda como borrador para que la persona lo revise.
 */
import type { EvaluacionFull } from './evaluaciones';
import { fmtDateTime, RESULTADOS, type Resultado } from './format';
import { etiquetaEstrellas } from './score';

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

export const asunto = (ev: EvaluacionFull) => `Resultado Checklist Operativo - CR ${ev.tienda.cr} - ${ev.tienda.nombre}`;

/** inlineId: la imagen va dentro del cuerpo (se referencia como cid:inlineId). */
export interface Adjunto { nombre: string; mime: string; data: Buffer; inlineId?: string }

/** Identificador de la foto dentro del correo. */
export const cidFoto = (id: string) => `foto-${id}@ckl`;

/** Cuerpo HTML con estilos en línea (Outlook ignora <style> en muchos casos). */
export function cuerpoHtml(ev: EvaluacionFull, anterior: { porcentaje: number | null } | null, appUrl?: string, srcFoto?: (id: string) => string) {
  const p = ev.porcentaje;
  const color = p == null ? '#4b4943' : p >= 90 ? '#24603f' : p >= 75 ? '#8a5f06' : '#a8361f';
  const hallazgos = ev.respuestas.filter(r => r.resultado === 'no_cumple');
  const fotosTotal = ev.respuestas.reduce((n, r) => n + r.evidencias.length, 0);
  let comp = '';
  if (anterior?.porcentaje != null && p != null) {
    const d = Math.round((p - anterior.porcentaje) * 10) / 10;
    comp = Math.abs(d) < 0.5 ? '= Se mantuvo respecto a la evaluación anterior'
      : d > 0 ? `↑ Mejoró ${d} pts respecto a la evaluación anterior (${anterior.porcentaje}%)`
      : `↓ Empeoró ${Math.abs(d)} pts respecto a la evaluación anterior (${anterior.porcentaje}%)`;
  }
  const td = 'padding:6px 10px;border-bottom:1px solid #e7e5df;font-size:13px;vertical-align:top;';
  const filas = ev.respuestas.map((r, i) => {
    const res = r.calificacion
      ? `<span style="color:${r.calificacion <= 3 ? '#e07a35' : '#e0a20b'};letter-spacing:1px;">${'★'.repeat(r.calificacion)}</span><span style="color:#d8d5cc;letter-spacing:1px;">${'★'.repeat(5 - r.calificacion)}</span> ${r.calificacion}/5 ${etiquetaEstrellas(r.calificacion)}`
      : r.resultado ? RESULTADOS[r.resultado as Resultado].label : 'Sin respuesta';
    const bg = r.resultado === 'cumple' ? '#e7f1ea' : r.resultado === 'no_cumple' ? '#fbe9e5' : '#f1f0ec';
    const fg = r.resultado === 'cumple' ? '#24603f' : r.resultado === 'no_cumple' ? '#a8361f' : '#85827a';
    return `<tr><td style="${td}color:#6d6a62;">${i + 1}</td><td style="${td}">${esc(r.texto)}<div style="color:#6d6a62;font-size:12px;">${esc(r.categoria)}</div></td>
      <td style="${td}">${r.calificacion ? `<span style="font-weight:600;font-size:12px;white-space:nowrap;">${res}</span>` : `<span style="background:${bg};color:${fg};padding:2px 8px;border-radius:5px;font-weight:600;font-size:12px;white-space:nowrap;">${res}</span>`}</td>
      <td style="${td}">${esc(r.comentario || '')}</td></tr>${srcFoto && r.evidencias.length ? `<tr><td style="padding:0 10px 10px;border-bottom:1px solid #e7e5df;"></td><td colspan="3" style="padding:0 10px 12px;border-bottom:1px solid #e7e5df;">${r.evidencias.filter(f => f.mime === 'image/jpeg' || f.mime === 'image/png').map((f, k) => `<img src="${srcFoto(f.id)}" width="180" alt="Evidencia ${i + 1}.${k + 1}" style="width:180px;max-width:100%;height:auto;border-radius:6px;border:1px solid #e7e5df;margin:6px 8px 0 0;vertical-align:top;">`).join('')}</td></tr>` : ''}`;
  }).join('');
  const kpi = (l: string, v: string | number, c = '#1c1b18') =>
    `<td style="padding:10px 14px;border-left:1px solid #e7e5df;"><div style="font-size:12px;color:#6d6a62;">${l}</div><div style="font-size:22px;font-weight:700;color:${c};">${v}</div></td>`;

  return `<div style="font-family:'Segoe UI',Arial,sans-serif;color:#1c1b18;max-width:760px;">
  <p style="font-size:14px;">Buen día,</p>
  <p style="font-size:14px;">Comparto el resultado del checklist operativo realizado en la tienda <b>${esc(ev.tienda.nombre)}</b> (CR <b>${esc(ev.tienda.cr)}</b>).</p>
  <table style="border-collapse:collapse;font-size:13px;margin:12px 0;">
    <tr><td style="padding:3px 14px 3px 0;color:#6d6a62;">Tienda</td><td><b>${esc(ev.tienda.nombre)}</b> · CR ${esc(ev.tienda.cr)}</td></tr>
    <tr><td style="padding:3px 14px 3px 0;color:#6d6a62;">Fecha del checklist</td><td><b>${esc(fmtDateTime(ev.fecha))}</b></td></tr>
    <tr><td style="padding:3px 14px 3px 0;color:#6d6a62;">Folio</td><td>${esc(ev.folio)}</td></tr>
    <tr><td style="padding:3px 14px 3px 0;color:#6d6a62;">Responsable</td><td>${esc(ev.evaluador.nombre)}</td></tr>
    ${ev.tienda.ro ? `<tr><td style="padding:3px 14px 3px 0;color:#6d6a62;">RO</td><td>${esc(ev.tienda.ro)}</td></tr>` : ''}
    <tr><td style="padding:3px 14px 3px 0;color:#6d6a62;">Plaza</td><td>${esc(ev.tienda.plaza || '—')}${ev.tienda.ciudad ? ' · ' + esc(ev.tienda.ciudad) : ''}</td></tr>
  </table>
  <h3 style="font-size:15px;margin:18px 0 6px;">Resumen ejecutivo</h3>
  <table style="border-collapse:collapse;border:1px solid #e7e5df;border-radius:8px;background:#faf9f7;"><tr>
    <td style="padding:10px 16px;"><div style="font-size:12px;color:#6d6a62;">Cumplimiento</div><div style="font-size:30px;font-weight:700;color:${color};">${p == null ? '—' : p.toFixed(1) + '%'}</div></td>
    ${kpi('Preguntas', ev.total)}${kpi('Bien (4-5★)', ev.cumple, '#24603f')}${kpi('Hallazgos (1-3★)', ev.noCumple, ev.noCumple ? '#a8361f' : '#1c1b18')}${kpi('No aplican', ev.noAplica)}
  </tr></table>
  ${comp ? `<p style="font-size:13px;color:#4b4943;margin:8px 0 0;">${comp}</p>` : ''}
  <h3 style="font-size:15px;margin:20px 0 6px;">Hallazgos encontrados (${hallazgos.length})</h3>
  ${hallazgos.length ? `<ul style="font-size:13px;padding-left:18px;margin:0;">${hallazgos.map(h =>
    `<li style="margin-bottom:4px;"><b>${esc(h.categoria)}${h.calificacion ? ` (${h.calificacion}/5)` : ''}:</b> ${esc(h.texto)}${h.comentario ? ` — <i>${esc(h.comentario)}</i>` : ''}</li>`).join('')}</ul>`
    : '<p style="font-size:13px;color:#24603f;margin:0;">Sin hallazgos. ¡Buen trabajo!</p>'}
  ${ev.observaciones ? `<h3 style="font-size:15px;margin:20px 0 6px;">Observaciones</h3><p style="font-size:13px;white-space:pre-wrap;margin:0;">${esc(ev.observaciones)}</p>` : ''}
  <h3 style="font-size:15px;margin:20px 0 6px;">Detalle por pregunta y evidencia fotográfica</h3>
  <table style="border-collapse:collapse;width:100%;"><tr style="background:#f1f0ec;">
    <th style="${td}text-align:left;">#</th><th style="${td}text-align:left;">Pregunta</th><th style="${td}text-align:left;">Resultado</th><th style="${td}text-align:left;">Comentario</th></tr>${filas}</table>
  <p style="font-size:12.5px;color:#6d6a62;margin-top:16px;">Incluye ${fotosTotal} evidencia${fotosTotal === 1 ? '' : 's'} fotográfica${fotosTotal === 1 ? '' : 's'} en el detalle. Se adjuntan el reporte PDF y el Excel de seguimiento (cada punto con sus fotos).${appUrl ? ` Consulta el detalle en <a href="${esc(appUrl)}">${esc(appUrl)}</a>.` : ''}</p>
  <p style="font-size:14px;">Saludos.</p></div>`;
}

const b64 = (b: Buffer | string) => Buffer.from(b).toString('base64').replace(/.{1,76}/g, '$&\r\n');
const encWord = (s: string) => `=?UTF-8?B?${Buffer.from(s).toString('base64')}?=`;

/** Construye un .eml (RFC 822) como borrador sin enviar, con adjuntos. */
export function construirEml(o: { to: string[]; cc: string[]; subject: string; html: string; adjuntos: Adjunto[] }) {
  const t = Date.now().toString(36);
  const mixed = `----=_CKL_M_${t}`, related = `----=_CKL_R_${t}`;
  const enLinea = o.adjuntos.filter(a => a.inlineId), archivos = o.adjuntos.filter(a => !a.inlineId);
  const parts = [
    `To: ${o.to.join(', ')}`,
    ...(o.cc.length ? [`Cc: ${o.cc.join(', ')}`] : []),
    `Subject: ${encWord(o.subject)}`,
    `Date: ${new Date().toUTCString()}`,
    'X-Unsent: 1',
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${mixed}"`,
    '',
    `--${mixed}`,
    // Cuerpo HTML + fotos que se muestran dentro del correo (cid:)
    `Content-Type: multipart/related; type="text/html"; boundary="${related}"`,
    '',
    `--${related}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    b64(`<!doctype html><html><head><meta charset="utf-8"></head><body>${o.html}</body></html>`),
  ];
  for (const a of enLinea) {
    parts.push(`--${related}`, `Content-Type: ${a.mime}; name="${a.nombre}"`, 'Content-Transfer-Encoding: base64',
      `Content-ID: <${a.inlineId}>`, `Content-Disposition: inline; filename="${a.nombre}"`, '', b64(a.data));
  }
  parts.push(`--${related}--`, '');
  for (const a of archivos) {
    parts.push(`--${mixed}`, `Content-Type: ${a.mime}; name="${encWord(a.nombre)}"`, 'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; filename="${encWord(a.nombre)}"`, '', b64(a.data));
  }
  parts.push(`--${mixed}--`, '');
  return parts.join('\r\n');
}

/**
 * Crea el borrador en el buzón del usuario con Microsoft Graph.
 * Adjuntos < 3 MB van en una sola llamada; los más grandes usan "upload session".
 * Devuelve el webLink para abrir el borrador en Outlook Web.
 */
export async function crearBorradorGraph(token: string, o: { to: string[]; cc: string[]; subject: string; html: string; adjuntos: Adjunto[] }) {
  const G = 'https://graph.microsoft.com/v1.0';
  const h = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const rcpt = (xs: string[]) => xs.map(address => ({ emailAddress: { address } }));
  const res = await fetch(`${G}/me/messages`, {
    method: 'POST', headers: h,
    body: JSON.stringify({ subject: o.subject, body: { contentType: 'HTML', content: o.html }, toRecipients: rcpt(o.to), ccRecipients: rcpt(o.cc) }),
  });
  if (!res.ok) throw new Error(`Graph no pudo crear el borrador (${res.status}): ${await res.text()}`);
  const msg = (await res.json()) as { id: string; webLink: string };

  for (const a of o.adjuntos) {
    if (a.data.length < 3 * 1024 * 1024) {
      const r = await fetch(`${G}/me/messages/${msg.id}/attachments`, {
        method: 'POST', headers: h,
        body: JSON.stringify({ '@odata.type': '#microsoft.graph.fileAttachment', name: a.nombre, contentType: a.mime, contentBytes: a.data.toString('base64'), ...(a.inlineId ? { isInline: true, contentId: a.inlineId } : {}) }),
      });
      if (!r.ok) throw new Error(`No se pudo adjuntar ${a.nombre} (${r.status})`);
    } else {
      const s = await fetch(`${G}/me/messages/${msg.id}/attachments/createUploadSession`, {
        method: 'POST', headers: h,
        body: JSON.stringify({ AttachmentItem: { attachmentType: 'file', name: a.nombre, size: a.data.length, contentType: a.mime } }),
      });
      if (!s.ok) throw new Error(`No se pudo preparar la carga de ${a.nombre} (${s.status})`);
      const { uploadUrl } = (await s.json()) as { uploadUrl: string };
      const CH = 3 * 1024 * 1024; // trozos de 3 MB (múltiplo de 320 KB)
      for (let i = 0; i < a.data.length; i += CH) {
        const chunk = a.data.subarray(i, Math.min(i + CH, a.data.length));
        const u = await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Length': String(chunk.length), 'Content-Range': `bytes ${i}-${i + chunk.length - 1}/${a.data.length}` },
          body: new Uint8Array(chunk),
        });
        if (!u.ok) throw new Error(`Falló la carga de ${a.nombre} (${u.status})`);
      }
    }
  }
  return msg.webLink;
}
