const db = require('../../lib/db');

module.exports = async (req, res) => {
  const { id } = req.query;
  try {
    if (req.method === 'PATCH' || req.method === 'PUT') {
      const activity = await db.updateActivity(id, req.body || {});
      return res.status(200).json({ activity });
    }
    if (req.method === 'DELETE') {
      await db.deleteActivity(id);
      return res.status(200).json({ success: true });
    }
    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
