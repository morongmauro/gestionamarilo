# Configuración: de Notion a Supabase

La app ya no usa Notion para nada. Todo (tareas, proyectos, fases y actividades del Gantt) vive en tu Supabase. Sigue estos pasos una sola vez:

> **¿Ya tenías la base creada?** Para las funciones nuevas (Gantt compartido por enlace y fases activables) ejecuta una sola vez [`supabase/migracion-2026-07-gantt.sql`](supabase/migracion-2026-07-gantt.sql) en **SQL Editor → New query → Run**. Es seguro correrlo más de una vez.

## 1. Crear el proyecto en Supabase

1. Entra a [supabase.com](https://supabase.com) → **New project** (el plan gratis alcanza de sobra).
2. Cuando esté listo, ve a **SQL Editor → New query**.
3. Copia y pega **todo** el contenido de [`supabase/schema.sql`](supabase/schema.sql) y dale **Run**. Eso crea las tablas `projects`, `project_sections`, `activities` y `tasks`.

## 2. Variables de entorno en Vercel

En Vercel → tu proyecto → **Settings → Environment Variables**, agrega:

| Variable | Dónde la encuentras |
|---|---|
| `SUPABASE_URL` | Supabase → Settings → API → Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → `service_role` (secret) |
| `ANTHROPIC_API_KEY` | (la que ya tienes — la usa el chat y la captura rápida) |

> Usa la clave `service_role`, no la `anon`: solo la usan las funciones del servidor y las tablas tienen RLS activado, así que nadie puede tocar los datos desde el navegador.

Después de agregarlas, haz **Redeploy**.

## 3. Cargar tus datos (una sola vez)

Tus tareas ya migraron con el archivo `supabase/seed-notion.sql` (generado desde tu export de Notion). Para cargarlo:

1. Supabase → **SQL Editor → New query**.
2. Pega **todo** el contenido de `supabase/seed-notion.sql` → **Run**.

Eso crea tus proyectos (desde los Topics, cada uno con sus 4 fases de Gantt) y todas tus tareas con su prioridad, esfuerzo, tipo de gestión, deadline, ICE y estado. Es idempotente: correrlo dos veces no duplica.

> ¿Necesitas volver a importar en el futuro desde otro export de Notion? El script offline sigue disponible (no se conecta a Notion, solo lee el archivo exportado):
> ```bash
> npm install
> npm run import -- <archivo.csv-o-.html-o-carpeta>
> ```
> Genera un nuevo `supabase/seed-notion.sql` que pegas en el SQL Editor.

## Desconexión de Notion ✅

La app ya no depende de Notion en absoluto: no hay cliente de Notion, ni token, ni llamadas a su API. Puedes:
- Quitar `NOTION_TOKEN` de las variables de entorno de Vercel (ya no se usa).
- Revocar la integración en [notion.so/profile/integrations](https://www.notion.so/profile/integrations) cuando confirmes que todo se ve bien en la app.

## Qué hay de nuevo en la app

- **Pestaña Tareas**: la cajita de captura rápida — escribes en lenguaje natural ("Enviar informe a Andrés, proyecto Facturación, urgente, para el viernes") y Claude reconoce proyecto, prioridad, esfuerzo, tipo de gestión y deadline. Solo la descripción es obligatoria. Debajo, kanban con arrastrar y soltar, y click en cualquier tarjeta para editar.
- **Pestaña Proyectos**: portafolio con % de cumplimiento, estado (🟢🟡🔴 según retrasos), fecha final y alertas. Cada proyecto tiene su Gantt con las fases **Planeación · Ejecución piloto · Seguimiento · Implementación al negocio**: escribes la actividad y Enter — fechas, responsable, % y dependencias son opcionales y se agregan con un click cuando quieras. El resumen muestra fecha final, fechas críticas, retrasos y próximas a vencer.
- **Vínculo micromanagement ↔ management**: al editar una tarea puedes vincularla opcionalmente a una actividad del Gantt de su proyecto.
- Consola Diaria, Dashboard y el chat de Claude siguen igual, pero ahora leen de Supabase.
