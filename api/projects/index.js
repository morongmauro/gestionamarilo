const db = require('../../lib/db');

module.exports = async (req, res) => {
  try {
    if (req.method === 'GET') {
      const projects = await db.listProjects();
      return res.status(200).json({ projects });
    }
    if (req.method === 'POST') {
      const project = await db.createProject(req.body || {});
      return res.status(201).json({ project });
    }
    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
