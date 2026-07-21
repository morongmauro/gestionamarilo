const { parseCapture } = require('../lib/capture');
const db = require('../lib/db');

const PRIOS = ['High', 'Medium', 'Low'];
const EFFORTS = ['Small', 'Medium', 'Large'];
const TIPOS = ['Propia', 'Compartida', 'Depende Tercero'];

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
    const { parsed, engine } = await parseCapture(String(text).trim(), projects);

    // Los atributos marcados a mano (overrides) mandan sobre lo que reconoce la IA.
    let projectCreated = false;
    let projectId = ov.projectId || null;
    if (!projectId && parsed.project) {
      const existed = projects.some(p => p.name.toLowerCase() === parsed.project.toLowerCase());
      const project = await db.resolveProject(parsed.project);
      projectId = project.id;
      projectCreated = !existed;
    }

    const priority = PRIOS.includes(ov.priority) ? ov.priority : (parsed.priority || undefined);
    const effortLevel = EFFORTS.includes(ov.effortLevel) ? ov.effortLevel : (parsed.effort || undefined);
    const tipoGestion = TIPOS.includes(ov.tipoGestion) ? ov.tipoGestion : (parsed.tipo_gestion || 'Propia');
    const dueDate = /^\d{4}-\d{2}-\d{2}$/.test(ov.dueDate || '') ? ov.dueDate : (parsed.due_date || undefined);

    const task = await db.createTask({
      description: parsed.description,
      projectId,
      priority,
      effortLevel,
      tipoGestion,
      dueDate,
    });

    // Devuelve lo que realmente quedó guardado (mezcla de IA + manual) para el feedback.
    const applied = {
      description: parsed.description,
      project: task.topic || null,
      priority: priority || null,
      effort: effortLevel || null,
      tipo_gestion: tipoGestion || null,
      due_date: dueDate || null,
    };

    res.status(200).json({ task, parsed, applied, engine, projectCreated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
