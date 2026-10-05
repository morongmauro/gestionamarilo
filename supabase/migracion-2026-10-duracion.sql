-- ============================================================
-- MIGRACIÓN · Octubre 2026 · Duración de cada actividad
--   · Se puede poner la duración (días hábiles) sin fechas; la actividad
--     se programa sola al terminar sus precedentes.
--   · Con duración, poner el inicio deja el fin como consecuencia.
-- Ejecuta este archivo en: Supabase → SQL Editor → New query → Run
-- (Es seguro correrlo más de una vez.)
-- ============================================================

alter table activities add column if not exists duracion integer;
