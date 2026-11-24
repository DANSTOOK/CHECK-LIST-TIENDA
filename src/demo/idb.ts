// Almacén llave-valor mínimo sobre IndexedDB (base de datos y fotos del modo demo).
const abrir = () => new Promise<IDBDatabase>((ok, mal) => {
  const r = indexedDB.open('ckl-demo', 1);
  r.onupgradeneeded = () => r.result.createObjectStore('kv');
  r.onsuccess = () => ok(r.result);
  r.onerror = () => mal(r.error);
});
let dbp: Promise<IDBDatabase> | null = null;
async function tx<T>(modo: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>) {
  const d = await (dbp ??= abrir());
  return new Promise<T>((ok, mal) => {
    const r = fn(d.transaction('kv', modo).objectStore('kv'));
    r.onsuccess = () => ok(r.result);
    r.onerror = () => mal(r.error);
  });
}
export const kvGet = <T>(k: string) => tx<T | undefined>('readonly', s => s.get(k) as IDBRequest<T | undefined>);
export const kvSet = (k: string, v: unknown) => tx('readwrite', s => s.put(v, k));
export const kvDel = (k: string) => tx('readwrite', s => s.delete(k));
