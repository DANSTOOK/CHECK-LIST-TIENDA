// Sirve out/ como lo hace GitHub Pages (subruta /CHECK-LIST-TIENDA, .html sin extensión y 404.html)
// para probar la demo antes de publicarla:  node scripts/serve-demo.mjs [puerto]
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const out = path.resolve(import.meta.dirname, '..', 'out');
const BASE = '/CHECK-LIST-TIENDA';
const port = Number(process.argv[2] || 3200);
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.txt': 'text/plain; charset=utf-8', '.wasm': 'application/wasm', '.png': 'image/png', '.json': 'application/json', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
const existe = async p => { try { return (await stat(p)).isFile(); } catch { return false; } };

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/' ) { res.writeHead(302, { Location: BASE + '/' }); return res.end(); }
  if (!url.pathname.startsWith(BASE)) { res.writeHead(404); return res.end(); }
  let rel = decodeURIComponent(url.pathname.slice(BASE.length)) || '/';
  if (rel.endsWith('/')) rel += 'index.html';
  let file = path.join(out, rel);
  if (!file.startsWith(out)) { res.writeHead(403); return res.end(); }
  let status = 200;
  if (!(await existe(file))) {
    if (await existe(file + '.html')) file += '.html';
    else { file = path.join(out, '404.html'); status = 404; }
  }
  res.writeHead(status, { 'Content-Type': TIPOS[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  res.end(await readFile(file));
}).listen(port, () => console.log(`Demo en http://localhost:${port}${BASE}/`));
