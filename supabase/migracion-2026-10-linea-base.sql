-- ============================================================
-- MIGRACIÓN · Octubre 2026 (3) · Línea base + ajustes propuestos
--   · Línea base: fechas planeadas congeladas por actividad
--   · Ajustes propuestos desde el enlace compartido (el dueño decide)
-- Ejecuta este archivo en: Supabase → SQL Editor → New query → Run
-- (Es seguro correrlo más de una vez.)
-- ============================================================

alter table activities add column if not exists baseline_start date;
alter table activities add column if not exists baseline_end date;
alter table projects add column if not exists linea_base_at timestamptz;

create table if not exists propuestas_cambio (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references projects(id) on delete cascade,
  activity_id   uuid references activities(id) on delete cascade,
  campo         text not null,          -- deadline | startDate | responsables | entregable | name | nota
  valor         text,
  motivo        text,
  propuesto_por text,
  estado        text not null default 'pendiente' check (estado in ('pendiente','aceptada','descartada')),
  created_at    timestamptz not null default now()
);

create index if not exists idx_propuestas_project on propuestas_cambio(project_id);
alter table propuestas_cambio enable row level security;
