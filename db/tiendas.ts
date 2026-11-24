/**
 * Catálogo de tiendas de la región (db/tiendas-region.json).
 * Hoy contiene la Plaza Playas (distribución OCT 2026, con su RO).
 * Lo usa la versión publicada en GitHub Pages como datos iniciales y se puede
 * cargar en la base local con `npm run db:tiendas`. Es idempotente (actualiza por CR).
 * Para agregar otra plaza: añade sus tiendas al JSON (cr, nombre, plaza, ro…).
 */
import type { Kysely } from 'kysely';
import type { DB } from '../src/lib/db';
import { newId } from '../src/lib/db';
import catalogo from './tiendas-region.json';

type T = { cr: string; nombre: string; ciudad: string | null; plaza: string | null; estado: string | null; region: string | null; ro: string | null };

export async function cargarTiendas(db: Kysely<DB>) {
  const ts = new Date().toISOString();
  const existentes = new Map((await db.selectFrom('tiendas').select(['id', 'cr']).execute()).map(t => [t.cr, t.id]));
  let n = 0;
  for (const t of catalogo as T[]) {
    const data = { nombre: t.nombre, ciudad: t.ciudad, plaza: t.plaza, estado: t.estado, region: t.region, ro: t.ro };
    const id = existentes.get(t.cr);
    if (id) await db.updateTable('tiendas').set({ ...data, activa: true, updated_at: ts }).where('id', '=', id).execute();
    else await db.insertInto('tiendas').values({ id: newId(), cr: t.cr, ...data, activa: true, created_at: ts, updated_at: ts }).execute();
    n++;
  }
  console.log(`Catálogo cargado: ${n} tiendas.`);
}
