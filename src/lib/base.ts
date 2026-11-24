/**
 * Modo de ejecución.
 * - Normal: Next.js con servidor (API, base de datos y archivos en el servidor).
 * - Demo (NEXT_PUBLIC_DEMO=1): sitio estático para GitHub Pages. La API corre dentro
 *   del navegador en un service worker (src/demo/sw.ts) con SQLite en WebAssembly;
 *   los datos se guardan en el navegador de cada persona.
 */
export const IS_DEMO = process.env.NEXT_PUBLIC_DEMO === '1';
/** Prefijo del sitio (en GitHub Pages: /NOMBRE-DEL-REPO). */
export const BASE = process.env.NEXT_PUBLIC_BASE_PATH || '';
/** Antepone el prefijo del sitio a rutas que no pasan por <Link> (API, imágenes, descargas). */
export const u = (path: string) => `${BASE}${path}`;
