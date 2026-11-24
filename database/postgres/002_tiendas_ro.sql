-- 002 · Responsable de operación (RO) por tienda (equivalente a la migración '002_tiendas_ro').
BEGIN;
ALTER TABLE tiendas ADD COLUMN ro varchar(150);
CREATE INDEX ix_tiendas_ro ON tiendas (ro);
INSERT INTO kysely_migration (name, timestamp) VALUES ('002_tiendas_ro', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
COMMIT;
