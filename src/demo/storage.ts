// Fotos de evidencia del modo demo: en IndexedDB, con la misma llave evidencias/CR/AAAA/MM/…
import { Buffer } from 'buffer';
import { kvDel, kvGet, kvSet } from './idb';
const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
export const MIME_PERMITIDOS = Object.keys(EXT);
export function evidenceKey(cr: string, folio: string, mime: string, when = new Date()) {
  const m = String(when.getMonth() + 1).padStart(2, '0');
  return `evidencias/${cr.replace(/[^A-Za-z0-9_-]/g, '')}/${when.getFullYear()}/${m}/${folio}_${crypto.randomUUID()}.${EXT[mime] ?? 'jpg'}`;
}
const driver = {
  async put(key: string, data: Buffer) { await kvSet('f:' + key, new Uint8Array(data)); },
  async get(key: string) { const v = await kvGet<Uint8Array>('f:' + key); if (!v) throw new Error('No existe'); return Buffer.from(v); },
  async remove(key: string) { await kvDel('f:' + key); },
};
export const storage = () => driver;
