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
      // Solo duración (sin fechas): arranca al terminar lo que la condiciona
      if (min && !ini && a.duracion > 0 && !terminada(a)) {
        a.startDate = min; a.deadline = finHabil(min, a.duracion); n++;
      } else if (min && ini && ini < min && !terminada(a)) {
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
  // Duración en días hábiles: la guardada o la que dan las fechas
  const duracionDe = a => a.duracion || (a.startDate && a.deadline ? diasHabiles(a.startDate, a.deadline) : null);
  // Misma regla del servidor: con duración, el inicio deja el fin como consecuencia;
  // cambiar la duración recalcula el fin; poner el fin a mano actualiza la duración.
  function reglaDuracion(a, cambios, durAntes) {
    let nueva;
    if (cambios.duracion !== undefined) {
      const n = Math.round(Number(cambios.duracion));
      nueva = n >= 1 && n <= 999 ? n : null;
      a.duracion = nueva;
    }
    const dur = nueva !== undefined ? nueva : durAntes;
    const ponenFin = cambios.deadline !== undefined;
    if (dur && !ponenFin && (cambios.startDate !== undefined || nueva !== undefined) && a.startDate) {
      a.startDate = habilDesde(a.startDate);
      a.deadline = finHabil(a.startDate, dur);
    }
    if (ponenFin && a.deadline && a.startDate && nueva === undefined) a.duracion = diasHabiles(a.startDate, a.deadline);
    if (cambios.startDate === null && !ponenFin && nueva === undefined && dur) { a.deadline = null; a.duracion = dur; }
  }
  function aplicarLocal(acts, id, cambios, today) {
    const a = acts.find(x => x.id === id); if (!a) return 0;
    const antes = finEf(a);
    const durAntes = duracionDe(a);
    Object.assign(a, cambios);
    reglaDuracion(a, cambios, durAntes);
    amarrarReal(a, cambios);
    const toca = ['startDate', 'deadline', 'realStart', 'realEnd', 'dependsOnIds', 'pctComplete', 'duracion'].some(k => cambios[k] !== undefined);
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
        bot += `<span class="pl-sc-b${w === hoyL ? ' now' : ''}" style="left:${E.x(w)}px;width:${Math.min(7 * E.ppd, E.W - E.x(w))}px" title="Semana ${n} · lunes ${fCorta(w)}">${Number(w.slice(8, 10))}</span>`;
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
  const listaNombres = v => (Array.isArray(v) ? v : String(v || '').split(',')).map(x => String(x || '').trim()).filter(Boolean);
  function areasActividad(a, miembros) {
    if (a.area) return listaNombres(a.area); // elegida a mano
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
      const nombre = a.area ? listaNombres(a.area)[0] : r0 ? areaDe(r0, model.miembros) : 'Sin responsable';
      const k = 'a:' + norm(nombre);
      if (!mapa.has(k)) mapa.set(k, { key: k, id: null, name: nombre, sec: null, area: true, color: nombre === 'Sin responsable' ? '#9A9384' : colorDe(nombre), acts: [] });
      mapa.get(k).acts.push(a);
    });
    return [...mapa.values()].sort((x, y) => (x.name === 'Sin responsable') - (y.name === 'Sin responsable') || x.name.localeCompare(y.name));
  }

  // Área responsable: la elegida a mano va sólida; la automática (de los involucrados), tenue
  function celdaArea(a, editable) {
    const mi = ultimoModelo && ultimoModelo.miembros;
    const manual = !!a.area;
    const ar = areasActividad(a, mi);
    const chips = ar.map(x => `<span class="pl-arp${manual ? '' : ' auto'}" style="--c:${colorDe(x)}">${esc(x)}</span>`).join('');
    const vacio = `<span class="pl-mut">${editable ? 'Elegir…' : '—'}</span>`;
    return editable
      ? `<td class="pl-arc pl-pick" tabindex="0" data-pick="area" data-act="${a.id}" title="${manual ? 'Área elegida a mano' : ar.length ? 'Automática: sale del área de los responsables. Clic para elegirla a mano' : 'Elegir de la lista de áreas de los involucrados'}">${chips || vacio}<i class="pl-caret">▾</i></td>`
      : `<td class="pl-arc">${chips || vacio}</td>`;
  }

  // ---------- Lista desplegable para responsables y áreas (involucrados del proyecto) ----------
  let sel = null, selCtx = null;
  function opcionesPick(tipo, a) {
    const m = ultimoModelo || {}, mi = m.miembros || [];
    const out = [];
    const add = (valor, sub, grupo) => { if (valor && !out.some(o => norm(o.valor) === norm(valor))) out.push({ valor, sub, grupo }); };
    if (tipo === 'resp') {
      mi.forEach(x => add(x.nombre, [x.area, x.rol].filter(Boolean).join(' · '), 'Involucrados'));
      // Áreas como responsable (p. ej. «Jurídica») y nombres ya usados en el plan
      [...new Set(mi.map(x => x.area).filter(Boolean))].forEach(ar => add(ar, 'Área', 'Áreas'));
      (m.activities || []).forEach(y => respDe(y).forEach(r => add(r, 'ya usado en el plan', 'Otros')));
    } else {
      mi.forEach(x => add(x.area, mi.filter(y => norm(y.area) === norm(x.area)).map(y => y.nombre).join(', '), 'Áreas de los involucrados'));
      (m.activities || []).forEach(y => listaNombres(y.area).forEach(r => add(r, 'ya usada en el plan', 'Otras')));
    }
    return out;
  }
  function pintarSel() {
    if (!sel || !selCtx) return;
    const { tipo, a, elegidos } = selCtx;
    const q = norm(sel.querySelector('input.pl-sel-q') ? sel.querySelector('input.pl-sel-q').value : '');
    const ops = opcionesPick(tipo, a).filter(o => !q || norm(o.valor).includes(q) || norm(o.sub || '').includes(q));
    elegidos.forEach(v => { if (!ops.some(o => norm(o.valor) === norm(v)) && (!q || norm(v).includes(q))) ops.unshift({ valor: v, sub: 'elegido', grupo: 'Elegidos' }); });
    let grupo = null, html = '';
    ops.forEach((o, i) => {
      if (o.grupo !== grupo) { grupo = o.grupo; html += `<div class="pl-sel-g">${esc(grupo)}</div>`; }
      const on = elegidos.some(v => norm(v) === norm(o.valor));
      html += `<button class="pl-sel-o${on ? ' on' : ''}" data-v="${esc(o.valor)}"><i></i><span><b>${esc(o.valor)}</b>${o.sub ? `<em>${esc(o.sub)}</em>` : ''}</span></button>`;
    });
    const qOrig = sel.querySelector('input.pl-sel-q') ? sel.querySelector('input.pl-sel-q').value.trim() : '';
    const nuevo = qOrig && !ops.some(o => norm(o.valor) === norm(qOrig)) ? `<button class="pl-sel-o nuevo" data-v="${esc(qOrig)}"><i>＋</i><span><b>Agregar «${esc(qOrig)}»</b><em>${tipo === 'resp' ? 'nombre que no está en Involucrados' : 'área nueva'}</em></span></button>` : '';
    sel.querySelector('.pl-sel-l').innerHTML = (html || nuevo ? html + nuevo : `<div class="pl-sel-v">${(ultimoModelo && (ultimoModelo.miembros || []).length) ? 'Nada coincide' : 'Aún no hay involucrados: regístralos en «👥 Involucrados» o escribe un nombre'}</div>`);
    sel.querySelector('.pl-sel-chips').innerHTML = elegidos.length
      ? elegidos.map(v => `<span class="pl-sel-chip">${esc(v)}<button data-quitar="${esc(v)}" title="Quitar">×</button></span>`).join('')
      : `<span class="pl-mut">${tipo === 'area' ? 'Automática (según los responsables)' : 'Sin responsable'}</span>`;
  }
  function abrirSel(celda) {
    const m = ultimoModelo || {};
    const a = (m.activities || []).find(x => x.id === celda.dataset.act); if (!a) return;
    const tipo = celda.dataset.pick;
    cerrarSel(false);
    const actuales = tipo === 'resp' ? respDe(a) : listaNombres(a.area);
    selCtx = { tipo, a, elegidos: [...actuales], inicial: JSON.stringify(actuales) };
    sel = document.createElement('div'); sel.className = 'pl-selpop';
    sel.innerHTML = `<div class="pl-sel-h">${tipo === 'resp' ? 'Responsables' : 'Área responsable'} · <span>${esc(a._cod || '')} ${esc(a.name)}</span></div>
      <div class="pl-sel-chips"></div>
      <input class="pl-sel-q" placeholder="${tipo === 'resp' ? 'Buscar o escribir un nombre…' : 'Buscar o escribir un área…'}">
      <div class="pl-sel-l"></div>
      <div class="pl-sel-f">${tipo === 'area' ? '<button data-auto="1" title="Volver a sacarla de los responsables">↺ Automática</button>' : '<span class="pl-mut">Puedes elegir varios</span>'}<button class="ok" data-listo="1">Listo</button></div>`;
    document.body.appendChild(sel);
    const r = celda.getBoundingClientRect();
    const w = sel.offsetWidth, h = sel.offsetHeight;
    sel.style.left = Math.max(10, Math.min(r.left, window.innerWidth - w - 10)) + 'px';
    sel.style.top = (r.bottom + h + 8 > window.innerHeight ? Math.max(10, r.top - h - 4) : r.bottom + 4) + 'px';
    pintarSel();
    const q = sel.querySelector('input.pl-sel-q');
    q.addEventListener('input', pintarSel);
    q.addEventListener('keydown', ev => {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        const prim = sel.querySelector('.pl-sel-o');
        if (q.value.trim() && prim) prim.click(); else cerrarSel(true);
      }
      if (ev.key === 'Escape') { ev.stopPropagation(); cerrarSel(false); }
      if (ev.key === 'Backspace' && !q.value && selCtx.elegidos.length) { selCtx.elegidos.pop(); pintarSel(); }
    });
    sel.addEventListener('mousedown', ev => { if (ev.target !== q) ev.preventDefault(); });
    sel.addEventListener('click', ev => {
      const o = ev.target.closest('.pl-sel-o'), qu = ev.target.closest('[data-quitar]');
      if (o) {
        const v = o.dataset.v, i = selCtx.elegidos.findIndex(x => norm(x) === norm(v));
        if (i >= 0) selCtx.elegidos.splice(i, 1); else selCtx.elegidos.push(v);
        q.value = ''; pintarSel(); q.focus();
      } else if (qu) {
        selCtx.elegidos = selCtx.elegidos.filter(x => norm(x) !== norm(qu.dataset.quitar)); pintarSel(); q.focus();
      } else if (ev.target.closest('[data-auto]')) { selCtx.elegidos = []; cerrarSel(true); }
      else if (ev.target.closest('[data-listo]')) cerrarSel(true);
    });
    setTimeout(() => q.focus(), 20);
  }
  // Al cerrar se guarda (si cambió): la hoja se repinta sola
  function cerrarSel(guardar) {
    if (!sel) return;
    const ctx = selCtx;
    sel.remove(); sel = null; selCtx = null;
    if (!guardar || !ctx || JSON.stringify(ctx.elegidos) === ctx.inicial || !has('planOnPatch')) return;
    window.planOnPatch(ctx.a.id, ctx.tipo === 'resp' ? { responsables: ctx.elegidos.join(', ') } : { area: ctx.elegidos.join(', ') || null });
  }
  document.addEventListener('click', ev => {
    const c = ev.target.closest && ev.target.closest('.pl-pick[data-pick]');
    if (c) { abrirSel(c); return; }
    // (la lista se repinta al elegir: el botón pulsado ya no está dentro, por eso se mira el recorrido del clic)
    if (sel && !ev.composedPath().includes(sel)) cerrarSel(true);
  });
  document.addEventListener('keydown', ev => {
    // Enter o espacio sobre la celda también abre la lista
    const c = ev.target.closest && ev.target.closest('.pl-pick[data-pick]');
    if (c && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); abrirSel(c); }
  });

  // Avatares con iniciales; en la columna de responsable van también los nombres
  function avatares(nombres) {
    if (!nombres.length) return '';
    const ini = n => n.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
    const vis = nombres.slice(0, 3).map(n => `<span class="pl-av" style="background:${colorDe(n)}" title="${esc(n)}">${esc(ini(n))}</span>`).join('');
    return `<span class="pl-avs">${vis}${nombres.length > 3 ? `<span class="pl-av mas">+${nombres.length - 3}</span>` : ''}</span>`;
  }

  // Menú «Columnas»: mostrar u ocultar cada una (se recuerda por vista y por navegador)
  function columnasHtml(opts, cols, base) {
    if (!cols) return '';
    const full = opts.vista === 'tabla';
    const lista = [['rs', 'Responsable', cols.rs], ['ar', 'Área', cols.area], ['en', 'Entregable', cols.entregable],
      ['fechas', full ? 'Inicio y fin' : 'Cronograma (fechas)', cols.fechas], ['real', 'Fechas reales', cols.real],
      ['dias', 'Duración', cols.dias], ['p', 'Avance', cols.p], ['e', 'Estado', cols.e], ['dp', 'Depende de', cols.deps]];
    if (base) lista.push(['lb', 'Línea base', cols.base], ['dv', 'Desvío', cols.desvio]);
    const hay = Object.keys(anchosCol).length;
    return `<div class="pl-colsmenu"><span class="pl-ol">Columnas · ${full ? 'tabla completa' : 'vista Gantt'}</span>
      ${lista.map(([k, l, on]) => `<button class="pl-colchip${on ? ' on' : ''}" onclick="planSetOpt('colvis','${k}:${on ? 0 : 1}')" title="${on ? 'Ocultar' : 'Mostrar'} «${l}»"><i></i>${l}</button>`).join('')}
      ${hay ? `<button class="pl-optbtn" onclick="planSetOpt('anchosReset',1)" title="Volver al ancho normal de todas las columnas">↺ Anchos originales</button>` : ''}
      <span class="pl-mut">Para ensanchar o angostar una columna, arrastra el borde derecho de su título.</span></div>`;
  }
  function filtrosHtml(model, opts, gs, cols, base) {
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
    const colsBtn = `<button class="pl-optbtn${opts.verCols ? ' on' : ''}" onclick="planSetOpt('verCols',${!opts.verCols})" title="Mostrar u ocultar columnas">▤ Columnas</button>`;
    if (!opts.compacto) return opciones + `<div class="pl-bar-r" style="margin:0 0 8px">${colsBtn}</div>` + (opts.verCols ? columnasHtml(opts, cols, base) : '') + filtro;
    // Modo compacto (enlace para directivos): una barra delgada y las opciones escondidas
    const solo = opts.plegadas === '*';
    return `<div class="pl-bar-c">
        <div class="pl-areas pl-areas-c">
          <button class="pl-chip todas${opts.grupo ? '' : ' on'}" onclick="planSetOpt('grupo',null)">${agr === 'area' ? 'Todas las áreas' : 'Todas las etapas'}</button>
          ${vivas.map(chip).join('')}
        </div>
        <div class="pl-bar-r">
          <button class="pl-optbtn${solo ? ' on' : ''}" onclick="planSetOpt('soloEtapas',${!solo})" title="Ver solo el resumen de cada etapa (vista macro)">${solo ? '▸ Ver actividades' : '▾ Solo etapas'}</button>
          ${colsBtn}
          <button class="pl-optbtn${opts.verOpciones ? ' on' : ''}" onclick="planSetOpt('verOpciones',${!opts.verOpciones})" title="Vista, agrupación, escala, filtros y qué mostrar">⚙ Opciones de vista</button>
        </div>
      </div>
      ${opts.verCols ? columnasHtml(opts, cols, base) : ''}
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
  // Nubecita de comentarios + tareas + acciones de fila (solo en el editor)
  function notasTareasBtn(a) {
    const m = ultimoModelo || {};
    const nC = (m.notas || []).filter(n => n.activityId === a.id).length;
    const ts = (m.tasks || []).filter(t => t.activityId === a.id);
    const nH = ts.filter(t => t.kanbanStatus === 'done').length;
    const cmt = `<button class="pl-cmt${nC ? '' : ' vacio'}" data-cmt="${a.id}" title="Comentarios de esta actividad">${nC || '＋'}</button>`;
    const tar = ts.length ? `<button class="pl-nb" onclick="planOnDetalle('${a.id}')" title="Tareas de esta actividad">☑ ${nH}/${ts.length}</button>` : '';
    const acc = has('planOnRow') ? `<span class="pl-ra"><button onclick="planOnRow('insertar-debajo','${a.id}')" title="Insertar una fila debajo (Ctrl+Enter)">＋</button><button onclick="planOnRow('eliminar','${a.id}')" title="Eliminar esta fila">🗑</button></span>` : '';
    return cmt + tar + acc;
  }
  // Día (en Bogotá) de un comentario
  const diaDe = iso => { const d = iso ? new Date(iso) : new Date(); try { return (isNaN(d) ? new Date() : d).toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }); } catch (e) { return String(iso || '').slice(0, 10); } };

  // Duración editable: fin = inicio + N días hábiles (sin inicio, arranca el próximo día hábil)
  let ultimoModelo = null;
  let ultimasClaves = [];
  // Duración: se guarda aunque no haya fechas. Con inicio, el fin sale solo;
  // sin inicio, se programa al terminar sus precedentes (si los tiene).
  function cambiarDuracion(id, valor) {
    const n = Math.round(Number(valor));
    if (!ultimoModelo) return;
    if (String(valor).trim() !== '' && !(n >= 1 && n <= 999)) return;
    window.planOnPatch(id, { duracion: String(valor).trim() === '' ? null : n });
  }

  // ---------- Ancho de cada columna (lo elige cada persona; se guarda en el navegador) ----------
  const CW_KEY = 'planColWV1';
  let anchosCol = {};
  try { anchosCol = JSON.parse(localStorage.getItem(CW_KEY) || '{}') || {}; } catch (e) { anchosCol = {}; }
  const guardarAnchos = () => { try { localStorage.setItem(CW_KEY, JSON.stringify(anchosCol)); } catch (e) {} };
  const selCol = (n, suf) => [`.pl thead th:nth-child(${n})`, `.pl tr.pl-act>td:nth-child(${n})`, `.pl tr.pl-area:not(.off)>td:nth-child(${n})`].map(x => x + (suf || '')).join(',');
  const anchoCss = (n, w) => `${selCol(n)}{width:${w}px;min-width:${w}px;max-width:${w}px;overflow:hidden;text-overflow:ellipsis}` +
    `${selCol(n, ' .pl-tlp')},${selCol(n, ' .pl-est')},${selCol(n, ' .pl-bat')},${selCol(n, ' .pl-tx')}{min-width:0!important;max-width:100%}`;
  // Repinta la hoja (la página decide cómo) y redibuja las flechas
  const rehacer = () => { if (has('planOnAncho')) window.planOnAncho(true); dibujarLineas(); };
  document.addEventListener('mousedown', ev => {
    const h = ev.target.closest && ev.target.closest('.pl-cw');
    if (!h || ev.button !== 0) return;
    ev.preventDefault(); ev.stopPropagation();
    const th = h.parentElement, n = [...th.parentElement.children].indexOf(th) + 1, k = h.dataset.col;
    const x0 = ev.clientX, w0 = th.getBoundingClientRect().width;
    let live = document.getElementById('pl-colw-live');
    if (!live) { live = document.createElement('style'); live.id = 'pl-colw-live'; document.head.appendChild(live); }
    document.body.classList.add('pl-resizing');
    let w = Math.round(w0), movio = false;
    const mover = e => {
      if (Math.abs(e.clientX - x0) > 2) movio = true;
      if (!movio) return;
      w = Math.max(30, Math.min(700, Math.round(w0 + e.clientX - x0)));
      live.textContent = anchoCss(n, w);
    };
    const soltar = () => {
      document.removeEventListener('mousemove', mover); document.removeEventListener('mouseup', soltar);
      document.body.classList.remove('pl-resizing');
      if (!movio) return;
      anchosCol[k] = w; guardarAnchos();
      rehacer(); live.textContent = '';
    };
    document.addEventListener('mousemove', mover); document.addEventListener('mouseup', soltar);
  });
  document.addEventListener('dblclick', ev => {
    const h = ev.target.closest && ev.target.closest('.pl-cw');
    if (!h) return;
    delete anchosCol[h.dataset.col]; guardarAnchos(); rehacer();
  });

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

  // ============================================================
  // EDICIÓN TIPO EXCEL (editor: vista Gantt y vista Tabla)
  //   ↑ ↓ / Enter / Shift+Enter: moverse entre filas · Esc: deshacer la celda
  //   Alt+↑ / Alt+↓: mover la fila · Ctrl+Enter: insertar fila debajo
  //   Clic derecho: insertar, duplicar, mover, eliminar · ⠿: arrastrar la fila
  //   Pegar varias líneas: llena hacia abajo (o crea filas en «＋ Actividad»)
  // Las páginas responden con window.planOnRow(accion, id, extra) y window.planOnPegarFilas(secId, filas).
  // ============================================================
  const GRID = '.pl, .ptable';
  const partir = key => { const i = key.indexOf(':'); return [key.slice(0, i), key.slice(i + 1)]; };
  function filasDe(grid) { return [...grid.querySelectorAll('tr[data-row]')]; }
  function celdaVecina(el, paso) {
    const grid = el.closest(GRID); if (!grid) return null;
    const [id, campo] = partir(el.dataset.cell);
    const filas = filasDe(grid);
    let i = filas.findIndex(f => f.dataset.row === id);
    for (i += paso; i >= 0 && i < filas.length; i += paso) {
      const c = filas[i].querySelector(`[data-cell="${filas[i].dataset.row}:${campo}"]`);
      if (c) return c.dataset.cell;
    }
    return null;
  }
  function enfocar(key, seleccionar) {
    const el = key && document.querySelector(`[data-cell="${key}"]`);
    if (!el) return;
    el.focus();
    if (seleccionar && el.select && el.type !== 'date') try { el.select(); } catch (e) {}
    el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  // Guarda lo escrito en la celda antes de moverse (la hoja se repinta al guardar)
  function confirmar(el) {
    if (el.tagName !== 'SELECT' && el.value !== el.dataset.orig) {
      el.dataset.orig = el.value;
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }
  document.addEventListener('focusin', ev => {
    const el = ev.target;
    if (el && el.dataset && el.dataset.cell && el.closest(GRID)) el.dataset.orig = el.value;
  });
  document.addEventListener('keydown', ev => {
    const el = ev.target;
    if (!el || !el.dataset || !el.dataset.cell || !el.closest(GRID)) return;
    const [id] = partir(el.dataset.cell);
    const k = ev.key;
    if (ev.altKey && (k === 'ArrowUp' || k === 'ArrowDown')) {
      if (!has('planOnRow') || !el.closest('tr[data-row]')) return;
      ev.preventDefault();
      const key = el.dataset.cell;
      confirmar(el);
      window.planOnRow(k === 'ArrowUp' ? 'subir' : 'bajar', id);
      setTimeout(() => enfocar(key, false), 0);
      return;
    }
    if (k === 'Enter' && (ev.ctrlKey || ev.metaKey)) {
      if (!has('planOnRow')) return;
      ev.preventDefault(); confirmar(el);
      window.planOnRow('insertar-debajo', id);
      return;
    }
    if (k === 'Escape') {
      if (el.dataset.orig != null && el.tagName !== 'SELECT') el.value = el.dataset.orig;
      el.blur(); ev.stopPropagation();
      return;
    }
    const vertical = k === 'Enter' || ((k === 'ArrowUp' || k === 'ArrowDown') && el.tagName !== 'SELECT' && el.type !== 'date');
    if (!vertical) return;
    ev.preventDefault();
    const paso = k === 'ArrowUp' || (k === 'Enter' && ev.shiftKey) ? -1 : 1;
    const destino = celdaVecina(el, paso);
    confirmar(el);
    if (destino) enfocar(destino, true);
    else if (k === 'Enter') el.blur();
  });
  // Pegar desde Excel
  const lineas = txt => txt.replace(/\r/g, '').split('\n').map(l => l.replace(/\s+$/, '')).filter(l => l.trim() !== '');
  document.addEventListener('paste', ev => {
    const el = ev.target;
    if (!el || el.tagName !== 'INPUT') return;
    const txt = (ev.clipboardData || window.clipboardData).getData('text') || '';
    const ls = lineas(txt);
    // En «＋ Actividad…»: cada línea es una actividad nueva (Nombre · Responsable · Días)
    if (el.dataset.secAdd !== undefined && has('planOnPegarFilas') && (ls.length > 1 || txt.includes('\t'))) {
      ev.preventDefault();
      window.planOnPegarFilas(el.dataset.secAdd || null, ls.map(l => l.split('\t').map(x => x.trim())));
      return;
    }
    // En una celda: varias líneas llenan hacia abajo, como en Excel
    if (!el.dataset.cell || !el.closest(GRID) || ls.length < 2) return;
    ev.preventDefault();
    const claves = [el.dataset.cell];
    let k = el.dataset.cell;
    for (let i = 1; i < ls.length; i++) { k = celdaVecina(document.querySelector(`[data-cell="${k}"]`), 1); if (!k) break; claves.push(k); }
    claves.forEach((c, i) => {
      const x = document.querySelector(`[data-cell="${c}"]`);
      if (!x) return;
      x.value = ls[i].split('\t')[0].trim();
      x.dataset.orig = x.value;
      x.dispatchEvent(new Event('change', { bubbles: true }));
    });
    if (claves.length < ls.length) aviso(`Se pegaron ${claves.length} de ${ls.length} líneas: no hay más filas debajo`);
  });
  function aviso(t) { if (has('toast')) window.toast(t, false); }

  // Arrastrar una fila por su asa ⠿ (a otra fila o al título de una etapa)
  document.addEventListener('mousedown', ev => {
    const h = ev.target.closest && ev.target.closest('.pl-drag');
    if (!h || ev.button !== 0 || !has('planOnRow')) return;
    const fila = h.closest('tr[data-row]'), grid = h.closest(GRID);
    if (!fila || !grid) return;
    ev.preventDefault();
    const id = fila.dataset.row;
    let marca = null, destino = null;
    fila.classList.add('pl-moviendo');
    document.body.classList.add('pl-arrastrando');
    const limpiar = () => { if (marca) marca.classList.remove('pl-drop-antes', 'pl-drop-despues', 'pl-drop-dentro'); marca = null; };
    const mover = e => {
      limpiar(); destino = null;
      const bajo = document.elementFromPoint(e.clientX, e.clientY);
      const tr = bajo && bajo.closest && bajo.closest('tr[data-row], tr[data-sec]');
      if (!tr || !grid.contains(tr) || tr === fila) return;
      const r = tr.getBoundingClientRect();
      if (tr.dataset.sec) { marca = tr; tr.classList.add('pl-drop-dentro'); destino = { sec: tr.dataset.sec }; return; }
      const despues = e.clientY > r.top + r.height / 2;
      marca = tr; tr.classList.add(despues ? 'pl-drop-despues' : 'pl-drop-antes');
      destino = { destino: tr.dataset.row, despues };
    };
    const soltar = () => {
      document.removeEventListener('mousemove', mover); document.removeEventListener('mouseup', soltar);
      limpiar(); fila.classList.remove('pl-moviendo'); document.body.classList.remove('pl-arrastrando');
      if (destino) window.planOnRow('mover', id, destino);
    };
    document.addEventListener('mousemove', mover); document.addEventListener('mouseup', soltar);
  });

  // Clic derecho sobre una fila: menú de acciones
  let menu = null;
  const cerrarMenu = () => { if (menu) { menu.remove(); menu = null; } };
  document.addEventListener('contextmenu', ev => {
    const fila = ev.target.closest && ev.target.closest('tr[data-row]');
    if (!fila || !fila.closest(GRID) || !has('planOnRow')) return;
    ev.preventDefault(); cerrarMenu();
    const id = fila.dataset.row;
    const it = (acc, txt, atajo, cls) => `<button data-acc="${acc}" class="${cls || ''}"><span>${txt}</span>${atajo ? `<kbd>${atajo}</kbd>` : ''}</button>`;
    menu = document.createElement('div');
    menu.className = 'pl-menu';
    menu.innerHTML = it('insertar-arriba', '↥ Insertar fila arriba') + it('insertar-debajo', '↧ Insertar fila debajo', 'Ctrl+Enter') + it('duplicar', '⧉ Duplicar fila') +
      '<hr>' + it('subir', '▲ Subir', 'Alt+↑') + it('bajar', '▼ Bajar', 'Alt+↓') +
      '<hr>' + it('detalle', '☰ Notas y tareas') + it('eliminar', '🗑 Eliminar fila', '', 'peligro');
    document.body.appendChild(menu);
    const w = menu.offsetWidth, h = menu.offsetHeight;
    menu.style.left = Math.min(ev.clientX, window.innerWidth - w - 8) + 'px';
    menu.style.top = Math.min(ev.clientY, window.innerHeight - h - 8) + 'px';
    menu.addEventListener('click', e => {
      const b = e.target.closest('button[data-acc]'); if (!b) return;
      cerrarMenu(); window.planOnRow(b.dataset.acc, id);
    });
  });
  document.addEventListener('click', e => { if (menu && !menu.contains(e.target)) cerrarMenu(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') cerrarMenu(); });
  window.addEventListener('blur', cerrarMenu);

  // ============================================================
  // COMENTARIOS: nubecita en la fila y en el cronograma
  //   Pasar el mouse: historial · Clic: lo deja abierto para comentar
  //   Cada comentario se puede convertir en tarea de la actividad.
  // La página responde con window.planOnComentario(accion, actividadId, datos) → Promise
  // ============================================================
  let pop = null, popId = null, popFijo = false, popT = null;
  const hoyBog = () => diaDe(new Date().toISOString());
  const fechaCmt = iso => {
    const d = new Date(iso); if (isNaN(d)) return 'recién';
    const f = d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', timeZone: 'America/Bogota' });
    const h = d.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Bogota' });
    return /^12:00/.test(h) ? f : `${f} · ${h}`; // los de fecha elegida no llevan hora
  };
  function esTarea(n, tareas) {
    const t0 = norm(n.texto).slice(0, 60);
    return tareas.some(t => norm(t.title || '').slice(0, 60) === t0);
  }
  function pintarPop() {
    if (!pop || !popId) return;
    const m = ultimoModelo || {};
    const a = (m.activities || []).find(x => x.id === popId);
    if (!a) { cerrarPop(); return; }
    const cs = (m.notas || []).filter(n => n.activityId === popId).sort((x, y) => String(y.createdAt).localeCompare(String(x.createdAt)));
    const ts = (m.tasks || []).filter(t => t.activityId === popId);
    const borrador = pop.querySelector('textarea') ? pop.querySelector('textarea').value : '';
    pop.innerHTML = `<div class="pl-pop-h"><div><span class="pl-pop-cod">${a._cod || ''}</span>${esc(a.name)}</div><button data-acc="cerrar" title="Cerrar">×</button></div>
      <div class="pl-pop-l">${cs.length ? cs.map(n => `<div class="pl-pc">
          <div class="pl-pc-f"><span>📅 ${fechaCmt(n.createdAt)}</span><span class="pl-pc-a">${esTarea(n, ts) ? '<em>✓ ya es tarea</em>' : `<button data-acc="tarea" data-n="${n.id}" title="Crear una tarea de esta actividad con este texto">→ Tarea</button>`}<button data-acc="borrar" data-n="${n.id}" title="Borrar comentario">×</button></span></div>
          <div class="pl-pc-t">${esc(n.texto).replace(/\n/g, '<br>')}</div></div>`).join('')
        : '<div class="pl-pop-v">Sin comentarios todavía. Escribe el primero 👇</div>'}</div>
      <div class="pl-pop-add">
        <textarea rows="2" placeholder="Escribe un comentario… (Enter guarda · Shift+Enter: otra línea)">${esc(borrador)}</textarea>
        <div class="pl-pop-r"><input type="date" value="${hoyBog()}" title="Fecha del comentario (por defecto hoy)"><button data-acc="agregar" class="ok">Comentar</button></div>
      </div>
      <div class="pl-pop-f"><span>${ts.length ? `☑ ${ts.filter(t => t.kanbanStatus === 'done').length}/${ts.length} tareas` : ''}</span><button data-acc="detalle">Abrir bitácora y tareas →</button></div>`;
  }
  function abrirPop(id, ancla, fijo) {
    clearTimeout(popT);
    if (!pop) {
      pop = document.createElement('div'); pop.className = 'pl-pop';
      document.body.appendChild(pop);
      pop.addEventListener('mouseenter', () => clearTimeout(popT));
      pop.addEventListener('mouseleave', () => { if (!popFijo) popT = setTimeout(cerrarPop, 250); });
      pop.addEventListener('focusin', () => { popFijo = true; pop.classList.add('fijo'); });
      pop.addEventListener('click', ev => {
        const b = ev.target.closest('button[data-acc]'); if (!b) return;
        const acc = b.dataset.acc;
        if (acc === 'cerrar') return cerrarPop();
        if (acc === 'detalle') { const i = popId; cerrarPop(); return window.planOnDetalle && window.planOnDetalle(i); }
        if (acc === 'agregar') return enviarCmt();
        accionCmt(acc, { noteId: b.dataset.n }, b);
      });
      pop.addEventListener('keydown', ev => {
        if (ev.key === 'Enter' && !ev.shiftKey && ev.target.tagName === 'TEXTAREA') { ev.preventDefault(); enviarCmt(); }
        if (ev.key === 'Escape') cerrarPop();
      });
    }
    if (popId !== id) { pop.innerHTML = ''; }
    popId = id; popFijo = !!fijo;
    pop.classList.toggle('fijo', popFijo);
    pintarPop();
    const r = ancla.getBoundingClientRect();
    pop.style.visibility = 'hidden'; pop.classList.add('on');
    const w = pop.offsetWidth, h = pop.offsetHeight;
    let x = r.left, y = r.bottom + 6;
    if (x + w > window.innerWidth - 10) x = window.innerWidth - w - 10;
    if (y + h > window.innerHeight - 10) y = Math.max(10, r.top - h - 6);
    pop.style.left = Math.max(10, x) + 'px'; pop.style.top = y + 'px'; pop.style.visibility = '';
    if (fijo) setTimeout(() => { const t = pop.querySelector('textarea'); if (t) t.focus(); }, 30);
  }
  function cerrarPop() { clearTimeout(popT); if (pop) { pop.classList.remove('on', 'fijo'); pop.innerHTML = ''; } popId = null; popFijo = false; }
  async function accionCmt(acc, datos, boton) {
    if (!has('planOnComentario') || !popId) return;
    if (boton) boton.disabled = true;
    try { await window.planOnComentario(acc, popId, datos); } catch (e) {}
    pintarPop();
  }
  function enviarCmt() {
    const t = pop && pop.querySelector('textarea'), f = pop && pop.querySelector('input[type=date]');
    const texto = t ? t.value.trim() : '';
    if (!texto) { if (t) t.focus(); return; }
    t.value = '';
    accionCmt('agregar', { texto, fecha: f && f.value || null }).then(() => { const n = pop && pop.querySelector('textarea'); if (n) n.focus(); });
  }
  document.addEventListener('mouseover', ev => {
    const b = ev.target.closest && ev.target.closest('[data-cmt]');
    if (!b || popFijo) return;
    clearTimeout(popT);
    popT = setTimeout(() => abrirPop(b.dataset.cmt, b, false), 280);
  });
  document.addEventListener('mouseout', ev => {
    const b = ev.target.closest && ev.target.closest('[data-cmt]');
    if (!b || popFijo) return;
    if (pop && pop.contains(ev.relatedTarget)) return;
    clearTimeout(popT);
    popT = setTimeout(() => { if (!popFijo) cerrarPop(); }, 250);
  });
  document.addEventListener('click', ev => {
    const b = ev.target.closest && ev.target.closest('[data-cmt]');
    if (b) { ev.preventDefault(); abrirPop(b.dataset.cmt, b, true); return; }
    if (pop && popId && !ev.composedPath().includes(pop) && !(ev.target.closest && ev.target.closest('.pl-menu'))) cerrarPop();
  });

  // ---------- Escala «Todo»: mide lo que ocupan las columnas para que el cronograma quepa exacto ----------
  let fijoMedido = null;
  function medirAjuste(raiz) {
    const w = (raiz || document).querySelector('.pl-wrap');
    const t = w && w.querySelector('table.pl'), lane = t && t.querySelector('.pl-lane');
    if (!lane) return null;
    fijoMedido = t.offsetWidth - lane.offsetWidth;
    return Math.max(360, w.clientWidth - fijoMedido - 2);
  }
  // Ancho para el cronograma antes de dibujar: con la medida anterior si la hay
  function anchoAjuste(anchoWrap, estimadoFijo) {
    const w = document.querySelector('.pl-wrap');
    const total = w ? w.clientWidth : anchoWrap;
    return Math.max(360, total - (fijoMedido != null ? fijoMedido + 2 : estimadoFijo));
  }

  // ---------- Texto completo al pasar el mouse por una celda recortada ----------
  let tip = null, tipEl = null, sinTitulo = [];
  const SEL_TIP = '.pl .pl-in, .pl .pl-tx, .pl .pl-tt, .pl .pl-an';
  function quitarTip() {
    if (tip) tip.classList.remove('on');
    sinTitulo.forEach(([x, t]) => x.setAttribute('title', t)); // devuelve el globo nativo
    sinTitulo = []; tipEl = null;
  }
  document.addEventListener('mouseover', ev => {
    const el = ev.target.closest && ev.target.closest(SEL_TIP);
    if (el === tipEl) return;
    quitarTip();
    if (!el || el.type === 'number' || el.type === 'date') return;
    const texto = (el.tagName === 'INPUT' ? el.value : el.textContent || '').trim();
    if (!texto || el.scrollWidth <= el.clientWidth + 1) return; // cabe completo: no hace falta
    if (!tip) { tip = document.createElement('div'); tip.className = 'pl-tip'; document.body.appendChild(tip); }
    // El nombre lleva también el entregable, si lo tiene
    const wrap = el.closest('.pl-nmw');
    const tw = wrap ? wrap.getAttribute('title') || '' : '';
    const extra = tw.includes(' → ') ? tw.split(' → ').slice(1).join(' → ').split(' · ')[0] : '';
    tip.innerHTML = `${esc(texto)}${extra ? `<small>Entregable: ${esc(extra)}</small>` : ''}`;
    // Sin el globo nativo encima mientras se ve este
    [el, wrap].forEach(x => { if (x && x.hasAttribute('title')) { sinTitulo.push([x, x.getAttribute('title')]); x.removeAttribute('title'); } });
    tipEl = el;
    const r = el.getBoundingClientRect();
    tip.style.left = Math.max(12, Math.min(r.left, window.innerWidth - tip.offsetWidth - 12)) + 'px';
    const arriba = r.bottom + tip.offsetHeight + 10 > window.innerHeight;
    tip.style.top = (arriba ? r.top - tip.offsetHeight - 6 : r.bottom + 6) + 'px';
    tip.classList.add('on');
  });
  document.addEventListener('scroll', quitarTip, true);
  document.addEventListener('focusin', quitarTip);

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
    // Columnas a la vista: cada persona elige cuáles ver en cada vista (menú «Columnas»)
    const vk = full ? 'tabla' : 'gantt';
    const cv = (opts.colsVis && opts.colsVis[vk]) || {};
    const vis = (k, def) => cv[k] !== undefined ? !!cv[k] : !!def;
    const own = editable && !!opts.owner;
    const cols = {
      entregable: vis('en', full && c0.entregable), real: vis('real', full && c0.real), deps: vis('dp', full && c0.deps),
      dias: vis('dias', editable || full), area: vis('ar', full || own), base: base && vis('lb', full), desvio: base && vis('dv', full), full,
      rs: vis('rs', true), fechas: vis('fechas', true), p: vis('p', true), e: vis('e', true),
    };
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

    const nCols0 = (full ? 7 : 6) + (cols.dias ? 1 : 0) + (cols.area ? 1 : 0) + (cols.entregable ? 1 : 0) + (cols.base ? 1 : 0) + (cols.real ? 2 : 0) + (cols.desvio ? 1 : 0) + (cols.deps ? 1 : 0);
    // Responsable, fechas, avance y estado siempre se pintan; si están ocultas, las esconde el estilo
    const nCols = Math.max(3, nCols0 - (cols.rs ? 0 : 1) - (cols.fechas ? 0 : (full ? 2 : 1)) - (cols.p ? 0 : 1) - (cols.e ? 0 : 1));
    const lbI = base ? 'Inicio proy.' : 'Inicio', lbF = base ? 'Fin proy.' : 'Fin';
    const head = `<thead><tr>
      <th class="pl-sk pl-c-id" data-col="id">ID</th><th class="pl-sk pl-c-nm" data-col="nm">Actividad<span class="pl-resz" title="Arrastra para ensanchar o angostar la columna · doble clic: ajustar a los nombres (otro doble clic: volver al ancho normal)"></span></th><th class="pl-c-rs" data-col="rs">Responsable</th>
      ${cols.area ? `<th class="pl-c-ar" data-col="ar" title="Elígela de la lista de áreas de «Involucrados». Si la dejas en automática, sale del área de cada responsable">${full ? 'Área responsable' : 'Área'}</th>` : ''}
      ${cols.entregable ? '<th class="pl-c-en" data-col="en">Entregable / resultado</th>' : ''}
      ${cols.base ? '<th class="pl-c-lb" data-col="lb" title="Fechas congeladas al fijar la línea base: no se mueven">🔒 Línea base</th>' : ''}
      ${full ? `<th class="pl-c-d" data-col="ini" title="${base ? 'Inicio proyectado: se recalcula solo con las fechas reales y las dependencias' : 'Inicio planeado'}">${lbI}</th>
      <th class="pl-c-d" data-col="fin" title="${base ? 'Fin proyectado: se recalcula solo con las fechas reales y las dependencias' : 'Fin planeado'}">${lbF}</th>`
      : `<th class="pl-c-tl" data-col="tl" title="${base ? 'Fechas proyectadas (se recalculan con lo real y las dependencias)' : 'Fechas planeadas'}">${base ? 'Cronograma proy.' : 'Cronograma'}</th>`}
      ${cols.real ? '<th class="pl-c-d real" data-col="rini" title="Cuándo empezó de verdad">Inicio real</th><th class="pl-c-d real" data-col="rfin" title="Cuándo terminó de verdad (la da por completada)">Fin real</th>' : ''}
      ${cols.dias ? `<th class="pl-c-n" data-col="dias" title="Duración en días hábiles (sin fines de semana ni festivos de Colombia)${editable ? '. Ponla aunque no haya fechas: con inicio, el fin sale solo y lo que depende se corre en cascada' : ''}">Duración</th>` : ''}
      ${cols.desvio ? '<th class="pl-c-dv" data-col="dv" title="Días hábiles de diferencia entre el fin (real o proyectado) y la línea base">Desvío</th>' : ''}
      <th class="pl-c-p${full ? '' : ' corta'}" data-col="p">Avance</th><th class="pl-c-e" data-col="e">Estado</th>
      ${cols.deps ? '<th class="pl-c-dp" data-col="dp">Depende de</th>' : ''}
      <th class="pl-tl-h">${escalaHead(E, today, zoom).replace(/<\/div>$/, meta && meta >= E.ini && meta <= E.fin ? `<span class="pl-sc-meta" style="left:${E.x(addDays(meta, 1))}px">Meta ${fCorta(meta)}</span></div>` : '</div>')}</th>
    </tr></thead>`;
    // Asa para cambiar el ancho de cada columna (menos ID y Actividad, que tiene la suya)
    const headF = head.replace(/(<th\b[^>]*data-col="(?!id"|nm")([a-z]+)"[^>]*>)([\s\S]*?)<\/th>/g,
      (m0, abre, k, cont) => `${abre}${cont}<span class="pl-cw" data-col="${k}" title="Arrastra para ensanchar o angostar · doble clic: ancho normal"></span></th>`);
    // Estilo de columnas: ocultas y anchos elegidos (por posición en la tabla)
    const ocultasK = new Set([...(cols.rs ? [] : ['rs']), ...(cols.fechas ? [] : ['ini', 'fin', 'tl']), ...(cols.p ? [] : ['p']), ...(cols.e ? [] : ['e'])]);
    let cssCols = '';
    [...head.matchAll(/<th\b[^>]*?data-col="([a-z]+)"/g)].map(x => x[1]).forEach((k, i) => {
      if (ocultasK.has(k)) cssCols += `${selCol(i + 1)}{display:none}`;
      else if (k !== 'id' && k !== 'nm' && anchosCol[k]) cssCols += anchoCss(i + 1, anchosCol[k]);
    });

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
      const areaRow = `<tr class="pl-area" style="--c:${g.color}"${editable && opts.owner && agr === 'etapa' && g.id ? ` data-sec="${g.id}"` : ''}>
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
      const add = !plegada && opts.owner && editable && agr === 'etapa' ? `<tr class="pl-add"><td class="pl-sk pl-c-id"></td><td class="pl-sk pl-c-nm"><input placeholder="＋ Actividad en ${esc(g.name)} · o pega filas de Excel" data-sec-add="${g.id || ''}" onkeydown="if(event.key==='Enter')planOnAdd('${g.id || ''}',this)"></td><td colspan="${nCols - 2}"></td>${carril('')}</tr>` : '';
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
    const tabla = `<style id="pl-colstyle">${cssCols}</style><div class="pl-wrap" id="pl-wrap"><div class="pl-canvas"><table class="pl">${headF}<tbody>${filas}${addArea}</tbody></table><svg class="pl-links" data-deps='${esc(JSON.stringify(deps))}'></svg></div></div>`;
    const panel = opts.panel ? involucradosHtml(model, opts) : '';
    return `${filtrosHtml(model, opts, gs, cols, base)}<div class="pl-div"></div>${vacio}
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
    if (opts.owner && has('planOnComentario')) {
      const porDia = {};
      ((ultimoModelo && ultimoModelo.notas) || []).filter(n => n.activityId === a.id).forEach(n => { const d = diaDe(n.createdAt); porDia[d] = (porDia[d] || 0) + 1; });
      Object.keys(porDia).forEach(d => {
        if (d < E.ini || d > E.fin) return;
        barra += `<span class="pl-nube" data-cmt="${a.id}" style="left:${E.x(d) + E.ppd / 2}px" title="${porDia[d]} comentario${porDia[d] > 1 ? 's' : ''} · ${fCorta(d)}">${porDia[d] > 1 ? porDia[d] : ''}</span>`;
      });
    }
    const cp = opts.owner && a.critical ? ` style="color:${a.criticaEnRiesgo ? 'var(--cp-late-ink)' : 'var(--cp-ink)'}"` : '';
    const idCell = has('planOnOpen') && opts.owner
      ? `<button class="pl-cod"${cp} onclick="planOnOpen('${a.id}')" title="Abrir detalle (dependencias, notas)">${a._cod}</button>`
      : `<span class="pl-cod">${a._cod}</span>`;
    const inp = (campo, valor, ph, cls) => editable
      ? `<input class="pl-in ${cls || ''}" data-cell="${a.id}:${campo}" value="${esc(valor)}" placeholder="${ph}" title="${esc(valor)}"${campo === 'responsables' ? ' list="dl-personas"' : ''} onchange="planOnPatch('${a.id}',{${campo}:this.value.trim()})">`
      : `<span class="pl-tx ${cls || ''}" title="${esc(valor)}">${esc(valor) || '<span class="pl-mut">—</span>'}</span>`;
    const deps = (a.dependsOnIds || []).map(id => codigo[id]).filter(Boolean).join(', ');
    const dias = duracionDe(a) || '';
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
    const dvChip = !cols.desvio && dv ? ` ${desvioHtml(dv)}` : '';
    const mueve = editable && opts.owner && opts.agrupar !== 'area';
    return `<tr class="pl-act${a.propuesta ? ' prop' : ''}" style="--c:${g.color}"${editable && opts.owner ? ` data-row="${a.id}"` : ''}>
      <td class="pl-sk pl-c-id">${mueve ? '<span class="pl-drag" title="Arrastra para mover la fila · clic derecho: más opciones">⠿</span>' : ''}${idCell}</td>
      <td class="pl-sk pl-c-nm"><div class="pl-nmw" title="${esc(a.name + (a.entregable ? ' → ' + a.entregable : '') + (opts.agrupar === 'area' && a._etapa ? ' · ' + a._etapa : ''))}">${inp('name', a.name, 'Actividad', 'nm')}${opts.owner && has('planOnDetalle') ? notasTareasBtn(a) : ''}</div></td>
      ${editable && opts.owner
        ? `<td class="pl-rs pl-pick" tabindex="0" data-pick="resp" data-act="${a.id}" title="Elegir responsables de la lista de involucrados">${avatares(respDe(a))}<span class="pl-tx rs">${esc(resp) || '<span class="pl-mut">Elegir…</span>'}</span><i class="pl-caret">▾</i></td>`
        : `<td class="pl-rs">${avatares(respDe(a))}<span class="pl-tx rs" title="${esc(resp)}">${esc(resp) || '<span class="pl-mut">—</span>'}</span></td>`}
      ${cols.area ? celdaArea(a, editable && opts.owner) : ''}
      ${cols.entregable ? `<td>${inp('entregable', a.entregable || '', '—', 'en')}</td>` : ''}
      ${cols.base ? `<td class="pl-lbc" title="Congelada: no se mueve">${lb}</td>` : ''}
      ${cols.full ? celdaFecha(a, 'startDate', editable) + celdaFecha(a, 'deadline', editable, est === 'Atrasada' ? ' late' : '')
        : `<td class="pl-tlc">${!a.startDate && !a.deadline && a.duracion ? `<span class="pl-mut" title="Tiene duración pero aún no fechas: ponle inicio, o una precedencia con fecha, y se programa sola">⏱ ${a.duracion} d · sin fechas</span>` : pildoraRango(a.startDate, a.deadline, today, est, g.color, has('planOnOpen') && opts.owner ? ` onclick="planOnOpen('${a.id}')" role="button"` : '')}${dvChip}${ultimoModelo && ultimoModelo.fechaMeta && a.deadline && a.deadline > ultimoModelo.fechaMeta && est !== 'Completada' ? `<span class="pl-pasa" title="Termina después de la fecha meta (${fCorta(ultimoModelo.fechaMeta)})">⚑</span>` : ''}</td>`}
      ${cols.real ? celdaFecha(a, 'realStart', editable, ' real') + celdaFecha(a, 'realEnd', editable, ' real') : ''}
      ${cols.dias ? (editable
        ? `<td class="pl-n"><input type="number" min="1" max="999" class="pl-in pct dur" data-cell="${a.id}:dur" value="${dias}" placeholder="—" title="Duración en días hábiles. Con inicio, el fin sale solo; sin fechas, queda la duración y se programa al terminar sus precedentes" onchange="Plan.cambiarDuracion('${a.id}',this.value)"></td>`
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
    render, estado, pickDate, duracionDe, aplicarLocal, adelantar, cascada, colorDe, respDe, norm, fCorta, dibujarLineas, cambiarDuracion, areasActividad,
    etapas, medirAjuste, anchoAjuste, enfocar, pintarComentarios: pintarPop,
    // La vista Tabla del editor no pasa por render(): le presta su modelo a la nubecita
    usarModelo(m) { ultimoModelo = m; },
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
    guardar(clave, o) { try { localStorage.setItem(clave, JSON.stringify({ vista: o.vista, zoom: o.zoom, agrupar: o.agrupar, panel: o.panel, lineas: o.lineas, tareas: o.tareas, cols: o.cols, colsVis: o.colsVis })); } catch (e) {} },
    cambiar(o, k, v) {
      if (k === 'col') o.cols[v] = !o.cols[v];
      else if (k === 'colvis') {
        const [ck, on] = String(v).split(':'), vk = o.vista === 'tabla' ? 'tabla' : 'gantt';
        o.colsVis = o.colsVis || {}; o.colsVis[vk] = Object.assign({}, o.colsVis[vk], { [ck]: on === '1' });
      }
      else if (k === 'anchosReset') { anchosCol = {}; guardarAnchos(); }
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
