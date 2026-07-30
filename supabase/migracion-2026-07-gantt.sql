-- ============================================================
-- MIGRACIÓN · Julio 2026 · Gantt compartido + fases ajustables
-- Ejecuta este archivo en: Supabase → SQL Editor → New query → Run
-- (Es seguro correrlo más de una vez.)
-- ============================================================

-- 1. Fases activables/desactivables por proyecto
alter table project_sections add column if not exists enabled boolean not null default true;

-- 2. Enlaces de Gantt compartido (solo Gantt + actividades, nunca tareas)
create table if not exists project_shares (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  token      text not null unique,
  label      text,
  role       text not null default 'view' check (role in ('view','edit')),
  created_at timestamptz not null default now()
);

create index if not exists idx_shares_project on project_shares(project_id);
alter table project_shares enable row level security;
