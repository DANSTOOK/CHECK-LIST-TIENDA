import { db } from '@/lib/db';
import { fail, handler, ok } from '@/lib/api';
import { editable } from '@/lib/guard';
import { storage } from '@/lib/storage';

type Ctx = { params: Promise<{ id: string }> };

/** Entrega la imagen (pasa por la app para respetar la sesión, aun con Azure Blob privado). */
export const GET = handler<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  const f = await db.selectFrom('evidencias').select(['ruta', 'mime']).where('id', '=', id).executeTakeFirst();
  if (!f) return fail('No encontrada', 404);
  const data = await storage().get(f.ruta);
  return new Response(new Uint8Array(data), { headers: { 'Content-Type': f.mime, 'Cache-Control': 'private, max-age=31536000, immutable' } });
});

/** Quita una foto (solo mientras la evaluación está en borrador). */
export const DELETE = handler<Ctx>(async (_req, { params }, user) => {
  const { id } = await params;
  const f = await db.selectFrom('evidencias').select(['ruta', 'evaluacion_id']).where('id', '=', id).executeTakeFirst();
  if (!f) return fail('No encontrada', 404);
  const { error } = await editable(f.evaluacion_id, user);
  if (error) return error;
  await db.deleteFrom('evidencias').where('id', '=', id).execute();
  await storage().remove(f.ruta).catch(() => {});
  return ok({ ok: true });
});
