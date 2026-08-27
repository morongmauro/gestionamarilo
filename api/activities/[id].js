const db = require('../../lib/db');

module.exports = async (req, res) => {
  const { id } = req.query;
  try {
    // Se devuelve también el listado del proyecto: al guardar, las fechas de
    // las sucesoras pueden haberse corrido, y así el front no vuelve a pedir todo.
    if (req.method === 'PATCH' || req.method === 'PUT') {
      const activity = await db.updateActivity(id, req.body || {});
      const activities = await db.listProjectActivities(activity.projectId);
      return res.status(200).json({ activity, activities });
    }
    if (req.method === 'DELETE') {
      const { projectId } = req.query;
      await db.deleteActivity(id);
      const activities = projectId ? await db.listProjectActivities(projectId) : null;
      return res.status(200).json({ success: true, activities });
    }
    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
