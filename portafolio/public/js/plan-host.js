/* ============================================================
   CRONOGRAMA · el mismo plan de trabajo de la app de gestión
   La hoja (public/plan/plan.js + plan.css) es copia exacta de la de la
   app de gestión: se ve y se comporta igual (capítulos y subcapítulos,
   ID 1.1.1, días hábiles de Colombia, precedencias FC/CC/FF/CF con
   desfase, fechas en cascada, ruta crítica, línea base, fechas reales,
   arrastrar barras y flechas, edición tipo Excel, comentarios…).
   Este archivo es el «anfitrión»: le pasa los datos del portafolio,
   guarda lo que cambie (POST /api/plan/:proyecto) y pone lo que en la
   app de gestión hace la página: deshacer, línea base, fecha meta,
   involucrados, mesa de trabajo y el detalle de cada actividad.
   ============================================================ */
'use strict';
(function () {
  const { $, esc } = App;
  const P = window.Plan;
  const LS = 'pf.planOpts', LS_PORT = 'pf.planOptsPortafolio';
  const opts = P.opciones(LS, { owner: true, editable: true, panel: false, compacto: true });
  const optsPort = P.opciones(LS_PORT, { owner: false, editable: false, panel: false, compacto: true, zoom: 'mes' });
  opts.compacto = optsPort.compacto = true;

  let cur = null;          // { el, pid (null = todo el portafolio), M (modelo), ro }
  let guardando = 0, cola = Promise.resolve();
  const pila = [];         // deshacer: fotos de actividades y capítulos
  let undoSuspendido = 0;
  let mesa = false;
  const clonar = x => JSON.parse(JSON.stringify(x));
  const hoy = () => App.d.today();
  const addDays = (iso, n) => App.d.add(iso, n);
  const dayDiff = (a, b) => App.d.diff(a, b);
  const toast = (m, ok = true) => App.toast(String(m).replace(/^⚠\s*/, ''), ok === false);
  const optsDe = () => (cur && cur.pid ? opts : optsPort);
  const editable = () => !!(cur && cur.pid && !cur.ro && document.body.contains(cur.el));

  /* ---------- Del portafolio al modelo de la hoja (y de vuelta) ---------- */
  const lista = v => (Array.isArray(v) ? v : String(v || '').split(',')).map(x => String(x || '').trim()).filter(Boolean);
  function aModelo(a) {
    const resp = lista(a.responsable);
    return {
      id: a.id, projectId: a.project_id, name: a.name || '', sectionId: a.section_id || null, position: a.position ?? 0,
      responsables: resp, responsable: resp.join(', ') || null,
      startDate: a.inicio || null, deadline: a.fin || null, duracion: a.duracion || null,
      pctComplete: Math.max(0, Math.min(100, a.avance || 0)),
      dependsOnIds: (a.deps || []).slice(), depTipos: clonar(a.dep_tipos || {}),
      realStart: a.real_ini || null, realEnd: a.real_fin || null, baselineStart: a.base_ini || null, baselineEnd: a.base_fin || null,
      entregable: a.entregable || '', area: a.area || null, notes: a.notas || '',
    };
  }
  function aNativo(m) {
    return {
      section_id: m.sectionId || null, name: String(m.name || '').trim() || 'Actividad', responsable: lista(m.responsables && m.responsables.length ? m.responsables : m.responsable).join(', '),
      inicio: m.startDate || null, fin: m.deadline || null, avance: Math.max(0, Math.min(100, Math.round(Number(m.pctComplete) || 0))),
      hito: !!(m.startDate && m.startDate === m.deadline), position: m.position ?? 0, duracion: m.duracion || null,
      deps: (m.dependsOnIds || []).filter(Boolean), dep_tipos: m.depTipos || {},
      real_ini: m.realStart || null, real_fin: m.realEnd || null, base_ini: m.baselineStart || null, base_fin: m.baselineEnd || null,
      entregable: m.entregable || '', area: m.area || '', notas: m.notes || '',
    };
  }
  const aModeloSec = s => ({ id: s.id, name: s.name || 'Capítulo', position: s.position ?? 0, parentId: s.parent_id || null, enabled: s.enabled !== false });
  const aNativoSec = m => ({ name: String(m.name || '').trim() || 'Capítulo', position: m.position ?? 0, parent_id: m.parentId || null, enabled: m.enabled !== false });

  function modelo(pid) {
    const p = App.byId('projects', pid) || {};
    const nat = App.S.activities.filter(a => a.project_id === pid);
    const notas = [];
    nat.forEach(a => (a.comentarios || []).forEach(n => notas.push(Object.assign({}, n, { activityId: a.id }))));
    const M = {
      pid, sections: (App.S.sections || []).filter(s => s.project_id === pid).map(aModeloSec), activities: nat.map(aModelo),
      tasks: [], notas, miembros: p.miembros || [], lineaBase: p.linea_base_at || null, fechaMeta: p.fecha_meta || null, today: hoy(),
    };
    recalcular(M);
    return M;
  }

  /* ---------- Estado, ruta crítica e indicadores (igual que la app de gestión) ---------- */
  function esperado(a, t) {
    if (!a.startDate || !a.deadline || a.deadline < a.startDate) return null;
    return Math.max(0, Math.min(100, Math.round((dayDiff(a.startDate, t) + 1) / (dayDiff(a.startDate, a.deadline) + 1) * 100)));
  }
  function derivar(a, t) {
    const done = (a.pctComplete || 0) >= 100 || !!a.realEnd;
    a.status = done ? 'completada' : (a.pctComplete || 0) > 0 ? 'en_curso' : 'pendiente';
    a.diasRestantes = a.deadline ? dayDiff(t, a.deadline) : null;
    a.alerta = !done && a.deadline ? (a.diasRestantes < 0 ? 'retraso' : a.diasRestantes <= 7 ? 'proximidad' : null) : null;
    a.estadoEfectivo = done ? 'completada' : a.alerta === 'retraso' ? 'retrasada' : a.status;
    a.pctEsperado = esperado(a, t);
  }
  function rutaCritica(list) {
    list.forEach(a => { a.critical = false; a.slack = null; a.criticaEnRiesgo = false; });
    const fechas = []; list.forEach(a => { if (a.startDate) fechas.push(a.startDate); if (a.deadline) fechas.push(a.deadline); });
    if (!fechas.length) return;
    fechas.sort(); const origen = fechas[0];
    const byId = new Map(list.map(a => [a.id, a]));
    const preds = new Map(list.map(a => [a.id, (a.dependsOnIds || []).filter(x => byId.has(x) && x !== a.id)]));
    const succs = new Map(list.map(a => [a.id, []]));
    preds.forEach((ids, id) => ids.forEach(pid => succs.get(pid).push(id)));
    const dur = a => (a.startDate && a.deadline && a.deadline >= a.startDate ? dayDiff(a.startDate, a.deadline) + 1 : 1);
    const ancla = a => (a.startDate ? dayDiff(origen, a.startDate) : a.deadline ? dayDiff(origen, a.deadline) - dur(a) + 1 : null);
    const es = {}, ef = {}, e1 = {};
    const adelante = a => {
      if (e1[a.id] === 'listo') return;
      if (e1[a.id] === 'visitando') { es[a.id] = es[a.id] || 0; ef[a.id] = es[a.id] + dur(a) - 1; return; }
      e1[a.id] = 'visitando';
      let ini = ancla(a); if (ini == null) ini = 0;
      preds.get(a.id).forEach(pid => { adelante(byId.get(pid)); ini = Math.max(ini, ef[pid] + 1); });
      es[a.id] = ini; ef[a.id] = ini + dur(a) - 1; e1[a.id] = 'listo';
    };
    list.forEach(adelante);
    const fin = Math.max(...list.map(a => ef[a.id]));
    const lf = {}, ls = {}, e2 = {};
    const atras = a => {
      if (e2[a.id] === 'listo') return;
      if (e2[a.id] === 'visitando') { lf[a.id] = lf[a.id] != null ? lf[a.id] : fin; ls[a.id] = lf[a.id] - dur(a) + 1; return; }
      e2[a.id] = 'visitando';
      const hijos = succs.get(a.id); let f = hijos.length ? Infinity : fin;
      hijos.forEach(sid => { atras(byId.get(sid)); f = Math.min(f, ls[sid] - 1); });
      if (!isFinite(f)) f = fin;
      lf[a.id] = f; ls[a.id] = f - dur(a) + 1; e2[a.id] = 'listo';
    };
    list.forEach(atras);
    list.forEach(a => {
      const suelta = !a.startDate && !a.deadline && !preds.get(a.id).length && !succs.get(a.id).length;
      const holgura = ls[a.id] - es[a.id];
      a.slack = suelta ? null : holgura;
      a.critical = !suelta && holgura <= 0;
      a.criticaEnRiesgo = a.critical && a.estadoEfectivo !== 'completada' && (a.alerta === 'retraso' || (a.pctEsperado != null && a.pctComplete < a.pctEsperado - 15));
    });
  }
  function resumen(acts, t) {
    const conPlan = acts.map(a => a.pctEsperado).filter(v => v != null), crit = acts.filter(a => a.critical);
    const fins = acts.map(a => a.deadline).filter(Boolean).sort();
    return {
      today: t, total: acts.length, completadas: acts.filter(a => a.status === 'completada').length,
      avance: acts.length ? Math.round(acts.reduce((s, a) => s + (a.pctComplete || 0), 0) / acts.length) : 0,
      avanceEsperado: conPlan.length ? Math.round(conPlan.reduce((s, v) => s + v, 0) / conPlan.length) : null,
      rutaCritica: crit.length, rutaCriticaEnRiesgo: crit.filter(a => a.criticaEnRiesgo).length,
      fechaFinal: fins.length ? fins[fins.length - 1] : null,
      retrasos: acts.filter(a => a.alerta === 'retraso').length, proximas: acts.filter(a => a.alerta === 'proximidad').length,
    };
  }
  function recalcular(M) {
    M.today = hoy();
    M.activities.forEach(a => derivar(a, M.today));
    rutaCritica(M.activities);
    M.summary = resumen(M.activities, M.today);
  }

  /* ---------- Guardar: lo que cambió, en una sola petición y en orden ---------- */
  function diferencias(pid, M) {
    const out = { activities: { upsert: [], remove: [] }, sections: { upsert: [], remove: [] } };
    const par = [['activities', App.S.activities, M.activities, aNativo, aModelo], ['sections', App.S.sections || [], M.sections, aNativoSec, aModeloSec]];
    par.forEach(([coll, nativos, modelos, aN, aM]) => {
      const nat = new Map(nativos.filter(x => x.project_id === pid).map(x => [x.id, x]));
      modelos.forEach(m => {
        const n = aN(m), viejo = nat.get(m.id);
        if (!viejo) { out[coll].upsert.push(Object.assign({ id: m.id }, n)); return; }
        const v = aN(aM(viejo)), c = {};
        Object.keys(n).forEach(k => { if (JSON.stringify(n[k]) !== JSON.stringify(v[k])) c[k] = n[k]; });
        if (Object.keys(c).length) out[coll].upsert.push(Object.assign({ id: m.id }, c));
      });
      nat.forEach((x, id) => { if (!modelos.some(m => m.id === id)) out[coll].remove.push(id); });
    });
    return out;
  }
  const vacio = c => !c.activities.upsert.length && !c.activities.remove.length && !c.sections.upsert.length && !c.sections.remove.length;
  function aplicarEnEstado(pid, c) {
    [['activities', 'activities'], ['sections', 'sections']].forEach(([coll, k]) => {
      let l = App.S[k] || [];
      c[coll].upsert.forEach(u => {
        const d = l.find(x => x.id === u.id);
        if (d) Object.assign(d, u); else l.push(Object.assign({ project_id: pid, comentarios: [] }, u));
      });
      l = l.filter(x => !c[coll].remove.includes(x.id));
      App.S[k] = l;
    });
  }
  function marcar(d) {
    guardando = Math.max(0, guardando + d);
    const el = $('#plan-saving'); if (el) el.style.opacity = guardando ? '1' : '0';
  }
  function planConFoco() {
    const el = document.activeElement;
    return !!(el && el.closest && el.closest('#plan-body') && /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName));
  }
  function enviar(pid, c, registrar) {
    if (vacio(c)) return cola;
    marcar(1);
    cola = cola.then(async () => {
      try {
        const r = await App.api('POST', '/api/plan/' + pid, Object.assign({ registrar: registrar !== false }, c));
        // Solo con la última respuesta en camino: así no se pisa lo que aún va de viaje
        if (guardando === 1) {
          App.S.activities = App.S.activities.filter(a => a.project_id !== pid).concat(r.activities);
          App.S.sections = (App.S.sections || []).filter(s => s.project_id !== pid).concat(r.sections);
          if (cur && cur.pid === pid && !planConFoco() && JSON.stringify(diferencias(pid, cur.M)) !== JSON.stringify({ activities: { upsert: [], remove: [] }, sections: { upsert: [], remove: [] } })) { cur.M = modelo(pid); pintar(); }
        }
      } catch (e) {
        App.toast('No se guardó: ' + e.message, true);
        if (App.reload) await App.reload();
      } finally { marcar(-1); }
    });
    return cola;
  }
  // Un cambio: foto para deshacer → se aplica al modelo → se pinta → se guarda por detrás
  function hacer(desc, fn, { undo = true, registrar = true } = {}) {
    if (!editable()) return;
    if (undo) pushUndo(desc);
    const r = fn(cur.M);
    recalcular(cur.M);
    const c = diferencias(cur.pid, cur.M);
    aplicarEnEstado(cur.pid, c);
    pintar();
    enviar(cur.pid, c, registrar);
    return r;
  }

  /* ---------- Deshacer (cambio por cambio, como en la app de gestión) ---------- */
  function pushUndo(desc) {
    if (!cur || !cur.pid || undoSuspendido) return;
    pila.push({ desc, pid: cur.pid, acts: clonar(App.S.activities.filter(a => a.project_id === cur.pid)), secs: clonar((App.S.sections || []).filter(s => s.project_id === cur.pid)) });
    if (pila.length > 40) pila.shift();
  }
  function deshacer() {
    if (!editable()) return;
    const i = pila.map(x => x.pid).lastIndexOf(cur.pid);
    if (i < 0) { toast('No hay cambios para deshacer en este proyecto', false); return; }
    const e = pila.splice(i, 1)[0], pid = e.pid;
    // El modelo vuelve a ser la foto; las diferencias contra lo actual se guardan de una
    const nat = App.S.activities.filter(a => a.project_id === pid);
    const M = cur.M;
    M.activities = e.acts.map(aModelo);
    M.sections = e.secs.map(aModeloSec);
    recalcular(M);
    const c = diferencias(pid, M);
    aplicarEnEstado(pid, c);
    // los comentarios de lo que vuelve siguen en la foto
    e.acts.forEach(a => { const d = App.S.activities.find(x => x.id === a.id); if (d && !nat.some(x => x.id === a.id)) d.comentarios = a.comentarios || []; });
    cur.M = modelo(pid);
    pintar();
    enviar(pid, c, true);
    toast('↶ Deshecho: ' + e.desc);
  }
  document.addEventListener('keydown', ev => {
    if (!(ev.ctrlKey || ev.metaKey) || ev.shiftKey || ev.key.toLowerCase() !== 'z' || !editable()) return;
    const t = ev.target; if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return;
    if (App.drawerOpen() || App.popOpen()) return;
    ev.preventDefault(); deshacer();
  });

  /* ---------- Orden de filas y capítulos ---------- */
  function ordenadas(M) {
    const secs = P.ordenSecciones(M.sections), out = [], pos = (x, y) => (x.position || 0) - (y.position || 0);
    secs.forEach(s => M.activities.filter(a => a.sectionId === s.id).sort(pos).forEach(a => out.push(a)));
    M.activities.filter(a => !a.sectionId || !secs.some(s => s.id === a.sectionId)).sort(pos).forEach(a => out.push(a));
    return out;
  }
  const numerar = l => l.forEach((a, i) => { a.position = i; });
  const quitarDeps = (M, ids) => M.activities.forEach(x => {
    if (!(x.dependsOnIds || []).some(y => ids.includes(y))) return;
    x.dependsOnIds = x.dependsOnIds.filter(y => !ids.includes(y));
    const t = Object.assign({}, x.depTipos || {}); ids.forEach(y => delete t[y]); x.depTipos = t;
  });
  function normalizar(c) {
    const o = Object.assign({}, c);
    if (o.responsables !== undefined) { o.responsables = lista(o.responsables); o.responsable = o.responsables.join(', ') || null; }
    if (o.pctComplete !== undefined) o.pctComplete = Math.max(0, Math.min(100, Number(o.pctComplete) || 0));
    if (o.name !== undefined) o.name = String(o.name).trim();
    if (o.dependsOnIds !== undefined) o.dependsOnIds = (o.dependsOnIds || []).filter(Boolean);
    if (o.area !== undefined) o.area = o.area ? String(o.area).trim() || null : null;
    return o;
  }
  const nuevaAct = (M, extra) => Object.assign({ id: App.uid(), projectId: M.pid, name: 'Nueva actividad', sectionId: null, position: 0, responsables: [], responsable: null, startDate: null, deadline: null, duracion: null, pctComplete: 0, dependsOnIds: [], depTipos: {}, realStart: null, realEnd: null, baselineStart: null, baselineEnd: null, entregable: '', area: null, notes: '' }, extra);
  const enfocarLuego = key => setTimeout(() => P.enfocar(key, true), 30);

  /* ---------- Lo que la hoja le pide a la página (mismos nombres que en la app de gestión) ---------- */
  window.toast = (m, ok) => toast(m, ok);
  window.planSetOpt = (k, v) => { const o = optsDe(); P.cambiar(o, k, v); P.guardar(cur && cur.pid ? LS : LS_PORT, o); pintar(); };
  window.planOnAncho = forzar => { if (forzar || optsDe().zoom === 'ajustar') pintar(); };
  window.planOnPatch = (id, cambios) => {
    if (!editable()) return;
    const a = cur.M.activities.find(x => x.id === id); if (!a) return;
    if (cambios.name !== undefined && !String(cambios.name).trim()) { toast('El nombre no puede quedar vacío', false); pintar(); return; }
    let movidas = 0;
    hacer(`cambio en «${a.name}»`, M => { movidas = P.aplicarLocal(M.activities, id, normalizar(cambios), M.today); });
    if (movidas) toast(`✓ Guardado · ${movidas} fecha${movidas === 1 ? '' : 's'} corrida${movidas === 1 ? '' : 's'} por dependencias`);
  };
  // Copiar un valor a varias filas (agarradera, Ctrl+V, Ctrl+D): un solo «deshacer» para todo
  window.planOnRelleno = (items, campo, mensaje) => {
    if (!editable() || !items.length) return;
    hacer(campo === 'celdas' ? `pegar celdas en ${items.length} fila${items.length === 1 ? '' : 's'}` : `copiar ${campo || 'valores'} en ${items.length} fila${items.length === 1 ? '' : 's'}`,
      M => items.forEach(x => P.aplicarLocal(M.activities, x.id, normalizar(x.cambios), M.today)));
    toast(mensaje || `✓ ${campo ? campo.charAt(0).toUpperCase() + campo.slice(1) : 'Valor'} copiado en ${items.length} fila${items.length === 1 ? '' : 's'}`);
  };
  window.planOnRow = (acc, id, x) => {
    if (!editable()) return;
    const M = cur.M, a = M.activities.find(y => y.id === id); if (!a) return;
    if (acc === 'detalle') return window.planOnDetalle(id);
    if (acc === 'subir' || acc === 'bajar') {
      const l = ordenadas(M), her = l.filter(y => (y.sectionId || '') === (a.sectionId || ''));
      const i = her.indexOf(a), j = i + (acc === 'subir' ? -1 : 1);
      if (j < 0 || j >= her.length) { toast(acc === 'subir' ? 'Ya es la primera de su capítulo' : 'Ya es la última de su capítulo', false); return; }
      [her[i], her[j]] = [her[j], her[i]];
      let k = 0;
      return hacer('mover filas', () => numerar(l.map(y => ((y.sectionId || '') === (a.sectionId || '') ? her[k++] : y))));
    }
    if (acc === 'eliminar') {
      if (!confirm(`¿Eliminar la actividad «${a.name}»?\n\nPuedes deshacerlo con «↶ Deshacer» (Ctrl+Z).`)) return;
      hacer(`eliminar «${a.name}»`, M2 => { M2.activities = M2.activities.filter(y => y.id !== id); quitarDeps(M2, [id]); });
      return toast('Eliminada');
    }
    if (acc === 'mover') {
      const l = ordenadas(M), resto = l.filter(y => y.id !== id);
      let idx, sec;
      if (x && x.destino) { const t = resto.findIndex(y => y.id === x.destino); if (t < 0) return; idx = t + (x.despues ? 1 : 0); sec = resto[t].sectionId || null; }
      else if (x && x.sec) { sec = x.sec; idx = resto.findIndex(y => y.sectionId === sec); if (idx < 0) idx = resto.length; }
      else return;
      resto.splice(idx, 0, a);
      return hacer('mover filas', () => { a.sectionId = sec; numerar(resto); });
    }
    if (acc === 'insertar-arriba' || acc === 'insertar-debajo' || acc === 'duplicar') {
      const debajo = acc !== 'insertar-arriba', dup = acc === 'duplicar';
      const n = nuevaAct(M, { sectionId: a.sectionId || null, name: dup ? a.name + ' (copia)' : 'Nueva actividad' });
      if (dup) Object.assign(n, { responsables: a.responsables.slice(), responsable: a.responsable, entregable: a.entregable, area: a.area, startDate: a.startDate, deadline: a.deadline, duracion: a.duracion, dependsOnIds: a.dependsOnIds.slice(), depTipos: clonar(a.depTipos || {}) });
      else if (a.startDate || a.deadline) {
        // Un día hábil: debajo arranca al terminar la de arriba; arriba arranca con ella
        n.startDate = debajo ? P.cal.habilDesde(addDays(a.deadline || a.startDate, 1)) : (a.startDate || a.deadline);
        n.deadline = n.startDate; n.duracion = 1;
      }
      hacer(dup ? `duplicar «${a.name}»` : 'insertar fila', M2 => {
        const l = ordenadas(M2), t = l.indexOf(a);
        l.splice(debajo ? t + 1 : t, 0, n); M2.activities.push(n); numerar(l);
      });
      enfocarLuego(`${n.id}:name`);
      toast(dup ? '✓ Fila duplicada' : '✓ Fila insertada · escribe el nombre');
    }
  };
  // Pegar varias filas de Excel en «＋ Actividad»: Nombre · Responsable · Días hábiles
  window.planOnPegarFilas = (sectionId, filas) => {
    if (!editable()) return;
    const validas = filas.filter(f => f[0]);
    if (!validas.length) return;
    if (validas.length > 1 && !confirm(`¿Crear ${validas.length} actividades con lo que pegaste?\n(columnas: nombre · responsable · días hábiles)`)) return;
    hacer(`pegar ${validas.length} fila${validas.length === 1 ? '' : 's'}`, M => {
      let pos = M.activities.reduce((m, a) => Math.max(m, a.position || 0), -1);
      validas.forEach(f => {
        const dias = parseInt(f[2], 10), resp = lista(f[1]);
        M.activities.push(nuevaAct(M, { sectionId: sectionId || null, name: String(f[0]).slice(0, 500), position: ++pos, responsables: resp, responsable: resp.join(', ') || null, duracion: dias > 0 && dias <= 999 ? dias : null }));
      });
      P.adelantar(M.activities);
    });
    toast(`✓ ${validas.length} actividad${validas.length === 1 ? '' : 'es'} pegada${validas.length === 1 ? '' : 's'}`);
  };
  window.planOnAdd = (sectionId, inp) => {
    if (!editable()) return;
    const name = String(inp.value || '').trim(); if (!name) return;
    if (sectionId === '__area__') {
      const id = App.uid();
      hacer(`crear capítulo «${name}»`, M => {
        const pos = M.sections.filter(s => !s.parentId).reduce((m, s) => Math.max(m, s.position || 0), -1) + 1;
        M.sections.push({ id, name: name.slice(0, 200), position: pos, parentId: null, enabled: true });
      });
      toast('✓ Capítulo agregado');
      setTimeout(() => { const i = document.querySelector(`[data-sec-add="${id}"]`); if (i) i.focus(); }, 30);
      return;
    }
    hacer(`agregar «${name}»`, M => {
      const pos = M.activities.reduce((m, a) => Math.max(m, a.position || 0), -1) + 1;
      M.activities.push(nuevaAct(M, { sectionId: sectionId || null, name: name.slice(0, 500), position: pos }));
    });
    setTimeout(() => { const i = document.querySelector(`[data-sec-add="${sectionId || ''}"]`); if (i) i.focus(); }, 30);
  };
  window.planOnSection = (acc, id, extra) => {
    if (!editable()) return;
    const M = cur.M, sc = M.sections.find(x => x.id === id); if (!sc) return;
    if (acc === 'rename') {
      const n = prompt(sc.parentId ? 'Nombre del subcapítulo:' : 'Nombre del capítulo:', sc.name);
      if (n === null || !n.trim() || n.trim() === sc.name) return;
      return hacer(`renombrar «${sc.name}»`, () => { sc.name = n.trim().slice(0, 200); });
    }
    if (acc === 'remove') {
      const hijos = M.sections.filter(x => x.parentId === id).map(x => x.id), todas = [id, ...hijos];
      const ids = M.activities.filter(a => todas.includes(a.sectionId)).map(a => a.id);
      if (!confirm(`¿Eliminar ${sc.parentId ? 'el subcapítulo' : 'el capítulo'} «${sc.name}»${ids.length ? ` y sus ${ids.length} actividad${ids.length === 1 ? '' : 'es'}` : ''}${hijos.length ? ` (con ${hijos.length} subcapítulo${hijos.length === 1 ? '' : 's'})` : ''}?\n\nPuedes deshacerlo con «↶ Deshacer».`)) return;
      hacer(`eliminar capítulo «${sc.name}»`, M2 => { M2.sections = M2.sections.filter(x => !todas.includes(x.id)); M2.activities = M2.activities.filter(a => !ids.includes(a.id)); quitarDeps(M2, ids); });
      return toast(`🗑 Capítulo eliminado${ids.length ? ` con ${ids.length} actividad${ids.length === 1 ? '' : 'es'}` : ''}`);
    }
    if (acc === 'sacar') {
      return hacer('sacar subcapítulo', M2 => {
        const padre = M2.sections.find(x => x.id === sc.parentId);
        const tops = M2.sections.filter(x => !x.parentId).sort((a, b) => a.position - b.position);
        const i = padre ? tops.indexOf(padre) : tops.length - 1;
        sc.parentId = null; tops.splice(i + 1, 0, sc); tops.forEach((x, k) => { x.position = k; });
      });
    }
    if (acc === 'anidar') {
      const pa = M.sections.find(x => x.id === extra); if (!pa || pa.parentId || pa.id === id) return;
      if (M.sections.some(x => x.parentId === id)) { toast('Ese capítulo tiene subcapítulos: no puede quedar dentro de otro', false); return; }
      const sueltas = M.activities.filter(a => a.sectionId === pa.id);
      if (!confirm(`¿Meter «${sc.name}» como subcapítulo de «${pa.name}»?${sueltas.length ? `\n\nLas ${sueltas.length} actividades que ya tiene «${pa.name}» quedan juntas en un subcapítulo nuevo (le pones nombre ahora).` : ''}`)) return;
      let nombre = null;
      if (sueltas.length) { nombre = prompt(`Nombre del subcapítulo con las actividades que ya tenía «${pa.name}»:`, pa.name); if (nombre === null) return; }
      hacer(`meter «${sc.name}» en «${pa.name}»`, M2 => {
        const her = M2.sections.filter(x => x.parentId === pa.id).sort((a, b) => a.position - b.position);
        if (sueltas.length) {
          const g = { id: App.uid(), name: (nombre || '').trim() || pa.name, position: 0, parentId: pa.id, enabled: true };
          M2.sections.push(g); her.unshift(g);
          sueltas.forEach(a => { a.sectionId = g.id; });
        }
        sc.parentId = pa.id; her.push(sc); her.forEach((x, k) => { x.position = k; });
        M2.sections.filter(x => !x.parentId).sort((a, b) => a.position - b.position).forEach((x, k) => { x.position = k; });
      });
      return toast(`✓ «${sc.name}» ahora es subcapítulo de «${pa.name}»`);
    }
    if (acc === 'mover') {
      const destino = extra && extra.destino, despues = !!(extra && extra.despues), dst = M.sections.find(x => x.id === destino);
      if (!dst || destino === id) return;
      const padre = dst.parentId || null;
      if (padre === id || (padre && M.sections.some(x => x.parentId === id))) { toast('Ese capítulo tiene subcapítulos: solo se puede mover entre capítulos principales', false); return; }
      hacer(`mover «${sc.name}»`, M2 => {
        const her = M2.sections.filter(x => (x.parentId || null) === padre && x.id !== id).sort((a, b) => a.position - b.position);
        const i = her.indexOf(dst); her.splice(despues ? i + 1 : i, 0, sc);
        sc.parentId = padre; her.forEach((x, k) => { x.position = k; });
      });
      return toast(`✓ «${sc.name}» ${despues ? 'después' : 'antes'} de «${dst.name}»`);
    }
  };
  // Comentarios (nubecita): se guardan aparte, sin pisar lo que otros escriben al tiempo
  window.planOnComentario = async (acc, actId, x) => {
    if (!cur || !cur.pid) return;
    try {
      if (acc === 'agregar') {
        if (cur.ro) { toast('Tu rol es de solo consulta', false); return; }
        const r = await App.api('POST', `/api/activities/${actId}/comentarios`, { texto: x.texto, fecha: x.fecha || null });
        const d = App.byId('activities', actId); if (d) d.comentarios = r.activity.comentarios || [];
        cur.M.notas.push(Object.assign({}, r.nota, { activityId: actId }));
        toast('✓ Comentario guardado');
      } else if (acc === 'borrar') {
        if (!confirm('¿Borrar este comentario?')) return;
        const r = await App.api('DELETE', `/api/activities/${actId}/comentarios/${x.noteId}`);
        const d = App.byId('activities', actId); if (d) d.comentarios = r.activity.comentarios || [];
        cur.M.notas = cur.M.notas.filter(n => n.id !== x.noteId);
      }
    } catch (e) { toast(e.message, false); }
    if (!planConFoco()) pintar();
    if (App.drawerOpen() && detalleId === actId) detalle(actId);
  };

  /* ---------- Detalle de una actividad (panel lateral) ---------- */
  let detalleId = null;
  window.planOnOpen = id => window.planOnDetalle(id);
  window.planOnDetalle = id => { detalleId = id; detalle(id); };
  function detalle(id) {
    if (!cur) return;
    const M = cur.M, a = M.activities.find(x => x.id === id); if (!a) return;
    P.etapas(M);
    const est = P.estado(a, M.today), ro = !editable();
    const cods = {}; M.activities.forEach(x => { cods[x.id] = x._cod || ''; });
    const deps = (a.dependsOnIds || []).filter(d => cods[d] != null).map(d => { const t = P.tipoDep(a, d); return `<span class="dep-chip" title="${esc(P.textoDep(t.t, t.d, t.u, cods[d]))}">${esc(P.etiquetaDep(a, d, cods[d]))}</span> <span class="muted">${esc((M.activities.find(x => x.id === d) || {}).name || '')}</span>`; });
    const cs = (M.notas || []).filter(n => n.activityId === id).sort((x, y) => String(x.createdAt).localeCompare(String(y.createdAt)));
    const f = v => (v ? esc(App.d.fmt(v)) : '—');
    const html = `<div class="d-top"><span class="faint" style="font-size:11.5px;font-weight:700">${esc(a._cod || '')} · ${esc(a._etapa || 'Sin capítulo')}</span><button class="x" data-x="1" title="Cerrar (Esc)">✕</button></div><h2>${esc(a.name)}</h2>
      <div class="pd-meta"><span class="pl-est ${est.replace(' ', '-')}">${est}</span><span>${a.pctComplete || 0}% de avance</span>${a.critical ? '<span class="cp-chip">Ruta crítica</span>' : ''}</div>
      <div class="props pd-props">
        <div class="k">Plan</div><div class="v">${f(a.startDate)} → ${f(a.deadline)}${P.duracionDe(a) ? ` · ${P.duracionDe(a)} días háb.` : ''}</div>
        <div class="k">Real</div><div class="v">${a.realStart || a.realEnd ? `${f(a.realStart)} → ${f(a.realEnd)}` : '—'}</div>
        ${a.baselineStart || a.baselineEnd ? `<div class="k">Línea base</div><div class="v">${f(a.baselineStart)} → ${f(a.baselineEnd)}</div>` : ''}
        <div class="k">Responsable</div><div class="v">${esc(P.respDe(a).join(', ') || '—')}</div>
        <div class="k">Área</div><div class="v">${esc(P.areasActividad(a, M.miembros).join(', ') || '—')}</div>
        <div class="k">Entregable</div><div class="v">${esc(a.entregable || '—')}</div>
        <div class="k">Depende de</div><div class="v">${deps.join('<br>') || '—'}</div>
      </div>
      <h4>Notas</h4>
      <textarea class="fld" id="pdNotas" rows="4" ${ro ? 'readonly' : ''} placeholder="${ro ? '' : 'Contexto, acuerdos, enlaces…'}">${esc(a.notes || '')}</textarea>
      <h4>Comentarios · ${cs.length}</h4>
      <div class="pd-cmts">${cs.map(n => `<div class="pd-c"><div class="faint">${esc(n.autor || '')} · ${esc(App.d.fmt(String(n.createdAt).slice(0, 10)))}${!ro ? ` <button class="lnk" data-borrar="${n.id}">borrar</button>` : ''}</div><div>${esc(n.texto).replace(/\n/g, '<br>')}</div></div>`).join('') || '<div class="faint">Sin comentarios todavía.</div>'}</div>
      ${ro ? '' : '<textarea class="fld" id="pdCmt" rows="2" placeholder="Escribe un comentario… (Ctrl+Enter guarda)"></textarea><div style="margin-top:6px"><button class="btn primary sm" data-cmt="1">Comentar</button></div>'}`;
    const d = App.openDrawer(html, { onClose: () => { detalleId = null; } });
    d.addEventListener('click', ev => {
      if (ev.target.closest('[data-x]')) return App.closeDrawer();
      const b = ev.target.closest('[data-borrar]'); if (b) return window.planOnComentario('borrar', id, { noteId: b.dataset.borrar });
      if (ev.target.closest('[data-cmt]')) enviarCmt();
    });
    const enviarCmt = () => { const t = $('#pdCmt', d); if (!t || !t.value.trim()) return; const v = t.value.trim(); t.value = ''; window.planOnComentario('agregar', id, { texto: v }); };
    const ta = $('#pdCmt', d); if (ta) ta.addEventListener('keydown', ev => { if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); enviarCmt(); } });
    const notas = $('#pdNotas', d);
    if (!ro) notas.addEventListener('change', () => { if (notas.value !== (a.notes || '')) window.planOnPatch(id, { notes: notas.value }); });
  }

  /* ---------- Involucrados del proyecto (nombre, área, rol) ---------- */
  function involucrados() {
    if (!cur || !cur.pid) return;
    const p = App.byId('projects', cur.pid); if (!p) return;
    const ro = !editable();
    let ms = clonar(p.miembros || []);
    const fila = (m, i) => `<tr data-i="${i}"><td><input class="fld" data-k="nombre" value="${esc(m.nombre || '')}" list="pdGente" ${ro ? 'readonly' : ''} placeholder="Nombre"></td><td><input class="fld" data-k="area" value="${esc(m.area || '')}" list="pdAreas" ${ro ? 'readonly' : ''} placeholder="Área"></td><td><input class="fld" data-k="rol" value="${esc(m.rol || '')}" ${ro ? 'readonly' : ''} placeholder="Rol"></td>${ro ? '' : '<td><button class="btn sm" data-q="1" title="Quitar">✕</button></td>'}</tr>`;
    const pintarLista = () => {
      const areas = [...new Set(ms.map(m => m.area).filter(Boolean))];
      return `<datalist id="pdGente">${(App.S.people || []).map(x => `<option value="${esc(x.name)}">`).join('')}</datalist><datalist id="pdAreas">${areas.map(x => `<option value="${esc(x)}">`).join('')}</datalist>
        <table class="lst pd-inv"><thead><tr><th>Nombre</th><th>Área</th><th>Rol</th>${ro ? '' : '<th></th>'}</tr></thead><tbody>${ms.map(fila).join('') || `<tr><td colspan="4" class="faint">Aún no hay involucrados.</td></tr>`}</tbody></table>
        ${ro ? '' : '<div style="margin-top:10px;display:flex;gap:8px"><button class="btn" data-add="1">+ Agregar persona</button><span class="sp"></span><button class="btn primary" data-ok="1">Guardar</button></div>'}`;
    };
    const d = App.openDrawer(`<div class="d-top"><span class="faint" style="font-size:11.5px;font-weight:700">${esc(App.projectName(p))}</span><button class="x" data-x="1" title="Cerrar (Esc)">✕</button></div><h2>👥 Involucrados</h2>
      <p class="muted" style="font-size:12.5px;margin:0 0 12px">Quiénes participan y de qué área son. Con esto, el plan colorea por área, sugiere responsables y deja agrupar por «Área responsable».</p><div id="pdInv">${pintarLista()}</div>`);
    const leer = () => { $$('#pdInv tbody tr[data-i]').forEach(tr => { const m = ms[Number(tr.dataset.i)]; tr.querySelectorAll('input[data-k]').forEach(i => { m[i.dataset.k] = i.value.trim(); }); }); };
    const $$ = (s) => Array.from(d.querySelectorAll(s));
    d.addEventListener('click', ev => {
      if (ev.target.closest('[data-x]')) return App.closeDrawer();
      if (ro) return;
      if (ev.target.closest('[data-add]')) { leer(); ms.push({ nombre: '', area: '', rol: '' }); $('#pdInv', d).innerHTML = pintarLista(); const l = $$('#pdInv input[data-k=nombre]'); if (l.length) l[l.length - 1].focus(); }
      const q = ev.target.closest('[data-q]'); if (q) { leer(); ms.splice(Number(q.closest('tr').dataset.i), 1); $('#pdInv', d).innerHTML = pintarLista(); }
      if (ev.target.closest('[data-ok]')) {
        leer();
        const limpios = ms.filter(m => m.nombre).map(m => ({ nombre: m.nombre.slice(0, 120), area: (m.area || '').slice(0, 120), rol: (m.rol || '').slice(0, 120) }));
        App.guard(async () => { await App.patch('projects', p.id, { miembros: limpios }); App.closeDrawer(); toast('✓ Involucrados guardados'); if (cur && cur.pid === p.id) { cur.M = modelo(p.id); pintar(); } });
      }
    });
  }

  /* ---------- Línea base y fecha meta ---------- */
  function fijarLineaBase(otraVez) {
    if (!editable()) return;
    const msg = otraVez
      ? '¿Volver a fijar la línea base con las fechas proyectadas de hoy? La línea base anterior se reemplaza y el desvío vuelve a cero.'
      : '¿Fijar la línea base? Las fechas planeadas de hoy quedan congeladas. Desde ahí, lo que se mueve es lo proyectado (por fechas reales y dependencias) y se ve el desvío contra lo pactado.';
    if (!confirm(msg)) return;
    const pid = cur.pid, at = new Date().toISOString();
    hacer('fijar línea base', M => { M.activities.forEach(a => { a.baselineStart = a.startDate || null; a.baselineEnd = a.deadline || null; }); M.lineaBase = at; });
    App.patch('projects', pid, { linea_base_at: at }).then(() => { toast('🔒 Línea base fijada'); pintar(); }).catch(() => {});
  }
  function quitarLineaBase() {
    if (!editable() || !confirm('¿Quitar la línea base? Se pierde la comparación contra lo pactado.')) return;
    const pid = cur.pid;
    hacer('quitar línea base', M => { M.activities.forEach(a => { a.baselineStart = null; a.baselineEnd = null; }); M.lineaBase = null; });
    App.patch('projects', pid, { linea_base_at: null }).then(() => { toast('Línea base quitada'); pintar(); }).catch(() => {});
  }
  function fechaMeta(btn) {
    if (!editable()) return;
    const pid = cur.pid, p = App.byId('projects', pid);
    App.editDate(btn, p.fecha_meta || null, v => {
      App.patch('projects', pid, { fecha_meta: v || null }).then(() => { if (cur && cur.pid === pid) { cur.M.fechaMeta = v || null; pintar(); } }).catch(() => {});
    });
  }

  /* ---------- Mesa de trabajo: el cronograma a pantalla completa ---------- */
  function toggleMesa(on) {
    const antes = mesa;
    mesa = on === undefined ? !mesa : !!on;
    document.documentElement.classList.toggle('mesa', mesa);
    if (antes !== mesa) pintar();
  }
  document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && mesa && !App.drawerOpen() && !App.popOpen() && !document.querySelector('.pl-selpop')) toggleMesa(false); });
  window.addEventListener('hashchange', () => { if (mesa) toggleMesa(false); });

  /* ---------- Cabecera: guardado, línea base, indicadores y botones ---------- */
  const fmt = v => (v ? App.d.fmt(v) : '—');
  function kpis(M) {
    const s = M.summary; if (!s || !s.total) return '';
    const dif = M.fechaMeta && s.fechaFinal ? P.cal.difHabiles(M.fechaMeta, s.fechaFinal) : null;
    const delta = s.avanceEsperado != null ? s.avance - s.avanceEsperado : null;
    return `<span class="mesa-kpis">
      <span title="Promedio del avance de las actividades vs. lo que deberían llevar hoy según sus fechas"><b>${s.avance}%</b> avance${s.avanceEsperado != null ? ` · plan ${s.avanceEsperado}%${delta < -10 ? ' <em style="color:var(--crit-ink)">▼</em>' : ''}` : ''}</span>
      <span>Fin <b>${esc(fmt(s.fechaFinal))}</b>${M.fechaMeta ? ` · meta ${esc(fmt(M.fechaMeta))}${dif != null ? ` <em style="color:${dif > 0 ? 'var(--crit)' : 'var(--good)'}">${dif > 0 ? `+${dif} háb.` : dif < 0 ? `${dif} háb.` : 'justo'}</em>` : ''}` : ''}</span>
      <span><b>${s.completadas}/${s.total}</b> listas</span>
      ${s.retrasos ? `<span style="color:var(--crit-ink)"><b>${s.retrasos}</b> atrasada${s.retrasos === 1 ? '' : 's'}</span>` : ''}
      ${s.rutaCritica ? `<span title="Actividades sin holgura: si una se atrasa, se atrasa todo el proyecto" style="color:${s.rutaCriticaEnRiesgo ? 'var(--cp-late-ink)' : 'var(--cp-ink)'}"><b>${s.rutaCritica}</b> en ruta crítica${s.rutaCriticaEnRiesgo ? ` (${s.rutaCriticaEnRiesgo} en riesgo)` : ''}</span>` : ''}
    </span>`;
  }
  function cabecera() {
    const M = cur.M, ed = editable(), p = cur.pid ? App.byId('projects', cur.pid) : null;
    const n = pila.filter(x => x.pid === cur.pid).length;
    let lb = '';
    if (p && M.lineaBase) {
      const f = new Date(M.lineaBase).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
      lb = `<span class="lb-chip" title="Las fechas de la línea base no se mueven. Lo que cambia es lo proyectado (por fechas reales y dependencias) y se ve el desvío.">🔒 Línea base del ${esc(f)}</span>${ed ? '<button class="btn sm" data-ph="lb-otra" title="Vuelve a congelar con las fechas proyectadas de hoy">Volver a fijar</button><button class="btn sm" data-ph="lb-quitar">Quitar</button>' : ''}`;
    } else if (p && ed) lb = '<button class="btn sm" data-ph="lb" title="Congela las fechas planeadas de hoy: desde ahí se comparan contra lo real">🔒 Fijar línea base</button>';
    const info = 'Todo se edita aquí mismo y se guarda solo. Si mueves el fin de una actividad, lo que depende de ella se corre en cascada (días hábiles, sin fines de semana ni festivos de Colombia). Flechas: arrastra el punto del final de una barra hasta otra actividad para conectarlas; haz clic en una flecha para cambiar su tipo o quitarla. Clic derecho en una fila: insertar, duplicar, mover, eliminar. Arrastra el borde del título «Actividad» para ensanchar la columna.';
    return `<div class="plan-head-l"><span id="plan-saving" class="saving-dot" style="opacity:${guardando ? 1 : 0}">guardando…</span>${lb}</div>
      <div class="plan-head-r">${kpis(M)}
        ${p ? `<span class="plan-info" title="${esc(info)}">ⓘ</span>` : ''}
        ${p && ed ? `<button class="btn sm undo-btn" data-ph="undo" ${n ? '' : 'disabled'} title="${n ? 'Deshacer: ' + esc(pila.filter(x => x.pid === cur.pid).slice(-1)[0].desc) + ' (Ctrl+Z)' : 'Nada que deshacer'}">↶ Deshacer${n ? ` <em>${n}</em>` : ''}</button>` : ''}
        ${p ? `<button class="btn sm" data-ph="meta" ${ed ? '' : 'disabled'} title="Fecha en que el proyecto debe terminar: el plan avisa si se pasa">⚑ ${p.fecha_meta ? 'Meta ' + esc(App.d.fmtShort(p.fecha_meta)) : 'Fecha meta'}</button>
        <button class="btn sm" data-ph="inv" title="Quiénes participan en el proyecto y de qué área son">👥 Involucrados${(p.miembros || []).length ? ` · ${p.miembros.length}` : ''}</button>` : ''}
        <button class="btn sm mesa-btn${mesa ? ' on' : ''}" data-ph="mesa" title="${mesa ? 'Volver a la vista normal (Esc)' : 'Solo el cronograma, a pantalla completa: para mesas de trabajo de revisión'}">${mesa ? '✕ Salir de mesa' : '⛶ Mesa de trabajo'}</button>
      </div>`;
  }

  /* ---------- Pintar ---------- */
  function pintar() {
    if (!cur || !document.body.contains(cur.el)) return;
    const o = optsDe();
    o.owner = o.editable = editable();
    const head = $('.plan-head', cur.el), body = $('#plan-body', cur.el);
    head.innerHTML = cabecera();
    const wrap = $('#pl-wrap', body), keep = wrap ? [wrap.scrollLeft, wrap.scrollTop] : null;
    o.vacioHtml = cur.pid ? (editable() ? 'Aún no hay actividades. Crea el primer capítulo abajo («＋ Nueva etapa») y agrega actividades, o pega filas desde Excel.' : 'Aún no hay actividades en este plan.') : 'Aún no hay actividades en ningún proyecto.';
    const ancho = (body.clientWidth || cur.el.clientWidth || 1100) - (o.panel ? 236 : 0);
    o.anchoTL = P.anchoAjuste(ancho, (o.vista === 'tabla' ? 1300 : 700) + P.extraNombre());
    body.innerHTML = P.render(cur.M, o);
    if (o.zoom === 'ajustar') { const a = P.medirAjuste(body); if (a && Math.abs(a - o.anchoTL) > 3) { o.anchoTL = a; body.innerHTML = P.render(cur.M, o); } }
    const n = $('#pl-wrap', body); if (n && keep) { n.scrollLeft = keep[0]; n.scrollTop = keep[1]; }
    requestAnimationFrame(() => P.dibujarLineas());
  }
  function montar(el, pid, M) {
    cur = { el, pid, M, ro: !App.canEdit() };
    el.innerHTML = `<div class="pf-plan${pid ? '' : ' port'}"><div class="plan-head"></div><div id="plan-body"></div></div>`;
    $('.plan-head', el).addEventListener('click', ev => {
      const b = ev.target.closest('[data-ph]'); if (!b || b.disabled) return;
      const a = b.dataset.ph;
      if (a === 'undo') deshacer();
      if (a === 'lb') fijarLineaBase(false);
      if (a === 'lb-otra') fijarLineaBase(true);
      if (a === 'lb-quitar') quitarLineaBase();
      if (a === 'meta') fechaMeta(b);
      if (a === 'inv') involucrados();
      if (a === 'mesa') toggleMesa();
    });
    pintar();
  }
  // Un proyecto: el plan completo, editable
  function render(el, pid) { montar(el, pid, modelo(pid)); }

  // Todo el portafolio: cada proyecto es un capítulo y sus capítulos, subcapítulos (solo lectura)
  function modeloPortafolio(pids) {
    const sections = [], activities = [], notas = [], miembros = [];
    let base = null;
    pids.forEach((pid, i) => {
      const p = App.byId('projects', pid), M = modelo(pid), raiz = 'p:' + pid;
      sections.push({ id: raiz, name: App.projectName(p), position: i, parentId: null, enabled: true });
      const tops = new Map();
      M.sections.forEach(s => { tops.set(s.id, s.parentId && M.sections.some(x => x.id === s.parentId) ? s.parentId : s.id); });
      P.ordenSecciones(M.sections).filter(s => tops.get(s.id) === s.id).forEach((s, k) => sections.push({ id: s.id, name: s.name, position: k, parentId: raiz, enabled: s.enabled }));
      M.activities.forEach(a => { a.sectionId = a.sectionId && tops.has(a.sectionId) ? tops.get(a.sectionId) : raiz; activities.push(a); });
      notas.push(...M.notas); (M.miembros || []).forEach(m => { if (!miembros.some(x => P.norm(x.nombre) === P.norm(m.nombre))) miembros.push(m); });
      if (M.lineaBase) base = M.lineaBase;
    });
    const M = { pid: null, sections, activities, tasks: [], notas, miembros, lineaBase: base, fechaMeta: null, today: hoy() };
    M.summary = resumen(activities, M.today);
    return M;
  }
  function renderPortafolio(el, pids) { montar(el, null, modeloPortafolio(pids)); }

  // Mientras se arrastra, se elige en una lista o se guarda, la sincronización no repinta encima
  function ocupado() {
    return guardando > 0 || !!document.querySelector('.pl-selpop, .pl-pop.fijo, .pl-picker, .pl-menu, body.pl-arrastrando, body.pl-resizing, body.pl-seleccionando');
  }

  /* ---------- Sección «Cronograma» ---------- */
  const LS_SEL = 'cron.sel';
  function seccion(main, params) {
    const ps = App.projectsSorted();
    const ec = App.estadoCol();
    const filtro = App.store.get('cron.estado', '');
    let pid = params[0] && App.byId('projects', params[0]) ? params[0] : null;
    if (!params[0] && !pid) { const g = App.store.get(LS_SEL, null); if (g && App.byId('projects', g)) pid = g; }
    if (params[0] === 'todos') pid = null;
    App.store.set(LS_SEL, pid || 'todos');
    const visibles = ps.filter(p => !filtro || !ec || (p.props || {})[ec.id] === filtro);
    const acts = App.S.activities.filter(a => visibles.some(p => p.id === a.project_id));
    const late = acts.filter(a => a.fin && a.fin < hoy() && (a.avance || 0) < 100 && !a.real_fin).length;
    main.innerHTML = `<div class="page-h"><button class="burger" data-act="burger">☰</button><div><h1>Cronograma</h1><div class="sub">${pid ? esc(App.projectName(App.byId('projects', pid))) + ' · plan de trabajo' : `${visibles.length} proyectos · ${acts.length} actividades${late ? ` · <b style="color:var(--crit-ink)">${late} atrasadas</b>` : ''}`}</div></div><span class="sp"></span>
        ${!pid && ec ? `<select class="fld" id="gEstado" style="width:auto"><option value="">Todos los estados</option>${(ec.options || []).map(o => `<option ${filtro === o.name ? 'selected' : ''}>${esc(o.name)}</option>`).join('')}</select>` : ''}
        ${pid ? `<a class="btn" href="#/proyectos/${pid}">Abrir proyecto →</a>` : ''}</div>
      <div class="cron-tabs"><a class="ctab${pid ? '' : ' on'}" href="#/cronograma/todos" title="Todos los proyectos en un solo cronograma (solo lectura)">▦ Todo el portafolio</a>${ps.map(p => { const pl = App.planOf(p.id); return `<a class="ctab${p.id === pid ? ' on' : ''}" href="#/cronograma/${p.id}"><i style="background:var(--c-${App.projectColor(p)}-i)"></i>${esc(App.projectName(p))}${pl.acts.length ? `<span class="n">${pl.avance}%</span>` : ''}</a>`; }).join('')}</div>
      ${pid ? '' : '<div class="cron-nota">Vista del portafolio: cada proyecto es un capítulo. Para editar, elige el proyecto arriba.</div>'}
      <div id="gBox"></div>`;
    const sel = $('#gEstado', main); if (sel) sel.onchange = () => { App.store.set('cron.estado', sel.value); App.render(); };
    $('.burger', main).onclick = App.toggleSide;
    if (pid) render($('#gBox', main), pid); else renderPortafolio($('#gBox', main), visibles.map(p => p.id));
  }

  window.addEventListener('resize', () => { if (cur && document.body.contains(cur.el)) { if (optsDe().zoom === 'ajustar') pintar(); else P.dibujarLineas(); } });

  App.PlanHost = { render, renderPortafolio, ocupado, deshacer, modelo, aModelo, aNativo };
  App.views.cronograma = { render: seccion };
})();
