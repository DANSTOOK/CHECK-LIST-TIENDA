// Cálculo del cumplimiento. Regla: % = peso de "Cumple" ÷ peso de (Cumple + No cumple).
// "No aplica" no suma ni resta. Si todo es "No aplica", el % queda en null.
export interface RespLite { resultado: string | null; peso: number; evidenciaRegla?: string; _fotos?: number }

export function calcular(resps: RespLite[]) {
  let cumple = 0, noCumple = 0, noAplica = 0, pendientes = 0, pc = 0, pt = 0;
  for (const r of resps) {
    if (r.resultado === 'cumple') { cumple++; pc += r.peso; pt += r.peso; }
    else if (r.resultado === 'no_cumple') { noCumple++; pt += r.peso; }
    else if (r.resultado === 'no_aplica') noAplica++;
    else pendientes++;
  }
  const porcentaje = pt ? Math.round((pc / pt) * 1000) / 10 : null;
  return { total: resps.length, cumple, noCumple, noAplica, pendientes, porcentaje };
}

/** ¿Esta respuesta exige foto y no la tiene? */
export function faltaFoto(r: RespLite) {
  if ((r._fotos ?? 0) > 0) return false;
  if (r.evidenciaRegla === 'siempre') return r.resultado === 'cumple' || r.resultado === 'no_cumple';
  if (r.evidenciaRegla === 'no_cumple') return r.resultado === 'no_cumple';
  return false;
}
