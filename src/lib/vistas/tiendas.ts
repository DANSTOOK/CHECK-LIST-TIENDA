// Datos del catálogo de tiendas con su última y penúltima evaluación.
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import type { TiendaRow } from '@/app/tiendas/TiendasView';

export async function loadTiendas() {
  const user = await getCurrentUser();
  if (!user) return null;
  const [tiendas, evals, borradores] = await Promise.all([
    db.selectFrom('tiendas').selectAll().orderBy('nombre').execute(),
    db.selectFrom('evaluaciones').select(['tienda_id', 'fecha', 'porcentaje', 'no_cumple'])
      .where('estado', '=', 'finalizada').orderBy('fecha', 'desc').execute(),
    db.selectFrom('evaluaciones').select(['id', 'tienda_id']).where('estado', '=', 'borrador').where('evaluador_id', '=', user.id).execute(),
  ]);
  // Última y penúltima evaluación por tienda (para el indicador ↑ ↓ =).
  const porTienda = new Map<string, typeof evals>();
  for (const e of evals) {
    const l = porTienda.get(e.tienda_id) ?? [];
    if (l.length < 2) l.push(e);
    porTienda.set(e.tienda_id, l);
  }
  const counts = new Map<string, number>();
  for (const e of evals) counts.set(e.tienda_id, (counts.get(e.tienda_id) ?? 0) + 1);

  const rows: TiendaRow[] = tiendas.map(t => {
    const [u, a] = porTienda.get(t.id) ?? [];
    return {
      id: t.id, cr: t.cr, nombre: t.nombre, ciudad: t.ciudad, plaza: t.plaza, estado: t.estado, region: t.region, ro: t.ro, activa: !!t.activa,
      ultima: u ? { fecha: u.fecha, porcentaje: u.porcentaje == null ? null : Number(u.porcentaje), hallazgos: u.no_cumple } : null,
      anterior: a?.porcentaje == null ? null : Number(a.porcentaje),
      evaluaciones: counts.get(t.id) ?? 0,
      borradorId: borradores.find(b => b.tienda_id === t.id)?.id ?? null,
    };
  });
  return { tiendas: rows, admin: user.rol === 'admin', puedeEvaluar: user.rol !== 'consulta' };
}
