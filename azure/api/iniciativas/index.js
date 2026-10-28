// ============================================================
// INICIATIVAS · Azure Functions (Node) + Azure SQL
// Mismo contrato que api/iniciativas.js en Vercel, así la página
// iniciativas.html funciona igual en los dos sitios:
//   GET    /api/iniciativas            → { columns, rows }
//   PUT    /api/iniciativas?config=1   → { columns:[...] }
//   POST   /api/iniciativas            → { props:{...} }  → { row }
//   PATCH  /api/iniciativas?id=...     → { props:{...} }  → { row }
//   DELETE /api/iniciativas?id=...
// Variable de entorno: SQL_CONNECTION_STRING
//   Server=tcp:<servidor>.database.windows.net,1433;Database=<base>;User ID=<usuario>;Password=<clave>;Encrypt=true;
// Si la app está en Static Web Apps con login de Entra ID, el usuario
// llega en el encabezado x-ms-client-principal (se usa para `authLevel`
// vía staticwebapp.config.json, no hace falta validarlo aquí).
// ============================================================
const sql = require('mssql');

const CONFIG_ID = 'default';
const TYPES = ['title', 'text', 'select', 'multi', 'people', 'number', 'date', 'check', 'url'];
let poolPromise;

function pool() {
  if (!process.env.SQL_CONNECTION_STRING) throw new Error('Falta la variable SQL_CONNECTION_STRING');
  if (!poolPromise) poolPromise = sql.connect(process.env.SQL_CONNECTION_STRING).catch(e => { poolPromise = null; throw e; });
  return poolPromise;
}

function cleanProps(props) {
  if (props == null) return {};
  if (typeof props !== 'object' || Array.isArray(props)) throw badRequest('props debe ser un objeto { columna: valor }');
  const out = {};
  for (const [k, v] of Object.entries(props)) {
    if (!k.trim()) continue;
    if (v === null || ['string', 'number', 'boolean'].includes(typeof v)) out[k] = v;
    else if (Array.isArray(v)) out[k] = v.filter(x => typeof x === 'string').map(x => x.trim()).filter(Boolean);
  }
  return out;
}
function cleanColumns(columns) {
  if (!Array.isArray(columns)) throw badRequest('columns debe ser una lista');
  const seen = new Set();
  return columns.map(c => {
    if (!c || typeof c.id !== 'string' || !c.id.trim()) throw badRequest('Cada columna necesita un id');
    if (seen.has(c.id)) throw badRequest(`Columna repetida: ${c.id}`);
    seen.add(c.id);
    const col = { id: c.id, name: String(c.name || 'Columna').slice(0, 120), type: TYPES.includes(c.type) ? c.type : 'text', width: Math.min(1200, Math.max(60, Number(c.width) || 180)) };
    if (c.hidden) col.hidden = true;
    if (c.log) col.log = true;
    if (Array.isArray(c.options)) col.options = c.options.filter(o => o && typeof o.name === 'string' && o.name.trim()).map(o => ({ name: o.name.trim().slice(0, 120), color: String(o.color || 'gris').slice(0, 20) }));
    return col;
  });
}
function badRequest(msg) { const e = new Error(msg); e.status = 400; return e; }
const parse = s => { try { return JSON.parse(s); } catch { return null; } };
const toRow = r => ({ id: String(r.id).toLowerCase(), props: parse(r.props) || {}, position: r.position, created_at: r.created_at, updated_at: r.updated_at });

async function fetchAll() {
  const p = await pool();
  const [cfg, rows] = await Promise.all([
    p.request().input('id', sql.NVarChar(40), CONFIG_ID).query('SELECT columns FROM dbo.iniciativas_config WHERE id = @id'),
    p.request().query('SELECT id, props, position, created_at, updated_at FROM dbo.iniciativas ORDER BY position, created_at'),
  ]);
  return { columns: cfg.recordset.length ? (parse(cfg.recordset[0].columns) || []) : [], rows: rows.recordset.map(toRow) };
}
async function saveColumns(columns) {
  const p = await pool();
  await p.request().input('id', sql.NVarChar(40), CONFIG_ID).input('columns', sql.NVarChar(sql.MAX), JSON.stringify(cleanColumns(columns)))
    .query(`MERGE dbo.iniciativas_config AS t USING (SELECT @id AS id) AS s ON t.id = s.id
            WHEN MATCHED THEN UPDATE SET columns = @columns, updated_at = SYSUTCDATETIME()
            WHEN NOT MATCHED THEN INSERT (id, columns) VALUES (@id, @columns);`);
}
async function createRow(props) {
  const p = await pool();
  const r = await p.request().input('props', sql.NVarChar(sql.MAX), JSON.stringify(cleanProps(props)))
    .query(`INSERT INTO dbo.iniciativas (props, position)
            OUTPUT inserted.id, inserted.props, inserted.position, inserted.created_at, inserted.updated_at
            SELECT @props, ISNULL(MAX(position), -1) + 1 FROM dbo.iniciativas;`);
  return toRow(r.recordset[0]);
}
async function updateRow(id, props) {
  const p = await pool();
  const cur = await p.request().input('id', sql.UniqueIdentifier, id).query('SELECT props FROM dbo.iniciativas WHERE id = @id');
  if (!cur.recordset.length) { const e = new Error('Iniciativa no encontrada'); e.status = 404; throw e; }
  const merged = { ...(parse(cur.recordset[0].props) || {}), ...cleanProps(props) };
  const r = await p.request().input('id', sql.UniqueIdentifier, id).input('props', sql.NVarChar(sql.MAX), JSON.stringify(merged))
    .query(`UPDATE dbo.iniciativas SET props = @props, updated_at = SYSUTCDATETIME()
            OUTPUT inserted.id, inserted.props, inserted.position, inserted.created_at, inserted.updated_at
            WHERE id = @id;`);
  return toRow(r.recordset[0]);
}
async function deleteRow(id) {
  const p = await pool();
  await p.request().input('id', sql.UniqueIdentifier, id).query('DELETE FROM dbo.iniciativas WHERE id = @id');
}

module.exports = async function (context, req) {
  const json = (status, body) => { context.res = { status, headers: { 'Content-Type': 'application/json' }, body }; };
  const q = req.query || {}, b = req.body || {};
  try {
    const m = (req.method || 'GET').toUpperCase();
    if (m === 'GET') return json(200, await fetchAll());
    if (m === 'PUT' && q.config) { await saveColumns(b.columns); return json(200, { success: true }); }
    if (m === 'POST') return json(201, { row: await createRow(b.props) });
    if (m === 'PATCH' || m === 'PUT') {
      if (!q.id) return json(400, { error: 'id es obligatorio' });
      return json(200, { row: await updateRow(q.id, b.props) });
    }
    if (m === 'DELETE') {
      if (!q.id) return json(400, { error: 'id es obligatorio' });
      await deleteRow(q.id); return json(200, { success: true });
    }
    return json(405, { error: 'Method not allowed' });
  } catch (err) {
    context.log.error(err);
    json(err.status || 500, { error: err.message });
  }
};
