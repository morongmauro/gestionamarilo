// Proyecto individual + sus enlaces de Gantt compartido (consolidados en una
// sola función por el límite del plan Hobby de Vercel):
//   GET/PATCH/DELETE /api/projects/:id                  → el proyecto
//   GET    /api/projects/:id?res=shares                 → listar enlaces
//   POST   /api/projects/:id?res=shares                 → crear enlace
//   DELETE /api/projects/:id?res=shares&shareId=...     → revocar enlace
//   GET/POST/DELETE /api/projects/:id?res=miembros       → involucrados (nombre + área)
//   POST   /api/projects/:id?res=lineabase              → fijar / quitar línea base { accion }
//   GET    /api/projects/:id?res=propuestas             → ajustes propuestos pendientes
//   POST   /api/projects/:id?res=propuestas             → aceptar / descartar { propuestaId, aceptar }
//   GET    /api/projects/:id?res=plantilla              → plantillas disponibles
//   POST   /api/projects/:id?res=plantilla              → cargar plantilla { key, inicio }
const db = require('../../lib/db');

module.exports = async (req, res) => {
  const { id, res: sub, shareId } = req.query;
  try {
    if (sub === 'miembros') {
      if (req.method === 'GET') return res.status(200).json({ miembros: await db.listMiembros(id) });
      if (req.method === 'POST' || req.method === 'PATCH') return res.status(200).json({ miembro: await db.guardarMiembro(id, req.body || {}) });
      if (req.method === 'DELETE') {
        if (!req.query.memberId) return res.status(400).json({ error: 'memberId es obligatorio' });
        await db.borrarMiembro(id, req.query.memberId);
        return res.status(200).json({ success: true });
      }
      return res.status(405).json({ error: 'Method not allowed' });
    }
    if (sub === 'lineabase') {
      if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
      const { accion } = req.body || {};
      if (accion === 'quitar') await db.quitarLineaBase(id);
      else await db.fijarLineaBase(id);
      return res.status(200).json({ success: true });
    }
    if (sub === 'propuestas') {
      if (req.method === 'GET') return res.status(200).json({ propuestas: await db.listPropuestas(id) });
      if (req.method === 'POST') {
        const { propuestaId, aceptar, todas } = req.body || {};
        if (todas) {
          const aplicadas = await db.aplicarTodasPropuestas(id);
          return res.status(200).json({ success: true, aplicadas });
        }
        await db.resolverPropuesta(id, propuestaId, !!aceptar);
        return res.status(200).json({ success: true });
      }
      return res.status(405).json({ error: 'Method not allowed' });
    }
    // Historial de cambios del cronograma (quién cambió qué y cuándo)
    if (sub === 'historial') {
      if (req.method === 'GET') return res.status(200).json(await db.listHistorial(id, req.query.limite));
      return res.status(405).json({ error: 'Method not allowed' });
    }
    if (sub === 'plantilla') {
      if (req.method === 'GET') return res.status(200).json({ plantillas: db.listarPlantillas() });
      if (req.method === 'POST') {
        const { key, inicio, reemplazar } = req.body || {};
        const resultado = await db.aplicarPlantilla(id, key, { inicio, reemplazar: !!reemplazar });
        return res.status(200).json({ resultado });
      }
      return res.status(405).json({ error: 'Method not allowed' });
    }
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
