/**
 * Calificación y cumplimiento.
 * - Cada pregunta se califica con 1 a 5 estrellas (como en Forms) o "No aplica".
 * - 4–5 estrellas = cumple; 1–3 estrellas = hallazgo (no cumple, pide comentario).
 * - % de cumplimiento = estrellas obtenidas ÷ estrellas posibles (ponderado por peso).
 *   "No aplica" no cuenta. Si todo es "No aplica", el % queda en null.
 * - Evaluaciones anteriores sin estrellas: "Cumple" cuenta como 5 y "No cumple" como 1.
 */
export interface RespLite { resultado: string | null; calificacion?: number | null; peso: number; evidenciaRegla?: string; _fotos?: number }

export const ESTRELLAS = [
  { n: 1, label: 'Muy mal' }, { n: 2, label: 'Mal' }, { n: 3, label: 'Regular' }, { n: 4, label: 'Bien' }, { n: 5, label: 'Excelente' },
];
export const etiquetaEstrellas = (n: number | null | undefined) => (n ? ESTRELLAS[n - 1]?.label ?? '' : '');
/** Resultado que corresponde a una calificación. */
export const resultadoDe = (n: number) => (n >= 4 ? 'cumple' : 'no_cumple');

const puntos = (r: RespLite) => r.calificacion ?? (r.resultado === 'cumple' ? 5 : r.resultado === 'no_cumple' ? 1 : 0);

export function calcular(resps: RespLite[]) {
  let cumple = 0, noCumple = 0, noAplica = 0, pendientes = 0, obtenidos = 0, posibles = 0;
  for (const r of resps) {
    if (r.resultado === 'cumple' || r.resultado === 'no_cumple') {
      if (r.resultado === 'cumple') cumple++; else noCumple++;
      obtenidos += puntos(r) * r.peso;
      posibles += 5 * r.peso;
    } else if (r.resultado === 'no_aplica') noAplica++;
    else pendientes++;
  }
  const porcentaje = posibles ? Math.round((obtenidos / posibles) * 1000) / 10 : null;
  return { total: resps.length, cumple, noCumple, noAplica, pendientes, porcentaje };
}

/** ¿Esta respuesta exige foto y no la tiene? */
export function faltaFoto(r: RespLite) {
  if ((r._fotos ?? 0) > 0) return false;
  if (r.evidenciaRegla === 'siempre') return r.resultado === 'cumple' || r.resultado === 'no_cumple';
  if (r.evidenciaRegla === 'no_cumple') return r.resultado === 'no_cumple';
  return false;
}
