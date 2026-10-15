-- ============================================================
-- MIGRACIÓN · Octubre 2026 · Enlace «Panorama» (solo ver)
--   Un tercer tipo de enlace para compartir: los visualizadores ven el
--   resumen y los capítulos contraídos; pueden abrir cada uno, pero no
--   proponen ni editan.
-- Ejecuta este archivo en: Supabase → SQL Editor → New query → Run
-- (Es seguro correrlo más de una vez.)
-- ============================================================

alter table project_shares drop constraint if exists project_shares_role_check;
alter table project_shares add constraint project_shares_role_check check (role in ('view','edit','editor','panorama'));
