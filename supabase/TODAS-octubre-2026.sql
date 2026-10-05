-- ============================================================
-- TODAS LAS MIGRACIONES DE OCTUBRE 2026 · en un solo archivo
-- Pega TODO este archivo en: Supabase → SQL Editor → New query → Run
-- Es seguro correrlo aunque ya hayas corrido alguna antes:
-- solo agrega lo que falte (columnas y tablas), no borra nada.
-- ============================================================

-- ---------- plan-trabajo ----------
alter table activities add column if not exists entregable text;

-- ---------- fechas-reales ----------
alter table activities add column if not exists real_start date;
alter table activities add column if not exists real_end date;
alter table activities add column if not exists propuesta boolean not null default false;
alter table activities add column if not exists propuesta_por text;

-- ---------- linea-base ----------
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

-- ---------- involucrados ----------
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

-- ---------- fecha-meta ----------
alter table projects add column if not exists fecha_meta date;

-- ---------- notas ----------
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

-- ---------- area ----------
alter table activities add column if not exists area text;

-- ---------- duracion ----------
alter table activities add column if not exists duracion integer;

-- ---------- edicion (enlaces de editor, historial, subcapítulos) ----------
alter table project_shares drop constraint if exists project_shares_role_check;
alter table project_shares add constraint project_shares_role_check check (role in ('view','edit','editor'));
alter table project_sections add column if not exists parent_id uuid references project_sections(id) on delete set null;
create table if not exists historial_cambios (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects(id) on delete cascade,
  activity_id uuid,
  autor       text,
  accion      text not null,
  objeto      text,
  detalle     text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_historial_project on historial_cambios(project_id, created_at desc);
alter table historial_cambios enable row level security;
