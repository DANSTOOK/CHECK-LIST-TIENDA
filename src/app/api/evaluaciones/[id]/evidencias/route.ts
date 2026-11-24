/**
 * Sube una foto de evidencia para una respuesta. El navegador ya la comprime a
 * JPEG (máx. 1600 px) antes de enviarla: ahorra datos en tienda y permite meterla
 * al PDF. Se aceptan JPG, JPEG, PNG y WEBP.
 * La foto se guarda en cuanto se toma (autoguardado), así no se pierde si se va la
 * señal; mientras la evaluación está en borrador se puede eliminar.
 */
import { db, newId, now } from '@/lib/db';
import { fail, handler, ok } from '@/lib/api';
import { editable } from '@/lib/guard';
import { evidenceKey, MIME_PERMITIDOS, storage } from '@/lib/storage';

type Ctx = { params: Promise<{ id: string }> };
const MAX = 10 * 1024 * 1024;

export const POST = handler<Ctx>(async (req, { params }, user) => {
  const { id } = await params;
  const { ev, error } = await editable(id, user);
  if (error) return error;
  const form = await req.formData();
  const respuestaId = String(form.get('respuestaId') || '');
  const file = form.get('file');
  if (!(file instanceof File)) return fail('No llegó la imagen');
  if (!MIME_PERMITIDOS.includes(file.type)) return fail('Formato no permitido. Usa JPG, PNG o WEBP');
  if (file.size > MAX) return fail('La imagen pesa más de 10 MB');
  const resp = await db.selectFrom('respuestas').select(['id', 'pregunta_id']).where('id', '=', respuestaId).where('evaluacion_id', '=', id).executeTakeFirst();
  if (!resp) return fail('Pregunta no encontrada', 404);
  const tienda = await db.selectFrom('tiendas').select('cr').where('id', '=', ev!.tienda_id).executeTakeFirstOrThrow();

  const ruta = evidenceKey(tienda.cr, ev!.folio, file.type);
  const data = Buffer.from(await file.arrayBuffer());
  await storage().put(ruta, data, file.type);
  const foto = {
    id: newId(), respuesta_id: resp.id, evaluacion_id: id, tienda_cr: tienda.cr, pregunta_id: resp.pregunta_id,
    usuario_id: user.id, ruta, nombre_original: file.name?.slice(0, 250) || null, mime: file.type, bytes: data.length, created_at: now(),
  };
  await db.insertInto('evidencias').values(foto).execute();
  return ok(foto, 201);
});
