// ============================================================
// PORTAFOLIO · servidor
// Sirve la aplicación (carpeta public/) y la API (/api/...).
// Sin frameworks: solo Node. Arranca con «npm start».
// ============================================================
require('./lib/env');
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const auth = require('./lib/auth');
const { cleanDoc, cleanColumns, cleanDireccion, cleanPropuesta, ValidationError } = require('./lib/validate');
const defaults = require('./lib/defaults');
const Fases = require('./public/js/fases');
const exporter = require('./lib/export');
const lake = require('./lib/lake');
let store = null; // se crea al arrancar (prepare)

const PUBLIC = path.join(__dirname, 'public');
const COLLS = ['projects', 'activities', 'sections', 'cases', 'sessions', 'committees'];
const PROD = process.env.NODE_ENV === 'production';
const newId = () => crypto.randomUUID();
const DUMMY_HASH = auth.hashPassword(crypto.randomBytes(12).toString('hex'));
const now = () => new Date().toISOString();

class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }

// ------------------------------------------------------------
// Utilidades HTTP
// ------------------------------------------------------------
function send(res, status, body, headers = {}) {
  const isText = typeof body === 'string' || Buffer.isBuffer(body);
  res.writeHead(status, { 'Content-Type': isText ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(isText ? body : JSON.stringify(body));
}
// El cuerpo debe ser un objeto JSON: «null», un número o un texto suelto no tienen campos que leer
function comoObjeto(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new HttpError(400, 'JSON inválido: se esperaba un objeto');
  return v;
}
function readBody(req) {
  // En Vercel el cuerpo ya viene leído en req.body (y el flujo ya se consumió:
  // leerlo otra vez dejaría la petición colgada)
  if ('body' in req || req.readableEnded) {
    let pre;
    try { pre = req.body; } catch { return Promise.reject(new HttpError(400, 'JSON inválido')); }
    if (pre === undefined || pre === null || pre === '') return Promise.resolve({});
    try {
      if (Buffer.isBuffer(pre)) pre = pre.toString('utf8');
      return Promise.resolve(comoObjeto(typeof pre === 'string' ? (pre ? JSON.parse(pre) : {}) : (pre || {})));
    } catch (e) { return Promise.reject(e instanceof HttpError ? e : new HttpError(400, 'JSON inválido')); }
  }
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > 8 * 1024 * 1024) { reject(new HttpError(413, 'Demasiado grande')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try { resolve(comoObjeto(JSON.parse(Buffer.concat(chunks).toString('utf8')))); } catch (e) { reject(e instanceof HttpError ? e : new HttpError(400, 'JSON inválido')); }
    });
    req.on('error', reject);
  });
}
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
  'X-Frame-Options': 'SAMEORIGIN',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'self'",
};
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json' };
function serveStatic(req, res, pathname) {
  let rel;
  try { rel = decodeURIComponent(pathname); } catch { return send(res, 400, 'Dirección inválida'); }
  if (rel === '/' || !path.extname(rel)) rel = '/index.html';
  const file = path.normalize(path.join(PUBLIC, rel));
  if (!file.startsWith(PUBLIC + path.sep)) return send(res, 403, 'Prohibido');
  fs.readFile(file, (err, data) => {
    if (err) return send(res, 404, 'No encontrado');
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': rel === '/index.html' ? 'no-cache' : 'public, max-age=300', ...SECURITY_HEADERS });
    res.end(data);
  });
}

// ------------------------------------------------------------
// Rutas
// ------------------------------------------------------------
const routes = [];
// nivel: 'publico' | 'usuario' | 'editor' | 'admin' | 'export'
function route(method, pattern, nivel, handler) {
  const keys = [];
  // «:nombre» captura un tramo; «:nombre(a|b)» solo acepta esas opciones
  const rx = new RegExp('^' + pattern.replace(/:(\w+)(\([^)]*\))?/g, (_, k, alt) => { keys.push(k); return alt || '([^/]+)'; }) + '$');
  routes.push({ method, rx, keys, nivel, handler });
}

async function currentUser(req) {
  const p = auth.readToken(auth.parseCookies(req)[auth.COOKIE]);
  if (!p) return null;
  const u = await store.get('users', p.u);
  if (!u || u.active === false || (u.sv || 0) !== p.v) return null;
  return u;
}
function canAccess(nivel, user) {
  if (nivel === 'publico') return true;
  if (!user) return false;
  if (nivel === 'usuario') return true;
  if (nivel === 'editor') return user.role === 'admin' || user.role === 'editor';
  if (nivel === 'admin') return user.role === 'admin';
  return false;
}

// Historial de cambios (quién hizo qué)
async function log(user, accion, coll, id, nombre, campos) {
  try {
    await store.insert('historial', { id: newId(), created_at: now(), user_id: user.id, user_name: user.name, accion, coll, record_id: id, nombre: String(nombre || '').slice(0, 200), campos: campos || [] });
  } catch (e) { console.error('historial', e.message); }
}
async function labelOf(coll, doc) {
  if (!doc) return '';
  if (coll === 'projects') { const t = (await titleColumn()).id; return (doc.props || {})[t] || 'Proyecto sin nombre'; }
  if (coll === 'cases') { const p = await store.get('projects', doc.project_id); return 'Caso de negocio · ' + (p ? await labelOf('projects', p) : ''); }
  if (coll === 'sessions') {
    const c = doc.comite_id ? await store.get('committees', doc.comite_id) : null;
    return `${doc.titulo || (c ? c.name : 'Sesión de comité')} · ${doc.fecha}`;
  }
  return doc.name || '';
}
async function projectColumns() { return (await store.getConfig('project_columns')) || defaults.projectColumns(); }
async function titleColumn() { return (await projectColumns()).find(c => c.type === 'title') || { id: 'proyecto' }; }

// ---------- Autenticación ----------
route('GET', '/api/auth/estado', 'publico', async (req, ctx) => {
  const users = await store.list('users');
  return { setup: users.length === 0, needCode: users.length === 0 && (PROD || !!process.env.SETUP_CODE), user: auth.publicUser(ctx.user), org: process.env.ORG_NAME || 'Amarilo', demo: process.env.MODO_DEMO === 'true' };
});

