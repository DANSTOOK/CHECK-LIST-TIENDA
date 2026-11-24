import { db } from '@/lib/db';
import { fail, handler, ok } from '@/lib/api';
import { crearEvaluacion } from '@/lib/evaluaciones';

/**
 * Inicia un checklist para una tienda. Si la misma persona ya tiene un borrador
 * abierto en esa tienda, lo retoma en lugar de crear otro.
 */
export const POST = handler(async (req, _ctx, user) => {
  if (user.rol === 'consulta') return fail('Tu perfil es solo de consulta', 403);
  const { tiendaId } = await req.json();
  const tienda = await db.selectFrom('tiendas').select(['id', 'activa']).where('id', '=', tiendaId).executeTakeFirst();
  if (!tienda || !tienda.activa) return fail('Tienda no encontrada', 404);
  const borrador = await db.selectFrom('evaluaciones').select(['id', 'folio'])
    .where('tienda_id', '=', tiendaId).where('evaluador_id', '=', user.id).where('estado', '=', 'borrador')
    .executeTakeFirst();
  if (borrador) return ok({ ...borrador, retomada: true });
  return ok(await crearEvaluacion(tiendaId, user.id), 201);
});
