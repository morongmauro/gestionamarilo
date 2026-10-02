// ============================================================
// HOJA DE PLAN DE TRABAJO · compartida entre la app y el enlace
// Una sola forma de pintar el plan: áreas (fases) con color, ID tipo
// Excel, responsable, entregable, fechas plan y reales, días hábiles,
// % avance, estado y cronograma con zoom (día · semana · mes).
//
// La página que la usa define estas funciones globales (las que no
// defina simplemente no aparecen):
//   planOnPatch(id, cambios)       guardar cambios de una actividad
//   planOnOpen(id)                 abrir el detalle de una actividad
//   planOnAdd(sectionId, input)    agregar actividad en un área
//   planOnProposal(id, aceptar)    aceptar / descartar una propuesta
//   planOnTask(accion, id, extra)  tareas: open · done · reopen · link · unlink
//   planOnSection(accion, id)      áreas: rename · off · on · remove
//   planSetOpt(clave, valor)       cambiar filtros / zoom / columnas
// ============================================================
(function () {
  const DAYMS = 86400000;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const dayDiff = (a, b) => Math.round((new Date(b + 'T12:00:00Z') - new Date(a + 'T12:00:00Z')) / DAYMS);
  const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const MES_L = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const fCorta = iso => iso ? `${Number(iso.slice(8, 10))} ${MES[Number(iso.slice(5, 7)) - 1]}` : '';
  const AREA_COLORS = ['#6C8EF5', '#F0875A', '#3FB592', '#AE7BEA', '#E3AE24', '#40AED6', '#E86B98', '#86BA52'];

  // ---------- Calendario laboral Colombia (espejo de lib/calendario.js) ----------
  const cacheFest = {};
  function festivos(y) {
    if (cacheFest[y]) return cacheFest[y];
    const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    const p2 = n => String(n).padStart(2, '0');
    const pas = `${y}-${p2(Math.floor((h + l - 7 * m + 114) / 31))}-${p2((h + l - 7 * m + 114) % 31 + 1)}`;
    const lunes = iso => { const dow = new Date(iso + 'T12:00:00Z').getUTCDay(); return dow === 1 ? iso : addDays(iso, (8 - dow) % 7); };
    const f2 = (mm, dd) => `${y}-${p2(mm)}-${p2(dd)}`;
    cacheFest[y] = new Set([f2(1, 1), f2(5, 1), f2(7, 20), f2(8, 7), f2(12, 8), f2(12, 25), addDays(pas, -3), addDays(pas, -2),
      lunes(f2(1, 6)), lunes(f2(3, 19)), lunes(f2(6, 29)), lunes(f2(8, 15)), lunes(f2(10, 12)), lunes(f2(11, 1)), lunes(f2(11, 11)),
      lunes(addDays(pas, 39)), lunes(addDays(pas, 60)), lunes(addDays(pas, 68))]);
    return cacheFest[y];
  }
  const esHabil = iso => { const dow = new Date(iso + 'T12:00:00Z').getUTCDay(); return dow !== 0 && dow !== 6 && !festivos(Number(iso.slice(0, 4))).has(iso); };
  const habilDesde = iso => { let x = iso; while (!esHabil(x)) x = addDays(x, 1); return x; };
  function finHabil(ini, dur) { let x = habilDesde(ini), n = 1; while (n < Math.max(1, dur)) { x = addDays(x, 1); if (esHabil(x)) n++; } return x; }
  function diasHabiles(ini, fin) { if (!ini || !fin || fin < ini) return 0; let n = 0; for (let x = ini; x <= fin; x = addDays(x, 1)) if (esHabil(x)) n++; return n; }
  function sumarHabiles(iso, n) { let x = iso, paso = n < 0 ? -1 : 1, falta = Math.abs(n); while (falta > 0) { x = addDays(x, paso); if (esHabil(x)) falta--; } return x; }
  function difHabiles(d, h) { if (!d || !h || d === h) return 0; return h > d ? diasHabiles(addDays(d, 1), h) : -diasHabiles(addDays(h, 1), d); }
  function moverRango(ini, fin, n) {
    if (ini && fin) { const dur = Math.max(1, diasHabiles(ini, fin)); const ni = habilDesde(sumarHabiles(habilDesde(ini), n)); return { ini: ni, fin: finHabil(ni, dur) }; }
    const nuevo = habilDesde(sumarHabiles(habilDesde(ini || fin), n));
    return { ini: ini ? nuevo : null, fin: fin ? nuevo : null };
  }

  // ---------- Fechas en cascada (espejo del servidor) ----------
  const finEf = a => a.realEnd || a.deadline || null;
  const terminada = a => !!a.realEnd || (a.pctComplete || 0) >= 100;
  // Todo lo que depende de `id` se corre `delta` días hábiles (adelante o atrás)
  function cascada(acts, id, delta) {
    if (!delta) return 0;
    const suc = new Map(acts.map(a => [a.id, []]));
    acts.forEach(a => (a.dependsOnIds || []).forEach(p => { if (suc.has(p) && p !== a.id) suc.get(p).push(a); }));
    const vistas = new Set([id]), cola = [...(suc.get(id) || [])];
    let n = 0;
    while (cola.length) {
      const a = cola.shift();
      if (vistas.has(a.id)) continue;
      vistas.add(a.id);
      if (terminada(a)) continue;
      if (a.startDate || a.deadline) { const r = moverRango(a.startDate, a.deadline, delta); a.startDate = r.ini; a.deadline = r.fin; n++; }
      (suc.get(a.id) || []).forEach(s => cola.push(s));
    }
    return n;
  }
  // Nada arranca antes del día hábil siguiente al fin de lo que lo condiciona
  function adelantar(acts) {
    const byId = new Map(acts.map(a => [a.id, a])), estado = {};
    let n = 0;
    const resolver = a => {
      if (estado[a.id]) return;
      estado[a.id] = 1;
      let min = null;
      (a.dependsOnIds || []).forEach(pid => {
        const p = byId.get(pid); if (!p || p.id === a.id) return;
        resolver(p);
        const f = finEf(p);
        if (f) { const s = habilDesde(addDays(f, 1)); if (!min || s > min) min = s; }
      });
      const ini = a.startDate || a.deadline;
      if (min && ini && ini < min && !terminada(a)) {
        const r = moverRango(a.startDate, a.deadline, difHabiles(habilDesde(ini), min));
        a.startDate = r.ini; a.deadline = r.fin; n++;
      }
      estado[a.id] = 2;
    };
    acts.forEach(resolver);
    return n;
  }
  // Aplica cambios a una actividad del modelo local con las mismas reglas del servidor
  // Las fechas reales solo las pone el usuario (nunca se inventan).
  // Lo único automático: poner el fin real deja el avance en 100%.
  function amarrarReal(a, cambios) {
    if (cambios.realEnd && cambios.pctComplete === undefined) { a.pctComplete = 100; a.status = 'completada'; }
  }
  function aplicarLocal(acts, id, cambios, today) {
    const a = acts.find(x => x.id === id); if (!a) return 0;
    const antes = finEf(a);
    Object.assign(a, cambios);
    amarrarReal(a, cambios);
    const toca = ['startDate', 'deadline', 'realStart', 'realEnd', 'dependsOnIds', 'pctComplete'].some(k => cambios[k] !== undefined);
    if (!toca) return 0;
    const despues = finEf(a);
    const n = (antes && despues) ? cascada(acts, id, difHabiles(antes, despues)) : 0;
    return n + adelantar(acts);
  }

  // ---------- Estado como en el Excel ----------
  function estado(a, today) {
    const pct = a.pctComplete || 0;
    if (pct >= 100 || a.realEnd) return 'Completada';
    if (a.deadline && today > a.deadline) return 'Atrasada';
    if (a.realStart || pct > 0 || (a.startDate && today >= a.startDate)) return 'En curso';
    return 'Por iniciar';
  }
  const estHtml = e => `<span class="pl-est ${e.replace(' ', '-')}">${e}</span>`;
  const has = fn => typeof window[fn] === 'function';

  // ---------- Escala del cronograma ----------
  const ZOOM = { dia: 26, semana: 9, mes: 2.4 };
  const lunesDe = iso => { const dow = new Date(iso + 'T12:00:00Z').getUTCDay(); return addDays(iso, dow === 0 ? -6 : 1 - dow); };
  // «ajustar»: todo el cronograma cabe en el ancho disponible (sin moverse a los lados)
  function escala(fechas, today, zoom, ancho) {
    const orden = [...fechas, today].filter(Boolean).sort();
    let ini = orden[0], fin = orden[orden.length - 1];
    if (zoom === 'ajustar') {
      ini = lunesDe(addDays(ini, -2)); // el fin ya trae el mes siguiente a la meta completo
      const dias = dayDiff(ini, fin) + 1;
      const ppd = Math.max(1.2, (ancho || 700) / dias);
      return { ini, fin, ppd, dias, W: Math.round(dias * ppd), x: iso => (dayDiff(ini, iso)) * ppd, modo: ppd * 7 >= 30 ? 'semana' : 'mes' };
    }
    const ppd = ZOOM[zoom] || ZOOM.semana;
    if (zoom === 'mes') { ini = ini.slice(0, 8) + '01'; const f = new Date(fin.slice(0, 8) + '01T12:00:00Z'); f.setUTCMonth(f.getUTCMonth() + 1); fin = addDays(f.toISOString().slice(0, 10), -1); }
    else { ini = lunesDe(addDays(ini, -3)); fin = addDays(lunesDe(fin), 13); }
    if (dayDiff(ini, fin) < 7 * 12) fin = addDays(ini, 7 * 12 - 1);
    const dias = dayDiff(ini, fin) + 1;
    return { ini, fin, ppd, dias, W: Math.round(dias * ppd), x: iso => (dayDiff(ini, iso)) * ppd, modo: zoom };
  }
  function escalaHead(E, today, zoomPedido) {
    const zoom = E.modo || zoomPedido;
    let top = '', bot = '';
    // Meses (arriba) o años (en zoom mes)
    for (let d = E.ini; d <= E.fin;) {
      const y = Number(d.slice(0, 4)), m = Number(d.slice(5, 7));
      const sig = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
      const x0 = E.x(d), x1 = E.x(sig > E.fin ? addDays(E.fin, 1) : sig);
      if (zoom === 'mes') bot += `<span class="pl-sc-b" style="left:${x0}px;width:${x1 - x0}px">${MES[m - 1]}</span>`;
      else top += `<span class="pl-sc-t" style="left:${x0}px;width:${x1 - x0}px">${x1 - x0 < 90 ? MES[m - 1] : MES_L[m - 1]}${(m === 1 || d === E.ini) && x1 - x0 >= 60 ? ' ' + String(y).slice(2) : ''}</span>`;
      d = sig;
    }
    if (zoom === 'mes') {
      for (let y = Number(E.ini.slice(0, 4)); y <= Number(E.fin.slice(0, 4)); y++) {
        const a = `${y}-01-01` < E.ini ? E.ini : `${y}-01-01`, b = `${y}-12-31` > E.fin ? E.fin : `${y}-12-31`;
        top += `<span class="pl-sc-t" style="left:${E.x(a)}px;width:${E.x(addDays(b, 1)) - E.x(a)}px">${y}</span>`;
      }
    } else if (zoom === 'semana') {
      const hoyL = lunesDe(today);
      let n = 1;
      for (let w = E.ini; w <= E.fin; w = addDays(w, 7), n++) {
        bot += `<span class="pl-sc-b${w === hoyL ? ' now' : ''}" style="left:${E.x(w)}px;width:${7 * E.ppd}px" title="Semana ${n} · lunes ${fCorta(w)}">${Number(w.slice(8, 10))}</span>`;
      }
    } else {
      for (let d = E.ini; d <= E.fin; d = addDays(d, 1)) {
        const dow = new Date(d + 'T12:00:00Z').getUTCDay();
        bot += `<span class="pl-sc-b${d === today ? ' now' : ''}${esHabil(d) ? '' : ' off'}" style="left:${E.x(d)}px;width:${E.ppd}px" title="${fCorta(d)}">${Number(d.slice(8, 10))}<em>${'DLMMJVS'[dow]}</em></span>`;
      }
    }
    return `<div class="pl-scale" style="width:${E.W}px">${top}${bot}<span class="pl-sc-hoy" style="left:${E.x(today) + E.ppd / 2}px" title="Hoy">${Number(today.slice(8, 10))}</span></div>`;
  }
  // Fondo de cada carril: franjas suaves por semana (o fin de semana en zoom día) + hoy
  function carrilFondo(E, today, zoomPedido) {
    const zoom = E.modo || zoomPedido;
    let bg = '';
    if (zoom === 'semana') bg = `background-image:repeating-linear-gradient(90deg,transparent 0 ${7 * E.ppd}px,var(--pl-shade) ${7 * E.ppd}px ${14 * E.ppd}px)`;
    else if (zoom === 'dia') bg = `background-image:repeating-linear-gradient(90deg,transparent 0 ${5 * E.ppd}px,var(--pl-shade) ${5 * E.ppd}px ${7 * E.ppd}px)`;
    const semana = zoom !== 'mes' ? `<span class="pl-now" style="left:${E.x(zoom === 'dia' ? today : lunesDe(today))}px;width:${(zoom === 'dia' ? 1 : 7) * E.ppd}px"></span>` : '';
    return { style: bg, capas: semana + `<span class="pl-hoy" style="left:${E.x(today) + E.ppd / 2}px"></span>` };
  }

  // ---------- Agrupación: por etapa (fases del plan) o por área responsable ----------
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const respDe = a => (a.responsables && a.responsables.length) ? a.responsables : (a.responsable ? String(a.responsable).split(',').map(x => x.trim()).filter(Boolean) : []);
  // Cada persona / área tiene siempre el mismo tono (avatares y grupos coinciden)
  function colorDe(nombre) {
    let h = 0; for (const ch of norm(nombre)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return AREA_COLORS[h % AREA_COLORS.length];
  }
  // Los códigos (1, 1.1…) salen siempre de las etapas, agrupe como agrupe
  function etapas(model) {
    const secs = [...(model.sections || [])].sort((a, b) => a.position - b.position);
    const acts = model.activities || [];
    const orden = (a, b) => (a.position || 0) - (b.position || 0);
    const gs = secs.map((s, i) => ({ key: s.id, id: s.id, name: s.name, sec: s, color: AREA_COLORS[i % AREA_COLORS.length], acts: acts.filter(a => a.sectionId === s.id).sort(orden) }));
    const huerf = acts.filter(a => !a.sectionId || !secs.some(s => s.id === a.sectionId)).sort(orden);
    if (huerf.length) gs.push({ key: '_otras', id: null, name: 'Otras', sec: null, color: '#9A9384', acts: huerf });
    // Una etapa cuyo nombre empieza con «0 ·» se numera 0 (arranque); las demás siguen 1, 2, 3…
    let n = 0, primera = true;
    gs.forEach(g => {
      if (g.sec && g.sec.enabled === false) return;
      const cero = /^0\s*[·.:\-–]\s*/.test(g.name);
      if (cero) g.name = g.name.replace(/^0\s*[·.:\-–]\s*/, '');
      const num = cero && primera ? 0 : ++n;
      primera = false;
      g.cod = String(num);
      g.acts.forEach((a, i) => { a._cod = `${num}.${i + 1}`; a._etapa = g.name; });
    });
    return gs;
  }
  // Área de un nombre: si es un involucrado del proyecto, su área; si no, el nombre mismo (p. ej. «Jurídica»)
  // Áreas de los responsables de una actividad (sin repetir)
  function areasActividad(a, miembros) {
    const out = [];
    respDe(a).forEach(r => {
      const m = (miembros || []).find(x => norm(x.nombre) === norm(r));
      const area = m ? m.area : ((miembros || []).some(x => norm(x.area) === norm(r)) ? r : null);
      if (area && !out.some(x => norm(x) === norm(area))) out.push(area);
    });
    return out;
  }
  function areaDe(nombre, miembros) {
    const m = (miembros || []).find(x => norm(x.nombre) === norm(nombre));
    return m ? (m.area || 'Sin área') : nombre;
  }
  function porArea(model, gsEtapas) {
    const orden = [];
    gsEtapas.forEach(g => { if (!(g.sec && g.sec.enabled === false)) g.acts.forEach(a => orden.push(a)); });
    const mapa = new Map();
    orden.forEach(a => {
      const r0 = respDe(a)[0];
      const nombre = r0 ? areaDe(r0, model.miembros) : 'Sin responsable';
      const k = 'a:' + norm(nombre);
      if (!mapa.has(k)) mapa.set(k, { key: k, id: null, name: nombre, sec: null, area: true, color: nombre === 'Sin responsable' ? '#9A9384' : colorDe(nombre), acts: [] });
      mapa.get(k).acts.push(a);
    });
    return [...mapa.values()].sort((x, y) => (x.name === 'Sin responsable') - (y.name === 'Sin responsable') || x.name.localeCompare(y.name));
  }

  // Avatares con iniciales; en la columna de responsable van también los nombres
  function avatares(nombres) {
    if (!nombres.length) return '';
    const ini = n => n.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
    const vis = nombres.slice(0, 3).map(n => `<span class="pl-av" style="background:${colorDe(n)}" title="${esc(n)}">${esc(ini(n))}</span>`).join('');
    return `<span class="pl-avs">${vis}${nombres.length > 3 ? `<span class="pl-av mas">+${nombres.length - 3}</span>` : ''}</span>`;
  }

  function filtrosHtml(model, opts, gs) {
    const today = model.today;
    const agr = opts.agrupar === 'area' ? 'area' : 'etapa';
    const vivas = gs.filter(g => !(g.sec && g.sec.enabled === false));
    const chip = g => {
      const avg = g.acts.length ? Math.round(g.acts.reduce((s, a) => s + (a.pctComplete || 0), 0) / g.acts.length) : 0;
      const tarde = g.acts.filter(a => estado(a, today) === 'Atrasada').length;
      const on = opts.grupo === g.key;
      return `<button class="pl-chip${on ? ' on' : ''}" style="--c:${g.color}" onclick="planSetOpt('grupo',${on ? 'null' : `'${esc(g.key)}'`})"><i></i>${esc(g.name)}<span class="n">${g.acts.length} · ${avg}%${tarde ? ` · <b>${tarde} atrasada${tarde > 1 ? 's' : ''}</b>` : ''}</span></button>`;
    };
    const personas = [];
    (model.activities || []).forEach(a => respDe(a).forEach(r => { if (!personas.some(p => norm(p) === norm(r))) personas.push(r); }));
    personas.sort((a, b) => a.localeCompare(b));
    const seg = (k, v, l, actual, tip) => `<button class="${actual === v ? 'on' : ''}" onclick="planSetOpt('${k}','${v}')"${tip ? ` title="${tip}"` : ''}>${l}</button>`;
    // Interruptor con nombre claro de lo que muestra u oculta
    const sw = (on, accion, l, tip) => `<button class="pl-sw${on ? ' on' : ''}" onclick="${accion}" title="${tip}"><i></i>${l}</button>`;
    const full = opts.vista === 'tabla';
    const opciones = `<div class="pl-opts">
        <div class="pl-og"><span class="pl-ol">Vista</span>
          <div class="pl-seg">${seg('vista', 'gantt', '📊 Gantt', opts.vista || 'gantt', 'Lo esencial y el cronograma a la vista')}${seg('vista', 'tabla', '▤ Tabla completa', opts.vista || 'gantt', 'Todas las columnas: área, entregable, fechas reales, dependencias…')}</div></div>
        <div class="pl-og"><span class="pl-ol">Agrupar por</span>
          <div class="pl-seg">${seg('agrupar', 'etapa', 'Etapa', agr, 'Etapas del plan (1, 2, 3…)')}${seg('agrupar', 'area', 'Área responsable', agr, 'Área de cada responsable (según los involucrados)')}</div></div>
        <div class="pl-og"><span class="pl-ol">Escala del cronograma</span>
          <div class="pl-seg">${seg('zoom', 'ajustar', 'Todo', opts.zoom, 'Todo el cronograma en el ancho de la pantalla')}${seg('zoom', 'dia', 'Día', opts.zoom)}${seg('zoom', 'semana', 'Semana', opts.zoom)}${seg('zoom', 'mes', 'Mes', opts.zoom)}</div></div>
        <div class="pl-og pl-og-sw"><span class="pl-ol">Mostrar</span>
          <div class="pl-sws">
            ${sw(opts.lineas !== false, `planSetOpt('lineas',${opts.lineas === false})`, 'Líneas de relación', 'Flechas entre actividades que dependen una de otra')}
            ${sw(!!opts.panel, `planSetOpt('panel',${!opts.panel})`, 'Panel de involucrados', 'Lista lateral de personas y áreas con lo que tiene cada una')}
            ${opts.owner ? sw(!!opts.tareas, `planSetOpt('tareas',${!opts.tareas})`, 'Tareas del día a día', 'Las microtareas vinculadas, debajo de cada actividad') : ''}
            ${full ? sw(!!opts.cols.entregable, "planSetOpt('col','entregable')", 'Entregable', 'Columna de entregable / resultado') + sw(!!opts.cols.real, "planSetOpt('col','real')", 'Fechas reales', 'Columnas de inicio y fin reales') + sw(!!opts.cols.deps, "planSetOpt('col','deps')", 'Depende de', 'Columna con los IDs de las que la condicionan') : ''}
          </div></div>
      </div>`;
    const filtro = `<div class="pl-filt">
        <span class="pl-ol">Filtrar</span>
        <select class="pl-sel" onchange="planSetOpt('resp',this.value)" title="Ver solo lo de un responsable">
          <option value="">👤 Todos los responsables</option>
          ${personas.map(p => `<option value="${esc(p)}"${norm(opts.resp) === norm(p) ? ' selected' : ''}>${esc(p)}</option>`).join('')}
        </select>
        <div class="pl-areas">
          <button class="pl-chip todas${opts.grupo ? '' : ' on'}" onclick="planSetOpt('grupo',null)">${agr === 'area' ? 'Todas las áreas' : 'Todas las etapas'}</button>
          ${vivas.map(chip).join('')}
        </div>
      </div>`;
    if (!opts.compacto) return opciones + filtro;
    // Modo compacto (enlace para directivos): una barra delgada y las opciones escondidas
    const solo = opts.plegadas === '*';
    return `<div class="pl-bar-c">
        <div class="pl-areas pl-areas-c">
          <button class="pl-chip todas${opts.grupo ? '' : ' on'}" onclick="planSetOpt('grupo',null)">${agr === 'area' ? 'Todas las áreas' : 'Todas las etapas'}</button>
          ${vivas.map(chip).join('')}
        </div>
        <div class="pl-bar-r">
          <button class="pl-optbtn${solo ? ' on' : ''}" onclick="planSetOpt('soloEtapas',${!solo})" title="Ver solo el resumen de cada etapa (vista macro)">${solo ? '▸ Ver actividades' : '▾ Solo etapas'}</button>
          <button class="pl-optbtn${opts.verOpciones ? ' on' : ''}" onclick="planSetOpt('verOpciones',${!opts.verOpciones})" title="Vista, agrupación, escala, filtros y qué mostrar">⚙ Opciones de vista</button>
        </div>
      </div>
      ${opts.verOpciones ? `<div class="pl-opts-c">${opciones}${filtro}</div>` : ''}`;
  }

  function celdaFecha(a, campo, editable, extra) {
    const v = a[campo] || '';
    const txt = v ? fCorta(v) : '—';
    if (!editable) return `<td class="pl-d${v ? '' : ' vacio'}${extra || ''}">${txt}</td>`;
    return `<td class="pl-d${extra || ''}"><button class="pl-date${v ? '' : ' vacio'}" data-v="${v}" onclick="Plan.pickDate(this,'${a.id}','${campo}')" title="${v ? 'Cambiar fecha' : 'Poner fecha'}">${v ? txt : '＋'}</button></td>`;
  }
  // «5 – 9 oct» / «28 sep – 2 oct»
  function rangoTxt(i, f) {
    if (!i && !f) return '';
    if (!i || !f || i === f) return fCorta(i || f);
    return i.slice(0, 7) === f.slice(0, 7) ? `${Number(i.slice(8, 10))} – ${fCorta(f)}` : `${fCorta(i)} – ${fCorta(f)}`;
  }
  // Píldora de cronograma como en Monday: se llena con el tiempo transcurrido
  function pildoraRango(i, f, today, est, color, click) {
    if (!i && !f) return '<span class="pl-mut">sin fechas</span>';
    const a = i || f, b = f || i;
    let p = today < a ? 0 : today > b ? 100 : Math.round((dayDiff(a, today) + 1) / (dayDiff(a, b) + 1) * 100);
    const col = est === 'Completada' ? 'var(--good)' : est === 'Atrasada' ? 'var(--crit)' : color;
    if (est === 'Completada') p = 100;
    return `<span class="pl-tlp" style="--c:${col};--p:${p}%"${click || ''} title="${fCorta(a)} → ${fCorta(b)}"><b>${rangoTxt(i, f)}</b></span>`;
  }
  // Batería de estados del grupo
  function bateria(acts, today) {
    const n = { Completada: 0, 'En curso': 0, Atrasada: 0, 'Por iniciar': 0 };
    acts.forEach(a => { n[estado(a, today)]++; });
    const tot = acts.length || 1;
    const tip = Object.entries(n).filter(([, v]) => v).map(([k, v]) => `${v} ${k.toLowerCase()}`).join(' · ');
    return `<span class="pl-bat" title="${tip}">${Object.entries(n).filter(([, v]) => v).map(([k, v]) => `<i class="${k.replace(' ', '-')}" style="width:${v / tot * 100}%"></i>`).join('')}</span>`;
  }
  // Desvío contra la línea base, en días hábiles (+ = va tarde)
  function desvio(a) {
    if (!a.baselineEnd) return null;
    const f = finEf(a); if (!f) return null;
    return difHabiles(a.baselineEnd, f);
  }
  const desvioHtml = d => d == null ? '<span class="pl-mut">—</span>'
    : d === 0 ? '<span class="pl-dv ok">a tiempo</span>'
    : `<span class="pl-dv ${d > 0 ? 'late' : 'ok'}" title="${d > 0 ? 'Días hábiles de atraso' : 'Días hábiles de adelanto'} contra la línea base">${d > 0 ? '+' : '−'}${Math.abs(d)}d</span>`;

  // ---------- Panel de involucrados (para que todos estén enterados) ----------
  function involucradosHtml(model, opts) {
    const today = model.today, en7 = addDays(today, 7);
    const stats = new Map();
    const statDe = nombre => {
      const k = norm(nombre);
      if (!stats.has(k)) stats.set(k, { nombre, total: 0, hechas: 0, tarde: 0, pronto: 0 });
      return stats.get(k);
    };
    (model.activities || []).forEach(a => respDe(a).forEach(r => {
      const p = statDe(r), est = estado(a, today);
      p.total++;
      if (est === 'Completada') p.hechas++;
      else if (est === 'Atrasada') p.tarde++;
      else if (a.deadline && a.deadline <= en7) p.pronto++;
    }));
    const miembros = model.miembros || [];
    const on = n => norm(opts.resp) === norm(n);
    const ini = n => n.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
    const fila = (nombre, sub) => {
      const p = stats.get(norm(nombre)) || { total: 0, hechas: 0, tarde: 0, pronto: 0 };
      return `<button class="pl-per${on(nombre) ? ' on' : ''}" onclick="planSetOpt('resp',${on(nombre) ? "''" : `'${esc(nombre).replace(/'/g, "\\'")}'`})" title="Ver solo lo de ${esc(nombre)}">
        <span class="pl-av" style="background:${colorDe(nombre)}">${esc(ini(nombre))}</span>
        <span class="pl-per-t"><b>${esc(nombre)}</b><span>${sub ? esc(sub) + ' · ' : ''}${p.total ? `${p.hechas}/${p.total} listas` : 'sin actividades'}${p.tarde ? ` · <em class="late">${p.tarde} atrasada${p.tarde > 1 ? 's' : ''}</em>` : ''}${p.pronto ? ` · <em class="soon">${p.pronto} vence${p.pronto > 1 ? 'n' : ''} pronto</em>` : ''}</span></span>
      </button>`;
    };
    let html = '';
    if (miembros.length) {
      // Involucrados agrupados por su área
      const areas = new Map();
      miembros.forEach(m => { const k = m.area || 'Sin área'; if (!areas.has(k)) areas.set(k, []); areas.get(k).push(m); });
      html += [...areas.entries()].sort((x, y) => x[0].localeCompare(y[0])).map(([area, ms]) =>
        `<div class="pl-side-a" style="--c:${colorDe(area)}"><i></i>${esc(area)}</div>${ms.map(m => fila(m.nombre, m.rol)).join('')}`).join('');
    }
    // Responsables que no están en la lista de involucrados (p. ej. un área escrita tal cual)
    const esMiembro = n => miembros.some(m => norm(m.nombre) === norm(n));
    const otros = [...stats.values()].filter(p => !esMiembro(p.nombre)).sort((x, y) => y.tarde - x.tarde || y.total - x.total);
    if (otros.length) html += `${miembros.length ? '<div class="pl-side-a"><i></i>Otros responsables</div>' : ''}${otros.map(p => fila(p.nombre)).join('')}`;
    if (!html) return '';
    return `<aside class="pl-side">
      <div class="pl-side-h">Involucrados <span class="pl-mut">${miembros.length || stats.size}</span></div>
      ${html}
    </aside>`;
  }

  // Indicador de notas y tareas de una actividad (abre su panel)
  function notasTareasBtn(a) {
    const m = ultimoModelo || {};
    const nN = (m.notas || []).filter(n => n.activityId === a.id).length + (a.notes ? 1 : 0);
    const ts = (m.tasks || []).filter(t => t.activityId === a.id);
    const nT = ts.filter(t => t.kanbanStatus !== 'done').length, nH = ts.length - nT;
    const vacio = !nN && !ts.length;
    return `<button class="pl-nb${vacio ? ' vacio' : ''}" onclick="planOnDetalle('${a.id}')" title="Notas y tareas de esta actividad">${vacio ? '＋ nota / tarea' : `${nN ? `💬 ${nN}` : ''}${ts.length ? ` ☑ ${nH}/${ts.length}` : ''}`}</button>`;
  }

  // Duración editable: fin = inicio + N días hábiles (sin inicio, arranca el próximo día hábil)
  let ultimoModelo = null;
  let ultimasClaves = [];
  function cambiarDuracion(id, valor) {
    const n = Math.round(Number(valor));
    if (!(n >= 1 && n <= 365) || !ultimoModelo) return;
    const a = (ultimoModelo.activities || []).find(x => x.id === id); if (!a) return;
    const ini = a.startDate || habilDesde(addDays(ultimoModelo.today, 1));
    window.planOnPatch(id, { startDate: ini, deadline: finHabil(ini, n) });
  }

  // ---------- Ancho de la columna «Actividad» (lo elige cada persona) ----------
  const NM_DEF = 300, NM_MIN = 160, NM_MAX = 900, NM_KEY = 'planNmW';
  let anchoNm = null;
  try { const g = Number(localStorage.getItem(NM_KEY)); if (g >= NM_MIN && g <= NM_MAX) anchoNm = g; } catch (e) {}
  function fijarAnchoNm(w, guardarlo) {
    anchoNm = w == null ? null : Math.round(Math.min(NM_MAX, Math.max(NM_MIN, w)));
    const html = document.documentElement;
    if (anchoNm == null) { html.classList.remove('pl-nmv'); html.style.removeProperty('--pl-nm'); }
    else { html.classList.add('pl-nmv'); html.style.setProperty('--pl-nm', anchoNm + 'px'); }
    if (guardarlo) try { anchoNm == null ? localStorage.removeItem(NM_KEY) : localStorage.setItem(NM_KEY, String(anchoNm)); } catch (e) {}
  }
  if (anchoNm != null) fijarAnchoNm(anchoNm, false);
  const alTerminarAncho = () => { dibujarLineas(); if (has('planOnAncho')) window.planOnAncho(); };
  document.addEventListener('mousedown', ev => {
    const h = ev.target.closest && ev.target.closest('.pl-resz');
    if (!h) return;
    ev.preventDefault();
    const th = h.parentElement, x0 = ev.clientX, w0 = th.getBoundingClientRect().width;
    document.body.classList.add('pl-resizing');
    let movio = false;
    const mover = e => { if (Math.abs(e.clientX - x0) > 2) movio = true; if (movio) fijarAnchoNm(w0 + e.clientX - x0, false); };
    const soltar = () => {
      document.removeEventListener('mousemove', mover); document.removeEventListener('mouseup', soltar);
      document.body.classList.remove('pl-resizing');
      // Un clic sin arrastrar no redibuja (así el doble clic sí llega)
      if (movio) { fijarAnchoNm(anchoNm, true); alTerminarAncho(); }
    };
    document.addEventListener('mousemove', mover); document.addEventListener('mouseup', soltar);
  });
  document.addEventListener('dblclick', ev => {
    const h = ev.target.closest && ev.target.closest('.pl-resz');
    if (!h) return;
    const tabla = h.closest('table');
    if (anchoNm != null && anchoNm > NM_DEF) { fijarAnchoNm(null, true); alTerminarAncho(); return; } // segundo doble clic: vuelve al normal
    // Mide el nombre más largo (sin recortar) y ajusta la columna a él
    const med = document.createElement('span');
    med.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;font:650 12px Montserrat,sans-serif';
    document.body.appendChild(med);
    let max = 0;
    tabla.querySelectorAll('td.pl-c-nm').forEach(td => {
      const el = td.querySelector('.pl-in.nm,.pl-tx.nm,.pl-an'); if (!el) return;
      med.textContent = el.value || el.textContent || '';
      max = Math.max(max, med.getBoundingClientRect().width + (td.querySelector('.pl-an') ? 60 : 0));
    });
    med.remove();
    fijarAnchoNm(Math.min(600, max + 56), true); alTerminarAncho(); // más ancho: arrastrando
  });
  // Toque en celular: también se puede arrastrar
  document.addEventListener('touchstart', ev => {
    const h = ev.target.closest && ev.target.closest('.pl-resz');
    if (!h) return;
    const th = h.parentElement, x0 = ev.touches[0].clientX, w0 = th.getBoundingClientRect().width;
    const mover = e => { e.preventDefault(); fijarAnchoNm(w0 + e.touches[0].clientX - x0, false); };
    const soltar = () => { h.removeEventListener('touchmove', mover); h.removeEventListener('touchend', soltar); fijarAnchoNm(anchoNm, true); alTerminarAncho(); };
    h.addEventListener('touchmove', mover, { passive: false }); h.addEventListener('touchend', soltar);
  }, { passive: true });

  // ---------- Líneas de relación (dependencias) sobre el cronograma ----------
  function dibujarLineas(raiz) {
    const cont = raiz || document;
    cont.querySelectorAll('svg.pl-links').forEach(svg => {
      let deps = [];
      try { deps = JSON.parse(svg.dataset.deps || '[]'); } catch (e) {}
      const canvas = svg.parentElement;
      const cr = canvas.getBoundingClientRect();
      svg.setAttribute('width', canvas.scrollWidth);
      svg.setAttribute('height', canvas.scrollHeight);
      const caja = id => {
        const el = canvas.querySelector(`[data-id="${id}"]`);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { l: r.left - cr.left, r: r.right - cr.left, y: r.top - cr.top + r.height / 2 };
      };
      let paths = '';
      deps.forEach(([de, a]) => {
        const p = caja(de), q = caja(a);
        if (!p || !q) return;
        const x1 = p.r, y1 = p.y, x2 = q.l - 3, y2 = q.y;
        const codo = Math.max(x1 + 8, Math.min(x2 - 8, x1 + 14));
        const d = x2 - 8 > x1
          ? `M${x1},${y1} H${codo} V${y2} H${x2}`
          : `M${x1},${y1} H${x1 + 8} V${(y1 + y2) / 2} H${x2 - 10} V${y2} H${x2}`;
        paths += `<path d="${d}" />`;
      });
      svg.innerHTML = `<defs><marker id="pl-flecha" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L8,4 L0,8 z" class="pl-flecha"/></marker></defs>${paths.replace(/<path d="/g, '<path marker-end="url(#pl-flecha)" d="')}`;
    });
  }

  function render(model, opts) {
    const today = model.today;
    const gsEt = etapas(model);
    const agr = opts.agrupar === 'area' ? 'area' : 'etapa';
    const gs = agr === 'area' ? porArea(model, gsEt) : gsEt;
    ultimasClaves = gs.map(g => g.key);
    if (opts.grupo && !gs.some(g => g.key === opts.grupo)) opts.grupo = null;
    const editable = !!opts.editable;
    const base = !!model.lineaBase;
    // Vista «gantt»: lo esencial y el cronograma a la vista. «tabla»: todas las columnas.
    const full = opts.vista === 'tabla';
    const c0 = opts.cols || {};
    const cols = { entregable: full && c0.entregable, real: full && c0.real, deps: full && c0.deps, dias: editable || full, area: full, base: full && base, desvio: full && base, full };
    ultimoModelo = model;
    const tareas = opts.owner && opts.tareas ? (model.tasks || []) : [];
    const tareasDe = id => tareas.filter(t => t.activityId === id)
      .sort((x, y) => (x.kanbanStatus === 'done') - (y.kanbanStatus === 'done') || (x.dueDate || '9').localeCompare(y.dueDate || '9'));
    const codigo = {}; gsEt.forEach(g => g.acts.forEach(a => { codigo[a.id] = a._cod; }));
    const pasaResp = a => !opts.resp || respDe(a).some(r => norm(r).includes(norm(opts.resp)));

    const fechas = [];
    (model.activities || []).forEach(a => ['startDate', 'deadline', 'realStart', 'realEnd', 'baselineStart', 'baselineEnd'].forEach(k => { if (a[k]) fechas.push(a[k]); }));
    tareas.forEach(t => { if (t.activityId && t.dueDate) fechas.push(t.dueDate); });
    // La escala llega hasta el fin del mes siguiente a la fecha meta (o al último fin si no hay meta):
    // meta a finales de noviembre → se ve diciembre completo
    const ref = model.fechaMeta || fechas.slice().sort().pop();
    if (ref) {
      const [y, m] = ref.split('-').map(Number);
      fechas.push(ref, addDays(`${m >= 11 ? y + 1 : y}-${String(m >= 11 ? m - 10 : m + 2).padStart(2, '0')}-01`, -1));
    }
    const zoom = opts.zoom || 'semana';
    const E = escala(fechas, today, zoom, opts.anchoTL);
    const fondo = carrilFondo(E, today, zoom);
    const meta = model.fechaMeta || null;
    if (meta && meta >= E.ini && meta <= E.fin) fondo.capas += `<span class="pl-meta" style="left:${E.x(addDays(meta, 1))}px" title="Fecha meta: ${fCorta(meta)}"></span>`;
    const carril = contenido => `<td class="pl-tl"><div class="pl-lane" style="width:${E.W}px;${fondo.style}">${fondo.capas}${contenido}</div></td>`;

    const nCols = (full ? 7 : 6) + (cols.dias ? 1 : 0) + (cols.area ? 1 : 0) + (cols.entregable ? 1 : 0) + (cols.base ? 1 : 0) + (cols.real ? 2 : 0) + (cols.desvio ? 1 : 0) + (cols.deps ? 1 : 0);
    const lbI = base ? 'Inicio proy.' : 'Inicio', lbF = base ? 'Fin proy.' : 'Fin';
    const head = `<thead><tr>
      <th class="pl-sk pl-c-id">ID</th><th class="pl-sk pl-c-nm">Actividad<span class="pl-resz" title="Arrastra para ensanchar o angostar la columna · doble clic: ajustar a los nombres (otro doble clic: volver al ancho normal)"></span></th><th class="pl-c-rs">Responsable</th>
      ${cols.area ? '<th class="pl-c-ar" title="Sale sola del área de cada responsable registrado en «Involucrados»">Área responsable</th>' : ''}
      ${cols.entregable ? '<th class="pl-c-en">Entregable / resultado</th>' : ''}
      ${cols.base ? '<th class="pl-c-lb" title="Fechas congeladas al fijar la línea base: no se mueven">🔒 Línea base</th>' : ''}
      ${full ? `<th class="pl-c-d" title="${base ? 'Inicio proyectado: se recalcula solo con las fechas reales y las dependencias' : 'Inicio planeado'}">${lbI}</th>
      <th class="pl-c-d" title="${base ? 'Fin proyectado: se recalcula solo con las fechas reales y las dependencias' : 'Fin planeado'}">${lbF}</th>`
      : `<th class="pl-c-tl" title="${base ? 'Fechas proyectadas (se recalculan con lo real y las dependencias)' : 'Fechas planeadas'}">${base ? 'Cronograma proy.' : 'Cronograma'}</th>`}
      ${cols.real ? '<th class="pl-c-d real" title="Cuándo empezó de verdad">Inicio real</th><th class="pl-c-d real" title="Cuándo terminó de verdad (la da por completada)">Fin real</th>' : ''}
      ${cols.dias ? `<th class="pl-c-n" title="Duración en días hábiles (sin fines de semana ni festivos de Colombia)${editable ? '. Cámbiala aquí: el fin se recalcula y lo que depende se corre en cascada' : ''}">Días</th>` : ''}
      ${cols.desvio ? '<th class="pl-c-dv" title="Días hábiles de diferencia entre el fin (real o proyectado) y la línea base">Desvío</th>' : ''}
      <th class="pl-c-p${full ? '' : ' corta'}">Avance</th><th class="pl-c-e">Estado</th>
      ${cols.deps ? '<th class="pl-c-dp">Depende de</th>' : ''}
      <th class="pl-tl-h">${escalaHead(E, today, zoom).replace(/<\/div>$/, meta && meta >= E.ini && meta <= E.fin ? `<span class="pl-sc-meta" style="left:${E.x(addDays(meta, 1))}px">Meta ${fCorta(meta)}</span></div>` : '</div>')}</th>
    </tr></thead>`;

    const filas = gs.map(g => {
      if (opts.grupo && g.key !== opts.grupo) return '';
      const plegada = opts.plegadas === '*' || (Array.isArray(opts.plegadas) && opts.plegadas.includes(g.key));
      if (g.sec && g.sec.enabled === false) {
        if (!opts.owner || agr !== 'etapa') return '';
        return `<tr class="pl-area off"><td class="pl-sk pl-c-id"></td><td class="pl-sk pl-c-nm"><span class="pl-an">${esc(g.name)}</span> <span class="pl-mut">no aplica</span> <button class="pl-mini" onclick="planOnSection('on','${g.id}')">activar</button></td><td colspan="${nCols - 2}"></td>${carril('')}</tr>`;
      }
      const acts = g.acts.filter(pasaResp);
      if (opts.resp && !acts.length) return '';
      const fs = []; acts.forEach(a => { if (a.startDate) fs.push(a.startDate); if (a.deadline) fs.push(a.deadline); }); fs.sort();
      const fI = fs[0] || null, fF = fs[fs.length - 1] || null;
      const avg = acts.length ? Math.round(acts.reduce((s, a) => s + (a.pctComplete || 0), 0) / acts.length) : 0;
      const hechas = acts.filter(a => estado(a, today) === 'Completada').length;
      const estA = acts.length ? (avg >= 100 ? 'Completada' : fF && today > fF ? 'Atrasada' : fI && today >= fI ? 'En curso' : 'Por iniciar') : '';
      const tools = opts.owner && g.id && agr === 'etapa' ? `<span class="pl-tools"><button onclick="planOnSection('rename','${g.id}')" title="Renombrar">✎</button><button onclick="planOnSection('off','${g.id}')" title="Esta etapa no aplica">no aplica</button>${g.acts.length ? '' : `<button onclick="planOnSection('remove','${g.id}')" title="Eliminar">🗑</button>`}</span>` : '';
      const sum = fI ? `<span class="pl-sum" style="left:${E.x(fI)}px;width:${Math.max(6, E.x(addDays(fF, 1)) - E.x(fI))}px;--c:${g.color}"><i style="width:${avg}%"></i></span>` : '';
      const dvs = acts.map(desvio).filter(d => d != null);
      const dvMax = dvs.length ? Math.max(...dvs) : null;
      const areaRow = `<tr class="pl-area" style="--c:${g.color}">
        <td class="pl-sk pl-c-id"><span class="pl-acod">${g.area ? esc(g.name.slice(0, 1).toUpperCase()) : (g.cod || '')}</span></td>
        <td class="pl-sk pl-c-nm"><button class="pl-fold" onclick="planSetOpt('plegar','${esc(g.key)}')" title="${plegada ? 'Ver sus actividades' : 'Contraer esta etapa'}">${plegada ? '▸' : '▾'}</button><span class="pl-an">${esc(g.name)}</span><span class="pl-mut">${hechas}/${acts.length} · ${avg}%</span>${tools}</td>
        <td></td>${cols.area ? '<td></td>' : ''}${cols.entregable ? '<td></td>' : ''}${cols.base ? '<td></td>' : ''}
        ${full ? `<td class="pl-d b">${fCorta(fI)}</td><td class="pl-d b">${fCorta(fF)}</td>`
          : `<td class="pl-tlc">${fI ? pildoraRango(fI, fF, today, estA, g.color) : ''}${base && dvMax != null && dvMax > 0 ? ' ' + desvioHtml(dvMax) : ''}</td>`}${cols.real ? '<td></td><td></td>' : ''}
        ${cols.dias ? `<td class="pl-n">${fI ? diasHabiles(fI, fF) : ''}</td>` : ''}
        ${cols.desvio ? `<td>${dvMax != null && dvMax > 0 ? desvioHtml(dvMax) : ''}</td>` : ''}
        <td class="pl-p${full ? '' : ' corta'}">${full ? `<span class="pl-pbar" style="--c:${g.color}"><i style="width:${avg}%"></i></span>` : ''}<b>${avg}%</b></td>
        <td class="pl-stc">${acts.length ? bateria(acts, today) : ''}</td>${cols.deps ? '<td></td>' : ''}
        ${carril(sum)}
      </tr>`;
      const actRows = plegada ? '' : acts.map(a => filaActividad(a, g, today, E, carril, editable, opts, cols, codigo, base) +
        tareasDe(a.id).map(t => filaTarea(t, today, E, carril, nCols)).join('')).join('');
      const add = !plegada && opts.owner && editable && agr === 'etapa' ? `<tr class="pl-add"><td class="pl-sk pl-c-id"></td><td class="pl-sk pl-c-nm"><input placeholder="＋ Actividad en ${esc(g.name)}" onkeydown="if(event.key==='Enter')planOnAdd('${g.id || ''}',this)"></td><td colspan="${nCols - 2}"></td>${carril('')}</tr>` : '';
      return areaRow + actRows + add;
    }).join('');
    const addArea = opts.owner && editable && agr === 'etapa' && !opts.grupo && !opts.resp ? `<tr class="pl-add"><td class="pl-sk pl-c-id"></td><td class="pl-sk pl-c-nm"><input placeholder="＋ Nueva etapa" onkeydown="if(event.key==='Enter')planOnAdd('__area__',this)"></td><td colspan="${nCols - 2}"></td>${carril('')}</tr>` : '';

    const vacio = (model.activities || []).length ? '' : `<div class="pl-vacio">${opts.vacioHtml || 'Aún no hay actividades en este plan.'}</div>`;
    const leyenda = `<div class="pl-ley">
      <span><i class="sw plan"></i>${base ? 'Proyectado' : 'Planeado'}</span><span><i class="sw av"></i>Avance</span><span><i class="sw ok"></i>Completado</span>
      <span><i class="sw late"></i>Atrasado</span>${base ? '<span><i class="sw lb"></i>Línea base</span>' : ''}<span><i class="sw real"></i>Ejecución real</span><span><i class="sw ms"></i>Hito (un solo día)</span>
      <span><i class="sw hoy"></i>Hoy</span><span class="pl-mut">Días hábiles sin fines de semana ni festivos de Colombia${opts.owner ? ' · ID morado = ruta crítica' : ''}</span>
    </div>`;
    const deps = [];
    if (opts.lineas !== false) (model.activities || []).forEach(a => (a.dependsOnIds || []).forEach(p => deps.push([p, a.id])));
    const tabla = `<div class="pl-wrap" id="pl-wrap"><div class="pl-canvas"><table class="pl">${head}<tbody>${filas}${addArea}</tbody></table><svg class="pl-links" data-deps='${esc(JSON.stringify(deps))}'></svg></div></div>`;
    const panel = opts.panel ? involucradosHtml(model, opts) : '';
    return `${filtrosHtml(model, opts, gs)}<div class="pl-div"></div>${vacio}
      ${panel ? `<div class="pl-layout"><div class="pl-main">${tabla}</div>${panel}</div>` : tabla}
      ${leyenda}${opts.owner ? sueltasHtml(model, gsEt) : ''}`;
  }

  function filaActividad(a, g, today, E, carril, editable, opts, cols, codigo, base) {
    const est = estado(a, today);
    const resp = respDe(a).join(', ');
    const pct = a.pctComplete || 0;
    const ini = a.startDate || a.deadline, fin = a.deadline || a.startDate;
    const dv = desvio(a);
    const tip = esc(`${a._cod} · ${a.name}${ini ? ` · ${fCorta(ini)} → ${fCorta(fin)}` : ''} · ${pct}% · ${est}${resp ? ' · ' + resp : ''}${a.entregable ? ' · Entregable: ' + a.entregable : ''}${a.baselineEnd ? ` · Línea base: ${fCorta(a.baselineStart)} → ${fCorta(a.baselineEnd)}` : ''}`);
    let barra = '';
    if (a.baselineStart || a.baselineEnd) {
      const bi = a.baselineStart || a.baselineEnd, bf = a.baselineEnd || a.baselineStart;
      barra += `<span class="pl-lb" style="left:${E.x(bi)}px;width:${Math.max(E.ppd, E.x(addDays(bf, 1)) - E.x(bi))}px" title="Línea base: ${fCorta(bi)} → ${fCorta(bf)}"></span>`;
    }
    if (ini) {
      const x0 = E.x(ini), w = Math.max(E.ppd, E.x(addDays(fin, 1)) - x0);
      const cls = est === 'Completada' ? ' ok' : est === 'Atrasada' ? ' late' : '';
      const click = has('planOnOpen') && opts.owner ? ` onclick="planOnOpen('${a.id}')"` : '';
      barra += ini === fin
        ? `<span class="pl-ms${cls}" data-id="${a.id}" style="left:${x0 + E.ppd / 2}px;--c:${g.color}" title="${tip}"${click}></span>`
        : `<span class="pl-b${cls}${w < 34 ? ' mini' : ''}" data-id="${a.id}" style="left:${x0}px;width:${w}px;--c:${g.color}" title="${tip}"${click}><i style="width:${pct}%"></i></span>`;
    }
    if (a.realStart) {
      const rf = a.realEnd || today;
      if (rf >= a.realStart) barra += `<span class="pl-real${a.realEnd ? '' : ' abierta'}" style="left:${E.x(a.realStart)}px;width:${Math.max(E.ppd, E.x(addDays(rf, 1)) - E.x(a.realStart))}px" title="Real: ${fCorta(a.realStart)} → ${a.realEnd ? fCorta(a.realEnd) : 'en curso'}"></span>`;
    }
    const cp = opts.owner && a.critical ? ` style="color:${a.criticaEnRiesgo ? 'var(--cp-late-ink)' : 'var(--cp-ink)'}"` : '';
    const idCell = has('planOnOpen') && opts.owner
      ? `<button class="pl-cod"${cp} onclick="planOnOpen('${a.id}')" title="Abrir detalle (dependencias, notas)">${a._cod}</button>`
      : `<span class="pl-cod">${a._cod}</span>`;
    const inp = (campo, valor, ph, cls) => editable
      ? `<input class="pl-in ${cls || ''}" data-cell="${a.id}:${campo}" value="${esc(valor)}" placeholder="${ph}" title="${esc(valor)}"${campo === 'responsables' ? ' list="dl-personas"' : ''} onchange="planOnPatch('${a.id}',{${campo}:this.value.trim()})">`
      : `<span class="pl-tx ${cls || ''}" title="${esc(valor)}">${esc(valor) || '<span class="pl-mut">—</span>'}</span>`;
    const deps = (a.dependsOnIds || []).map(id => codigo[id]).filter(Boolean).join(', ');
    const dias = a.startDate && a.deadline ? diasHabiles(a.startDate, a.deadline) : '';
    const pctCell = !cols.full
      ? (editable
        ? `<td class="pl-p corta"><input type="number" min="0" max="100" step="5" class="pl-in pct" data-cell="${a.id}:pct" value="${pct}" onchange="planOnPatch('${a.id}',{pctComplete:Number(this.value)})"><span class="pl-mut">%</span></td>`
        : `<td class="pl-p corta"><b>${pct}%</b></td>`)
      : editable
        ? `<td class="pl-p"><span class="pl-pbar" style="--c:${g.color}"><i style="width:${pct}%"></i></span><input type="number" min="0" max="100" step="5" class="pl-in pct" data-cell="${a.id}:pct" value="${pct}" onchange="planOnPatch('${a.id}',{pctComplete:Number(this.value)})"><span class="pl-mut">%</span></td>`
        : `<td class="pl-p"><span class="pl-pbar" style="--c:${g.color}"><i style="width:${pct}%"></i></span><b>${pct}%</b></td>`;
    // Una propuesta ocupa la columna de estado: quién la hizo y, para el dueño, aceptar / descartar
    const estCell = a.propuesta
      ? `<td class="pl-propc"><span class="pl-prop" title="Propuesta desde el enlace compartido${a.propuestaPor ? ' por ' + esc(a.propuestaPor) : ''}">Propuesta</span>${opts.owner ? `<button class="pl-mini ok" onclick="planOnProposal('${a.id}',true)" title="Aceptar en el plan">✓</button><button class="pl-mini" onclick="planOnProposal('${a.id}',false)" title="Descartar">✕</button>` : (a.propuestaPor ? `<span class="pl-mut">${esc(a.propuestaPor)}</span>` : '')}</td>`
      : `<td class="pl-stc">${estHtml(est)}</td>`;
    const lb = a.baselineStart || a.baselineEnd ? `${fCorta(a.baselineStart)} → ${fCorta(a.baselineEnd)}` : '<span class="pl-mut">nueva</span>';
    // En la vista Gantt el desvío acompaña al fin; en la tabla tiene su columna
    const dvChip = !cols.full && dv ? ` ${desvioHtml(dv)}` : '';
    return `<tr class="pl-act${a.propuesta ? ' prop' : ''}" style="--c:${g.color}">
      <td class="pl-sk pl-c-id">${idCell}</td>
      <td class="pl-sk pl-c-nm"><div class="pl-nmw" title="${esc(a.name + (a.entregable ? ' → ' + a.entregable : '') + (opts.agrupar === 'area' && a._etapa ? ' · ' + a._etapa : ''))}">${inp('name', a.name, 'Actividad', 'nm')}${opts.owner && has('planOnDetalle') ? notasTareasBtn(a) : ''}</div></td>
      <td class="pl-rs">${avatares(respDe(a))}${cols.full ? inp('responsables', resp, '—', 'rs') : `<span class="pl-tx rs" title="${esc(resp)}">${esc(resp) || '<span class="pl-mut">—</span>'}</span>`}</td>
      ${cols.area ? `<td class="pl-arc">${areasActividad(a, ultimoModelo && ultimoModelo.miembros).map(x => `<span class="pl-arp" style="--c:${colorDe(x)}">${esc(x)}</span>`).join('') || '<span class="pl-mut" title="Registra al responsable en «Involucrados» con su área">—</span>'}</td>` : ''}
      ${cols.entregable ? `<td>${inp('entregable', a.entregable || '', '—', 'en')}</td>` : ''}
      ${cols.base ? `<td class="pl-lbc" title="Congelada: no se mueve">${lb}</td>` : ''}
      ${cols.full ? celdaFecha(a, 'startDate', editable) + celdaFecha(a, 'deadline', editable, est === 'Atrasada' ? ' late' : '')
        : `<td class="pl-tlc">${pildoraRango(a.startDate, a.deadline, today, est, g.color, has('planOnOpen') && opts.owner ? ` onclick="planOnOpen('${a.id}')" role="button"` : '')}${dvChip}${ultimoModelo && ultimoModelo.fechaMeta && a.deadline && a.deadline > ultimoModelo.fechaMeta && est !== 'Completada' ? `<span class="pl-pasa" title="Termina después de la fecha meta (${fCorta(ultimoModelo.fechaMeta)})">⚑</span>` : ''}</td>`}
      ${cols.real ? celdaFecha(a, 'realStart', editable, ' real') + celdaFecha(a, 'realEnd', editable, ' real') : ''}
      ${cols.dias ? (editable
        ? `<td class="pl-n"><input type="number" min="1" max="365" class="pl-in pct dur" data-cell="${a.id}:dur" value="${dias}" placeholder="—" title="Días hábiles: al cambiarla se recalcula el fin" onchange="Plan.cambiarDuracion('${a.id}',this.value)"></td>`
        : `<td class="pl-n">${dias}</td>`) : ''}
      ${cols.desvio ? `<td>${desvioHtml(dv)}</td>` : ''}
      ${pctCell}
      ${estCell}
      ${cols.deps ? `<td class="pl-dp">${deps || '<span class="pl-mut">—</span>'}</td>` : ''}
      ${carril(barra)}
    </tr>`;
  }

  function filaTarea(t, today, E, carril, nCols) {
    const hecha = t.kanbanStatus === 'done', vencida = !hecha && t.dueDate && t.dueDate < today;
    const est = hecha ? '<span class="pl-est Completada">Hecha</span>' : vencida ? '<span class="pl-est Atrasada">Vencida</span>' : t.kanbanStatus === 'doing' ? '<span class="pl-est En-curso">En curso</span>' : '<span class="pl-est Por-iniciar">Por hacer</span>';
    const dot = t.dueDate ? `<span class="pl-tdot${hecha ? ' ok' : vencida ? ' late' : ''}" style="left:${E.x(t.dueDate) + E.ppd / 2}px" title="${esc(t.title)} · ${fCorta(t.dueDate)}"></span>` : '';
    return `<tr class="pl-task${hecha ? ' hecha' : ''}">
      <td class="pl-sk pl-c-id"><button class="pl-chk${hecha ? ' on' : ''}" title="${hecha ? 'Reabrir' : 'Marcar hecha'}" onclick="planOnTask('${hecha ? 'reopen' : 'done'}','${t.id}')"></button></td>
      <td class="pl-sk pl-c-nm"><span class="pl-tt" onclick="planOnTask('open','${t.id}')" title="${esc(t.title)}">↳ ${esc(t.title)}</span><button class="pl-x" title="Desvincular de esta actividad" onclick="planOnTask('unlink','${t.id}')">×</button></td>
      <td colspan="${nCols - 2}">${est}<span class="pl-mut">${t.dueDate ? 'vence ' + fCorta(t.dueDate) : 'sin fecha'}${t.tipoGestion && t.tipoGestion !== 'Propia' ? ' · ' + esc(t.tipoGestion) : ''}</span></td>
      ${carril(dot)}
    </tr>`;
  }

  // Tareas del proyecto sin actividad: se vinculan solo a mano
  function sueltasHtml(model, gs) {
    const sueltas = (model.tasks || []).filter(t => !t.activityId && t.kanbanStatus !== 'done');
    const acts = []; gs.forEach(g => g.acts.forEach(a => acts.push(a)));
    if (!sueltas.length || !acts.length) return '';
    const opts = '<option value="">Vincular a…</option>' + acts.map(a => `<option value="${a.id}">${a._cod || ''} · ${esc(a.name)}</option>`).join('');
    return `<details class="pl-sueltas"><summary>Tareas del proyecto sin vincular a una actividad <span class="pl-mut">· ${sueltas.length}</span></summary>
      ${sueltas.map(t => `<div class="row"><span class="tt" onclick="planOnTask('open','${t.id}')">${esc(t.title)}${t.dueDate ? ` <span class="pl-mut">· ${fCorta(t.dueDate)}</span>` : ''}</span><select class="pl-sel" onchange="if(this.value)planOnTask('link','${t.id}',this.value)">${opts}</select></div>`).join('')}
    </details>`;
  }

  // Selector de fecha: abre el calendario nativo sin ocupar espacio en la fila
  function pickDate(btn, id, campo) {
    const r = btn.getBoundingClientRect();
    const inp = document.createElement('input');
    inp.type = 'date';
    inp.value = btn.dataset.v || '';
    inp.className = 'pl-picker';
    inp.style.left = r.left + 'px';
    inp.style.top = r.bottom + 'px';
    document.body.appendChild(inp);
    let hecho = false;
    const cerrar = () => { if (!hecho) { hecho = true; setTimeout(() => inp.remove(), 0); } };
    inp.addEventListener('change', () => {
      const v = inp.value || null;
      cerrar();
      if (v !== (btn.dataset.v || null)) window.planOnPatch(id, { [campo]: v });
    });
    inp.addEventListener('blur', () => setTimeout(cerrar, 200));
    inp.focus();
    try { inp.showPicker(); } catch (e) { inp.classList.add('visible'); }
  }

  window.Plan = {
    render, estado, pickDate, aplicarLocal, adelantar, cascada, colorDe, respDe, norm, fCorta, dibujarLineas, cambiarDuracion, areasActividad,
    etapas,
    // Ancho extra que tomó la columna «Actividad» (para que la escala «Todo» siga cabiendo)
    extraNombre: () => (anchoNm == null ? 0 : anchoNm - NM_DEF),
    cal: { esHabil, habilDesde, finHabil, diasHabiles, sumarHabiles, difHabiles, moverRango },
    colores: AREA_COLORS,
    // Preferencias por persona (se guardan en el navegador)
    opciones(clave, base) {
      let o = Object.assign({ vista: 'gantt', zoom: 'semana', agrupar: 'etapa', grupo: null, resp: '', tareas: true, cols: { entregable: true, real: true, deps: true } }, base || {});
      try { const g = JSON.parse(localStorage.getItem(clave) || 'null'); if (g) { o = Object.assign(o, g, { cols: Object.assign({}, o.cols, g.cols || {}) }); } } catch (e) {}
      return o;
    },
    guardar(clave, o) { try { localStorage.setItem(clave, JSON.stringify({ vista: o.vista, zoom: o.zoom, agrupar: o.agrupar, panel: o.panel, lineas: o.lineas, tareas: o.tareas, cols: o.cols })); } catch (e) {} },
    cambiar(o, k, v) {
      if (k === 'col') o.cols[v] = !o.cols[v];
      else if (k === 'agrupar') { o.agrupar = v; o.grupo = null; o.plegadas = []; }
      else if (k === 'soloEtapas') o.plegadas = v ? '*' : [];
      else if (k === 'plegar') {
        // Contraer / expandir una etapa (si estaban todas contraídas, se abre solo esa)
        let l = o.plegadas === '*' ? ultimasClaves.slice() : (Array.isArray(o.plegadas) ? o.plegadas.slice() : []);
        l = l.includes(v) ? l.filter(x => x !== v) : [...l, v];
        o.plegadas = l;
      }
      else o[k] = v;
      return o;
    },
  };
})();
