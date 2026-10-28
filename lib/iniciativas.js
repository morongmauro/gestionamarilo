// ============================================================
// CAPA DE DATOS · INICIATIVAS (base de datos tipo Notion)
// Dos tablas en Supabase:
//   iniciativas        → una fila por iniciativa; sus propiedades van en `props` (jsonb)
//   iniciativas_config → la definición de columnas (jsonb), una sola fila 'default'
// Guardar las propiedades como JSON permite crear, renombrar y borrar columnas
// desde la app sin tocar el esquema, igual que en Notion.
// ============================================================
const { getClient } = require('./supabase');

const CONFIG_ID = 'default';
const MAX_PROPS_BYTES = 200 * 1024; // una fila no debería pesar más de 200 KB

function fail(error) {
  const msg = error.message || String(error);
  if (/iniciativas/i.test(msg) && /does not exist|could not find|schema cache/i.test(msg)) {
    throw new Error(`${msg} · Falta correr en Supabase → SQL Editor el archivo supabase/migracion-2026-10-iniciativas.sql`);
  }
  throw new Error(msg);
}

function cleanProps(props) {
  if (props == null) return {};
  if (typeof props !== 'object' || Array.isArray(props)) throw new Error('props debe ser un objeto { columna: valor }');
  const out = {};
  for (const [k, v] of Object.entries(props)) {
    if (typeof k !== 'string' || !k.trim()) continue;
    // Solo valores simples: texto, número, booleano, null o listas de texto
    if (v === null || ['string', 'number', 'boolean'].includes(typeof v)) out[k] = v;
    else if (Array.isArray(v)) out[k] = v.filter(x => typeof x === 'string').map(x => x.trim()).filter(Boolean);
  }
  if (JSON.stringify(out).length > MAX_PROPS_BYTES) throw new Error('La fila es demasiado grande');
  return out;
}

function cleanColumns(columns) {
  if (!Array.isArray(columns)) throw new Error('columns debe ser una lista');
  const TYPES = ['title', 'text', 'select', 'multi', 'people', 'number', 'date', 'check', 'url'];
  const seen = new Set();
  const out = columns.map(c => {
    if (!c || typeof c.id !== 'string' || !c.id.trim()) throw new Error('Cada columna necesita un id');
    if (seen.has(c.id)) throw new Error(`Columna repetida: ${c.id}`);
    seen.add(c.id);
    const col = {
      id: c.id,
      name: String(c.name || 'Columna').slice(0, 120),
      type: TYPES.includes(c.type) ? c.type : 'text',
      width: Math.min(1200, Math.max(60, Number(c.width) || 180)),
    };
    if (c.hidden) col.hidden = true;
    if (c.log) col.log = true;
    if (Array.isArray(c.options)) {
      col.options = c.options
        .filter(o => o && typeof o.name === 'string' && o.name.trim())
        .map(o => ({ name: o.name.trim().slice(0, 120), color: String(o.color || 'gris').slice(0, 20) }));
    }
    return col;
  });
  if (out.filter(c => c.type === 'title').length > 1) throw new Error('Solo puede haber una columna de tipo título');
  return out;
}

async function fetchAll() {
  const sb = getClient();
  const [cfg, rows] = await Promise.all([
    sb.from('iniciativas_config').select('columns').eq('id', CONFIG_ID).maybeSingle(),
    sb.from('iniciativas').select('*').order('position', { ascending: true }).order('created_at', { ascending: true }),
  ]);
  if (cfg.error) fail(cfg.error);
  if (rows.error) fail(rows.error);
  return { columns: (cfg.data && cfg.data.columns) || [], rows: rows.data || [] };
}

async function saveColumns(columns) {
  const sb = getClient();
  const { error } = await sb.from('iniciativas_config')
    .upsert({ id: CONFIG_ID, columns: cleanColumns(columns), updated_at: new Date().toISOString() });
  if (error) fail(error);
  return { success: true };
}

async function createRow(props) {
  const sb = getClient();
  const { data: last, error: e1 } = await sb.from('iniciativas').select('position').order('position', { ascending: false }).limit(1);
  if (e1) fail(e1);
  const position = last && last.length ? (last[0].position || 0) + 1 : 0;
  const { data, error } = await sb.from('iniciativas').insert({ props: cleanProps(props), position }).select().single();
  if (error) fail(error);
  return data;
}

// Mezcla las propiedades que llegan con las que ya tiene la fila (como PATCH)
async function updateRow(id, props) {
  const sb = getClient();
  const { data: cur, error: e1 } = await sb.from('iniciativas').select('props').eq('id', id).maybeSingle();
  if (e1) fail(e1);
  if (!cur) throw new Error('Iniciativa no encontrada');
  const merged = { ...(cur.props || {}), ...cleanProps(props) };
  const { data, error } = await sb.from('iniciativas')
    .update({ props: merged, updated_at: new Date().toISOString() }).eq('id', id).select().single();
  if (error) fail(error);
  return data;
}

async function deleteRow(id) {
  const sb = getClient();
  const { error } = await sb.from('iniciativas').delete().eq('id', id);
  if (error) fail(error);
  return { success: true };
}

module.exports = { fetchAll, saveColumns, createRow, updateRow, deleteRow, cleanProps, cleanColumns };
