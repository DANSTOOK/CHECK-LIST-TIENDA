/**
 * Service worker del modo demo (GitHub Pages).
 * Hace de "servidor" dentro del navegador: atiende /api/* con los MISMOS route
 * handlers y funciones de datos que usa Next.js en el servidor, sobre SQLite
 * (sql.js) e IndexedDB. Se empaqueta con esbuild (scripts/build-demo.mjs), que
 * sustituye db/auth/storage/next-headers por sus versiones de src/demo.
 */
/// <reference lib="webworker" />
import { iniciar, guardar, reiniciar } from './db';
import { cargarCookies } from './headers';
import { seed } from '../../db/seed';
import { demo } from '../../db/demo';
import { fail } from '@/lib/api';

import * as sesion from '@/app/api/sesion/route';
import * as tiendas from '@/app/api/tiendas/route';
import * as tiendaId from '@/app/api/tiendas/[id]/route';
import * as importar from '@/app/api/tiendas/importar/route';
import * as evaluaciones from '@/app/api/evaluaciones/route';
import * as evaluacionId from '@/app/api/evaluaciones/[id]/route';
import * as finalizar from '@/app/api/evaluaciones/[id]/finalizar/route';
import * as evidenciasPost from '@/app/api/evaluaciones/[id]/evidencias/route';
import * as pdf from '@/app/api/evaluaciones/[id]/pdf/route';
import * as correo from '@/app/api/evaluaciones/[id]/correo/route';
import * as evidenciaId from '@/app/api/evidencias/[id]/route';
import * as categorias from '@/app/api/categorias/route';
import * as categoriaId from '@/app/api/categorias/[id]/route';
import * as preguntas from '@/app/api/preguntas/route';
import * as preguntaId from '@/app/api/preguntas/[id]/route';
import * as destinatarios from '@/app/api/destinatarios/route';
import * as destinatarioId from '@/app/api/destinatarios/[id]/route';
import * as usuarios from '@/app/api/usuarios/route';
import * as usuarioId from '@/app/api/usuarios/[id]/route';

import { loadShell } from '@/lib/vistas/shell';
import { loadDashboard } from '@/lib/vistas/dashboard';
import { loadInicio } from '@/lib/vistas/inicio';
import { loadHistorial } from '@/lib/vistas/historial';
import { loadTiendas } from '@/lib/vistas/tiendas';
import { loadTienda } from '@/lib/vistas/tienda';
import { loadEvaluacion } from '@/lib/vistas/evaluacion';
import { loadAdminPreguntas } from '@/lib/vistas/admin-preguntas';
import { loadAdminDestinatarios } from '@/lib/vistas/admin-destinatarios';
import { loadAdminUsuarios } from '@/lib/vistas/admin-usuarios';

declare const self: ServiceWorkerGlobalScope;
const BASE = new URL(self.registration.scope).pathname.replace(/\/$/, '');

type Mod = Record<string, unknown>;
// El orden importa: rutas fijas antes que las de parámetro.
const RUTAS: [RegExp, Mod][] = [
  [/^\/api\/sesion$/, sesion],
  [/^\/api\/tiendas$/, tiendas],
  [/^\/api\/tiendas\/importar$/, importar],
  [/^\/api\/tiendas\/(?<id>[^/]+)$/, tiendaId],
  [/^\/api\/evaluaciones$/, evaluaciones],
  [/^\/api\/evaluaciones\/(?<id>[^/]+)$/, evaluacionId],
  [/^\/api\/evaluaciones\/(?<id>[^/]+)\/finalizar$/, finalizar],
  [/^\/api\/evaluaciones\/(?<id>[^/]+)\/evidencias$/, evidenciasPost],
  [/^\/api\/evaluaciones\/(?<id>[^/]+)\/pdf$/, pdf],
  [/^\/api\/evaluaciones\/(?<id>[^/]+)\/correo$/, correo],
  [/^\/api\/evidencias\/(?<id>[^/]+)$/, evidenciaId],
  [/^\/api\/categorias$/, categorias],
  [/^\/api\/categorias\/(?<id>[^/]+)$/, categoriaId],
  [/^\/api\/preguntas$/, preguntas],
  [/^\/api\/preguntas\/(?<id>[^/]+)$/, preguntaId],
  [/^\/api\/destinatarios$/, destinatarios],
  [/^\/api\/destinatarios\/(?<id>[^/]+)$/, destinatarioId],
  [/^\/api\/usuarios$/, usuarios],
  [/^\/api\/usuarios\/(?<id>[^/]+)$/, usuarioId],
];

