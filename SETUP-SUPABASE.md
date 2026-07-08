# Configuración: de Notion a Supabase

La app ya no usa Notion para nada. Todo (tareas, proyectos, fases y actividades del Gantt) vive en tu Supabase. Sigue estos pasos una sola vez:

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

## 3. (Opcional) Migrar lo que tienes en Notion

Hay dos formas — usa la que prefieras:

### Opción A: desde un export de Notion (sin tokens ni claves) ⭐ recomendada

1. En Notion, abre la página de tu base de datos de tareas → menú `•••` (arriba a la derecha) → **Export**.
2. Formato: **Markdown & CSV** (o HTML, ambos sirven) · "Include subpages": no hace falta.
3. Descarga el `.zip`, descomprímelo, y corre:

```bash
npm install
node scripts/import-notion-export.js <carpeta-descomprimida>
```

Eso genera `supabase/seed-notion.sql` con todos tus proyectos (desde los Topics, con sus 4 fases de Gantt) y todas tus tareas. Pégalo completo en **Supabase → SQL Editor → Run**. Es idempotente: correrlo dos veces no duplica.

### Opción B: directo desde el API de Notion

```bash
npm install
NOTION_TOKEN=secret_xxx SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=eyJ... npm run migrate
```

(También puedes poner esas variables en un archivo `.env` y correr solo `npm run migrate`.)

Ambas opciones:
- Crean un proyecto por cada **Topic** de Notion (con sus 4 fases de Gantt por defecto).
- Copian todas las tareas con su prioridad, esfuerzo, tipo de gestión, deadline, ICE y estado.
- Son idempotentes: puedes correrlas varias veces sin duplicar nada.

Cuando termine, ya puedes olvidarte de Notion. 🎉

## Qué hay de nuevo en la app

- **Pestaña Tareas**: la cajita de captura rápida — escribes en lenguaje natural ("Enviar informe a Andrés, proyecto Facturación, urgente, para el viernes") y Claude reconoce proyecto, prioridad, esfuerzo, tipo de gestión y deadline. Solo la descripción es obligatoria. Debajo, kanban con arrastrar y soltar, y click en cualquier tarjeta para editar.
- **Pestaña Proyectos**: portafolio con % de cumplimiento, estado (🟢🟡🔴 según retrasos), fecha final y alertas. Cada proyecto tiene su Gantt con las fases **Planeación · Ejecución piloto · Seguimiento · Implementación al negocio**: escribes la actividad y Enter — fechas, responsable, % y dependencias son opcionales y se agregan con un click cuando quieras. El resumen muestra fecha final, fechas críticas, retrasos y próximas a vencer.
- **Vínculo micromanagement ↔ management**: al editar una tarea puedes vincularla opcionalmente a una actividad del Gantt de su proyecto.
- Consola Diaria, Dashboard y el chat de Claude siguen igual, pero ahora leen de Supabase.
