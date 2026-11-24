/**
 * Almacenamiento de evidencias, configurable por STORAGE_DRIVER:
 *  - local: carpeta del servidor (STORAGE_DIR, por defecto ./storage)
 *  - azure: Azure Blob Storage (AZURE_STORAGE_CONNECTION_STRING + AZURE_STORAGE_CONTAINER)
 * La llave siempre tiene la forma evidencias/CR/AAAA/MM/<folio>_<uuid>.jpg
 * y el nombre incluye un UUID para que nunca se repita.
 */
import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

export interface StorageDriver {
  put(key: string, data: Buffer, mime: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  remove(key: string): Promise<void>;
}

const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
export const MIME_PERMITIDOS = Object.keys(EXT);

export function evidenceKey(cr: string, folio: string, mime: string, when = new Date()) {
  const safeCr = cr.replace(/[^A-Za-z0-9_-]/g, '');
  const y = String(when.getFullYear());
  const m = String(when.getMonth() + 1).padStart(2, '0');
  return `evidencias/${safeCr}/${y}/${m}/${folio}_${randomUUID()}.${EXT[mime] ?? 'jpg'}`;
}

class LocalDriver implements StorageDriver {
  root = path.resolve(process.env.STORAGE_DIR || './storage');
  private abs(key: string) {
    const p = path.resolve(this.root, key);
    if (!p.startsWith(this.root)) throw new Error('Ruta inválida'); // evita ../
    return p;
  }
  async put(key: string, data: Buffer) {
    const p = this.abs(key);
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.writeFile(p, data);
  }
  get(key: string) { return fs.readFile(this.abs(key)); }
  async remove(key: string) { await fs.rm(this.abs(key), { force: true }); }
}

class AzureDriver implements StorageDriver {
  private async container() {
    const { BlobServiceClient } = await import('@azure/storage-blob');
    const svc = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING!);
    const c = svc.getContainerClient(process.env.AZURE_STORAGE_CONTAINER || 'evidencias');
    await c.createIfNotExists();
    return c;
  }
  async put(key: string, data: Buffer, mime: string) {
    await (await this.container()).getBlockBlobClient(key).uploadData(data, { blobHTTPHeaders: { blobContentType: mime } });
  }
  async get(key: string) { return (await this.container()).getBlobClient(key).downloadToBuffer(); }
  async remove(key: string) { await (await this.container()).getBlobClient(key).deleteIfExists(); }
}

let driver: StorageDriver | null = null;
export function storage(): StorageDriver {
  if (!driver) driver = process.env.STORAGE_DRIVER === 'azure' ? new AzureDriver() : new LocalDriver();
  return driver;
}
