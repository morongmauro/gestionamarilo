-- ============================================================
-- MIGRACIÓN · Octubre 2026 (5) · Fecha meta del proyecto
--   La fecha en la que el proyecto debe estar listo. La app compara
--   contra ella el fin del plan y marca lo que se pasa.
-- Ejecuta este archivo en: Supabase → SQL Editor → New query → Run
-- (Es seguro correrlo más de una vez.)
-- ============================================================

alter table projects add column if not exists fecha_meta date;
