/**
 * Utilidades de base de datos:
 *   npm run setup       -> migrar + cargar checklist inicial
 *   npm run db:migrate  -> solo migraciones
 *   npm run db:seed     -> checklist, categorías y preguntas iniciales (idempotente)
 *   npm run db:demo     -> tiendas y evaluaciones de DEMOSTRACIÓN (solo para probar)
 */
import { readFileSync, existsSync } from 'node:fs';
import { Migrator } from 'kysely';

// Carga .env sin dependencias extra.
if (existsSync('.env')) {
  for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
}

async function main() {
  const { db, isPg } = await import('../src/lib/db');
  const cmd = process.argv[2];
  try {
    if (cmd === 'migrate' || cmd === 'setup') {
      const { migrationsFor } = await import('./migrations');
      const migrator = new Migrator({ db, provider: { getMigrations: async () => migrationsFor(isPg) } });
      const { error, results } = await migrator.migrateToLatest();
      results?.forEach(r => console.log(`${r.status === 'Success' ? '✔' : '✖'} migración ${r.migrationName}`));
      if (error) throw error;
      console.log(`Base de datos al día (${isPg ? 'PostgreSQL' : 'SQLite'}).`);
    }
    if (cmd === 'seed' || cmd === 'setup') await (await import('./seed')).seed(db);
    if (cmd === 'demo') await (await import('./demo')).demo(db);
    if (!['migrate', 'setup', 'seed', 'demo'].includes(cmd)) console.log('Uso: tsx db/cli.ts setup|migrate|seed|demo');
  } finally {
    await db.destroy();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
