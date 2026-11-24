/**
 * Base de datos del modo demo: SQLite en WebAssembly (sql.js) dentro del service
 * worker, con el MISMO Kysely, migraciones y consultas que el servidor.
 * Se guarda en IndexedDB después de cada cambio.
 */
import { Kysely, SqliteDialect, Migrator, sql } from 'kysely';
import initSqlJs, { type Database } from 'sql.js';
import type { DB } from '../lib/db';
import { migrationsFor } from '../../db/migrations';
import { kvGet, kvSet } from './idb';

export type * from '../lib/db';
export const isPg = false;
export const newId = () => crypto.randomUUID();
export const now = () => new Date().toISOString();
export const containsCI = (col: string, term: string) =>
  sql<boolean>`lower(${sql.ref(col)}) like ${'%' + term.toLowerCase() + '%'}`;

let raw: Database | null = null;
const fix = (ps: readonly unknown[]) => ps.map(p => (typeof p === 'boolean' ? (p ? 1 : 0) : p === undefined ? null : p)) as never[];

function adaptador(d: Database) {
  return {
    close: () => {},
    prepare(q: string) {
      return {
        reader: /^\s*(select|with|pragma)\b/i.test(q) || /\breturning\b/i.test(q),
        all(ps: readonly unknown[]) {
          const st = d.prepare(q); st.bind(fix(ps));
          const rows: unknown[] = [];
          while (st.step()) rows.push(st.getAsObject());
          st.free();
          return rows;
        },
        run(ps: readonly unknown[]) {
          d.run(q, fix(ps));
          return { changes: d.getRowsModified(), lastInsertRowid: 0 };
        },
        *iterate(ps: readonly unknown[]) { yield* this.all(ps); },
      };
    },
  };
}

let listo: Promise<void> | null = null;
/** Abre (o crea y llena) la base del demo. */
export function iniciar(wasmUrl: string, sembrar: (k: Kysely<DB>) => Promise<void>) {
  return (listo ??= (async () => {
    const SQL = await initSqlJs({ locateFile: () => wasmUrl });
    const guardada = await kvGet<Uint8Array>('db');
    raw = guardada ? new SQL.Database(guardada) : new SQL.Database();
    raw.run('PRAGMA foreign_keys = ON');
    const m = new Migrator({ db, provider: { getMigrations: async () => migrationsFor(false) } });
    const { error } = await m.migrateToLatest();
    if (error) throw error;
    if (!guardada) await sembrar(db);
    await guardar();
  })());
}
export async function guardar() { if (raw) await kvSet('db', raw.export()); }
/** Borra todo y vuelve a crear los datos de ejemplo. */
export async function reiniciar() { await kvSet('db', null as unknown as Uint8Array); raw = null; listo = null; }

export const db = new Kysely<DB>({
  dialect: new SqliteDialect({ database: async () => { if (!raw) throw new Error('Base demo no iniciada'); return adaptador(raw) as never; } }),
});
