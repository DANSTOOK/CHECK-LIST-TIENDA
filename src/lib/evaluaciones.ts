// Reglas de negocio de las evaluaciones (crear, recalcular, cargar, destinatarios).
import { db, newId, now, type EvidenciasT, type RespuestasT, type TiendasT } from './db';
import { calcular } from './score';

/** Crea una evaluación en borrador copiando las preguntas activas del checklist. */
export async function crearEvaluacion(tiendaId: string, evaluadorId: string) {
  const checklist = await db.selectFrom('checklist').select(['id']).where('activo', '=', true).orderBy('created_at').executeTakeFirst();
  if (!checklist) throw new Error('No hay un checklist activo.');
  const preguntas = await db.selectFrom('preguntas')
    .innerJoin('categorias', 'categorias.id', 'preguntas.categoria_id')
    .select(['preguntas.id', 'texto', 'ayuda', 'evidencia', 'peso', 'categorias.nombre as cat', 'categorias.color'])
    .where('checklist_id', '=', checklist.id).where('activa', '=', true)
    .orderBy('categorias.orden').orderBy('preguntas.orden').execute();
  if (!preguntas.length) throw new Error('El checklist no tiene preguntas activas. Agrégalas en Preguntas.');

  const year = new Date().getFullYear();
  // Folio consecutivo por año; si dos personas crean al mismo tiempo, el UNIQUE lo detecta y se reintenta.
  for (let intento = 0; intento < 5; intento++) {
    const { n } = await db.selectFrom('evaluaciones').select(db.fn.countAll<number>().as('n'))
      .where('folio', 'like', `EV-${year}-%`).executeTakeFirstOrThrow();
    const folio = `EV-${year}-${String(Number(n) + 1 + intento).padStart(6, '0')}`;
    const id = newId();
    const ts = now();
    try {
      await db.transaction().execute(async tx => {
        await tx.insertInto('evaluaciones').values({
          id, folio, tienda_id: tiendaId, checklist_id: checklist.id, evaluador_id: evaluadorId, fecha: ts,
          estado: 'borrador', observaciones: null, total: preguntas.length, cumple: 0, no_cumple: 0, no_aplica: 0,
          porcentaje: null, finalizada_at: null, created_at: ts, updated_at: ts,
        }).execute();
        await tx.insertInto('respuestas').values(preguntas.map((p, i) => ({
          id: newId(), evaluacion_id: id, pregunta_id: p.id, categoria: p.cat, categoria_color: p.color,
          texto: p.texto, ayuda: p.ayuda, evidencia_regla: p.evidencia, peso: p.peso, orden: i + 1, resultado: null, comentario: null, calificacion: null,
        }))).execute();
      });
      return { id, folio };
    } catch (e) {
      if (!(e instanceof Error) || !/unique|duplicate/i.test(e.message)) throw e;
    }
  }
  throw new Error('No se pudo generar el folio, intenta de nuevo.');
}

/** Recalcula y guarda los totales de la evaluación. */
export async function recalcular(evaluacionId: string) {
  const resps = await db.selectFrom('respuestas').select(['resultado', 'calificacion', 'peso', 'evidencia_regla as evidenciaRegla'])
    .where('evaluacion_id', '=', evaluacionId).execute();
  const c = calcular(resps);
  await db.updateTable('evaluaciones').set({
    total: c.total, cumple: c.cumple, no_cumple: c.noCumple, no_aplica: c.noAplica, porcentaje: c.porcentaje, updated_at: now(),
  }).where('id', '=', evaluacionId).execute();
  return c;
}

export type RespuestaFull = RespuestasT & { evidencias: EvidenciasT[] };
export interface EvaluacionFull {
  id: string; folio: string; fecha: string; estado: string; observaciones: string | null;
  total: number; cumple: number; noCumple: number; noAplica: number; porcentaje: number | null; finalizadaAt: string | null;
  tienda: TiendasT; evaluador: { id: string; nombre: string; email: string | null }; checklist: { nombre: string };
  respuestas: RespuestaFull[];
}

export async function cargarEvaluacion(id: string): Promise<EvaluacionFull | null> {
  const ev = await db.selectFrom('evaluaciones').selectAll().where('id', '=', id).executeTakeFirst();
  if (!ev) return null;
  const [tienda, evaluador, checklist, resps, fotos] = await Promise.all([
    db.selectFrom('tiendas').selectAll().where('id', '=', ev.tienda_id).executeTakeFirstOrThrow(),
    db.selectFrom('usuarios').select(['id', 'nombre', 'email']).where('id', '=', ev.evaluador_id).executeTakeFirstOrThrow(),
    db.selectFrom('checklist').select('nombre').where('id', '=', ev.checklist_id).executeTakeFirstOrThrow(),
    db.selectFrom('respuestas').selectAll().where('evaluacion_id', '=', id).orderBy('orden').execute(),
    db.selectFrom('evidencias').selectAll().where('evaluacion_id', '=', id).orderBy('created_at').execute(),
  ]);
  return {
    id: ev.id, folio: ev.folio, fecha: ev.fecha, estado: ev.estado, observaciones: ev.observaciones,
    total: ev.total, cumple: ev.cumple, noCumple: ev.no_cumple, noAplica: ev.no_aplica,
    porcentaje: ev.porcentaje == null ? null : Number(ev.porcentaje), finalizadaAt: ev.finalizada_at,
    tienda, evaluador, checklist,
    respuestas: resps.map(r => ({ ...r, evidencias: fotos.filter(f => f.respuesta_id === r.id) })),
  };
}

/** Evaluación finalizada inmediata anterior de la misma tienda (para comparar). */
export async function evaluacionAnterior(ev: { id: string; tienda: { id: string }; fecha: string }) {
  const r = await db.selectFrom('evaluaciones').select(['porcentaje', 'fecha', 'folio', 'id'])
    .where('tienda_id', '=', ev.tienda.id).where('estado', '=', 'finalizada')
    .where('fecha', '<', ev.fecha).where('id', '!=', ev.id)
    .orderBy('fecha', 'desc').executeTakeFirst();
  return r ? { ...r, porcentaje: r.porcentaje == null ? null : Number(r.porcentaje) } : null;
}

/**
 * Destinatarios sugeridos: los generales + los de cada área con hallazgos,
 * filtrados por la plaza de la tienda (sin plaza = todas las plazas).
 */
export async function destinatariosPara(ev: EvaluacionFull) {
  const areas = [...new Set(ev.respuestas.filter(r => r.resultado === 'no_cumple').map(r => r.categoria))];
  const lista = await db.selectFrom('destinatarios_correo')
    .leftJoin('categorias', 'categorias.id', 'destinatarios_correo.categoria_id')
    .select(['email', 'tipo', 'plaza', 'categorias.nombre as area'])
    .where('activo', '=', true).execute();
  const plaza = (ev.tienda.plaza || '').toLowerCase();
  const elegidos = lista.filter(d =>
    (!d.plaza || d.plaza.toLowerCase() === plaza) && (!d.area || areas.includes(d.area)));
  const uniq = (xs: string[]) => [...new Set(xs.map(x => x.trim().toLowerCase()))];
  const to = uniq(elegidos.filter(d => d.tipo !== 'cc').map(d => d.email));
  return { to, cc: uniq(elegidos.filter(d => d.tipo === 'cc').map(d => d.email)).filter(x => !to.includes(x)), areas };
}
