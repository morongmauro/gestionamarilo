// Endpoint público del plan compartido. El token del enlace es la llave:
// se lee el plan y se PROPONEN actividades o ajustes; el dueño decide.
// Un enlace de EDITOR (con nombre) además edita el cronograma (tipo: 'editar').
// Nunca expone las tareas (micromanagement) del proyecto.
const db = require('../../lib/db');

module.exports = async (req, res) => {
  const { token } = req.query;
  try {
    if (req.method === 'GET') {
      const data = await db.getSharedGantt(token);
      return res.status(200).json(data);
    }
    if (req.method === 'PATCH') {
      const { activityId, ...fields } = req.body || {};
      if (!activityId) return res.status(400).json({ error: 'activityId es obligatorio' });
      const activity = await db.shareUpdateActivity(token, activityId, fields);
      return res.status(200).json({ activity });
    }
    if (req.method === 'POST') {
      // Enlace de editor (con nombre): cambia el cronograma de verdad y queda en el historial
      if ((req.body || {}).tipo === 'editar') {
        const data = await db.shareEditar(token, req.body);
        return res.status(200).json(data);
      }
      // Ajuste a una actividad existente: queda como propuesta para el dueño
      if ((req.body || {}).tipo === 'ajuste') {
        const enviadas = await db.shareProponerAjuste(token, req.body);
        return res.status(201).json({ success: true, enviadas });
      }
      const activity = await db.shareCreateActivity(token, req.body || {});
      return res.status(201).json({ activity });
    }
    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    const msg = err.message || 'Error';
    const code = /no válido|revocado/.test(msg) ? 404 : /solo lectura|no se editan/.test(msg) ? 403 : /Operación no válida|Elige otro|subcapítulos|capítulo principal|ciclo/.test(msg) ? 400 : /no encontrada|no válid|Escribe|duración|Demasiados|nada que/.test(msg) ? 400 : 500;
    res.status(code).json({ error: msg });
  }
};
