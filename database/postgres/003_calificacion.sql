-- 003 · Calificación de 1 a 5 estrellas por respuesta (equivalente a la migración '003_calificacion').
BEGIN;
ALTER TABLE respuestas ADD COLUMN calificacion integer CHECK (calificacion BETWEEN 1 AND 5);
INSERT INTO kysely_migration (name, timestamp) VALUES ('003_calificacion', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
COMMIT;