const sp = (q: URLSearchParams) => Object.fromEntries(q.entries());
const VISTAS: Record<string, (q: URLSearchParams) => Promise<unknown>> = {
  shell: () => loadShell(),
  inicio: () => loadInicio(),
  dashboard: q => loadDashboard(sp(q)),
  historial: q => loadHistorial(sp(q)),
  tiendas: () => loadTiendas(),
  tienda: q => loadTienda(q.get('cr') || ''),
  evaluacion: q => loadEvaluacion(q.get('id') || ''),
  'admin-preguntas': () => loadAdminPreguntas(),
  'admin-destinatarios': () => loadAdminDestinatarios(),
  'admin-usuarios': () => loadAdminUsuarios(),
};

const arrancar = () => Promise.all([iniciar(`${BASE}/sql-wasm.wasm`, async k => { await seed(k); await demo(k); }), cargarCookies()]);

async function atender(req: Request, path: string, query: URLSearchParams): Promise<Response> {
  await arrancar();
  if (path === '/api/demo/reiniciar' && req.method === 'POST') {
    await reiniciar();
    return Response.json({ ok: true });
  }
  const vista = path.match(/^\/api\/vista\/([\w-]+)$/);
  if (vista) {
    const fn = VISTAS[vista[1]];
    return fn ? Response.json((await fn(query)) ?? null) : fail('Vista no encontrada', 404);
  }
  for (const [re, mod] of RUTAS) {
    const m = path.match(re);
    if (!m) continue;
    const h = mod[req.method] as ((r: Request, c: { params: Promise<Record<string, string>> }) => Promise<Response>) | undefined;
    if (!h) return fail('Método no permitido', 405);
    const params = Object.fromEntries(Object.entries(m.groups ?? {}).map(([k, v]) => [k, decodeURIComponent(v)]));
    const res = await h(req, { params: Promise.resolve(params) });
    if (req.method !== 'GET') await guardar();
    return res;
  }
  return fail('Ruta no disponible en la versión de prueba', 404);
}

self.addEventListener('install', () => { void self.skipWaiting(); });
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;
  // Next con subruta pide la página de inicio como /BASE.txt; el archivo real es /BASE/index.txt.
  if (url.pathname === `${BASE}.txt`) {
    e.respondWith(fetch(`${BASE}/index.txt${url.search}`, { headers: e.request.headers }));
    return;
  }
  if (!url.pathname.startsWith(BASE + '/')) return;
  const path = url.pathname.slice(BASE.length);
  if (path.startsWith('/api/')) {
    e.respondWith(atender(e.request, path, url.searchParams).catch(err => {
      console.error(err);
      return fail(err instanceof Error ? err.message : 'Error en la versión de prueba', 500);
    }));
    return;
  }
  // Rutas con parámetro (/tiendas/50ABC, /evaluaciones/<id>): el sitio estático solo
  // tiene la página "_"; se entrega esa y la vista lee el valor real de la URL.
  const m = path.match(/^\/(tiendas|evaluaciones)\/([^/.]+)(\.txt)?$/);
  if (m && m[2] !== '_') {
    const destino = `${BASE}/${m[1]}/_${m[3] ?? ''}${url.search}`;
    e.respondWith(fetch(destino, { headers: e.request.headers, credentials: 'same-origin' }));
  }
});