route('POST', '/api/auth/setup', 'publico', async (req, ctx) => {
  if ((await store.list('users')).length) throw new HttpError(409, 'Ya hay usuarios creados');
  const b = ctx.body;
  if (PROD || process.env.SETUP_CODE) {
    if (!process.env.SETUP_CODE) throw new HttpError(403, 'Define SETUP_CODE (o ADMIN_EMAIL y ADMIN_PASSWORD) en la configuración del servidor');
    const a = Buffer.from(String(b.code || '')), e = Buffer.from(process.env.SETUP_CODE);
    if (a.length !== e.length || !crypto.timingSafeEqual(a, e)) throw new HttpError(403, 'Código de instalación incorrecto');
  }
  const user = await createUser({ name: b.name, email: b.email, password: b.password, role: 'admin' }, false);
  ctx.setCookie = auth.sessionCookie(req, auth.makeToken(user));
  return { user: auth.publicUser(user) };
});

route('POST', '/api/auth/login', 'publico', async (req, ctx) => {
  const email = String(ctx.body.email || '').trim().toLowerCase().slice(0, 254);
  // Freno por correo + IP, y un tope más alto por correo (ver lib/auth.js)
  const ip = auth.ipDe(req);
  if (auth.loginBloqueado(email, ip)) throw new HttpError(429, 'Demasiados intentos. Espera 15 minutos.');
  const user = (await store.list('users')).find(u => u.email === email);
  // Si el correo no existe se verifica igual contra una clave falsa: así el tiempo de respuesta no lo delata
  const okPass = auth.verifyPassword(ctx.body.password || '', user ? user.pass : DUMMY_HASH);
  if (!user || user.active === false || !okPass) {
    auth.loginFallido(email, ip);
    throw new HttpError(401, 'Correo o contraseña incorrectos');
  }
  auth.loginOk(email, ip);
  const u = await store.update('users', user.id, d => ({ ...d, last_login: now() }));
  ctx.setCookie = auth.sessionCookie(req, auth.makeToken(u));
  return { user: auth.publicUser(u) };
});

route('POST', '/api/auth/logout', 'publico', async (req, ctx) => {
  ctx.setCookie = auth.clearCookie(req);
  // Cerrar sesión invalida las sesiones abiertas de ese usuario (una cookie copiada deja de servir).
  // En la demostración sin base no: cada copia de la app tiene su propio usuario y la cerraría a medias.
  if (ctx.user && store.kind !== 'memoria') await store.update('users', ctx.user.id, d => ({ ...d, sv: (d.sv || 0) + 1 }));
  return { ok: true };
});

route('POST', '/api/auth/clave', 'usuario', async (req, ctx) => {
  const { actual, nueva } = ctx.body;
  if (!auth.verifyPassword(actual || '', ctx.user.pass)) throw new HttpError(400, 'La contraseña actual no coincide');
  const err = auth.checkPasswordRules(nueva); if (err) throw new HttpError(400, err);
  const u = await store.update('users', ctx.user.id, d => ({ ...d, pass: auth.hashPassword(nueva), must_change: false, sv: (d.sv || 0) + 1, updated_at: now() }));
  ctx.setCookie = auth.sessionCookie(req, auth.makeToken(u)); // cierra las otras sesiones, mantiene esta
  return { user: auth.publicUser(u) };
});

// ---------- Usuarios (solo administradores) ----------
async function createUser(b, mustChange, idFijo) {
  const email = String(b.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'Correo inválido');
  const name = String(b.name || '').trim().slice(0, 120);
  if (!name) throw new HttpError(400, 'Falta el nombre');
  if (!auth.ROLES.includes(b.role)) throw new HttpError(400, 'Rol inválido');
  const err = auth.checkPasswordRules(b.password); if (err) throw new HttpError(400, err);
  if ((await store.list('users')).some(u => u.email === email)) throw new HttpError(409, 'Ya existe un usuario con ese correo');
  return store.insert('users', { id: idFijo || newId(), email, name, role: b.role, active: true, pass: auth.hashPassword(b.password), must_change: !!mustChange, sv: 0, created_at: now(), updated_at: now() });
}
route('GET', '/api/usuarios', 'admin', async () => (await store.list('users')).map(auth.publicUser));
route('POST', '/api/usuarios', 'admin', async (req, ctx) => {
  const u = await createUser(ctx.body, true);
  await log(ctx.user, 'creó', 'users', u.id, `${u.name} (${u.role})`);
  return { user: auth.publicUser(u) };
});
route('PATCH', '/api/usuarios/:id', 'admin', async (req, ctx) => {
  const b = ctx.body, id = ctx.params.id;
  const users = await store.list('users');
  const cur = users.find(u => u.id === id); if (!cur) throw new HttpError(404, 'Usuario no encontrado');
  if (b.role !== undefined && !auth.ROLES.includes(b.role)) throw new HttpError(400, 'Rol inválido');
  const quedaAdmin = users.some(u => u.id !== id && u.role === 'admin' && u.active !== false) ||
    ((b.role ?? cur.role) === 'admin' && (b.active ?? cur.active) !== false);
  if (!quedaAdmin) throw new HttpError(400, 'Debe quedar al menos un administrador activo');
  if (b.password !== undefined) { const err = auth.checkPasswordRules(b.password); if (err) throw new HttpError(400, err); }
  const u = await store.update('users', id, d => {
    const n = { ...d, updated_at: now() };
    if (b.name !== undefined) n.name = String(b.name).trim().slice(0, 120) || d.name;
    if (b.role !== undefined) n.role = b.role;
    if (b.active !== undefined) { n.active = !!b.active; if (!n.active) n.sv = (d.sv || 0) + 1; }
    if (b.password !== undefined) { n.pass = auth.hashPassword(b.password); n.must_change = true; n.sv = (d.sv || 0) + 1; }
    return n;
  });
  await log(ctx.user, 'editó', 'users', id, u.name, Object.keys(b).map(k => (k === 'password' ? 'contraseña' : k)));
  return { user: auth.publicUser(u) };
});
route('DELETE', '/api/usuarios/:id', 'admin', async (req, ctx) => {
  const id = ctx.params.id;
  if (id === ctx.user.id) throw new HttpError(400, 'No puedes eliminar tu propio usuario');
  const users = await store.list('users');
  const cur = users.find(u => u.id === id); if (!cur) throw new HttpError(404, 'Usuario no encontrado');
  if (cur.role === 'admin' && !users.some(u => u.id !== id && u.role === 'admin' && u.active !== false)) throw new HttpError(400, 'Debe quedar al menos un administrador activo');
  await store.remove('users', id);
  await log(ctx.user, 'eliminó', 'users', id, cur.name);
  return { ok: true };
});

