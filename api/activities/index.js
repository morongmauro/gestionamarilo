const db = require('../../lib/db');

module.exports = async (req, res) => {
  try {
    if (req.method === 'POST') {
      const activity = await db.createActivity(req.body || {});
      return res.status(201).json({ activity });
    }
    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
