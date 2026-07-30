const db = require('../../lib/db');

module.exports = async (req, res) => {
  try {
    if (req.method === 'POST') {
      const section = await db.createSection(req.body || {});
      return res.status(201).json({ section });
    }
    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
