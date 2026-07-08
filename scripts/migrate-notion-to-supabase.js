// ============================================================
// MIGRACIÓN ÚNICA: Notion → Supabase
//
// Trae todas las tareas de tu base de Notion y las inserta en
// Supabase. Los proyectos se crean a partir de los Topics de
// Notion (cada Topic = un proyecto, con sus 4 secciones de
// Gantt por defecto). Es idempotente: puedes correrlo varias
// veces sin duplicar (usa el id de Notion como llave).
//
// Uso:
//   NOTION_TOKEN=... SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run migrate
// (o pon las variables en un archivo .env)
// ============================================================
require('dotenv').config();

const { queryAll, formatTask } = require('../lib/notion');
const db = require('../lib/db');
const { getClient } = require('../lib/supabase');

const STATUS_MAP = { 'To-do': 'todo', 'In progress': 'doing', 'Doing': 'doing', 'Done': 'done' };

async function main() {
  console.log('→ Leyendo tareas de Notion...');
  const pages = await queryAll(undefined);
  const tasks = pages.map(formatTask);
  console.log(`  ${tasks.length} tareas encontradas.`);

  // 1. Proyectos desde los Topics (tu listado ya identificado)
  const topics = [...new Set(tasks.map(t => t.topic).filter(Boolean))];
  console.log(`→ Creando ${topics.length} proyectos (Topics de Notion)...`);
  const projectByTopic = {};
  for (const topic of topics) {
    const project = await db.resolveProject(topic);
    projectByTopic[topic] = project;
    console.log(`  ✓ ${topic}`);
  }

  // 2. ICE del proyecto = máximo ICE visto en sus tareas
  const sb = getClient();
  for (const topic of topics) {
    const ices = tasks.filter(t => t.topic === topic && t.ice).map(t => t.ice);
    if (ices.length) {
      await sb.from('projects').update({ ice: Math.max(...ices) }).eq('id', projectByTopic[topic].id);
    }
  }

  // 3. Tareas (upsert por notion_id)
  console.log('→ Migrando tareas...');
  let ok = 0;
  for (const t of tasks) {
    const row = {
      notion_id: t.id,
      description: t.title || '(sin título)',
      project_id: t.topic ? projectByTopic[t.topic].id : null,
      priority: ['High', 'Medium', 'Low'].includes(t.priority) ? t.priority : null,
      effort_level: ['Small', 'Medium', 'Large'].includes(t.effortLevel) ? t.effortLevel : null,
      tipo_gestion: ['Propia', 'Compartida', 'Depende Tercero'].includes(t.tipoGestion) ? t.tipoGestion : 'Propia',
      due_date: t.dueDate ? t.dueDate.slice(0, 10) : null,
      status: STATUS_MAP[t.status] || 'todo',
      ice: t.ice || null,
      created_at: t.createdTime,
      completed_at: STATUS_MAP[t.status] === 'done' ? t.lastEdited : null,
    };
    const { error } = await sb.from('tasks').upsert(row, { onConflict: 'notion_id' });
    if (error) {
      console.error(`  ✗ "${row.description}": ${error.message}`);
    } else {
      ok++;
    }
  }
  console.log(`✓ Migración completa: ${ok}/${tasks.length} tareas en Supabase.`);
  console.log('  Ya puedes usar la app sin Notion.');
}

main().catch(err => {
  console.error('Error en la migración:', err.message);
  process.exit(1);
});
