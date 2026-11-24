// Sustituto de next/headers en el service worker: "cookies" guardadas en IndexedDB.
import { kvGet, kvSet } from './idb';
let jar: Record<string, string> | null = null;
export async function cargarCookies() { jar = (await kvGet<Record<string, string>>('cookies')) ?? {}; }
export async function cookies() {
  if (!jar) await cargarCookies();
  return {
    get: (k: string) => (jar![k] ? { name: k, value: jar![k] } : undefined),
    set: (k: string, v: string) => { jar![k] = v; void kvSet('cookies', jar); },
    delete: (k: string) => { delete jar![k]; void kvSet('cookies', jar); },
  };
}
