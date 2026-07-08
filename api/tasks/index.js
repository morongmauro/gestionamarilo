const db = require('../../lib/db');

module.exports = async (req, res) => {
  try {
    if (req.method === 'GET') {
      const tasks = await db.fetchAllTasks();
      return res.status(200).json({ tasks });
    }
    if (req.method === 'POST') {
      const task = await db.createTask(req.body || {});
      return res.status(201).json({ task });
    }
    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
