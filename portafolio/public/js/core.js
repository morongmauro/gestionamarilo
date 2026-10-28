/* ============================================================
   NÚCLEO · estado compartido, API, fechas, formatos, popover,
   panel lateral y editores genéricos. Lo usan todas las secciones.
   ============================================================ */
'use strict';
const App = window.App = {
  S: { me: null, org: '', columns: [], projects: [], activities: [], cases: [], sessions: [], committees: [], people: [] },
  views: {},
};

/* ---------- utilidades ---------- */
App.$ = (s, el) => (el || document).querySelector(s);
App.$$ = (s, el) => Array.from((el || document).querySelectorAll(s));
App.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
App.uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8));
App.initials = n => String(n || '').trim().split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase();
App.canEdit = () => !!App.S.me && App.S.me.role !== 'lector';
App.isAdmin = () => !!App.S.me && App.S.me.role === 'admin';
App.COLORS = ['gris', 'rojo', 'naranja', 'amarillo', 'verde', 'azul', 'morado', 'rosa', 'cafe'];
App.store = {
  get(k, def) { try { const v = JSON.parse(localStorage.getItem('pf.' + k)); return v == null ? def : v; } catch { return def; } },
  set(k, v) { try { localStorage.setItem('pf.' + k, JSON.stringify(v)); } catch {} },
};

/* ---------- avisos ---------- */
let toastT;
App.toast = (msg, err) => {
  const t = App.$('#toast'); t.textContent = msg; t.className = 'on' + (err ? ' err' : '');
  clearTimeout(toastT); toastT = setTimeout(() => (t.className = ''), err ? 5000 : 2200);
};
App.guard = async fn => { try { return await fn(); } catch (e) { console.error(e); App.toast(e.message || 'Error', true); } };

/* ---------- API ---------- */
App.api = async (method, url, body) => {
  const json = body === undefined ? undefined : JSON.stringify(body);
  const r = await fetch(url, {
    method, credentials: 'same-origin',
    keepalive: method !== 'GET' && !!json && json.length < 60000, // termina de guardar aunque se cierre la pestaña
    headers: method === 'GET' ? { Accept: 'application/json' } : { 'Content-Type': 'application/json', 'X-Portafolio': '1' },
    body: json,
  });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 && !url.startsWith('/api/auth/')) { App.onLoggedOut && App.onLoggedOut(); }
  if (!r.ok) { const e = new Error(j.error || 'Error ' + r.status); e.status = r.status; throw e; }
  return j;
};

/* ---------- datos ---------- */
App.byId = (coll, id) => App.S[coll].find(x => x.id === id) || null;
App.titleCol = () => App.S.columns.find(c => c.type === 'title') || App.S.columns[0] || { id: 'proyecto' };
App.projectName = p => (p && (p.props || {})[App.titleCol().id]) || 'Proyecto sin nombre';
App.estadoCol = () => App.S.columns.find(c => c.type === 'select' && /estado/i.test(c.name)) || App.S.columns.find(c => c.type === 'select');
App.optColor = (c, name) => ((c && c.options || []).find(o => o.name === name) || {}).color || 'gris';
App.projectColor = p => { const c = App.estadoCol(); return c ? App.optColor(c, (p.props || {})[c.id]) : 'gris'; };
App.caseOf = pid => App.S.cases.find(c => c.project_id === pid) || null;
App.actsOf = pid => App.S.activities.filter(a => a.project_id === pid).sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
App.projectsSorted = () => App.S.projects.slice().sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
// Resumen de cronograma de un proyecto: inicio, fin, avance ponderado por duración
App.planOf = pid => {
  const acts = App.actsOf(pid);
  const ini = acts.map(a => a.inicio).filter(Boolean).sort()[0] || null;
  const fin = acts.map(a => a.fin || a.inicio).filter(Boolean).sort().pop() || null;
  let w = 0, s = 0;
  acts.forEach(a => { const d = a.inicio && a.fin ? Math.max(1, App.d.diff(a.inicio, a.fin) + 1) : 1; w += d; s += d * (a.avance || 0); });
  const atrasadas = acts.filter(a => a.fin && a.fin < App.d.today() && (a.avance || 0) < 100).length;
  return { acts, ini, fin, avance: w ? Math.round(s / w) : 0, atrasadas };
};

