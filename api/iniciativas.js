// Iniciativas (base de datos tipo Notion) en un solo endpoint (límite de funciones del plan Hobby):
// GET    /api/iniciativas            → { columns, rows }
// PUT    /api/iniciativas?config=1   → guardar columnas  { columns:[...] }
// POST   /api/iniciativas            → crear fila        { props:{...} }  → { row }
// PATCH  /api/iniciativas?id=...     → actualizar fila   { props:{...} }  → { row }  (mezcla con lo que ya tiene)
// DELETE /api/iniciativas?id=...     → eliminar fila
const db = require('../lib/iniciativas');

module.exports = async (req, res) => {
  const { id, config } = req.query;
  try {
    if (req.method === 'GET') return res.status(200).json(await db.fetchAll());
    if (req.method === 'PUT' && config) {
      await db.saveColumns((req.body || {}).columns);
      return res.status(200).json({ success: true });
    }
    if (req.method === 'POST') {
      const row = await db.createRow((req.body || {}).props);
      return res.status(201).json({ row });
    }
    if (req.method === 'PATCH' || req.method === 'PUT') {
      if (!id) return res.status(400).json({ error: 'id es obligatorio' });
      const row = await db.updateRow(id, (req.body || {}).props);
      return res.status(200).json({ row });
    }
    if (req.method === 'DELETE') {
      if (!id) return res.status(400).json({ error: 'id es obligatorio' });
      await db.deleteRow(id);
      return res.status(200).json({ success: true });
    }
    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    const status = /no encontrada/i.test(err.message) ? 404 : /debe|obligatorio|repetida|demasiado|necesita|Solo puede/i.test(err.message) ? 400 : 500;
    res.status(status).json({ error: err.message });
  }
};
