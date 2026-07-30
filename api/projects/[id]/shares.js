const db = require('../../../lib/db');

module.exports = async (req, res) => {
  const { id, shareId } = req.query;
  try {
    if (req.method === 'GET') {
      const shares = await db.listShares(id);
      return res.status(200).json({ shares });
    }
    if (req.method === 'POST') {
      const share = await db.createShare(id, req.body || {});
      return res.status(201).json({ share });
    }
    if (req.method === 'DELETE') {
      if (!shareId) return res.status(400).json({ error: 'shareId es obligatorio' });
      await db.deleteShare(id, shareId);
      return res.status(200).json({ success: true });
    }
    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
