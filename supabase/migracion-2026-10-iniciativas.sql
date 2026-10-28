-- ============================================================
-- INICIATIVAS · base de datos tipo Notion (vista tabla + tablero)
-- Ejecuta este archivo en: Supabase → SQL Editor → New query → Run
-- Es seguro correrlo más de una vez.
-- ============================================================

create extension if not exists pgcrypto;

-- Una fila por iniciativa. Las propiedades (estado, iniciativa, trazabilidad,
-- habilitadores, realizadores, income, OKRs, tipo de valor y las columnas que
-- agregues después) viven en `props` como JSON: { "estado": "L1 - Planeación",
-- "iniciativa": "...", "habilitadores": ["Ana", "Luis"], "income": 12, ... }
create table if not exists iniciativas (
  id         uuid primary key default gen_random_uuid(),
  props      jsonb not null default '{}'::jsonb,
  position   int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_iniciativas_position on iniciativas(position);
create index if not exists idx_iniciativas_props on iniciativas using gin (props);

-- Definición de columnas (nombre, tipo, ancho, opciones con color, ocultas).
-- Una sola fila con id 'default'.
create table if not exists iniciativas_config (
  id         text primary key default 'default',
  columns    jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

-- Igual que el resto de tablas: solo el servidor (service_role) puede tocarlas.
alter table iniciativas enable row level security;
alter table iniciativas_config enable row level security;