const replaceIn = (coll, doc) => { const i = App.S[coll].findIndex(x => x.id === doc.id); if (i >= 0) App.S[coll][i] = doc; else App.S[coll].push(doc); };
App.create = async (coll, data) => { const doc = await App.api('POST', '/api/' + coll, data); replaceIn(coll, doc); return doc; };
// Cambio optimista: se ve de inmediato y se guarda en segundo plano
App.patch = async (coll, id, patch) => {
  const cur = App.byId(coll, id);
  if (cur) { Object.assign(cur, patch, patch.props ? { props: Object.assign({}, cur.props, patch.props) } : {}); }
  try { const doc = await App.api('PATCH', `/api/${coll}/${id}`, patch); replaceIn(coll, doc); return doc; }
  catch (e) { App.toast(e.message, true); App.reload && App.reload(); throw e; }
};
App.remove = async (coll, id) => {
  await App.api('DELETE', `/api/${coll}/${id}`);
  App.S[coll] = App.S[coll].filter(x => x.id !== id);
  if (coll === 'projects') {
    App.S.activities = App.S.activities.filter(a => a.project_id !== id);
    App.S.cases = App.S.cases.filter(c => c.project_id !== id);
    App.S.sessions.forEach(s => { s.proyectos = (s.proyectos || []).filter(p => p !== id); });
  }
  if (coll === 'committees') App.S.sessions.forEach(s => { if (s.comite_id === id) s.comite_id = null; });
};
App.saveColumns = () => App.guard(async () => { const r = await App.api('PUT', '/api/config/columnas', { columns: App.S.columns }); App.S.columns = r.columns; });

