-- ============================================================
-- MIGRACIÓN · Agosto 2026 · Gantt avanzado
--   · Varios responsables por actividad
--   · Varias dependencias por actividad (para la ruta crítica)
-- Ejecuta este archivo en: Supabase → SQL Editor → New query → Run
-- (Es seguro correrlo más de una vez.)
-- ============================================================

-- 1. Varios responsables por actividad.
--    La columna vieja `responsable` se conserva sincronizada (nombres
--    separados por coma) para no romper el Gantt compartido.
alter table activities add column if not exists responsables text[] not null default '{}';

update activities
   set responsables = array[responsable]
 where cardinality(responsables) = 0
   and responsable is not null
   and btrim(responsable) <> '';

-- 2. Varias dependencias por actividad.
--    `depends_on` sigue guardando la primera, por compatibilidad.
alter table activities add column if not exists depends_on_ids uuid[] not null default '{}';

update activities
   set depends_on_ids = array[depends_on]
 where cardinality(depends_on_ids) = 0
   and depends_on is not null;
