const { parseCapture, parseCaptureMulti, isMultiCapture } = require('../lib/capture');
const db = require('../lib/db');

const PRIOS = ['High', 'Medium', 'Low'];
const EFFORTS = ['Small', 'Medium', 'Large'];
const TIPOS = ['Propia', 'Compartida', 'Depende Tercero'];

// Crea una tarea a partir de un parse + overrides manuales. Cache de proyectos
// resueltos para no duplicar cuando varias viñetas comparten proyecto nuevo.
async function createFromParsed(parsed, ov, projects, projectCache, projectsCreated) {
  let projectId = ov.projectId || null;
  if (!projectId && parsed.project) {
    const key = parsed.project.toLowerCase();
    if (!projectCache[key]) {
      const existed = projects.some(p => p.name.toLowerCase() === key);
      projectCache[key] = await db.resolveProject(parsed.project);
      if (!existed) projectsCreated.push(projectCache[key].name);
    }
    projectId = projectCache[key].id;
  }
  const priority = PRIOS.includes(ov.priority) ? ov.priority : (parsed.priority || undefined);
  const effortLevel = EFFORTS.includes(ov.effortLevel) ? ov.effortLevel : (parsed.effort || undefined);
  const tipoGestion = TIPOS.includes(ov.tipoGestion) ? ov.tipoGestion : (parsed.tipo_gestion || 'Propia');
  const dueDate = /^\d{4}-\d{2}-\d{2}$/.test(ov.dueDate || '') ? ov.dueDate : (parsed.due_date || undefined);
  const task = await db.createTask({ description: parsed.description, projectId, priority, effortLevel, tipoGestion, dueDate });
  const applied = {
    description: parsed.description,
    project: task.topic || null,
    priority: priority || null,
    effort: effortLevel || null,
    tipo_gestion: tipoGestion || null,
    due_date: dueDate || null,
  };
  return { task, applied };
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const { text, overrides } = req.body || {};
    if (!text || !String(text).trim()) {
      return res.status(400).json({ error: 'Escribe la tarea primero' });
    }
    const ov = overrides || {};

    const projects = await db.listProjectNames();

    // Varias viñetas "-" → varias tareas de una vez
    if (isMultiCapture(text)) {
      const { tareas, engine } = await parseCaptureMulti(String(text).trim(), projects);
      if (!tareas.length) return res.status(400).json({ error: 'No reconocí tareas en las viñetas' });
      const projectCache = {};
      const projectsCreated = [];
      const results = [];
      for (const parsed of tareas) {
        results.push(await createFromParsed(parsed, ov, projects, projectCache, projectsCreated));
      }
      return res.status(200).json({
        multi: true,
        engine,
        tasks: results.map(r => r.task),
        applied: results.map(r => r.applied),
        projectsCreated,
        projectCreated: projectsCreated.length > 0,
      });
    }

    const { parsed, engine } = await parseCapture(String(text).trim(), projects);

    // Los atributos marcados a mano (overrides) mandan sobre lo que reconoce la IA.
    const projectCache = {};
    const projectsCreated = [];
    const { task, applied } = await createFromParsed(parsed, ov, projects, projectCache, projectsCreated);

    res.status(200).json({ task, parsed, applied, engine, projectCreated: projectsCreated.length > 0 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
