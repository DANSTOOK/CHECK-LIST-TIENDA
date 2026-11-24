-- =============================================================================
-- Checklist Operativo OXXO · Esquema PostgreSQL (equivalente a db/migrations.ts)
-- Uso:  psql "postgresql://usuario:clave@servidor:5432/ckl" -f 001_init.sql
-- Alternativa recomendada: DATABASE_URL=postgresql://… y `npm run setup`
-- (aplica la migración con Kysely y registra la versión en kysely_migration).
-- =============================================================================
BEGIN;

CREATE TABLE usuarios (
  id          varchar(40)  PRIMARY KEY,
  nombre      varchar(150) NOT NULL,
  email       varchar(200) UNIQUE,
  rol         varchar(20)  NOT NULL DEFAULT 'evaluador' CHECK (rol IN ('evaluador','admin','consulta')),
  activo      boolean      NOT NULL DEFAULT true,
  created_at  timestamptz  NOT NULL DEFAULT now()
);

CREATE TABLE tiendas (
  id          varchar(40)  PRIMARY KEY,
  cr          varchar(20)  NOT NULL UNIQUE,          -- Centro de Responsabilidad
  nombre      varchar(150) NOT NULL,
  ciudad      varchar(100),
  plaza       varchar(100),
  estado      varchar(100),
  region      varchar(100),
  activa      boolean      NOT NULL DEFAULT true,
  created_at  timestamptz  NOT NULL DEFAULT now(),
  updated_at  timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX ix_tiendas_plaza ON tiendas (plaza);

CREATE TABLE checklist (
  id          varchar(40)  PRIMARY KEY,
  nombre      varchar(150) NOT NULL,
  descripcion text,
  activo      boolean      NOT NULL DEFAULT true,
  created_at  timestamptz  NOT NULL DEFAULT now()
);

CREATE TABLE categorias (                             -- también son las "áreas" del correo
  id          varchar(40)  PRIMARY KEY,
  nombre      varchar(100) NOT NULL UNIQUE,
  color       varchar(9)   NOT NULL DEFAULT '#1d6b4f',
  orden       integer      NOT NULL DEFAULT 0
);

CREATE TABLE preguntas (
  id            varchar(40) PRIMARY KEY,
  checklist_id  varchar(40) NOT NULL REFERENCES checklist(id) ON DELETE CASCADE,
  categoria_id  varchar(40) NOT NULL REFERENCES categorias(id),
  texto         text        NOT NULL,
  ayuda         text,
  evidencia     varchar(20) NOT NULL DEFAULT 'no_cumple' CHECK (evidencia IN ('siempre','no_cumple','opcional')),
  peso          integer     NOT NULL DEFAULT 1 CHECK (peso BETWEEN 1 AND 10),
  orden         integer     NOT NULL DEFAULT 0,
  activa        boolean     NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_preguntas_checklist ON preguntas (checklist_id, orden);

CREATE TABLE evaluaciones (
  id             varchar(40)  PRIMARY KEY,
  folio          varchar(30)  NOT NULL UNIQUE,       -- EV-2026-000123
  tienda_id      varchar(40)  NOT NULL REFERENCES tiendas(id),
  checklist_id   varchar(40)  NOT NULL REFERENCES checklist(id),
  evaluador_id   varchar(40)  NOT NULL REFERENCES usuarios(id),
  fecha          timestamptz  NOT NULL,
  estado         varchar(20)  NOT NULL DEFAULT 'borrador' CHECK (estado IN ('borrador','finalizada')),
  observaciones  text,
  total          integer      NOT NULL DEFAULT 0,
  cumple         integer      NOT NULL DEFAULT 0,
  no_cumple      integer      NOT NULL DEFAULT 0,
  no_aplica      integer      NOT NULL DEFAULT 0,
  porcentaje     numeric(5,1),                        -- null si todo fue "No aplica"
  finalizada_at  timestamptz,
  created_at     timestamptz  NOT NULL DEFAULT now(),
  updated_at     timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX ix_eval_tienda_fecha ON evaluaciones (tienda_id, fecha);
CREATE INDEX ix_eval_estado_fecha ON evaluaciones (estado, fecha);

-- Cada respuesta guarda una copia de la pregunta: el historial no cambia si se edita el catálogo.
CREATE TABLE respuestas (
  id               varchar(40)  PRIMARY KEY,
  evaluacion_id    varchar(40)  NOT NULL REFERENCES evaluaciones(id) ON DELETE CASCADE,
  pregunta_id      varchar(40)  REFERENCES preguntas(id) ON DELETE SET NULL,
  categoria        varchar(100) NOT NULL,
  categoria_color  varchar(9)   NOT NULL DEFAULT '#1d6b4f',
  texto            text         NOT NULL,
  ayuda            text,
  evidencia_regla  varchar(20)  NOT NULL DEFAULT 'no_cumple',
  peso             integer      NOT NULL DEFAULT 1,
  orden            integer      NOT NULL DEFAULT 0,
  resultado        varchar(20)  CHECK (resultado IN ('cumple','no_cumple','no_aplica')),
  comentario       text
);
CREATE INDEX ix_resp_eval ON respuestas (evaluacion_id, orden);

CREATE TABLE evidencias (
  id               varchar(40)  PRIMARY KEY,
  respuesta_id     varchar(40)  NOT NULL REFERENCES respuestas(id) ON DELETE CASCADE,
  evaluacion_id    varchar(40)  NOT NULL REFERENCES evaluaciones(id) ON DELETE CASCADE,
  tienda_cr        varchar(20)  NOT NULL,
  pregunta_id      varchar(40),
  usuario_id       varchar(40)  REFERENCES usuarios(id),
  ruta             varchar(400) NOT NULL,             -- evidencias/CR/AAAA/MM/<folio>_<uuid>.jpg
  nombre_original  varchar(255),
  mime             varchar(40)  NOT NULL,
  bytes            integer      NOT NULL,
  created_at       timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX ix_evid_resp ON evidencias (respuesta_id);
CREATE INDEX ix_evid_cr ON evidencias (tienda_cr, created_at);

CREATE TABLE destinatarios_correo (
  id            varchar(40)  PRIMARY KEY,
  nombre        varchar(150) NOT NULL,
  email         varchar(200) NOT NULL,
  tipo          varchar(5)   NOT NULL DEFAULT 'to' CHECK (tipo IN ('to','cc')),
  categoria_id  varchar(40)  REFERENCES categorias(id) ON DELETE SET NULL,   -- null = general
  plaza         varchar(100),                                               -- null = todas
  activo        boolean      NOT NULL DEFAULT true,
  created_at    timestamptz  NOT NULL DEFAULT now()
);

-- Registro de migración para que `npm run setup` no la vuelva a aplicar.
CREATE TABLE IF NOT EXISTS kysely_migration (name varchar(255) PRIMARY KEY, timestamp varchar(255) NOT NULL);
CREATE TABLE IF NOT EXISTS kysely_migration_lock (id varchar(255) PRIMARY KEY, is_locked integer NOT NULL DEFAULT 0);
INSERT INTO kysely_migration (name, timestamp) VALUES ('001_init', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
INSERT INTO kysely_migration_lock (id, is_locked) VALUES ('migration_lock', 0);

COMMIT;
-- Después: `npm run db:seed` carga el checklist "Evaluación Tienda Completa" y sus categorías.
