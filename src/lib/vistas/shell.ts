// Datos del marco de la app: usuario actual y sus checklists en curso.
import { entraEnabled, getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import pkg from '../../../package.json';

export async function loadShell() {
  const user = await getCurrentUser();
  const borradores = user
    ? (await db.selectFrom('evaluaciones').innerJoin('tiendas', 'tiendas.id', 'evaluaciones.tienda_id')
        .select(['evaluaciones.id', 'tiendas.nombre', 'tiendas.cr', 'evaluaciones.total', 'evaluaciones.cumple', 'evaluaciones.no_cumple', 'evaluaciones.no_aplica'])
        .where('evaluaciones.estado', '=', 'borrador').where('evaluador_id', '=', user.id).orderBy('evaluaciones.updated_at', 'desc').limit(8).execute())
        .map(b => ({ id: b.id, nombre: b.nombre, cr: b.cr, avance: b.total ? Math.round(((b.cumple + b.no_cumple + b.no_aplica) / b.total) * 100) : 0 }))
    : [];
  return { user, borradores, entra: entraEnabled, version: pkg.version };
}
export type ShellData = Awaited<ReturnType<typeof loadShell>>;
