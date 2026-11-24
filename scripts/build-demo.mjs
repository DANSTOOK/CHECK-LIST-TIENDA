/**
 * Compila la versión DEMO estática para GitHub Pages.
 *   node scripts/build-demo.mjs [/BASE]     (por defecto /CHECK-LIST-TIENDA)
 * 1. Empaqueta el service worker (src/demo/sw.ts) con esbuild en public/sw.js,
 *    sustituyendo base de datos, sesión, archivos y next/headers por las versiones
 *    de navegador de src/demo.
 * 2. Copia sql-wasm.wasm (SQLite en WebAssembly) a public/.
 * 3. Aparta src/app/api (las rutas de servidor no existen en un sitio estático;
 *    sus handlers ya van dentro del service worker) y ejecuta `next build` con
 *    output: 'export'. El resultado queda en out/.
 */
import { build } from 'esbuild';
import { copyFileSync, existsSync, renameSync, writeFileSync, rmSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const base = (process.argv[2] ?? '/CHECK-LIST-TIENDA').replace(/\/$/, '');
const r = p => path.join(root, p);

const SUSTITUTOS = [
  // Por alias (@/lib/x) o por ruta relativa (../src/lib/x, ./x desde src/lib).
  [/^@\/lib\/db$|[\\/]src[\\/]lib[\\/]db(\.ts)?$/, 'src/demo/db.ts'],
  [/^@\/lib\/auth$|[\\/]src[\\/]lib[\\/]auth(\.ts)?$/, 'src/demo/auth.ts'],
  [/^@\/lib\/storage$|[\\/]src[\\/]lib[\\/]storage(\.ts)?$/, 'src/demo/storage.ts'],
  [/^next\/headers$/, 'src/demo/headers.ts'],
  [/^(next-auth\/jwt|node:fs|node:path|fs|path)$/, 'src/demo/stubs.ts'],
];
const sustituir = {
  name: 'demo-sustitutos',
  setup(b) {
    b.onResolve({ filter: /.*/ }, args => {
      const spec = args.path.startsWith('.') ? path.resolve(args.resolveDir, args.path) : args.path;
      for (const [re, dest] of SUSTITUTOS) if (re.test(spec) && path.resolve(args.importer || '') !== r(dest)) return { path: r(dest) };
      return undefined;
    });
  },
};

console.log(`› Service worker (base ${base})`);
await build({
  entryPoints: [r('src/demo/sw.ts')],
  outfile: r('public/sw.js'),
  bundle: true, format: 'iife', platform: 'browser', target: 'es2022', minify: true, sourcemap: false,
  tsconfig: r('tsconfig.json'),
  plugins: [sustituir],
  inject: [r('src/demo/inject.ts')],
  define: { 'process.env.NODE_ENV': '"production"', 'process.env.NEXT_PUBLIC_DEMO': '"1"' },
  loader: { '.json': 'json' },
  logLevel: 'warning',
});
copyFileSync(r('node_modules/sql.js/dist/sql-wasm.wasm'), r('public/sql-wasm.wasm'));

console.log('› Sitio estático (next build)');
const api = r('src/app/api'), apartado = r('.api-off');
if (existsSync(apartado)) throw new Error('Existe .api-off: restaura src/app/api antes de compilar.');
renameSync(api, apartado);
try {
  rmSync(r('.next'), { recursive: true, force: true });
  execSync('node node_modules/next/dist/bin/next build', {
    cwd: root, stdio: 'inherit',
    env: { ...process.env, NEXT_PUBLIC_DEMO: '1', NEXT_PUBLIC_BASE_PATH: base, NEXT_TELEMETRY_DISABLED: '1' },
  });
} finally {
  renameSync(apartado, api);
}
writeFileSync(r('out/.nojekyll'), '');
console.log('✔ Demo lista en out/');
