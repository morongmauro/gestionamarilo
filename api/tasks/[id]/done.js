const { markDone } = require('../../../lib/db');

module.exports = async (req, res) => {
  if (req.method !== 'PATCH' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const task = await markDone(req.query.id);
    res.status(200).json({ success: true, task });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
