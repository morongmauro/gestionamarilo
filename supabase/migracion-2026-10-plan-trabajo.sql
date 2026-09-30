-- ============================================================
-- MIGRACIÓN · Octubre 2026 · Hoja de plan de trabajo
--   · Columna «Entregable / resultado» en cada actividad
-- Ejecuta este archivo en: Supabase → SQL Editor → New query → Run
-- (Es seguro correrlo más de una vez.)
-- ============================================================

alter table activities add column if not exists entregable text;
