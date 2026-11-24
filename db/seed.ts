/**
 * Carga inicial: checklist "Evaluación Tienda Completa", categorías y preguntas.
 * Las 5 preguntas salen del formato "Evaluacion Tienda Completa" (PPTX/PDF).
 * Es idempotente. Las tiendas NO se cargan aquí: se importan desde el concentrado
 * en Tiendas > Importar.
 */
import type { Kysely } from 'kysely';
import type { DB } from '../src/lib/db';
import { newId, now } from '../src/lib/db';

const CATEGORIAS = [
  { nombre: 'Limpieza', color: '#1d6b4f' },
  { nombre: 'Seguridad', color: '#cf4a36' },
  { nombre: 'Operación', color: '#36608f' },
  { nombre: 'Frío', color: '#2f8fb3' },
  { nombre: 'Imagen', color: '#c58a10' },
  { nombre: 'Sistemas', color: '#7a4fb3' },
];

const CALIF = 'Anexa evidencia fotográfica del hallazgo y de acuerdo con tu calificación.';
export const PREGUNTAS_INICIALES = [
  { texto: 'Evalúa orden y limpieza en el área de checkout (caja, laterales, piso)', ayuda: CALIF, evidencia: 'siempre' },
  { texto: 'Evalúa orden y limpieza en piso de venta', ayuda: 'Residuos debajo o en góndolas, incluye condiciones de suelo o techo que requieran mantenimiento. ' + CALIF, evidencia: 'siempre' },
  { texto: 'Evalúa orden y limpieza en Bodega de Tienda', ayuda: 'Estibas de producto desordenadas, obstrucción total de pasillos o puertas, piso sucio, residuos, etc. ' + CALIF, evidencia: 'siempre' },
  { texto: 'Evalúa orden y limpieza de tarja', ayuda: 'Residuos dentro de tarja, debajo, trastes sucios, etc. ' + CALIF, evidencia: 'siempre' },
  { texto: 'Verifica que no exista producto, materiales o residuos en techos de Bodega', ayuda: 'Techo de CF fuera de tapanco, techo de baño, otros techos. Anexa evidencia fotográfica del hallazgo.', evidencia: 'no_cumple' },
];

export async function seed(db: Kysely<DB>) {
  for (const [i, c] of CATEGORIAS.entries()) {
    const found = await db.selectFrom('categorias').select('id').where('nombre', '=', c.nombre).executeTakeFirst();
    if (!found) await db.insertInto('categorias').values({ id: newId(), ...c, orden: i }).execute();
  }
  const exists = await db.selectFrom('checklist').select('id').where('nombre', '=', 'Evaluación Tienda Completa').executeTakeFirst();
  if (!exists) {
    const checklistId = newId();
    await db.insertInto('checklist').values({
      id: checklistId, nombre: 'Evaluación Tienda Completa', descripcion: 'Checklist operativo de orden y limpieza en tienda.',
      activo: true, created_at: now(),
    }).execute();
    const limpieza = await db.selectFrom('categorias').select('id').where('nombre', '=', 'Limpieza').executeTakeFirstOrThrow();
    for (const [i, p] of PREGUNTAS_INICIALES.entries()) {
      await db.insertInto('preguntas').values({
        id: newId(), checklist_id: checklistId, categoria_id: limpieza.id, ...p, peso: 1, orden: i + 1, activa: true, created_at: now(),
      }).execute();
    }
  }
  const users = await db.selectFrom('usuarios').select(db.fn.countAll<number>().as('n')).executeTakeFirstOrThrow();
  if (Number(users.n) === 0) {
    await db.insertInto('usuarios').values({ id: newId(), nombre: 'Administrador', email: null, rol: 'admin', activo: true, created_at: now() }).execute();
  }
  console.log('Checklist, categorías y preguntas iniciales listos.');
}
