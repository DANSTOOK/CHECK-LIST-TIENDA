// Página de inicio: el checklist activo (sus preguntas) y las tiendas para elegir a cuál evaluar.
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function loadInicio() {
  const user = await getCurrentUser();
  if (!user) return null;
  const checklist = await db.selectFrom('checklist').select(['id', 'nombre', 'descripcion']).where('activo', '=', true).orderBy('created_at').executeTakeFirst();
  const [preguntas, tiendas, ultimas, borradores] = await Promise.all([
    checklist
      ? db.selectFrom('preguntas').innerJoin('categorias', 'categorias.id', 'preguntas.categoria_id')
          .select(['preguntas.id', 'texto', 'ayuda', 'evidencia', 'categorias.nombre as categoria', 'categorias.color'])
          .where('checklist_id', '=', checklist.id).where('activa', '=', true)
          .orderBy('categorias.orden').orderBy('preguntas.orden').execute()
      : [],
    db.selectFrom('tiendas').select(['id', 'cr', 'nombre', 'plaza', 'ro', 'ciudad']).where('activa', '=', true).orderBy('nombre').execute(),
    db.selectFrom('evaluaciones').select(['tienda_id', 'fecha', 'porcentaje']).where('estado', '=', 'finalizada').orderBy('fecha', 'desc').execute(),
    db.selectFrom('evaluaciones').select(['id', 'tienda_id']).where('estado', '=', 'borrador').where('evaluador_id', '=', user.id).execute(),
  ]);
  const ultima = new Map<string, { fecha: string; porcentaje: number | null }>();
  for (const e of ultimas) if (!ultima.has(e.tienda_id)) ultima.set(e.tienda_id, { fecha: e.fecha, porcentaje: e.porcentaje == null ? null : Number(e.porcentaje) });
  return {
    checklist: checklist ? { nombre: checklist.nombre, descripcion: checklist.descripcion } : null,
    preguntas,
    tiendas: tiendas.map(t => ({ ...t, ultima: ultima.get(t.id) ?? null, borradorId: borradores.find(b => b.tienda_id === t.id)?.id ?? null })),
    puedeEvaluar: user.rol !== 'consulta',
  };
}
export type InicioViewData = NonNullable<Awaited<ReturnType<typeof loadInicio>>>;
