-- ============================================================
-- Sistema de Gestión Mauro · Esquema Supabase
-- Ejecuta este archivo completo en: Supabase → SQL Editor → New query → Run
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- PROYECTOS (management general: cada frente de trabajo)
-- ------------------------------------------------------------
create table if not exists projects (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  descripcion text,
  responsable text,
  ice         numeric,
  archivado   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ------------------------------------------------------------
-- SECCIONES DEL PROYECTO (fases del Gantt)
-- Al crear un proyecto desde la app se crean 4 por defecto:
-- Planeación · Ejecución piloto · Seguimiento · Implementación al negocio
-- ------------------------------------------------------------
create table if not exists project_sections (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name       text not null,
  position   int not null default 0,
  enabled    boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_sections_project on project_sections(project_id);

-- ------------------------------------------------------------
-- ACTIVIDADES (filas del Gantt — management general)
-- Solo el nombre es obligatorio. Fechas, responsable, %, dependencia: opcionales.
-- ------------------------------------------------------------
create table if not exists activities (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references projects(id) on delete cascade,
  section_id   uuid references project_sections(id) on delete set null,
  name         text not null,
  responsable  text,
  start_date   date,
  deadline     date,
  status       text not null default 'pendiente' check (status in ('pendiente','en_curso','completada')),
  pct_complete int not null default 0 check (pct_complete between 0 and 100),
  depends_on   uuid references activities(id) on delete set null,
  notes        text,
  position     int not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_activities_project on activities(project_id);
create index if not exists idx_activities_section on activities(section_id);

-- ------------------------------------------------------------
-- TAREAS (micromanagement del día a día — captura rápida + kanban)
-- Puede vincularse opcionalmente a un proyecto y/o a una actividad del Gantt.
-- ------------------------------------------------------------
create table if not exists tasks (
  id           uuid primary key default gen_random_uuid(),
  description  text not null,
  project_id   uuid references projects(id) on delete set null,
  activity_id  uuid references activities(id) on delete set null,
  priority     text check (priority in ('High','Medium','Low')),
  effort_level text check (effort_level in ('Small','Medium','Large')),
  tipo_gestion text default 'Propia' check (tipo_gestion in ('Propia','Compartida','Depende Tercero')),
  due_date     date,
  status       text not null default 'todo' check (status in ('todo','doing','done')),
  ice          numeric,
  import_key   text unique,   -- llave estable para importar sin duplicar (id de la página de origen)
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists idx_tasks_project on tasks(project_id);
create index if not exists idx_tasks_status on tasks(status);

-- ------------------------------------------------------------
-- ENLACES DE GANTT COMPARTIDO
-- Cada enlace da acceso SOLO al Gantt (fases + actividades) de un
-- proyecto, nunca a las tareas. role: 'view' (solo ver) | 'edit'.
-- ------------------------------------------------------------
create table if not exists project_shares (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  token      text not null unique,
  label      text,
  role       text not null default 'view' check (role in ('view','edit')),
  created_at timestamptz not null default now()
);

create index if not exists idx_shares_project on project_shares(project_id);

-- ------------------------------------------------------------
-- updated_at automático
-- ------------------------------------------------------------
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_projects_updated on projects;
create trigger trg_projects_updated before update on projects
  for each row execute function set_updated_at();

drop trigger if exists trg_activities_updated on activities;
create trigger trg_activities_updated before update on activities
  for each row execute function set_updated_at();

drop trigger if exists trg_tasks_updated on tasks;
create trigger trg_tasks_updated before update on tasks
  for each row execute function set_updated_at();

-- ------------------------------------------------------------
-- Seguridad: la app accede solo desde el servidor (service role).
-- Activamos RLS sin políticas → la clave anónima no puede leer ni escribir.
-- ------------------------------------------------------------
alter table projects enable row level security;
alter table project_sections enable row level security;
alter table activities enable row level security;
alter table tasks enable row level security;
alter table project_shares enable row level security;
