import { db, now } from '@/lib/db';
import { fail, handler, ok, str } from '@/lib/api';

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handler<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const b = await req.json();
  const cr = str(b.cr)?.toUpperCase();
  const nombre = str(b.nombre);
  if (!cr || !nombre) return fail('CR y nombre son obligatorios');
  const dup = await db.selectFrom('tiendas').select('id').where('cr', '=', cr).where('id', '!=', id).executeTakeFirst();
  if (dup) return fail(`Ya existe otra tienda con CR ${cr}`, 409);
  await db.updateTable('tiendas').set({
    cr, nombre, ciudad: str(b.ciudad), plaza: str(b.plaza), estado: str(b.estado), region: str(b.region), ro: str(b.ro),
    activa: b.activa === undefined ? true : !!b.activa, updated_at: now(),
  }).where('id', '=', id).execute();
  return ok({ id });
}, { admin: true });

/** Si la tienda tiene evaluaciones solo se desactiva (para no perder historial). */
export const DELETE = handler<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  const { n } = await db.selectFrom('evaluaciones').select(db.fn.countAll<number>().as('n')).where('tienda_id', '=', id).executeTakeFirstOrThrow();
  if (Number(n) > 0) {
    await db.updateTable('tiendas').set({ activa: false, updated_at: now() }).where('id', '=', id).execute();
    return ok({ desactivada: true });
  }
  await db.deleteFrom('tiendas').where('id', '=', id).execute();
  return ok({ eliminada: true });
}, { admin: true });
