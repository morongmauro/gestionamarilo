// ============================================================
// VALIDACIÓN de lo que llega del navegador.
// Cada colección tiene sus campos y tipos; lo que no esté en la lista
// se descarta. Así nadie puede guardar cosas raras en la base.
// ============================================================
const BAD_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

class ValidationError extends Error { constructor(m) { super(m); this.status = 400; } }
const bad = m => { throw new ValidationError(m); };

// JSON libre pero acotado (para props de proyectos, flujos del caso, compromisos)
function cleanAny(v, depth = 0) {
  if (v === null) return null;
  const t = typeof v;
  if (t === 'string') return v.slice(0, 20000);
  if (t === 'number') return Number.isFinite(v) ? v : null;
  if (t === 'boolean') return v;
  if (depth >= 6) return undefined;
  if (Array.isArray(v)) return v.slice(0, 1000).map(x => cleanAny(x, depth + 1)).filter(x => x !== undefined);
  if (t === 'object') {
    const o = {};
    let n = 0;
    for (const [k, x] of Object.entries(v)) {
      if (BAD_KEYS.has(k) || n >= 300 || k.length > 100) continue;
      const c = cleanAny(x, depth + 1);
      if (c !== undefined) { o[k] = c; n++; }
    }
    return o;
  }
  return undefined;
}

const T = {
  str: v => (v == null ? '' : String(v).slice(0, 500)),
  text: v => (v == null ? '' : String(v).slice(0, 20000)),
  date: v => (v == null || v === '' ? null : /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : bad('Fecha inválida (AAAA-MM-DD)')),
  time: v => (v == null || v === '' ? null : /^\d{2}:\d{2}$/.test(v) ? v : bad('Hora inválida (HH:MM)')),
  num: v => (v == null || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : bad('Número inválido')),
  pct: v => Math.max(0, Math.min(100, Math.round(Number(v) || 0))),
  bool: v => !!v,
  id: v => (v == null || v === '' ? null : String(v).slice(0, 64)),
  ids: v => (Array.isArray(v) ? [...new Set(v.map(String))].slice(0, 300) : []),
  obj: v => (v && typeof v === 'object' && !Array.isArray(v) ? cleanAny(v) : {}),
  arr: v => (Array.isArray(v) ? cleanAny(v) : []),
  stamp: v => (v == null || v === '' ? null : !isNaN(Date.parse(v)) ? new Date(v).toISOString() : bad('Fecha y hora inválidas')),
  dur: v => (v == null || v === '' ? null : Number.isInteger(Number(v)) && Number(v) >= 1 && Number(v) <= 999 ? Number(v) : bad('Duración inválida (1 a 999 días hábiles)')),
  // { idPrecedente: { t: 'FC'|'CC'|'FF'|'CF', d: desfase, u: 'h' hábiles | 'c' corridos } }
  deptipos: v => {
    const out = {};
    if (!v || typeof v !== 'object' || Array.isArray(v)) return out;
    for (const [k, x] of Object.entries(v).slice(0, 300)) {
      if (BAD_KEYS.has(k) || k.length > 64 || !x || typeof x !== 'object') continue;
      const t = ['FC', 'CC', 'FF', 'CF'].includes(x.t) ? x.t : 'FC', d = Math.max(-730, Math.min(730, Math.round(Number(x.d) || 0)));
      out[k] = x.u === 'c' ? { t, d, u: 'c' } : { t, d };
    }
    return out;
  },
};

