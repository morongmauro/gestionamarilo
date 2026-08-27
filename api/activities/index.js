const db = require('../../lib/db');

module.exports = async (req, res) => {
  try {
    if (req.method === 'POST') {
      const activity = await db.createActivity(req.body || {});
      const activities = await db.listProjectActivities(activity.projectId);
      return res.status(201).json({ activity, activities });
    }
    // Reordenar en lote: { projectId, reorder: [{ id, position }, ...] }
    if (req.method === 'PATCH') {
      const count = await db.reorderActivities(req.body || {});
      const { projectId } = req.body || {};
      const activities = projectId ? await db.listProjectActivities(projectId) : null;
      return res.status(200).json({ success: true, count, activities });
    }
    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
