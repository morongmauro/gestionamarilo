// Endpoint público del Gantt compartido. El token del enlace es la llave:
// 'view' solo lee; 'edit' además actualiza/crea actividades del proyecto.
// Nunca expone las tareas (micromanagement) del proyecto.
const db = require('../../lib/db');

module.exports = async (req, res) => {
  const { token } = req.query;
  try {
    if (req.method === 'GET') {
      const data = await db.getSharedGantt(token);
      return res.status(200).json(data);
    }
    if (req.method === 'PATCH') {
      const { activityId, ...fields } = req.body || {};
      if (!activityId) return res.status(400).json({ error: 'activityId es obligatorio' });
      const activity = await db.shareUpdateActivity(token, activityId, fields);
      return res.status(200).json({ activity });
    }
    if (req.method === 'POST') {
      const activity = await db.shareCreateActivity(token, req.body || {});
      return res.status(201).json({ activity });
    }
    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    const msg = err.message || 'Error';
    const code = /no válido|revocado/.test(msg) ? 404 : /solo lectura/.test(msg) ? 403 : 500;
    res.status(code).json({ error: msg });
  }
};