const SCHEMAS = {
  // Proyecto: sus columnas (las define la tabla, como en Notion) van en props
  // Además, lo del plan de trabajo: fecha meta, línea base e involucrados ({nombre, area, rol})
  projects: { props: 'obj', position: 'num', fecha_meta: 'date', linea_base_at: 'stamp', miembros: 'arr' },
  // Actividades e hitos del cronograma (plan de trabajo, igual que en la app de gestión):
  // capítulo, duración en días hábiles, precedencias con su tipo (FC/CC/FF/CF y desfase),
  // fechas reales, línea base, entregable y área responsable
  activities: {
    project_id: 'id', section_id: 'id', name: 'str', responsable: 'str', inicio: 'date', fin: 'date', avance: 'pct', hito: 'bool', position: 'num', notas: 'text',
    duracion: 'dur', deps: 'ids', dep_tipos: 'deptipos', real_ini: 'date', real_fin: 'date', base_ini: 'date', base_fin: 'date', entregable: 'str', area: 'str',
  },
  // Capítulos del plan de trabajo (un nivel de subcapítulos con parent_id)
  sections: { project_id: 'id', name: 'str', position: 'num', parent_id: 'id', enabled: 'bool' },
  // Caso de negocio (uno por proyecto)
  cases: {
    project_id: 'id', estado: 'str', sponsor: 'str', fecha_comite: 'date',
    problema: 'text', objetivo: 'text', alcance: 'text', fuera_alcance: 'text', beneficios_cual: 'text',
    riesgos: 'text', supuestos: 'text', recomendacion: 'text',
    tasa: 'num', anios: 'num', anio_inicio: 'num', moneda: 'str', flujos: 'arr', escenarios: 'obj', captado: 'arr',
  },
  // Sesiones de comité (agenda)
  sessions: {
    comite_id: 'id', titulo: 'str', fecha: 'date', hora_ini: 'time', hora_fin: 'time', estado: 'str',
    lugar: 'str', enlace: 'str', proyectos: 'ids', temas: 'text', asistentes: 'text', decisiones: 'text', compromisos: 'arr',
  },
  // Tipos de comité
  committees: { name: 'str', color: 'str', frecuencia: 'str', descripcion: 'text', integrantes: 'text' },
};
const REQUIRED = { activities: ['project_id'], sections: ['project_id', 'name'], cases: ['project_id'], sessions: ['fecha'], committees: ['name'] };

function cleanDoc(coll, data, partial) {
  const schema = SCHEMAS[coll];
  if (!schema) bad('Colección desconocida');
  if (!data || typeof data !== 'object' || Array.isArray(data)) bad('Datos inválidos');
  const out = {};
  for (const [k, type] of Object.entries(schema)) {
    if (k in data) out[k] = T[type](data[k]);
  }
  if (!partial) for (const k of REQUIRED[coll] || []) if (out[k] == null || out[k] === '') bad(`Falta ${k}`);
  if (JSON.stringify(out).length > 400 * 1024) bad('El registro es demasiado grande');
  return out;
}

// Definición de columnas de la tabla de proyectos
const COL_TYPES = ['title', 'text', 'select', 'multi', 'people', 'number', 'date', 'check', 'url'];
function cleanColumns(columns) {
  if (!Array.isArray(columns)) bad('columns debe ser una lista');
  const seen = new Set();
  const out = columns.slice(0, 80).map(c => {
    if (!c || typeof c.id !== 'string' || !c.id.trim() || c.id.length > 64) bad('Cada columna necesita un id');
    if (seen.has(c.id)) bad(`Columna repetida: ${c.id}`);
    seen.add(c.id);
    const col = { id: c.id, name: String(c.name || 'Columna').slice(0, 120), type: COL_TYPES.includes(c.type) ? c.type : 'text', width: Math.min(1200, Math.max(60, Number(c.width) || 180)) };
    if (c.hidden) col.hidden = true;
    if (c.log) col.log = true;
    if (Array.isArray(c.options)) col.options = c.options.filter(o => o && typeof o.name === 'string' && o.name.trim()).slice(0, 300)
      .map(o => ({ name: o.name.trim().slice(0, 120), color: String(o.color || 'gris').slice(0, 20) }));
    return col;
  });
  if (out.filter(c => c.type === 'title').length !== 1) bad('Debe haber exactamente una columna de tipo título');
  return out;
}

module.exports = { cleanDoc, cleanColumns, cleanAny, ValidationError, SCHEMAS };
