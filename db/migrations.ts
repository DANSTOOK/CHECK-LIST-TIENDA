/**
 * Migraciones de base de datos (Kysely). Funcionan en SQLite y PostgreSQL.
 * Para agregar un cambio: crea una función m00X y regístrala en `migrations`.
 * Nunca modifiques una migración ya aplicada en producción.
 * El equivalente en SQL puro para PostgreSQL está en database/postgres/001_init.sql.
 */
import { Kysely, sql, type Migration } from 'kysely';

const m001: (isPg: boolean) => Migration = isPg => ({
  async up(db: Kysely<any>) {
    const ts = isPg ? 'timestamptz' : 'text';
    const bool = isPg ? 'boolean' : 'integer';
    const yes = isPg ? sql`true` : sql`1`;
    const real = isPg ? sql`numeric(5,1)` : sql`real`;

    await db.schema.createTable('usuarios')
      .addColumn('id', 'varchar(40)', c => c.primaryKey())
      .addColumn('nombre', 'varchar(150)', c => c.notNull())
      .addColumn('email', 'varchar(200)', c => c.unique())
      .addColumn('rol', 'varchar(20)', c => c.notNull().defaultTo('evaluador')) // evaluador | admin | consulta
      .addColumn('activo', bool, c => c.notNull().defaultTo(yes))
      .addColumn('created_at', ts, c => c.notNull())
      .execute();

    await db.schema.createTable('tiendas')
      .addColumn('id', 'varchar(40)', c => c.primaryKey())
      .addColumn('cr', 'varchar(20)', c => c.notNull().unique())
      .addColumn('nombre', 'varchar(150)', c => c.notNull())
      .addColumn('ciudad', 'varchar(100)')
      .addColumn('plaza', 'varchar(100)')
      .addColumn('estado', 'varchar(100)')
      .addColumn('region', 'varchar(100)')
      .addColumn('activa', bool, c => c.notNull().defaultTo(yes))
      .addColumn('created_at', ts, c => c.notNull())
      .addColumn('updated_at', ts, c => c.notNull())
      .execute();
    await db.schema.createIndex('ix_tiendas_plaza').on('tiendas').column('plaza').execute();

    await db.schema.createTable('checklist')
      .addColumn('id', 'varchar(40)', c => c.primaryKey())
      .addColumn('nombre', 'varchar(150)', c => c.notNull())
      .addColumn('descripcion', 'text')
      .addColumn('activo', bool, c => c.notNull().defaultTo(yes))
      .addColumn('created_at', ts, c => c.notNull())
      .execute();

    await db.schema.createTable('categorias')
      .addColumn('id', 'varchar(40)', c => c.primaryKey())
      .addColumn('nombre', 'varchar(100)', c => c.notNull().unique())
      .addColumn('color', 'varchar(9)', c => c.notNull().defaultTo('#1d6b4f'))
      .addColumn('orden', 'integer', c => c.notNull().defaultTo(0))
      .execute();

    await db.schema.createTable('preguntas')
      .addColumn('id', 'varchar(40)', c => c.primaryKey())
      .addColumn('checklist_id', 'varchar(40)', c => c.notNull().references('checklist.id').onDelete('cascade'))
      .addColumn('categoria_id', 'varchar(40)', c => c.notNull().references('categorias.id'))
      .addColumn('texto', 'text', c => c.notNull())
      .addColumn('ayuda', 'text')
      .addColumn('evidencia', 'varchar(20)', c => c.notNull().defaultTo('no_cumple')) // siempre | no_cumple | opcional
      .addColumn('peso', 'integer', c => c.notNull().defaultTo(1))
      .addColumn('orden', 'integer', c => c.notNull().defaultTo(0))
      .addColumn('activa', bool, c => c.notNull().defaultTo(yes))
      .addColumn('created_at', ts, c => c.notNull())
      .execute();
    await db.schema.createIndex('ix_preguntas_checklist').on('preguntas').columns(['checklist_id', 'orden']).execute();

    await db.schema.createTable('evaluaciones')
      .addColumn('id', 'varchar(40)', c => c.primaryKey())
      .addColumn('folio', 'varchar(30)', c => c.notNull().unique())
      .addColumn('tienda_id', 'varchar(40)', c => c.notNull().references('tiendas.id'))
      .addColumn('checklist_id', 'varchar(40)', c => c.notNull().references('checklist.id'))
      .addColumn('evaluador_id', 'varchar(40)', c => c.notNull().references('usuarios.id'))
      .addColumn('fecha', ts, c => c.notNull())
      .addColumn('estado', 'varchar(20)', c => c.notNull().defaultTo('borrador')) // borrador | finalizada
      .addColumn('observaciones', 'text')
      .addColumn('total', 'integer', c => c.notNull().defaultTo(0))
      .addColumn('cumple', 'integer', c => c.notNull().defaultTo(0))
      .addColumn('no_cumple', 'integer', c => c.notNull().defaultTo(0))
      .addColumn('no_aplica', 'integer', c => c.notNull().defaultTo(0))
      .addColumn('porcentaje', real)
      .addColumn('finalizada_at', ts)
      .addColumn('created_at', ts, c => c.notNull())
      .addColumn('updated_at', ts, c => c.notNull())
      .execute();
    await db.schema.createIndex('ix_eval_tienda_fecha').on('evaluaciones').columns(['tienda_id', 'fecha']).execute();
    await db.schema.createIndex('ix_eval_estado_fecha').on('evaluaciones').columns(['estado', 'fecha']).execute();

    // Las respuestas copian el texto de la pregunta: el historial no cambia si se edita la pregunta.
    await db.schema.createTable('respuestas')
      .addColumn('id', 'varchar(40)', c => c.primaryKey())
      .addColumn('evaluacion_id', 'varchar(40)', c => c.notNull().references('evaluaciones.id').onDelete('cascade'))
      .addColumn('pregunta_id', 'varchar(40)', c => c.references('preguntas.id').onDelete('set null'))
      .addColumn('categoria', 'varchar(100)', c => c.notNull())
      .addColumn('categoria_color', 'varchar(9)', c => c.notNull().defaultTo('#1d6b4f'))
      .addColumn('texto', 'text', c => c.notNull())
      .addColumn('ayuda', 'text')
      .addColumn('evidencia_regla', 'varchar(20)', c => c.notNull().defaultTo('no_cumple'))
      .addColumn('peso', 'integer', c => c.notNull().defaultTo(1))
      .addColumn('orden', 'integer', c => c.notNull().defaultTo(0))
      .addColumn('resultado', 'varchar(20)') // cumple | no_cumple | no_aplica | null
      .addColumn('comentario', 'text')
      .execute();
    await db.schema.createIndex('ix_resp_eval').on('respuestas').columns(['evaluacion_id', 'orden']).execute();

    await db.schema.createTable('evidencias')
      .addColumn('id', 'varchar(40)', c => c.primaryKey())
      .addColumn('respuesta_id', 'varchar(40)', c => c.notNull().references('respuestas.id').onDelete('cascade'))
      .addColumn('evaluacion_id', 'varchar(40)', c => c.notNull().references('evaluaciones.id').onDelete('cascade'))
      .addColumn('tienda_cr', 'varchar(20)', c => c.notNull())
      .addColumn('pregunta_id', 'varchar(40)')
      .addColumn('usuario_id', 'varchar(40)', c => c.references('usuarios.id'))
      .addColumn('ruta', 'varchar(400)', c => c.notNull())
      .addColumn('nombre_original', 'varchar(255)')
      .addColumn('mime', 'varchar(40)', c => c.notNull())
      .addColumn('bytes', 'integer', c => c.notNull())
      .addColumn('created_at', ts, c => c.notNull())
      .execute();
    await db.schema.createIndex('ix_evid_resp').on('evidencias').column('respuesta_id').execute();
    await db.schema.createIndex('ix_evid_cr').on('evidencias').columns(['tienda_cr', 'created_at']).execute();

    await db.schema.createTable('destinatarios_correo')
      .addColumn('id', 'varchar(40)', c => c.primaryKey())
      .addColumn('nombre', 'varchar(150)', c => c.notNull())
      .addColumn('email', 'varchar(200)', c => c.notNull())
      .addColumn('tipo', 'varchar(5)', c => c.notNull().defaultTo('to')) // to | cc
      .addColumn('categoria_id', 'varchar(40)', c => c.references('categorias.id').onDelete('set null')) // null = general
      .addColumn('plaza', 'varchar(100)') // null = todas
      .addColumn('activo', bool, c => c.notNull().defaultTo(yes))
      .addColumn('created_at', ts, c => c.notNull())
      .execute();
  },
});

/** 002: responsable de operación (RO) de cada tienda, según la distribución de la región. */
const m002: Migration = {
  async up(db: Kysely<any>) {
    await db.schema.alterTable('tiendas').addColumn('ro', 'varchar(150)').execute();
    await db.schema.createIndex('ix_tiendas_ro').on('tiendas').column('ro').execute();
  },
};

export const migrationsFor = (isPg: boolean): Record<string, Migration> => ({
  '001_init': m001(isPg),
  '002_tiendas_ro': m002,
});
