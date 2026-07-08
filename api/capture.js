const { parseCapture } = require('../lib/capture');
const db = require('../lib/db');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const { text } = req.body || {};
    if (!text || !String(text).trim()) {
      return res.status(400).json({ error: 'Escribe la tarea primero' });
    }

    const projects = await db.listProjectNames();
    const { parsed, engine } = await parseCapture(String(text).trim(), projects);

    let projectCreated = false;
    let projectId = null;
    if (parsed.project) {
      const existed = projects.some(p => p.name.toLowerCase() === parsed.project.toLowerCase());
      const project = await db.resolveProject(parsed.project);
      projectId = project.id;
      projectCreated = !existed;
    }

    const task = await db.createTask({
      description: parsed.description,
      projectId,
      priority: parsed.priority || undefined,
      effortLevel: parsed.effort || undefined,
      tipoGestion: parsed.tipo_gestion || 'Propia',
      dueDate: parsed.due_date || undefined,
    });

    res.status(200).json({ task, parsed, engine, projectCreated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