// ---------- Estado completo (lo que la app necesita para pintar) ----------
route('GET', '/api/estado', 'usuario', async (req, ctx) => {
  const [projects, activities, sections, cases, sessions, committees, users] = await Promise.all(['projects', 'activities', 'sections', 'cases', 'sessions', 'committees', 'users'].map(c => store.list(c)));
  return {
    me: auth.publicUser(ctx.user),
    org: process.env.ORG_NAME || 'Amarilo',
    almacenamiento: store.kind,
    demo: process.env.MODO_DEMO === 'true',
    columns: await projectColumns(),
    tablero: (await store.getConfig('tablero')) || { income_unidad: 1e6 },
    direccion: (await store.getConfig('direccion')) || null,
    projects, activities, sections, cases, sessions, committees,
    people: users.filter(u => u.active !== false).map(u => ({ id: u.id, name: u.name, email: u.email })),
  };
});
route('GET', '/api/historial', 'usuario', async () => store.recent('historial', 200));

// ---------- Configuración de columnas de la tabla de proyectos ----------
route('PUT', '/api/config/columnas', 'editor', async (req, ctx) => {
  const cols = cleanColumns(ctx.body.columns);
  await store.setConfig('project_columns', cols);
  return { columns: cols };
});

// ---------- Ajustes del tablero (unidad del Income) ----------
route('PUT', '/api/config/tablero', 'editor', async (req, ctx) => {
  const u = Number(ctx.body.income_unidad);
  if (![1, 1e3, 1e6].includes(u)) throw new HttpError(400, 'Unidad inválida');
  const v = { income_unidad: u }; await store.setConfig('tablero', v); return v;
});

// ---------- «Qué es la Dirección» y propuestas de necesidades (vista mejorada) ----------
route('PUT', '/api/config/direccion', 'admin', async (req, ctx) => {
  const v = cleanDireccion(ctx.body); await store.setConfig('direccion', v); return v;
});
// Cualquier persona con acceso puede proponer una necesidad: entra como idea al portafolio
route('POST', '/api/ideas', 'usuario', async (req, ctx) => {
  const d = cleanPropuesta(ctx.body);
  const cols = await projectColumns();
  const t = cols.find(c => c.type === 'title') || { id: 'proyecto' };
  const ec = cols.find(c => c.type === 'select' && /estado|fase/i.test(c.name));
  // Una propuesta entra en Fase 1 (o en el estado «Idea» si la tabla aún usa los antiguos)
  const idea = ec && ((ec.options || []).find(o => Fases.clasificar(o.name) === 1 && /^fase/i.test(o.name)) || (ec.options || []).find(o => /idea|propuesta/i.test(o.name)));
  const traz = cols.find(c => c.log) || cols.find(c => c.id === 'trazabilidad');
  const props = { [t.id]: d.titulo };
  if (ec && idea) props[ec.id] = idea.name;
  if (traz) props[traz.id] = `${fechaCorta()}: Propuesta por ${ctx.user.name}${d.area ? ' (' + d.area + ')' : ''} · urgencia ${d.urgencia}. ${d.problema}${d.beneficio ? ' Beneficio esperado: ' + d.beneficio : ''}`;
  const all = await store.list('projects');
  const doc = { id: newId(), props, position: all.reduce((m, x) => Math.max(m, x.position ?? 0), -1) + 1, frase: d.beneficio.slice(0, 500), area: d.area,
    origen: { tipo: 'propuesta', nombre: ctx.user.name, correo: ctx.user.email, urgencia: d.urgencia, problema: d.problema, fecha: now() },
    created_at: now(), updated_at: now(), updated_by: ctx.user.id, updated_by_name: ctx.user.name };
  await store.insert('projects', doc);
  await log(ctx.user, 'propuso', 'projects', doc.id, d.titulo);
  return doc;
});
function fechaCorta(d = new Date()) {
  const M = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
  const l = new Date(d.toLocaleString('en-US', { timeZone: process.env.ZONA_HORARIA || 'America/Bogota' }));
  return `${l.getDate()} ${M[l.getMonth()]}`;
}

// ---------- Exportación para el data lake ----------
route('GET', '/api/export', 'export', async () => ({ tablas: exporter.TABLAS, formatos: ['json', 'csv'] }));
async function exportData() {
  const [projects, activities, sections, cases, sessions, committees] = await Promise.all(COLLS.map(c => store.list(c)));
  return { columns: await projectColumns(), projects, activities, sections, cases, sessions, committees };
}
route('GET', '/api/export/:tabla', 'export', async (req, ctx) => {
  if (!exporter.TABLAS.includes(ctx.params.tabla)) throw new HttpError(404, 'Tabla desconocida');
  const rows = exporter.build(ctx.params.tabla, await exportData());
  if (ctx.query.get('format') === 'csv') return { __raw: exporter.toCSV(rows, exporter.headersOf(ctx.params.tabla, await exportData())), type: 'text/csv; charset=utf-8', file: `${ctx.params.tabla}.csv` };
  return rows;
});

