-- ============================================================
-- MIGRACIÓN · Octubre 2026 · Tipos de precedencia
--   · Cada precedencia puede ser: en serie (fin → comienzo), empiezan al
--     tiempo (comienzo → comienzo) o terminan al tiempo (fin → fin),
--     con desfase en días hábiles («3 días después», «2 días antes»).
-- Ejecuta este archivo en: Supabase → SQL Editor → New query → Run
-- (Es seguro correrlo más de una vez.)
-- ============================================================

alter table activities add column if not exists dep_tipos jsonb not null default '{}'::jsonb;
