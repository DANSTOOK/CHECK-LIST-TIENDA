/**
 * Acceso a datos con Kysely (query builder 100 % TypeScript, sin binarios nativos).
 *
 * Por qué no Prisma: el proxy corporativo bloquea la descarga de los motores
 * binarios de Prisma y de cualquier paquete con .node/.dll. Kysely no los necesita
 * y permite el mismo código para:
 *   - Local / piloto:  SQLite integrado en Node 24 (node:sqlite), archivo data/ckl.db
 *   - Producción:      PostgreSQL (DATABASE_URL=postgresql://…) con el driver `pg`
 *
 * Convenciones para que ambos motores se comporten igual:
 *   - IDs: UUID generados en la app.
 *   - Fechas: se escriben como ISO-8601 UTC (string). En PostgreSQL la columna es
 *     timestamptz y se convierte de vuelta a ISO al leer.
 *   - Booleanos: en SQLite son 0/1; usar `!!valor` al leer.
 */
import { Kysely, PostgresDialect, SqliteDialect, sql, type Generated } from 'kysely';
import path from 'node:path';
import { mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

// ---------------------------------------------------------------- Tipos de tablas
type Bool = number | boolean;
export interface UsuariosT { id: string; nombre: string; email: string | null; rol: string; activo: Bool; created_at: string }
export interface TiendasT {
  id: string; cr: string; nombre: string; ciudad: string | null; plaza: string | null; estado: string | null;
  region: string | null; ro: string | null; activa: Bool; created_at: string; updated_at: string;
}
export interface ChecklistT { id: string; nombre: string; descripcion: string | null; activo: Bool; created_at: string }
export interface CategoriasT { id: string; nombre: string; color: string; orden: number }
export interface PreguntasT {
  id: string; checklist_id: string; categoria_id: string; texto: string; ayuda: string | null;
  evidencia: string; peso: number; orden: number; activa: Bool; created_at: string;
}
export interface EvaluacionesT {
  id: string; folio: string; tienda_id: string; checklist_id: string; evaluador_id: string; fecha: string;
  estado: string; observaciones: string | null; total: number; cumple: number; no_cumple: number; no_aplica: number;
  porcentaje: number | null; finalizada_at: string | null; created_at: string; updated_at: string;
}
export interface RespuestasT {
  id: string; evaluacion_id: string; pregunta_id: string | null; categoria: string; categoria_color: string;
  texto: string; ayuda: string | null; evidencia_regla: string; peso: number; orden: number;
  resultado: string | null; comentario: string | null;
  /** 1 a 5 estrellas (null = sin calificar o No aplica) */
  calificacion: number | null;
}
export interface EvidenciasT {
  id: string; respuesta_id: string; evaluacion_id: string; tienda_cr: string; pregunta_id: string | null;
  usuario_id: string | null; ruta: string; nombre_original: string | null; mime: string; bytes: number; created_at: string;
}
export interface DestinatariosT {
  id: string; nombre: string; email: string; tipo: string; categoria_id: string | null; plaza: string | null;
  activo: Bool; created_at: string;
}
export interface DB {
  usuarios: UsuariosT; tiendas: TiendasT; checklist: ChecklistT; categorias: CategoriasT; preguntas: PreguntasT;
  evaluaciones: EvaluacionesT; respuestas: RespuestasT; evidencias: EvidenciasT; destinatarios_correo: DestinatariosT;
  kysely_migration: { name: string; timestamp: string }; _unused: { id: Generated<number> };
}

export const isPg = /^postgres(ql)?:\/\//.test(process.env.DATABASE_URL || '');
export const newId = () => randomUUID();
export const now = () => new Date().toISOString();

// ---------------------------------------------------------------- Adaptador node:sqlite
/** node:sqlite habla casi igual que better-sqlite3; este adaptador cubre la diferencia. */
function sqliteDatabase(file: string) {
  // getBuiltinModule evita que el empaquetador de Next intente resolver 'node:sqlite'.
  const { DatabaseSync } = process.getBuiltinModule('node:sqlite') as typeof import('node:sqlite');
  mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  const fix = (ps: readonly unknown[]) =>
    ps.map(p => (typeof p === 'boolean' ? (p ? 1 : 0) : p instanceof Date ? p.toISOString() : p)) as never[];
  return {
    close: () => db.close(),
    prepare(q: string) {
      const st = db.prepare(q);
      const reader = st.columns().length > 0;
      return {
        reader,
        // node:sqlite devuelve objetos con prototipo null; React no puede pasarlos a componentes cliente.
        all: (ps: readonly unknown[]) => st.all(...fix(ps)).map(r => ({ ...r })),
        run: (ps: readonly unknown[]) => {
          const r = st.run(...fix(ps));
          return { changes: Number(r.changes), lastInsertRowid: Number(r.lastInsertRowid) };
        },
        iterate: (ps: readonly unknown[]) => st.iterate(...fix(ps)),
      };
    },
  };
}

function createDb(): Kysely<DB> {
  if (isPg) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pg = require('pg') as typeof import('pg');
    // timestamptz -> ISO string (igual que SQLite) ; numeric -> number
    pg.types.setTypeParser(1184, (v: string) => new Date(v).toISOString());
    pg.types.setTypeParser(1700, (v: string) => Number(v));
    return new Kysely<DB>({ dialect: new PostgresDialect({ pool: new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 10 }) }) });
  }
  const file = path.resolve(process.env.SQLITE_PATH || './data/ckl.db');
  return new Kysely<DB>({ dialect: new SqliteDialect({ database: sqliteDatabase(file) as never }) });
}

// Una sola instancia (Next recarga módulos en desarrollo).
// Se crea al primer uso (no al importar), así el build no abre la base de datos.
const g = globalThis as unknown as { __ckl_db?: Kysely<DB> };
export const db: Kysely<DB> = new Proxy({} as Kysely<DB>, {
  get(_t, k) {
    const real = (g.__ckl_db ??= createDb()) as unknown as Record<string | symbol, unknown>;
    const v = real[k];
    // `fn` es una función con propiedades (fn.count, fn.countAll…): se devuelve tal cual.
    return typeof v === 'function' && k !== 'fn' ? (v as (...a: unknown[]) => unknown).bind(real) : v;
  },
});

/** Búsqueda sin distinguir mayúsculas, igual en SQLite y PostgreSQL. */
export const containsCI = (col: string, term: string) =>
  sql<boolean>`lower(${sql.ref(col)}) like ${'%' + term.toLowerCase() + '%'}`;