// ---------- Envío al data lake de Azure ----------
async function enviarAlLago(origen, user) {
  try {
    const r = await lake.enviar(await exportData());
    await store.setConfig('lake_ultimo', { ...r, ok: true, origen, por: user ? user.name : 'automático' });
    return r;
  } catch (e) {
    await store.setConfig('lake_ultimo', { at: now(), fecha: lake.localNow().fecha, ok: false, error: e.message, origen, por: user ? user.name : 'automático' });
    throw e;
  }
}
route('GET', '/api/lake', 'admin', async () => ({ ...lake.describe(), ultimo: await store.getConfig('lake_ultimo') }));
route('POST', '/api/lake/enviar', 'admin', async (req, ctx) => {
  if (!lake.configured()) throw new HttpError(400, 'El envío al data lake no está configurado (falta LAKE_ACCOUNT en la configuración del servidor)');
  try { return await enviarAlLago('manual', ctx.user); }
  catch (e) { throw new HttpError(502, 'No se pudo escribir en el data lake: ' + e.message); }
});

// ---------- Excel del caso de negocio ----------
route('POST', '/api/excel/leer', 'editor', async (req, ctx) => {
  const b64 = String(ctx.body.archivo || '');
  if (!b64) throw new HttpError(400, 'Falta el archivo');
  const buf = Buffer.from(b64, 'base64');
  if (buf.length > 4 * 1024 * 1024) throw new HttpError(413, 'El archivo pasa de 4 MB');
  return require('./lib/excel').leer(buf);
});
route('GET', '/api/cases/:id/excel', 'usuario', async (req, ctx) => {
  const excel = require('./lib/excel');
  if (ctx.params.id === 'plantilla') return { __raw: Buffer.from(await excel.exportar({}, '', true)), type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', file: 'plantilla-caso-de-negocio.xlsx' };
  const caso = await store.get('cases', ctx.params.id); if (!caso) throw new HttpError(404, 'Caso no encontrado');
  const p = await store.get('projects', caso.project_id);
  const nombre = p ? (p.props || {})[(await titleColumn()).id] || 'Proyecto' : 'Proyecto';
  const file = `caso-${nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase().slice(0, 60) || 'proyecto'}.xlsx`;
  return { __raw: Buffer.from(await excel.exportar(caso, nombre, false)), type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', file };
});

// ---------- Agenda: archivo .ics para Outlook ----------
route('GET', '/api/sesiones/:id/ics', 'usuario', async (req, ctx) => {
  const s = await store.get('sessions', ctx.params.id); if (!s) throw new HttpError(404, 'Sesión no encontrada');
  const c = s.comite_id ? await store.get('committees', s.comite_id) : null;
  const t = (await titleColumn()).id;
  const names = [];
  for (const pid of s.proyectos || []) { const p = await store.get('projects', pid); if (p) names.push((p.props || {})[t] || ''); }
  return { __raw: exporter.toICS(s, c && c.name, names, process.env.TZ_OFFSET), type: 'text/calendar; charset=utf-8', file: `comite-${s.fecha}.ics` };
});

// ---------- Demostración: volver a los datos de ejemplo ----------
route('POST', '/api/demo/cargar', 'admin', async (req, ctx) => {
  if (process.env.MODO_DEMO !== 'true') throw new HttpError(403, 'Solo en la copia de demostración (MODO_DEMO=true)');
  const r = await require('./lib/demo').cargar(store);
  await log(ctx.user, 'restableció', 'projects', '', 'Datos de ejemplo', []);
  return r;
});

// ---------- Plan de trabajo: varios cambios de una vez ----------
// El navegador calcula las fechas en cascada (mismas reglas de la app de gestión:
// días hábiles de Colombia, precedencias FC/CC/FF/CF con desfase) y manda solo lo
// que cambió: actividades y capítulos nuevos (con su id), editados o borrados.
// Así un arrastre que corre 20 actividades se guarda en una sola petición, y
// «Deshacer» puede devolver incluso filas borradas con su mismo id.
const ID_RX = /^[A-Za-z0-9_-]{8,64}$/;
route('POST', '/api/plan/:pid', 'editor', async (req, ctx) => {
  const pid = ctx.params.pid, b = ctx.body || {};
  const proyecto = await store.get('projects', pid);
  if (!proyecto) throw new HttpError(404, 'El proyecto no existe');
  const lista = (v, n) => { const l = Array.isArray(v) ? v : []; if (l.length > n) throw new HttpError(413, 'Demasiados cambios de una vez'); return l; };
  const cambios = { sections: b.sections || {}, activities: b.activities || {} };
  // 1) Se revisa todo antes de escribir: si un registro no sirve, no se guarda nada a medias
  const ups = [], rems = [];
  for (const coll of ['sections', 'activities']) {
    for (const raw of lista(cambios[coll].upsert, 2000)) {
      const id = String((raw && raw.id) || '');
      if (!ID_RX.test(id)) throw new HttpError(400, 'Id inválido');
      const data = cleanDoc(coll, raw, true);
      delete data.project_id;
      const cur = await store.get(coll, id);
      if (cur && cur.project_id !== pid) throw new HttpError(400, 'El registro es de otro proyecto');
      ups.push({ coll, id, data, cur });
    }
  }
  for (const coll of ['activities', 'sections']) {
    for (const id of lista(cambios[coll].remove, 2000)) {
      const cur = await store.get(coll, String(id));
      if (!cur) continue;
      if (cur.project_id !== pid) throw new HttpError(400, 'El registro es de otro proyecto');
      rems.push({ coll, cur });
    }
  }
  // Comentarios de actividades borradas: se guardan aparte para que «Deshacer» los devuelva
  const papelera = Object.assign(Object.create(null), (await store.getConfig('papelera_comentarios')) || {});
  let papeleraCambio = false;
  // 2) Se aplica. Primero capítulos (las actividades nuevas pueden caer en un capítulo nuevo); al final, lo borrado
  let n = 0;
  for (const { coll, id, data, cur } of ups) {
    if (cur) {
      if (!Object.keys(data).length) continue;
      const doc = await store.update(coll, id, c => ({ ...c, ...data, updated_at: now(), updated_by: ctx.user.id, updated_by_name: ctx.user.name }));
      if (b.registrar !== false) await log(ctx.user, 'editó', coll, id, await labelOf(coll, doc), Object.keys(data));
    } else {
      const doc = { name: coll === 'sections' ? 'Capítulo' : 'Nueva actividad', ...data, project_id: pid, id, created_at: now(), updated_at: now(), updated_by: ctx.user.id, updated_by_name: ctx.user.name };
      if (coll === 'activities' && papelera[id]) { doc.comentarios = papelera[id].comentarios; delete papelera[id]; papeleraCambio = true; }
      await store.insert(coll, doc);
      if (b.registrar !== false) await log(ctx.user, 'creó', coll, id, await labelOf(coll, doc));
    }
    n++;
  }
  for (const { coll, cur } of rems) {
    if (coll === 'activities' && (cur.comentarios || []).length) { papelera[cur.id] = { comentarios: cur.comentarios, at: now() }; papeleraCambio = true; }
    await store.remove(coll, cur.id);
    // Un borrado siempre queda en el historial, aunque el cambio venga marcado como automático
    await log(ctx.user, 'eliminó', coll, cur.id, await labelOf(coll, cur));
    n++;
  }
  if (papeleraCambio) {
    const ids = Object.keys(papelera).sort((x, y) => String(papelera[y].at).localeCompare(String(papelera[x].at)));
    for (const id of ids.slice(100)) delete papelera[id]; // se guardan los 100 más recientes
    await store.setConfig('papelera_comentarios', papelera);
  }
  const [activities, sections] = await Promise.all(['activities', 'sections'].map(c => store.list(c)));
  return { cambios: n, activities: activities.filter(a => a.project_id === pid), sections: sections.filter(x => x.project_id === pid) };
});

// ---------- Traer un cronograma desde la app de gestión (enlace compartido) ----------
// Solo enlaces de los sitios permitidos (GESTION_HOSTS; por defecto gestionamarilo.vercel.app):
// el servidor no sale a cualquier dirección que alguien escriba.
route('POST', '/api/importar/gestion', 'editor', async (req, ctx) => {
  let u; try { u = new URL(String(ctx.body.url || '').trim()); } catch { throw new HttpError(400, 'Pega el enlace completo, p. ej. https://gestionamarilo.vercel.app/share/…'); }
  const hosts = String(process.env.GESTION_HOSTS || 'gestionamarilo.vercel.app').split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
  const m = /^\/share\/([A-Za-z0-9_-]{8,128})\/?$/.exec(u.pathname);
  if (u.protocol !== 'https:' || !hosts.includes(u.hostname.toLowerCase()) || !m) throw new HttpError(400, `El enlace debe ser un cronograma compartido de ${hosts.join(' o ')} (…/share/código)`);
  let r;
  try { r = await fetch(`https://${u.hostname}/api/share/${m[1]}`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(15000) }); }
  catch (e) { throw new HttpError(502, 'No se pudo leer el enlace: ' + e.message); }
  if (r.status === 404) throw new HttpError(404, 'El enlace no existe o fue revocado en la app de gestión');
  if (!r.ok) throw new HttpError(502, `La app de gestión respondió ${r.status}`);
  const d = await r.json();
  if (!d || !Array.isArray(d.activities) || !Array.isArray(d.sections)) throw new HttpError(502, 'El enlace no trae un cronograma');
  const p = d.project || {};
  return { project: { name: p.name || '', fechaMeta: p.fechaMeta || null, lineaBaseAt: p.lineaBaseAt || null }, sections: d.sections, activities: d.activities, miembros: Array.isArray(d.miembros) ? d.miembros : [] };
});

// ---------- Comentarios de una actividad (la nubecita del plan) ----------
route('POST', '/api/activities/:id/comentarios', 'editor', async (req, ctx) => {
  const texto = String(ctx.body.texto || '').trim().slice(0, 4000);
  if (!texto) throw new HttpError(400, 'Escribe el comentario');
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(ctx.body.fecha || '') ? ctx.body.fecha : null;
  const hoy = now();
  // Con fecha elegida (distinta de hoy) se guarda al mediodía, sin hora
  const createdAt = fecha && fecha !== hoy.slice(0, 10) ? `${fecha}T17:00:00.000Z` : hoy;
  const nota = { id: newId(), texto, createdAt, autor: ctx.user.name, autor_id: ctx.user.id };
  const doc = await store.update('activities', ctx.params.id, c => ({ ...c, comentarios: [...(c.comentarios || []), nota].slice(-500) }));
  if (!doc) throw new HttpError(404, 'Actividad no encontrada');
  await log(ctx.user, 'comentó', 'activities', doc.id, doc.name, []);
  return { nota, activity: doc };
});
route('DELETE', '/api/activities/:id/comentarios/:cid', 'editor', async (req, ctx) => {
  let ok = false;
  const doc = await store.update('activities', ctx.params.id, c => {
    const l = c.comentarios || [], x = l.find(n => n.id === ctx.params.cid);
    if (!x) return c;
    if (x.autor_id && x.autor_id !== ctx.user.id && ctx.user.role !== 'admin') throw new HttpError(403, 'Solo quien lo escribió (o un administrador) puede borrarlo');
    ok = true;
    return { ...c, comentarios: l.filter(n => n.id !== ctx.params.cid) };
  });
  if (!doc) throw new HttpError(404, 'Actividad no encontrada');
  return { ok, activity: doc };
});

// ---------- CRUD genérico de colecciones ----------
const COLL_RX = `:coll(${COLLS.join('|')})`;
route('POST', `/api/${COLL_RX}`, 'editor', async (req, ctx) => {
  const coll = ctx.params.coll;
  const data = cleanDoc(coll, ctx.body, false);
  if (data.project_id && !(await store.get('projects', data.project_id))) throw new HttpError(400, 'El proyecto no existe');
  if (coll === 'cases') { // un caso por proyecto
    const ya = (await store.list('cases')).find(c => c.project_id === data.project_id);
    if (ya) return ya;
  }
  if (coll === 'projects' || coll === 'activities' || coll === 'sections') {
    const all = await store.list(coll);
    const same = coll === 'projects' ? all : all.filter(a => a.project_id === data.project_id);
    if (data.position == null) data.position = same.reduce((m, x) => Math.max(m, x.position ?? 0), -1) + 1;
  }
  // El caso usa un id fijo por proyecto: si llegan dos creaciones a la vez, la base rechaza la segunda
  const doc = { ...data, id: coll === 'cases' ? 'caso-' + data.project_id : newId(), created_at: now(), updated_at: now(), updated_by: ctx.user.id, updated_by_name: ctx.user.name };
  if (coll === 'cases' && (await store.get('cases', doc.id))) return store.get('cases', doc.id);
  try { await store.insert(coll, doc); }
  catch (e) { const ya = coll === 'cases' && (await store.get('cases', doc.id)); if (ya) return ya; throw e; }
  await log(ctx.user, 'creó', coll, doc.id, await labelOf(coll, doc));
  return doc;
});
route('PATCH', `/api/${COLL_RX}/:id`, 'editor', async (req, ctx) => {
  const coll = ctx.params.coll, id = ctx.params.id;
  const patch = cleanDoc(coll, ctx.body, true);
  delete patch.project_id; // un registro no cambia de proyecto
  let cols = null, ec = null, traz = null;
  if (coll === 'projects' && patch.props) { cols = await projectColumns(); ec = cols.find(c => c.type === 'select' && /estado|fase/i.test(c.name)); traz = cols.find(c => c.log) || cols.find(c => c.id === 'trazabilidad'); }
  const doc = await store.update(coll, id, cur => {
    const next = { ...cur, ...patch, updated_at: now(), updated_by: ctx.user.id, updated_by_name: ctx.user.name };
    if (patch.props) next.props = { ...(cur.props || {}), ...patch.props }; // se mezclan columna por columna
    // Trazabilidad automática: cada cambio de estado deja su entrada en la bitácora
    if (ec && traz && ec.id in patch.props && (cur.props || {})[ec.id] !== patch.props[ec.id] && !(traz.id in patch.props)) {
      const linea = `${fechaCorta()}: Estado ${(cur.props || {})[ec.id] || 'sin estado'} → ${patch.props[ec.id] || 'sin estado'} (${ctx.user.name})`;
      const prev = String(next.props[traz.id] || '');
      next.props[traz.id] = (linea + (prev ? '\n' + prev : '')).slice(0, 20000);
    }
    return next;
  });
  if (!doc) throw new HttpError(404, 'No encontrado');
  const campos = Object.keys(patch.props ? { ...patch, ...patch.props } : patch).filter(k => k !== 'props');
  await log(ctx.user, 'editó', coll, id, await labelOf(coll, doc), campos);
  return doc;
});
route('DELETE', `/api/${COLL_RX}/:id`, 'editor', async (req, ctx) => {
  const coll = ctx.params.coll, id = ctx.params.id;
  const cur = await store.get(coll, id); if (!cur) throw new HttpError(404, 'No encontrado');
  const nombre = await labelOf(coll, cur);
  if (coll === 'projects') { // borra en cascada lo que cuelga del proyecto
    for (const a of (await store.list('activities')).filter(a => a.project_id === id)) await store.remove('activities', a.id);
    for (const x of (await store.list('sections')).filter(x => x.project_id === id)) await store.remove('sections', x.id);
    for (const c of (await store.list('cases')).filter(c => c.project_id === id)) await store.remove('cases', c.id);
    for (const s of (await store.list('sessions')).filter(s => (s.proyectos || []).includes(id))) await store.update('sessions', s.id, d => ({ ...d, proyectos: d.proyectos.filter(p => p !== id) }));
  }
  if (coll === 'sections') { // sus actividades y subcapítulos se van con él
    for (const x of (await store.list('sections')).filter(x => x.parent_id === id)) {
      for (const a of (await store.list('activities')).filter(a => a.section_id === x.id)) await store.remove('activities', a.id);
      await store.remove('sections', x.id);
    }
    for (const a of (await store.list('activities')).filter(a => a.section_id === id)) await store.remove('activities', a.id);
  }
  if (coll === 'committees') for (const s of (await store.list('sessions')).filter(s => s.comite_id === id)) await store.update('sessions', s.id, d => ({ ...d, comite_id: null }));
  await store.remove(coll, id);
  await log(ctx.user, 'eliminó', coll, id, nombre);
  return { ok: true };
});

// ------------------------------------------------------------
// Servidor
// ------------------------------------------------------------
async function handle(req, res) {
  const url = new URL(req.url, 'http://x');
  // En Vercel todas las rutas /api/* llegan a una sola función con ?__path=
  const viaPath = url.searchParams.get('__path');
  if (viaPath !== null) { url.pathname = '/api/' + viaPath.replace(/^\/+/, ''); url.searchParams.delete('__path'); }
  if (!url.pathname.startsWith('/api/')) return serveStatic(req, res, url.pathname);
  const r = routes.find(x => x.method === req.method && x.rx.test(url.pathname));
  if (!r) return send(res, 404, { error: 'No encontrado' });
  try {
    // Defensa CSRF: las escrituras deben venir de la propia app (encabezado propio + JSON)
    if (req.method !== 'GET' && req.headers['x-portafolio'] !== '1') throw new HttpError(403, 'Solicitud no permitida');
    const m = url.pathname.match(r.rx);
    const params = {};
    try { m.slice(1).forEach((v, i) => { params[r.keys[i]] = decodeURIComponent(v); }); } catch { throw new HttpError(400, 'Dirección inválida'); }
    const ctx = { params, query: url.searchParams, body: req.method === 'GET' ? {} : await readBody(req), user: await currentUser(req) };
    if (r.nivel === 'export') {
      const hdr = String(req.headers.authorization || '');
      const tok = process.env.EXPORT_TOKEN;
      const dado = Buffer.from(hdr.slice(7)), esperado = Buffer.from(tok || '');
      const okToken = tok && hdr.startsWith('Bearer ') && dado.length === esperado.length && crypto.timingSafeEqual(dado, esperado);
      if (!okToken && !(ctx.user && ctx.user.role === 'admin')) throw new HttpError(401, 'Necesitas el token de exportación');
    } else if (!canAccess(r.nivel, ctx.user)) {
      throw new HttpError(ctx.user ? 403 : 401, ctx.user ? 'Tu rol no permite esta acción' : 'Inicia sesión');
    }
    // Contraseña temporal: hasta cambiarla solo puede consultar su estado, cambiarla o salir
    if (ctx.user && ctx.user.must_change && r.nivel !== 'publico' && url.pathname !== '/api/auth/clave') throw new HttpError(403, 'Primero cambia tu contraseña temporal');
    const out = await r.handler(req, ctx);
    const headers = ctx.setCookie ? { 'Set-Cookie': ctx.setCookie } : {};
    if (out && out.__raw !== undefined) return send(res, 200, out.__raw, { ...headers, 'Content-Type': out.type, 'Content-Disposition': `attachment; filename="${out.file}"` });
    send(res, req.method === 'POST' && /^\/api\/(projects|activities|sections|cases|sessions|committees|usuarios)$/.test(url.pathname) ? 201 : 200, out, headers);
  } catch (e) {
    const status = e.status || (e instanceof ValidationError ? 400 : 500);
    if (status >= 500) console.error(e);
    send(res, status, { error: status >= 500 && PROD ? 'Error interno' : e.message });
  }
}

// Arranque: conecta la base, crea la estructura inicial y el primer administrador.
// Se hace una sola vez por proceso (en Vercel, en la primera petición).
let readyPromise = null;
function ready() {
  if (!readyPromise) readyPromise = prepare().catch(e => { readyPromise = null; throw e; });
  return readyPromise;
}
async function prepare() {
  store = require('./lib/store').create();
  await store.init();
  // Clave de sesión: la del entorno o una generada y guardada en la base
  let secret = process.env.SESSION_SECRET;
  const memoria = store.kind === 'memoria';
  // Sin base de datos, cada copia de la app arranca vacía: el administrador y la clave
  // de sesión salen de la configuración para que todas las copias reconozcan la sesión.
  if (memoria && !(process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD)) throw new Error('Para la demostración sin base de datos define las variables ADMIN_EMAIL y ADMIN_PASSWORD');
  if (process.env.ADMIN_PASSWORD) { const malo = auth.checkPasswordRules(process.env.ADMIN_PASSWORD); if (malo) throw new Error(`La variable ADMIN_PASSWORD no sirve: ${malo.charAt(0).toLowerCase() + malo.slice(1)} (por ejemplo: Prueba2026)`); }
  if (!secret && memoria) secret = crypto.createHash('sha256').update(`pf-demo|${process.env.ADMIN_EMAIL}|${process.env.ADMIN_PASSWORD}`).digest('base64');
  if (!secret) {
    secret = await store.getConfig('session_secret');
    if (!secret) { secret = crypto.randomBytes(48).toString('base64'); await store.setConfig('session_secret', secret); }
  }
  auth.setSecret(secret);
  // Estructura inicial (sin datos)
  if (!(await store.getConfig('project_columns'))) await store.setConfig('project_columns', defaults.projectColumns());
  // Migración (una sola vez): columnas de ICE para portafolios creados antes
  if (!(await store.getConfig('migr_ice_v1'))) {
    const cols = await store.getConfig('project_columns');
    const faltan = defaults.iceColumns().filter(c => !cols.some(x => x.id === c.id));
    if (faltan.length) { const i = cols.findIndex(c => c.id === 'income'); cols.splice(i >= 0 ? i + 1 : cols.length, 0, ...faltan); await store.setConfig('project_columns', cols); }
    await store.setConfig('migr_ice_v1', true);
  }
  // Migración (una sola vez): factores del ICE con el método de la Oficina (Income, Confidence, Effort, OS).
  // Las columnas antiguas 1 a 10 se ocultan si nadie las llenó (los datos no se borran).
  if (!(await store.getConfig('migr_ice_v2'))) {
    const cols = await store.getConfig('project_columns');
    const faltan = defaults.iceOficinaColumns().filter(c => !cols.some(x => x.id === c.id));
    if (faltan.length) { const i = cols.findIndex(c => c.id === 'income'); cols.splice(i >= 0 ? i + 1 : cols.length, 0, ...faltan); }
    const ps = await store.list('projects');
    cols.forEach(c => { if (['impacto', 'confianza', 'facilidad'].includes(c.id) && !ps.some(p => (p.props || {})[c.id] != null && (p.props || {})[c.id] !== '')) c.hidden = true; });
    await store.setConfig('project_columns', cols);
    await store.setConfig('migr_ice_v2', true);
  }
  // Migración (una sola vez): de los estados L0…L4 a las 3 fases (y Cerrada, En pausa, Cancelada).
  // Cada iniciativa deja en su trazabilidad de qué estado venía. Un estado que no se reconoce queda igual.
  if (!(await store.getConfig('migr_fases_v1'))) {
    const cols = await store.getConfig('project_columns');
    const ec = cols.find(c => c.type === 'select' && /estado|fase/i.test(c.name));
    if (ec) {
      const traz = cols.find(c => c.log) || cols.find(c => c.id === 'trazabilidad');
      const sinMapear = (ec.options || []).filter(o => !Fases.de(o.name)).map(o => ({ name: o.name, color: o.color }));
      ec.options = Fases.opciones().concat(sinMapear);
      await store.setConfig('project_columns', cols);
      let n = 0;
      for (const p of await store.list('projects')) {
        const antes = (p.props || {})[ec.id], despues = antes ? Fases.mapear(antes) : antes;
        if (!antes || despues === antes) continue;
        await store.update('projects', p.id, d => {
          const props = { ...(d.props || {}), [ec.id]: despues };
          if (traz) props[traz.id] = (`${fechaCorta()}: Estado ${antes} → ${despues} (organización en 3 fases)` + (props[traz.id] ? '\n' + props[traz.id] : '')).slice(0, 20000);
          return { ...d, props };
        });
        n++;
      }
      if (n) await store.insert('historial', { id: newId(), created_at: now(), user_id: 'sistema', user_name: 'Sistema', accion: 'reorganizó', coll: 'projects', record_id: '', nombre: `${n} iniciativas pasaron a las 3 fases`, campos: [ec.id] });
      if (n || sinMapear.length) console.log(`Fases: ${n} iniciativas actualizadas${sinMapear.length ? `; estados sin reconocer: ${sinMapear.map(o => o.name).join(', ')}` : ''}`);
    }
    await store.setConfig('migr_fases_v1', true);
  }
  // Migración (una sola vez): un solo vocabulario. Las columnas que conservan su nombre de fábrica pasan a
  // «Iniciativa», «Fase», «Confianza (%)» y «Esfuerzo (%)». Las que alguien renombró no se tocan.
  if (!(await store.getConfig('migr_terminos_v1'))) {
    const cols = await store.getConfig('project_columns');
    if (Array.isArray(cols)) {
      const NOMBRES = { proyecto: ['Proyecto', 'Iniciativa'], estado: ['Estado', 'Fase'], ice_confianza: ['Confidence (%)', 'Confianza (%)'], ice_esfuerzo: ['Effort (%)', 'Esfuerzo (%)'] };
      let n = 0;
      cols.forEach(c => { const r = NOMBRES[c.id]; if (r && c.name === r[0]) { c.name = r[1]; n++; } });
      if (n) await store.setConfig('project_columns', cols);
    }
    await store.setConfig('migr_terminos_v1', true);
  }
  // Migración (una sola vez): la columna «¿Revisión DGV?» existe siempre, con SI y NO (y los valores que ya traigan las iniciativas).
  // El Portafolio muestra por defecto solo las que están en SI.
  if (!(await store.getConfig('migr_dgv_v1'))) {
    const cols = await store.getConfig('project_columns');
    if (Array.isArray(cols)) {
      let c = cols.find(x => x.id === 'revision_dgv') || cols.find(x => /revisi[oó]n\s*dgv/i.test(x.name || ''));
      if (!c) { c = { id: 'revision_dgv', name: '¿Revisión DGV?', type: 'select', width: 150, options: [], hidden: true }; cols.push(c); }
      if (c.type === 'select') {
        c.options = c.options || [];
        const usados = new Set((await store.list('projects')).map(p => (p.props || {})[c.id]).filter(v => typeof v === 'string' && v.trim()));
        if (![...usados, ...c.options.map(o => o.name)].some(v => /^s[ií]$/i.test(v))) usados.add('SI');
        if (![...usados, ...c.options.map(o => o.name)].some(v => /^no$/i.test(v))) usados.add('NO');
        usados.forEach(v => { if (!c.options.some(o => o.name === v)) c.options.push({ name: v, color: /^s[ií]$/i.test(v) ? 'verde' : 'gris' }); });
      }
      await store.setConfig('project_columns', cols);
    }
    await store.setConfig('migr_dgv_v1', true);
  }
  if (!(await store.getConfig('seeded_committees'))) {
    if (!(await store.list('committees')).length) for (const c of defaults.committees()) await store.insert('committees', { ...c, id: newId(), created_at: now(), updated_at: now() });
    await store.setConfig('seeded_committees', true);
  }
  // Primer administrador desde variables de entorno
  if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD && !(await store.list('users')).length) {
    const idFijo = store.kind === 'memoria' ? 'admin-' + crypto.createHash('sha256').update(String(process.env.ADMIN_EMAIL).trim().toLowerCase()).digest('hex').slice(0, 24) : null;
    await createUser({ name: process.env.ADMIN_NAME || 'Administrador', email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD, role: 'admin' }, store.kind !== 'memoria', idFijo);
    console.log(`Administrador creado: ${process.env.ADMIN_EMAIL}`);
  }
  // Demostración: la primera vez, con la base vacía, se cargan datos de ejemplo
  if (process.env.MODO_DEMO === 'true' && !(await store.getConfig('demo_cargada')) && !(await store.list('projects')).length) {
    await store.setConfig('demo_cargada', { at: now(), cargando: true });
    await require('./lib/demo').cargar(store);
    console.log('Datos de ejemplo cargados');
  }
}

