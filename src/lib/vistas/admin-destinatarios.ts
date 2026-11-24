import { db } from '@/lib/db';
import { entraEnabled, getCurrentUser } from '@/lib/auth';

/** Solo administradores: devuelve null para cualquier otro rol. */
export async function loadAdminDestinatarios() {
  const user = await getCurrentUser();
  if (user?.rol !== 'admin') return null;
  void entraEnabled;
  const [lista, categorias, plazas] = await Promise.all([
    db.selectFrom('destinatarios_correo').selectAll().orderBy('nombre').execute(),
    db.selectFrom('categorias').select(['id', 'nombre']).orderBy('orden').execute(),
    db.selectFrom('tiendas').select('plaza').distinct().where('plaza', 'is not', null).orderBy('plaza').execute(),
  ]);
  return { lista: lista.map(d => ({ ...d, activo: !!d.activo })), categorias, plazas: plazas.map(p => p.plaza!) };
}
