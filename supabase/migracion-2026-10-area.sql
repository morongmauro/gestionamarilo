-- ============================================================
-- MIGRACIÓN · Octubre 2026 · Área responsable elegida a mano
--   · Cada actividad puede tener su área responsable (lista desplegable
--     con las áreas de «Involucrados»). Si queda vacía, la app la saca
--     sola del área de cada responsable.
-- Ejecuta este archivo en: Supabase → SQL Editor → New query → Run
-- (Es seguro correrlo más de una vez.)
-- ============================================================

alter table activities add column if not exists area text;