// Para Vercel (api/index.js) y para cualquier servidor que quiera montarla
async function handler(req, res) {
  try { await ready(); }
  catch (e) { console.error('No arrancó:', e); return send(res, 503, { error: 'La aplicación no pudo arrancar: ' + e.message }); }
  try { await handle(req, res); }
  catch (e) { console.error(e); if (!res.headersSent) send(res, 500, { error: 'Error interno' }); }
}
module.exports = handler;

// Servidor propio (computador, Azure App Service, Docker)
async function main() {
  await ready();
  // Envío nocturno al data lake (una vez al día, a la hora LAKE_HOUR)
  if (lake.configured() && lake.describe().hora != null) {
    setInterval(async () => {
      try {
        const { fecha, hora } = lake.localNow();
        if (hora !== lake.describe().hora) return;
        const u = await store.getConfig('lake_ultimo');
        if (u && u.fecha === fecha && u.origen === 'automático' && u.ok) return;
        const r = await enviarAlLago('automático'); console.log(`Data lake: ${r.archivos.length} tablas enviadas (${r.fecha})`);
      } catch (e) { console.error('Data lake:', e.message); }
    }, 60 * 1000);
  }
  const port = Number(process.env.PORT) || 8080;
  http.createServer(handler)
    .listen(port, () => console.log(`Portafolio en http://localhost:${port} · almacenamiento: ${store.kind}`));
}

if (require.main === module) main().catch(e => { console.error('No arrancó:', e.message); process.exit(1); });
