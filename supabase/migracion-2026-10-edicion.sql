-- ============================================================
-- MIGRACIÓN · Octubre 2026 · Edición compartida, historial y subcapítulos
--   · Enlaces de EDICIÓN con nombre de la persona (rol «editor»)
--   · Historial de cambios: quién cambió qué y cuándo
--   · Subcapítulos: un capítulo puede quedar dentro de otro
-- Ejecuta este archivo en: Supabase → SQL Editor → New query → Run
-- (Es seguro correrlo más de una vez.)
-- ============================================================

-- Enlaces: además de «ver y proponer», el rol «editor» (edita de verdad)
alter table project_shares drop constraint if exists project_shares_role_check;
alter table project_shares add constraint project_shares_role_check check (role in ('view','edit','editor'));

-- Subcapítulos
alter table project_sections add column if not exists parent_id uuid references project_sections(id) on delete set null;

-- Historial de cambios
create table if not exists historial_cambios (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects(id) on delete cascade,
  activity_id uuid,                       -- puede ya no existir (si se eliminó)
  autor       text,                       -- nombre del enlace de edición; vacío = el dueño
  accion      text not null,              -- editó · creó · eliminó · movió · capítulo…
  objeto      text,                       -- nombre de la actividad o capítulo (queda aunque se borre)
  detalle     text,                       -- qué cambió: «fin: 13 nov → 19 nov · duración: 5 → 8»
  created_at  timestamptz not null default now()
);
create index if not exists idx_historial_project on historial_cambios(project_id, created_at desc);
alter table historial_cambios enable row level security;
