-- ============================================================
-- MIGRACIÓN · Octubre 2026 (2) · Fechas reales + propuestas
--   · Fecha real de inicio y de fin en cada actividad
--   · Actividades propuestas desde un enlace compartido
-- Ejecuta este archivo en: Supabase → SQL Editor → New query → Run
-- (Es seguro correrlo más de una vez.)
-- ============================================================

alter table activities add column if not exists real_start date;
alter table activities add column if not exists real_end date;
alter table activities add column if not exists propuesta boolean not null default false;
alter table activities add column if not exists propuesta_por text;
