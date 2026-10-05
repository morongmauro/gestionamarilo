// Fases del Gantt en un solo endpoint (límite de funciones del plan Hobby):
// POST /api/sections            → crear fase
// PATCH /api/sections?id=...    → renombrar / activar / desactivar
// DELETE /api/sections?id=...   → eliminar (&conActividades=1: también sus actividades)
// POST { accion: 'anidar', id, padreId } → subcapítulo · { accion: 'sacar', id }
const db = require('../lib/db');

module.exports = async (req, res) => {
  const { id } = req.query;
  try {
    if (req.method === 'POST') {
      const b = req.body || {};
      // Meter un capítulo dentro de otro (subcapítulo) o sacarlo
      if (b.accion === 'anidar') return res.status(200).json(await db.anidarSeccion(b.id, b.padreId));
      if (b.accion === 'sacar') { await db.sacarSeccion(b.id); return res.status(200).json({ success: true }); }
      const section = await db.createSection(b);
      return res.status(201).json({ section });
    }
    if (req.method === 'PATCH' || req.method === 'PUT') {
      if (!id) return res.status(400).json({ error: 'id es obligatorio' });
      const section = await db.updateSection(id, req.body || {});
      return res.status(200).json({ section });
    }
    if (req.method === 'DELETE') {
      if (!id) return res.status(400).json({ error: 'id es obligatorio' });
      await db.deleteSection(id, { conActividades: req.query.conActividades === '1' });
      return res.status(200).json({ success: true });
    }
    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
