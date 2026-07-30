// Proyecto individual + sus enlaces de Gantt compartido (consolidados en una
// sola función por el límite del plan Hobby de Vercel):
//   GET/PATCH/DELETE /api/projects/:id                  → el proyecto
//   GET    /api/projects/:id?res=shares                 → listar enlaces
//   POST   /api/projects/:id?res=shares                 → crear enlace
//   DELETE /api/projects/:id?res=shares&shareId=...     → revocar enlace
const db = require('../../lib/db');

module.exports = async (req, res) => {
  const { id, res: sub, shareId } = req.query;
  try {
    if (sub === 'shares') {
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
      return res.status(405).json({ error: 'Method not allowed' });
    }
    if (req.method === 'GET') {
      const project = await db.getProjectDetail(id);
      return res.status(200).json({ project });
    }
    if (req.method === 'PATCH' || req.method === 'PUT') {
      const project = await db.updateProject(id, req.body || {});
      return res.status(200).json({ project });
    }
    if (req.method === 'DELETE') {
      await db.deleteProject(id);
      return res.status(200).json({ success: true });
    }
    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
