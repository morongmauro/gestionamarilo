-- ============================================================
-- MIGRACIÓN · Octubre 2026 (6) · Bitácora de notas por actividad
--   Notas con fecha asociadas a una actividad del plan (privadas: no
--   se muestran en el enlace compartido).
-- Ejecuta este archivo en: Supabase → SQL Editor → New query → Run
-- (Es seguro correrlo más de una vez.)
-- ============================================================

create table if not exists activity_notes (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects(id) on delete cascade,
  activity_id uuid not null references activities(id) on delete cascade,
  texto       text not null,
  created_at  timestamptz not null default now()
);

create index if not exists idx_notes_activity on activity_notes(activity_id);
create index if not exists idx_notes_project on activity_notes(project_id);
alter table activity_notes enable row level security;
