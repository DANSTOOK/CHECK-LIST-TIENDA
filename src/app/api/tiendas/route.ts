import { db, newId, now } from '@/lib/db';
import { fail, handler, ok, str } from '@/lib/api';

/** Alta de una tienda (o actualización si el CR ya existe). */
export const POST = handler(async req => {
  const b = await req.json();
  const cr = str(b.cr)?.toUpperCase();
  const nombre = str(b.nombre);
  if (!cr || !nombre) return fail('CR y nombre son obligatorios');
  const data = { nombre, ciudad: str(b.ciudad), plaza: str(b.plaza), estado: str(b.estado), region: str(b.region), ro: str(b.ro) };
  const existe = await db.selectFrom('tiendas').select('id').where('cr', '=', cr).executeTakeFirst();
  if (existe) {
    if (!b.sobrescribir) return fail(`Ya existe una tienda con CR ${cr}`, 409);
    await db.updateTable('tiendas').set({ ...data, activa: true, updated_at: now() }).where('id', '=', existe.id).execute();
    return ok({ id: existe.id });
  }
  const id = newId();
  await db.insertInto('tiendas').values({ id, cr, ...data, activa: true, created_at: now(), updated_at: now() }).execute();
  return ok({ id }, 201);
}, { admin: true });