/* ---------- fechas (siempre 'AAAA-MM-DD', sin zonas horarias) ---------- */
App.d = {
  MESES: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
  MES3: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'],
  DIAS: ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'],
  today() { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`; },
  toDate(iso) { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); },
  iso(dt) { return dt.toISOString().slice(0, 10); },
  add(iso, n) { const d = App.d.toDate(iso); d.setUTCDate(d.getUTCDate() + n); return App.d.iso(d); },
  diff(a, b) { return Math.round((App.d.toDate(b) - App.d.toDate(a)) / 86400000); },
  dow(iso) { return (App.d.toDate(iso).getUTCDay() + 6) % 7; }, // 0 = lunes
  fmt(iso) { if (!iso) return ''; const [y, m, d] = iso.split('-'); return `${parseInt(d)} ${App.d.MES3[parseInt(m) - 1]} ${y}`; },
  fmtShort(iso) { if (!iso) return ''; const [, m, d] = iso.split('-'); return `${parseInt(d)} ${App.d.MES3[parseInt(m) - 1]}`; },
  fmtLong(iso) { if (!iso) return ''; const dt = App.d.toDate(iso); const [y, m, d] = iso.split('-'); return `${['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'][dt.getUTCDay()]} ${parseInt(d)} de ${App.d.MESES[parseInt(m) - 1]} de ${y}`; },
  ago(ts) {
    if (!ts) return ''; const s = (Date.now() - new Date(ts)) / 1000;
    if (s < 60) return 'hace un momento'; if (s < 3600) return `hace ${Math.round(s / 60)} min`;
    if (s < 86400) return `hace ${Math.round(s / 3600)} h`; return new Date(ts).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
  },
};

/* ---------- números y dinero ---------- */
App.num = (v, dec = 0) => (v == null || v === '' || !Number.isFinite(Number(v)) ? '' : Number(v).toLocaleString('es-CO', { maximumFractionDigits: dec }));
App.money = (v, moneda) => (v == null || !Number.isFinite(v) ? '—' : (moneda === 'USD' ? 'US$' : '$') + Math.round(v).toLocaleString('es-CO'));
App.moneyShort = (v, moneda) => {
  if (v == null || !Number.isFinite(v)) return '—';
  const p = moneda === 'USD' ? 'US$' : '$', a = Math.abs(v), s = v < 0 ? '−' : '';
  if (a >= 1e9) return `${s}${p}${(a / 1e9).toLocaleString('es-CO', { maximumFractionDigits: 1 })} mil M`;
  if (a >= 1e6) return `${s}${p}${(a / 1e6).toLocaleString('es-CO', { maximumFractionDigits: 1 })} M`;
  return s + p + Math.round(a).toLocaleString('es-CO');
};
App.pct = v => (v == null || !Number.isFinite(v) ? '—' : (v * 100).toLocaleString('es-CO', { maximumFractionDigits: 1 }) + '%');
// "1.250.000", "1250000", "1,5" → número
App.parseNum = s => {
  s = String(s || '').trim().replace(/[$\s]|US/g, '');
  if (!s) return 0;
  if (/^-?[\d.]+,\d+$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  else s = s.replace(/,/g, '');
  const n = Number(s); return Number.isFinite(n) ? n : 0;
};

/* ---------- popover ---------- */
const pop = () => App.$('#pop');
let popCtx = null;
App.openPop = (anchor, html, opts = {}) => {
  App.closePop(true);
  const p = pop(); p.innerHTML = html; p.hidden = false; popCtx = opts;
  p.onclick = null; p.onchange = null;
  const r = anchor.getBoundingClientRect();
  p.style.minWidth = (opts.width || Math.max(240, Math.min(r.width, 520))) + 'px';
  let left = r.left, top = opts.cover ? r.top : r.bottom + 4;
  const W = window.innerWidth, H = window.innerHeight;
  if (left + p.offsetWidth > W - 12) left = Math.max(12, W - 12 - p.offsetWidth);
  if (top + p.offsetHeight > H - 12) top = Math.max(12, (opts.cover ? H - 12 - p.offsetHeight : r.top - p.offsetHeight - 4));
  p.style.left = left + 'px'; p.style.top = top + 'px';
  const f = App.$('textarea, input:not([type=hidden]):not([type=checkbox]), select', p);
  if (f && !opts.nofocus) { f.focus(); if (f.select && f.type !== 'date' && f.type !== 'time') f.select(); }
  App.$$('.ed').forEach(e => e.classList.remove('ed'));
  if (anchor.classList && (anchor.classList.contains('cell') || anchor.classList.contains('g-c'))) anchor.classList.add('ed');
  return p;
};
App.closePop = cancel => {
  const p = pop(); if (p.hidden) return;
  const ctx = popCtx; popCtx = null;
  if (ctx && ctx.onClose) ctx.onClose(!!cancel); // primero guarda (lee el popover), luego lo cierra
  p.hidden = true; p.innerHTML = ''; p.onclick = null; p.onchange = null;
  App.$$('.ed').forEach(e => e.classList.remove('ed'));
};
App.popOpen = () => !pop().hidden;
document.addEventListener('mousedown', e => { if (App.popOpen() && !pop().contains(e.target)) App.closePop(false); });
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (App.popOpen()) { e.preventDefault(); App.closePop(true); }
  else if (App.drawerOpen()) App.closeDrawer();
});

/* ---------- panel lateral (drawer) ---------- */
let drawerCtx = null;
App.openDrawer = (html, opts = {}) => {
  let bg = App.$('.drawer-bg');
  if (!bg) {
    bg = document.createElement('div'); bg.className = 'drawer-bg' + (App.canEdit() ? '' : ' ro');
    bg.addEventListener('mousedown', e => { if (e.target === bg) App.closeDrawer(); });
    document.body.appendChild(bg);
  }
  bg.innerHTML = `<div class="drawer">${html}</div>`;
  drawerCtx = opts;
  return bg.firstElementChild;
};
App.closeDrawer = () => {
  const bg = App.$('.drawer-bg'); if (!bg) return;
  // guarda el campo con foco antes de cerrar
  if (document.activeElement && bg.contains(document.activeElement)) document.activeElement.blur();
  bg.remove(); const ctx = drawerCtx; drawerCtx = null;
  if (ctx && ctx.onClose) ctx.onClose();
};
App.drawerOpen = () => !!App.$('.drawer-bg');

/* ---------- editores genéricos ---------- */
const autoGrow = ta => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight + 2, window.innerHeight * 0.5) + 'px'; };
App.editText = (anchor, value, { multi, log, placeholder, onSave, width } = {}) => {
  const hint = log ? `<div class="row"><button class="btn sm" data-p="hoy">+ Entrada de hoy</button><span class="hint" style="margin:0">Ctrl+Enter guarda · Esc cancela</span></div>` : multi ? `<div class="hint">Ctrl+Enter guarda · Esc cancela</div>` : '';
  const p = App.openPop(anchor, `<textarea rows="${multi ? 5 : 1}" placeholder="${App.esc(placeholder || '')}">${App.esc(value || '')}</textarea>${hint}`,
    { cover: true, width: width || Math.max(anchor.getBoundingClientRect().width, multi ? 420 : 300), onClose: cancel => { if (!cancel) onSave(ta.value.trim()); } });
  const ta = App.$('textarea', p); autoGrow(ta);
  ta.addEventListener('input', () => autoGrow(ta));
  ta.addEventListener('keydown', e => { if (e.key === 'Enter' && (!multi || e.ctrlKey || e.metaKey)) { e.preventDefault(); App.closePop(false); } });
  const hoy = App.$('[data-p=hoy]', p);
  if (hoy) hoy.addEventListener('click', () => {
    const t = App.d.today(); const pre = `${parseInt(t.slice(8))} ${App.d.MES3[parseInt(t.slice(5, 7)) - 1].toUpperCase()}: `;
    ta.value = pre + (ta.value ? '\n' + ta.value : ''); ta.focus(); ta.setSelectionRange(pre.length, pre.length); autoGrow(ta);
  });
};
App.editNumber = (anchor, value, onSave, { min, max } = {}) => {
  const p = App.openPop(anchor, `<input type="number" step="any" ${min != null ? `min="${min}"` : ''} ${max != null ? `max="${max}"` : ''} value="${value == null ? '' : App.esc(value)}">`,
    { cover: true, onClose: cancel => { if (!cancel) { const x = App.$('input', p).value; onSave(x === '' ? null : Number(x)); } } });
  App.$('input', p).addEventListener('keydown', e => { if (e.key === 'Enter') App.closePop(false); });
};
App.editDate = (anchor, value, onSave, { clear = true } = {}) => {
  const p = App.openPop(anchor, `<input type="date" value="${App.esc(value || '')}">${clear ? '<div class="row"><button class="btn sm" data-p="clear">Sin fecha</button></div>' : ''}`,
    { cover: true, onClose: cancel => { if (!cancel) onSave(App.$('input', p).value || null); } });
  const inp = App.$('input', p);
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') App.closePop(false); });
  const c = App.$('[data-p=clear]', p); if (c) c.addEventListener('click', () => { onSave(null); App.closePop(true); });
};
// Lista para elegir (uno o varios): items [{id, label, color}]
App.pickList = (anchor, { items, selected = [], multi = true, onSave, placeholder = 'Buscar…', empty = 'Sin opciones' }) => {
  let sel = selected.slice(), q = '', dirty = false;
  const draw = () => {
    const vis = items.filter(it => !q || it.label.toLowerCase().includes(q.toLowerCase()));
    p.innerHTML = `<input type="text" placeholder="${App.esc(placeholder)}" value="${App.esc(q)}" style="margin-bottom:6px">` +
      (vis.length ? vis.map(it => `<div class="opt" data-id="${App.esc(it.id)}"><span class="ck">${sel.includes(it.id) ? '✓' : ''}</span><span class="pill cl-${it.color || 'gris'}">${App.esc(it.label)}</span></div>`).join('') : `<div class="hint">${App.esc(empty)}</div>`);
    const inp = App.$('input', p); inp.focus(); inp.setSelectionRange(q.length, q.length);
    inp.oninput = () => { q = inp.value; draw(); };
    inp.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); if (vis[0]) toggle(vis[0].id); } };
  };
  const toggle = id => { dirty = true; if (multi) { sel = sel.includes(id) ? sel.filter(x => x !== id) : [...sel, id]; draw(); } else { sel = [id]; App.closePop(false); } };
  const p = App.openPop(anchor, '<div></div>', { width: 320, nofocus: true, onClose: cancel => { if (dirty && !cancel) onSave(multi ? sel : sel[0]); else if (dirty && multi) onSave(sel); } });
  p.onclick = e => { const o = e.target.closest('.opt'); if (o) toggle(o.dataset.id); };
  draw();
};
// Menú simple: items [{id,label,danger}]
App.menu = (anchor, items, onPick, width = 220) => {
  const p = App.openPop(anchor, items.map(it => it === '-' ? '<div class="sep"></div>' : `<button class="mi ${it.danger ? 'danger' : ''}" data-m="${App.esc(it.id)}">${App.esc(it.label)}</button>`).join(''), { width, nofocus: true });
  p.onclick = e => { const b = e.target.closest('[data-m]'); if (!b) return; App.closePop(true); onPick(b.dataset.m); };
};

/* ---------- tipos de valor (beneficios) e ICE ---------- */
// Orden fijo: es el que validó la paleta (cada tipo conserva su color siempre)
App.CATS = [
  { id: 'ahorro', label: 'Ahorro' }, { id: 'ingresos', label: 'Nuevos ingresos' }, { id: 'eficiencia', label: 'Eficiencia' },
  { id: 'tiempo', label: 'Tiempo' }, { id: 'riesgo', label: 'Riesgo evitado' }, { id: 'otro', label: 'Otro' }];
App.catLabel = id => (App.CATS.find(c => c.id === id) || App.CATS.at(-1)).label;
App.inferCat = txt => {
  const n = String(txt || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (/ahorro|reduccion de costo|evita.*costo|menor costo/.test(n)) return 'ahorro';
  if (/ingreso|venta|conversion|recaudo|cliente nuevo|revenue|income/.test(n)) return 'ingresos';
  if (/eficien|productiv|automatiz/.test(n)) return 'eficiencia';
  if (/hora|tiempo|dias|minuto|agil/.test(n)) return 'tiempo';
  if (/riesgo|fraude|multa|cumplim|perdida/.test(n)) return 'riesgo';
  return 'otro';
};
App.catOf = row => row.categoria || App.inferCat(row.concepto);
// «Tipo de valor» del proyecto (columna) → tipo de beneficio, para proyectos sin caso
App.catDeTipoValor = v => { const n = String(v || '').toLowerCase(); return /ingres/.test(n) ? 'ingresos' : /eficien/.test(n) ? 'eficiencia' : /riesg|cumpl/.test(n) ? 'riesgo' : /ahorr/.test(n) ? 'ahorro' : /tiemp/.test(n) ? 'tiempo' : 'otro'; };
// ICE = Impacto × Confianza × Facilidad (cada uno de 1 a 10)
App.iceOf = p => { const v = (p.props || {}); const i = Number(v.impacto), c = Number(v.confianza), f = Number(v.facilidad); return i > 0 && c > 0 && f > 0 ? Math.round(i * c * f) : null; };
// Proyecto en realización: su estado dice ejecución, escalamiento, implementación, operación o cerrado, o ya tiene valor captado
App.enRealizacion = p => {
  const ec = App.estadoCol(), e = ec ? String((p.props || {})[ec.id] || '') : '';
  const caso = App.caseOf(p.id);
  return /ejecu|escal|implement|operac|produc|cerrad/i.test(e) || !!(caso && (caso.captado || []).some(x => Number(x.valor)));
};
// Año calendario del «Año 0» de un caso
App.anioCero = c => c.anio_inicio || Number(String(c.created_at || App.d.today()).slice(0, 4));

/* ---------- navegación ---------- */
App.go = hash => { if (location.hash === hash) App.render(); else location.hash = hash; };
