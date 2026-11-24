/**
 * Datos de EJEMPLO para probar dashboard, historial y seguimiento.
 * Crea tiendas "Oxxo 001…006" (CR OX001…OX006) y evaluaciones de los últimos 6 meses.
 * Se borran solas al volver a correr, y con `npm run db:demo -- --clear` se quitan.
 * No usar en producción.
 */
import type { Kysely } from 'kysely';
import type { DB } from '../src/lib/db';
import { newId } from '../src/lib/db';
import { calcular } from '../src/lib/score';

const TIENDAS = [
  ['OX001', 'Oxxo 001', 'Tijuana', 'Tijuana Centro'], ['OX002', 'Oxxo 002', 'Tijuana', 'Playas'],
  ['OX003', 'Oxxo 003', 'Tijuana', 'Tijuana Este'], ['OX004', 'Oxxo 004', 'Ensenada', 'Ensenada'],
  ['OX005', 'Oxxo 005', 'Rosarito', 'Playas'], ['OX006', 'Oxxo 006', 'Ensenada', 'Ensenada'],
];

let seedN = 7;
const rnd = () => ((seedN = (seedN * 16807) % 2147483647) / 2147483647);

export async function demo(db: Kysely<DB>) {
  const old = await db.selectFrom('tiendas').select('id').where('cr', 'in', TIENDAS.map(t => t[0])).execute();
  if (old.length) {
    const ids = old.map(o => o.id);
    await db.deleteFrom('evaluaciones').where('tienda_id', 'in', ids).execute();
    await db.deleteFrom('tiendas').where('id', 'in', ids).execute();
  }
  if (process.argv.includes('--clear')) { console.log('Datos de ejemplo eliminados.'); return; }

  const checklist = await db.selectFrom('checklist').select('id').where('activo', '=', true).orderBy('created_at').executeTakeFirstOrThrow();
  const preguntas = await db.selectFrom('preguntas').innerJoin('categorias', 'categorias.id', 'preguntas.categoria_id')
    .select(['preguntas.id', 'texto', 'ayuda', 'evidencia', 'peso', 'categorias.nombre as cat', 'categorias.color'])
    .where('checklist_id', '=', checklist.id).where('activa', '=', true).orderBy('preguntas.orden').execute();
  const user = await db.selectFrom('usuarios').select('id').orderBy('created_at').executeTakeFirstOrThrow();

  let folio = 900000;
  for (const [i, [cr, nombre, ciudad, plaza]] of TIENDAS.entries()) {
    const tiendaId = newId();
    const ts = new Date().toISOString();
    await db.insertInto('tiendas').values({ id: tiendaId, cr, nombre, ciudad, plaza, estado: 'Baja California', region: 'Noroeste', activa: true, created_at: ts, updated_at: ts }).execute();
    const base = 0.55 + i * 0.06;
    for (let m = 5; m >= 0; m--) {
      const d = new Date(); d.setDate(10 + Math.floor(rnd() * 10)); d.setMonth(d.getMonth() - m);
      const prob = Math.min(0.97, base + (5 - m) * 0.05 * (i % 2 ? 1 : 0.4));
      const id = newId();
      const resps = preguntas.map((p, k) => {
        const r = rnd();
        const resultado = r < 0.06 ? 'no_aplica' : r < prob ? 'cumple' : 'no_cumple';
        const calificacion = resultado === 'cumple' ? (rnd() < 0.6 ? 5 : 4) : resultado === 'no_cumple' ? 1 + Math.floor(rnd() * 3) : null;
        return {
          id: newId(), evaluacion_id: id, pregunta_id: p.id, categoria: p.cat, categoria_color: p.color, texto: p.texto, ayuda: p.ayuda,
          evidencia_regla: p.evidencia, peso: p.peso, orden: k + 1, resultado, calificacion,
          comentario: resultado === 'no_cumple' ? 'Hallazgo de ejemplo.' : null,
        };
      });
      const c = calcular(resps);
      const iso = d.toISOString();
      await db.insertInto('evaluaciones').values({
        id, folio: `EV-${d.getFullYear()}-${folio++}`, tienda_id: tiendaId, checklist_id: checklist.id, evaluador_id: user.id, fecha: iso,
        estado: 'finalizada', observaciones: null, total: c.total, cumple: c.cumple, no_cumple: c.noCumple, no_aplica: c.noAplica,
        porcentaje: c.porcentaje, finalizada_at: iso, created_at: iso, updated_at: iso,
      }).execute();
      await db.insertInto('respuestas').values(resps).execute();
    }
  }
  console.log(`Ejemplo listo: ${TIENDAS.length} tiendas Oxxo 001…006 con 6 evaluaciones cada una.`);
}
