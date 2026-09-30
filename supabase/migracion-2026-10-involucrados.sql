-- ============================================================
-- MIGRACIÓN · Octubre 2026 (4) · Involucrados del proyecto
--   Personas del proyecto y el área a la que pertenecen. Es distinto
--   del responsable de cada actividad (ahí se pueden usar estos nombres).
-- Ejecuta este archivo en: Supabase → SQL Editor → New query → Run
-- (Es seguro correrlo más de una vez.)
-- ============================================================

create table if not exists project_members (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  nombre     text not null,
  area       text,
  rol        text,
  created_at timestamptz not null default now()
);

create index if not exists idx_members_project on project_members(project_id);
alter table project_members enable row level security;
