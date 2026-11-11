/* ============================================================
   AGENDA DE COMITÉS · calendario mensual y lista
   Cada sesión: comité, fecha y hora, lugar o enlace de Teams,
   proyectos que se presentan, temas, asistentes, decisiones y
   compromisos. Se puede agregar a Outlook (.ics).
   ============================================================ */
'use strict';
(function () {
  const { $, $$, esc } = App;
  const A = Object.assign({ view: 'mes', hidden: [], tab: 'cal' }, App.store.get('agenda', {}));
  const save = () => App.store.set('agenda', A);
  let mes = App.d.today().slice(0, 7); // 'AAAA-MM'
  const ESTADOS = ['Programada', 'Realizada', 'Cancelada'];

  const comite = s => App.byId('committees', s.comite_id);
  const colorOf = s => (comite(s) || {}).color || 'gris';
  const tituloOf = s => s.titulo || (comite(s) || {}).name || 'Sesión de comité';
  const visibles = () => App.S.sessions.filter(s => s.fecha && !A.hidden.includes(s.comite_id || '_'));
  const byDate = (a, b) => (a.fecha + (a.hora_ini || '')).localeCompare(b.fecha + (b.hora_ini || ''));

  /* ---------- Comité de valor: calendario, decisiones, compromisos y actas ---------- */
  const TABS = [['cal', 'Calendario'], ['dec', 'Decisiones'], ['comp', 'Compromisos'], ['actas', 'Actas']];
  const iniciales = n => { const p = String(n || '').trim().split(/\s+/); return p.length > 1 ? `${p[0][0]}. ${p[p.length - 1]}` : p[0] || ''; };
  const responsableDe = p => { const v = p.props || {}; return [].concat(v.habilitadores || [], v.realizadores || []).filter(Boolean)[0] || ''; };
  // Por qué va una iniciativa al comité (se deduce del caso, la fase y el cronograma)
  function motivo(p) {
    const c = App.caseOf(p.id);
    if (c && c.estado === 'En revisión') return { t: 'Aprobar caso', cl: 'azul' };
    if (c && c.estado === 'Aplazado') return { t: 'Caso con ajustes', cl: 'naranja' };
    const av = App.Avance && App.Avance.de(p); if (av && av.listo && av.sig) return { t: 'Paso a ' + av.sig.corto, cl: 'azul' };
    const pl = App.planOf(p.id); if (pl.atrasadas) return { t: `Atraso · ${pl.atrasadas} act.`, cl: 'rojo' };
    if (!c) return { t: 'Sin caso', cl: 'gris' };
    return { t: 'Avance', cl: 'gris' };
  }
  const compromisosTodos = () => App.S.sessions.flatMap(s => (s.compromisos || []).map((k, i) => ({ s, k, i }))).filter(x => (x.k.texto || '').trim());
  // Decisiones registradas una a una; si el acta solo tiene el texto libre, cada línea cuenta como una decisión
  const decisionesTodas = () => App.S.sessions.flatMap(s => { const reg = (s.decisiones_reg || []).filter(d => (d.texto || '').trim()); return (reg.length ? reg : String(s.decisiones || '').split('\n').map(t => t.replace(/^[-*•\d.)\s]+/, '').trim()).filter(Boolean).map(texto => ({ texto, tipo: 'Decisión', libre: true }))).map(d => ({ d, s })); }).sort((a, b) => (b.d.fecha || b.s.fecha).localeCompare(a.d.fecha || a.s.fecha));

  function section(main, params) {
    if (params && params[0] === 'preparar') return App.Mejoras.preparar(main, params[1]);
    const ro = !App.canEdit(), today = App.d.today(), Y = +today.slice(0, 4);
    const tab = TABS.some(t => t[0] === A.tab) ? A.tab : 'cal';
    const [y, m] = mes.split('-').map(Number);
    const ses = visibles();
    const prox = ses.filter(s => s.fecha >= today && s.estado !== 'Cancelada').sort(byDate);
    const sig = prox[0] || null;
    const comps = compromisosTodos(), abiertos = comps.filter(x => !x.k.hecho), vencidos = abiertos.filter(x => x.k.fecha && x.k.fecha < today);
    const decs = decisionesTodas(), decsY = decs.filter(x => (x.d.fecha || x.s.fecha).startsWith(String(Y)));

    let cuerpo = '';
    if (tab === 'cal') cuerpo = `<div class="cv-grid"><div>${A.view === 'lista' ? listaHTML(ses) : calHTML(ses, sig, y, m, today, ro)}${leyendaComites(ro, today)}</div>${panelSesion(sig, abiertos, today, ro)}</div>`;
    else if (tab === 'dec') cuerpo = decisionesHTML(decs);
    else if (tab === 'comp') cuerpo = compromisosHTML(comps, today, ro);
    else cuerpo = actasHTML(today);

    main.innerHTML = `<div class="pg-top"><button class="burger" data-act="burger" aria-label="Menú">☰</button><h1>Comité de valor</h1>
        <div class="kl"><span><b>${sig ? esc(App.d.fmtShort(sig.fecha)) : '—'}</b>próxima sesión</span><span><b>${sig ? (sig.proyectos || []).length : 0}</b>iniciativas en agenda</span><span><b class="${vencidos.length ? 'r' : ''}">${vencidos.length}</b>compromisos vencidos</span><span><b>${decsY.length}</b>decisiones en ${Y}</span></div>
        <span class="sp"></span>${sig ? `<a class="btn ghost sm" href="/api/sesiones/${sig.id}/ics" download title="Agregar la próxima sesión a Outlook">⇩ Próxima sesión a Outlook</a>` : ''}${ro ? '' : '<button class="btn primary sm" data-new="">+ Sesión</button>'}</div>
      <div class="cv-tabs" role="tablist">${TABS.map(([k, l]) => `<button role="tab" data-tab="${k}" class="${tab === k ? 'on' : ''}" aria-selected="${tab === k}">${l}${k === 'comp' && abiertos.length ? ` <em class="${vencidos.length ? 'r' : ''}">${abiertos.length}</em>` : ''}</button>`).join('')}
        <span class="sp"></span>${tab === 'cal' ? `${A.view === 'mes' ? `<div class="cv-mes"><button class="btn sm" data-nav="-1" aria-label="Mes anterior">‹</button><b>${App.d.MESES[m - 1].replace(/^./, c => c.toUpperCase())} ${y}</b><button class="btn sm" data-nav="1" aria-label="Mes siguiente">›</button>${mes !== today.slice(0, 7) ? '<button class="btn ghost sm" data-nav="0">Hoy</button>' : ''}</div>` : ''}
        <div class="seg"><button data-v="mes" class="${A.view === 'mes' ? 'on' : ''}">Mes</button><button data-v="lista" class="${A.view === 'lista' ? 'on' : ''}">Lista</button></div>` : ''}</div>
      ${cuerpo}`;

    if (tab === 'cal' && A.view === 'lista') { const el = $(`#m-${mes}`, main) || $(`[id^="m-${today.slice(0, 7)}"]`, main); if (el) el.scrollIntoView({ block: 'start' }); }
    main.onclick = e => {
      if (e.target.closest('.burger')) return App.toggleSide();
      const tb = e.target.closest('[data-tab]'); if (tb) { A.tab = tb.dataset.tab; save(); return App.render(); }
      const v = e.target.closest('[data-v]'); if (v) { A.view = v.dataset.v; save(); return App.render(); }
      const nv = e.target.closest('[data-nav]');
      if (nv) { const k = +nv.dataset.nav; if (k === 0) mes = today.slice(0, 7); else { const d = App.d.toDate(`${mes}-01`); d.setUTCMonth(d.getUTCMonth() + k); mes = App.d.iso(d).slice(0, 7); } return App.render(); }
      const ed = e.target.closest('[data-cm-ed]'); if (ed) { e.stopPropagation(); return editComite(ed, ed.dataset.cmEd); }
      if (e.target.closest('[data-cm-new]')) return App.guard(async () => { const c = await App.create('committees', { name: 'Nuevo comité', color: App.COLORS[(App.S.committees.length + 3) % App.COLORS.length], frecuencia: '' }); App.render(); const b = $(`[data-cm-ed="${c.id}"]`, main); if (b) editComite(b, c.id); });
      const cm = e.target.closest('[data-cm]'); if (cm) { const id = cm.dataset.cm; A.hidden = A.hidden.includes(id) ? A.hidden.filter(x => x !== id) : [...A.hidden, id]; save(); return App.render(); }
      const ag = e.target.closest('[data-agenda-add]'); if (ag && !ro) { const s = App.byId('sessions', ag.dataset.agendaAdd); return App.pickList(ag, {
        items: App.projectsSorted().map(p => ({ id: p.id, label: App.projectName(p), color: App.projectColor(p) })),
        selected: s.proyectos || [], placeholder: 'Buscar iniciativa…', empty: 'No hay iniciativas',
        onSave: ids => App.patch('sessions', s.id, { proyectos: ids }).then(() => App.render()).catch(() => {}) }); }
      const gp = e.target.closest('[data-goproj]'); if (gp) return App.go('#/proyectos/' + gp.dataset.goproj);
      const dn = e.target.closest('[data-done]'); if (dn) return;
      const s = e.target.closest('[data-ses]'); if (s) return openSession(s.dataset.ses);
      const nw = e.target.closest('[data-new]'); if (nw) return openNewSession(nw.dataset.new || (mes === today.slice(0, 7) ? today : `${mes}-01`));
    };
    main.ondblclick = e => { const d = e.target.closest('[data-day]'); if (d && App.canEdit() && !e.target.closest('[data-ses], [data-new], a')) openNewSession(d.dataset.day); };
    main.onchange = e => {
      const dn = e.target.closest('[data-done]'); if (!dn) return;
      const s = App.byId('sessions', dn.dataset.done); const comp = JSON.parse(JSON.stringify(s.compromisos || []));
      comp[+dn.dataset.i].hecho = dn.checked;
      App.patch('sessions', s.id, { compromisos: comp }).then(() => App.render()).catch(() => {});
    };
  }

  // Calendario de lunes a viernes (sábado y domingo aparecen solo si ese mes tiene sesiones en fin de semana)
  function calHTML(ses, sig, y, m, today, ro) {
    const first = `${mes}-01`, gridStart = App.d.add(first, -App.d.dow(first));
    const dim = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const weeks = Math.ceil((App.d.dow(first) + dim) / 7);
    const finDe = ses.some(s => s.fecha.startsWith(mes) && App.d.dow(s.fecha) > 4);
    const nd = finDe ? 7 : 5;
    const hitos = App.S.activities.filter(a => a.hito && a.fin && a.fin.startsWith(mes) && (a.avance || 0) < 100);
    let cells = '';
    for (let w = 0; w < weeks; w++) for (let k = 0; k < nd; k++) {
      const d = App.d.add(gridStart, w * 7 + k);
      const evs = ses.filter(s => s.fecha === d).sort(byDate);
      const hs = hitos.filter(a => a.fin === d);
      cells += `<div class="cv-d ${d.slice(0, 7) !== mes ? 'out' : ''} ${d === today ? 'hoy' : ''}" data-day="${d}"><div class="dn"><span>${+d.slice(8)}</span>${ro ? '' : `<button class="add" data-new="${d}" title="Nueva sesión este día" aria-label="Nueva sesión">+</button>`}</div>
        ${evs.map(s => { const n = (s.proyectos || []).length; return `<button class="cv-ev ${sig && s.id === sig.id ? 'sig' : ''} ${s.estado === 'Cancelada' ? 'cancel' : ''}" data-ses="${s.id}" style="--ev:var(--c-${colorOf(s)});--evi:var(--c-${colorOf(s)}-i)" title="${esc(tituloOf(s))}"><b>${esc(tituloOf(s))}</b><span>${s.hora_ini ? esc(s.hora_ini) + ' · ' : ''}${n ? `${n} ${n === 1 ? 'iniciativa' : 'iniciativas'}` : esc(s.estado || 'Programada')}</span></button>`; }).join('')}
        ${hs.map(a => { const p = App.byId('projects', a.project_id); return `<a class="cv-ev hito ${a.fin < today ? 'tarde' : ''}" href="#/cronograma/${a.project_id}" title="Hito del cronograma"><b>Hito · ${esc(a.name)}</b><span>${p ? esc(App.projectName(p)) : ''}</span></a>`; }).join('')}</div>`;
    }
    const dias = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].slice(0, nd);
    return `<section class="t-card cv-cal" style="--nd:${nd}"><div class="cv-h">${dias.map(d => `<div><span class="l">${d}</span><span class="c">${d.slice(0, 3)}</span></div>`).join('')}</div><div class="cv-b">${cells}</div></section>`;
  }
  function listaHTML(ses) {
    const all = ses.slice().sort(byDate); let cur = '';
    return `<div class="ag-list">${all.length ? all.map(s => { const mm = s.fecha.slice(0, 7); const h = mm !== cur ? `<div class="mes" id="m-${mm}">${App.d.MESES[+mm.slice(5) - 1]} ${mm.slice(0, 4)}</div>` : ''; cur = mm; return h + itemHTML(s, true); }).join('') : '<div class="t-card"><div class="t-vacio">No hay sesiones</div></div>'}</div>`;
  }
  function leyendaComites(ro, today) {
    const counts = id => App.S.sessions.filter(s => (s.comite_id || '_') === id && s.fecha >= today && s.estado !== 'Cancelada').length;
    return `<div class="cv-ley"><span class="t-tag">Comités (clic para mostrar u ocultar):</span>
      ${App.S.committees.map(c => `<span class="cv-cm ${A.hidden.includes(c.id) ? 'off' : ''}" data-cm="${c.id}" role="button" aria-pressed="${!A.hidden.includes(c.id)}"><i style="background:var(--c-${c.color || 'gris'}-i)"></i>${esc(c.name)}${counts(c.id) ? ` <small>${counts(c.id)}</small>` : ''}${ro ? '' : `<button class="more" data-cm-ed="${c.id}" title="Editar comité" aria-label="Editar comité">···</button>`}</span>`).join('')}
      ${App.S.sessions.some(s => !s.comite_id) ? `<span class="cv-cm ${A.hidden.includes('_') ? 'off' : ''}" data-cm="_" role="button"><i style="background:var(--c-gris-i)"></i>Sin comité</span>` : ''}
      <span class="cv-cm hito"><i></i>Hitos de los cronogramas</span>
      ${ro ? '' : '<button class="t-lnk" data-cm-new="1">+ Comité</button>'}</div>`;
  }
  function panelSesion(s, abiertos, today, ro) {
    if (!s) return `<aside class="t-card cv-side"><div class="cv-sec"><div class="cv-lbl">Próxima sesión</div><div class="faint" style="margin:6px 0 10px">No hay sesiones programadas.</div>${ro ? '' : '<button class="btn primary sm" data-new="">+ Programar sesión</button>'}</div></aside>`;
    const c = comite(s), dt = App.d.toDate(s.fecha), dia = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'][dt.getUTCDay()];
    const ps = (s.proyectos || []).map(id => App.byId('projects', id)).filter(Boolean);
    const vence = abiertos.filter(x => x.k.fecha && x.k.fecha <= s.fecha).sort((a, b) => a.k.fecha.localeCompare(b.k.fecha));
    const sinFecha = abiertos.filter(x => !x.k.fecha).length;
    return `<aside class="t-card cv-side">
      <div class="cv-sec"><div class="cv-lbl">Próxima sesión${s.fecha === today ? ' · hoy' : ''}</div>
        <h3 class="cv-tit"><a data-ses="${s.id}" href="javascript:void 0">${esc(tituloOf(s))} · ${dia} ${+s.fecha.slice(8)} ${App.d.MES3[+s.fecha.slice(5, 7) - 1]}</a></h3>
        <div class="cv-meta">${[s.hora_ini ? esc(s.hora_ini) + (s.hora_fin ? ' – ' + esc(s.hora_fin) : '') : '', s.lugar ? esc(s.lugar) : '', s.enlace && /^https?:\/\//i.test(s.enlace) ? `<a href="${esc(s.enlace)}" target="_blank" rel="noopener">Enlace de la reunión ↗</a>` : '', c ? esc(c.name) : ''].filter(Boolean).join(' · ') || '<span class="faint">Sin hora ni lugar todavía</span>'}</div>
        <div class="cv-acc"><a class="btn sm" href="#/agenda/preparar/${s.id}">Preparar presentación</a><a class="btn sm" href="/api/sesiones/${s.id}/ics" download title="Agregar a Outlook">.ics</a><button class="btn sm" data-ses="${s.id}">Acta</button></div></div>
      <div class="cv-sec"><div class="cv-lbl">Agenda · ${ps.length} ${ps.length === 1 ? 'iniciativa' : 'iniciativas'}</div>
        ${ps.length ? `<ol class="cv-ag">${ps.map((p, i) => { const mo = motivo(p), r = responsableDe(p); return `<li data-goproj="${p.id}" title="Abrir la iniciativa"><span class="n">${i + 1}</span><span class="t"><b>${esc(App.projectName(p))}</b><small>${r ? `<span class="pf-per"><i class="cl-${App.colorPersona(r)}"></i>${esc(iniciales(r))}</span>` : '<span class="faint">sin responsable</span>'}</small></span><span class="pill cl-${mo.cl}">${esc(mo.t)}</span></li>`; }).join('')}</ol>` : '<div class="faint" style="margin:6px 0">Aún no hay iniciativas en la agenda.</div>'}
        ${ro ? '' : `<button class="t-lnk" data-agenda-add="${s.id}">+ Agregar iniciativa a la agenda</button>`}</div>
      <div class="cv-sec"><div class="cv-lbl">Compromisos que vencen antes de la sesión</div>
        ${vence.length ? `<div class="cv-cps">${vence.slice(0, 8).map(({ s: s2, k, i }) => `<div class="cv-cp"><input type="checkbox" data-done="${s2.id}" data-i="${i}" ${ro ? 'disabled' : ''} title="Marcar como cumplido" aria-label="Cumplido"><span class="t" data-ses="${s2.id}"><b>${esc(k.texto)}</b>${k.responsable ? ` · ${esc(k.responsable)}` : ''}</span><span class="f ${k.fecha < today ? 'r' : ''}">${k.fecha < today ? 'vencido ' : ''}${esc(App.d.fmtShort(k.fecha))}</span></div>`).join('')}</div>` : '<div class="faint" style="margin:6px 0">Nada vence antes de la sesión.</div>'}
        ${sinFecha ? `<button class="t-lnk" data-tab="comp">${sinFecha} compromiso${sinFecha === 1 ? '' : 's'} sin fecha →</button>` : ''}</div></aside>`;
  }
  function decisionesHTML(decs) {
    return `<section class="t-card pf-tbl-card"><div class="pf-wrap"><table class="pf-tbl cv-tbl"><thead><tr><th>Fecha</th><th>Tipo</th><th>Decisión</th><th>Iniciativa</th><th>Responsable</th><th>Estado</th><th>Sesión</th></tr></thead><tbody>
      ${decs.map(({ d, s }) => { const p = d.project_id ? App.byId('projects', d.project_id) : null; return `<tr data-ses="${s.id}"><td>${esc(App.d.fmt(d.fecha || s.fecha))}</td><td><span class="pill cl-${/aprob/i.test(d.tipo || '') ? 'verde' : /rechaz|cancel/i.test(d.tipo || '') ? 'rojo' : 'gris'}">${esc(d.tipo || 'Decisión')}</span></td><td class="cv-txt">${esc(d.texto)}</td><td>${p ? `<a href="#/proyectos/${p.id}" data-goproj="${p.id}">${esc(App.projectName(p))}</a>` : '<span class="faint">—</span>'}</td><td>${esc(d.responsable || '')}</td><td>${d.estado === 'Cumplida' ? '<span class="pill cl-verde">Cumplida</span>' : `<span class="faint">${d.libre ? '—' : esc(d.estado || 'Pendiente')}</span>`}</td><td class="faint">${esc(tituloOf(s))}</td></tr>`; }).join('') || '<tr><td colspan="7"><div class="t-vacio">Aún no hay decisiones registradas. Se anotan en el acta de cada sesión.</div></td></tr>'}
      </tbody></table></div><div class="t-pie t-pie-row"><span class="t-tag">${decs.length} decisiones · clic en una fila abre el acta de esa sesión</span></div></section>`;
  }
  function compromisosHTML(comps, today, ro) {
    const orden = comps.slice().sort((a, b) => (a.k.hecho - b.k.hecho) || (a.k.fecha || '9999').localeCompare(b.k.fecha || '9999'));
    return `<section class="t-card pf-tbl-card"><div class="pf-wrap"><table class="pf-tbl cv-tbl"><thead><tr><th></th><th>Compromiso</th><th>Responsable</th><th>Vence</th><th>Sesión</th></tr></thead><tbody>
      ${orden.map(({ s, k, i }) => `<tr class="${k.hecho ? 'ok' : ''}"><td style="width:28px"><input type="checkbox" data-done="${s.id}" data-i="${i}" ${k.hecho ? 'checked' : ''} ${ro ? 'disabled' : ''} aria-label="Cumplido"></td><td class="cv-txt" data-ses="${s.id}">${esc(k.texto)}</td><td>${esc(k.responsable || '')}</td><td class="${!k.hecho && k.fecha && k.fecha < today ? 'cv-r' : ''}">${k.fecha ? (!k.hecho && k.fecha < today ? 'vencido ' : '') + esc(App.d.fmtShort(k.fecha)) : '<span class="faint">sin fecha</span>'}</td><td class="faint" data-ses="${s.id}">${esc(tituloOf(s))} · ${esc(App.d.fmtShort(s.fecha))}</td></tr>`).join('') || '<tr><td colspan="5"><div class="t-vacio">No hay compromisos. Se anotan en el acta de cada sesión.</div></td></tr>'}
      </tbody></table></div><div class="t-pie t-pie-row"><span class="t-tag">${comps.filter(x => !x.k.hecho).length} abiertos · ${comps.filter(x => x.k.hecho).length} cumplidos · marca la casilla cuando se cumpla</span></div></section>`;
  }
  function actasHTML(today) {
    const pas = App.S.sessions.filter(s => s.fecha && (s.fecha <= today || s.estado === 'Realizada') && s.estado !== 'Cancelada').sort((a, b) => byDate(b, a));
    return `<section class="t-card pf-tbl-card"><div class="pf-wrap"><table class="pf-tbl cv-tbl"><thead><tr><th>Fecha</th><th>Sesión</th><th class="n">Iniciativas</th><th class="n">Decisiones</th><th class="n">Compromisos</th><th>Asistentes</th><th></th></tr></thead><tbody>
      ${pas.map(s => { const nd = decisionesTodas().filter(x => x.s.id === s.id).length, nc = (s.compromisos || []).filter(k => (k.texto || '').trim()).length, completa = nd || (s.decisiones || '').trim(); return `<tr data-ses="${s.id}"><td>${esc(App.d.fmt(s.fecha))}</td><td><b>${esc(tituloOf(s))}</b></td><td class="n">${(s.proyectos || []).length}</td><td class="n">${nd || '<span class="faint">—</span>'}</td><td class="n">${nc || '<span class="faint">—</span>'}</td><td class="cv-txt faint">${esc((s.asistentes || '').replace(/\s+/g, ' ').slice(0, 80))}</td><td>${completa ? '<span class="pill cl-verde">Acta registrada</span>' : '<span class="pill cl-naranja">Falta el acta</span>'}</td></tr>`; }).join('') || '<tr><td colspan="7"><div class="t-vacio">Aún no hay sesiones realizadas.</div></td></tr>'}
      </tbody></table></div><div class="t-pie t-pie-row"><span class="t-tag">Clic en una sesión abre su acta: asistentes, decisiones y compromisos</span></div></section>`;
  }
  function itemHTML(s, full) {
    const c = comite(s);
    return `<button class="up-item" data-ses="${s.id}"><div class="up-date" style="${s.estado === 'Cancelada' ? 'opacity:.5' : ''}"><b>${+s.fecha.slice(8)}</b><span>${App.d.MES3[+s.fecha.slice(5, 7) - 1]}</span></div><div class="up-t"><b style="${s.estado === 'Cancelada' ? 'text-decoration:line-through' : ''}">${esc(tituloOf(s))}</b><span>${s.hora_ini ? esc(s.hora_ini) + (s.hora_fin ? '–' + esc(s.hora_fin) : '') + ' · ' : ''}${(s.proyectos || []).length} ${(s.proyectos || []).length === 1 ? 'proyecto' : 'proyectos'}${full && c ? ' · ' + esc(c.name) : ''}${s.estado && s.estado !== 'Programada' ? ' · ' + esc(s.estado) : ''}</span></div><i style="width:10px;height:10px;border-radius:50%;flex-shrink:0;background:var(--c-${colorOf(s)}-i)"></i></button>`;
  }

  /* ---------- comités ---------- */
  function editComite(anchor, id) {
    const c = App.byId('committees', id); if (!c) return;
    const p = App.openPop(anchor, `<div class="lbl">Comité</div><input type="text" data-k="name" value="${esc(c.name)}" style="margin:0 4px 6px;width:calc(100% - 8px)">
      <div class="colors">${App.COLORS.map(k => `<i class="cl-${k} ${c.color === k ? 'on' : ''}" data-color="${k}" style="background:var(--c-${k}-i)" title="${k}"></i>`).join('')}</div>
      <div class="lbl">Frecuencia</div><input type="text" data-k="frecuencia" value="${esc(c.frecuencia || '')}" placeholder="Ej.: quincenal, primer martes del mes" style="margin:0 4px 6px;width:calc(100% - 8px)">
      <div class="lbl">Integrantes</div><textarea data-k="integrantes" rows="3" placeholder="Nombres, uno por línea" style="margin:0 4px 6px;width:calc(100% - 8px)">${esc(c.integrantes || '')}</textarea>
      <div class="lbl">Descripción</div><textarea data-k="descripcion" rows="2" style="margin:0 4px 6px;width:calc(100% - 8px)">${esc(c.descripcion || '')}</textarea>
      <div class="sep"></div><button class="mi danger" data-p="del">🗑 Eliminar comité</button>`, { width: 300, onClose: cancel => {
        if (cancel) return; // Escape cancela
        const patch = {}; $$('[data-k]', p).forEach(f => { if ((c[f.dataset.k] || '') !== f.value) patch[f.dataset.k] = f.value; });
        if (patch.name === '') delete patch.name;
        if (Object.keys(patch).length) App.patch('committees', id, patch).then(() => App.render()).catch(() => {});
      } });
    p.onclick = e => {
      const ci = e.target.closest('[data-color]'); if (ci) { c.color = ci.dataset.color; $$('.colors i', p).forEach(x => x.classList.toggle('on', x.dataset.color === c.color)); App.patch('committees', id, { color: c.color }).then(() => App.render()).catch(() => {}); return; }
      if (e.target.closest('[data-p=del]')) {
        const n = App.S.sessions.filter(s => s.comite_id === id).length;
        if (!confirm(`¿Eliminar «${c.name}»?${n ? ` Sus ${n} sesiones quedan sin comité (no se borran).` : ''}`)) return;
        App.closePop(true); App.guard(async () => { await App.remove('committees', id); App.render(); });
      }
    };
  }

  /* ---------- sesiones ---------- */
  async function openNewSession(fecha, extra = {}) {
    if (!App.canEdit()) return;
    const c = App.S.committees.find(x => !A.hidden.includes(x.id)) || App.S.committees[0];
    await App.guard(async () => {
      const s = await App.create('sessions', Object.assign({ comite_id: c ? c.id : null, fecha, hora_ini: '09:00', hora_fin: '10:00', estado: 'Programada', proyectos: [], compromisos: [] }, extra));
      mes = fecha.slice(0, 7);
      App.render(); openSession(s.id);
    });
  }
  function openSession(id) {
    const s = App.byId('sessions', id); if (!s) return;
    const ro = !App.canEdit(), dis = ro ? 'disabled' : '';
    const c = comite(s);
    const comp = JSON.parse(JSON.stringify(s.compromisos || []));
    const compHTML = () => comp.map((k, i) => `<div class="comp-ed"><input type="checkbox" data-ci="${i}" data-ck="hecho" ${k.hecho ? 'checked' : ''} ${dis} title="Cumplido"><input class="fld" data-ci="${i}" data-ck="texto" value="${esc(k.texto || '')}" placeholder="Compromiso" ${dis} style="${k.hecho ? 'text-decoration:line-through;color:var(--muted)' : ''}"><input class="fld rsp" data-ci="${i}" data-ck="responsable" value="${esc(k.responsable || '')}" placeholder="Responsable" ${dis} list="pplList"><input class="fld fch" type="date" data-ci="${i}" data-ck="fecha" value="${esc(k.fecha || '')}" ${dis}>${ro ? '<span></span>' : `<button class="x" data-cdel="${i}" title="Quitar">✕</button>`}</div>`).join('') || '<div class="faint" style="font-size:12px">Sin compromisos</div>';
    const projHTML = () => (s.proyectos || []).map(pid => { const p = App.byId('projects', pid); return p ? `<span class="pill cl-${App.projectColor(p)}" data-goproj="${pid}" title="Abrir proyecto">${esc(App.projectName(p))}</span>` : ''; }).join('') + (ro ? '' : '<button class="btn sm" data-addproj="1">+ Proyecto</button>') + (!(s.proyectos || []).length && ro ? '<span class="faint">Ninguno</span>' : '');
    const d = App.openDrawer(`<div class="d-top"><div style="display:flex;gap:8px;align-items:center"><span class="pill cl-${colorOf(s)}">${esc(c ? c.name : 'Sin comité')}</span><span class="tag ${s.estado === 'Cancelada' ? '' : 'warn'}">${esc(s.estado || 'Programada')}</span></div><button class="x" data-close="1" title="Cerrar">✕</button></div>
      <h2>${esc(tituloOf(s))}</h2>
      <div class="faint" style="font-size:12px;margin:-6px 0 14px">${esc(App.d.fmtLong(s.fecha))}${s.hora_ini ? ' · ' + esc(s.hora_ini) + (s.hora_fin ? ' a ' + esc(s.hora_fin) : '') : ''}</div>
      <div class="frm">
        <label>Título</label><input class="fld" data-s="titulo" value="${esc(s.titulo || '')}" placeholder="${esc(c ? c.name : 'Sesión de comité')}" ${dis}>
        <label>Comité</label><select class="fld" data-s="comite_id" ${dis}><option value="">Sin comité</option>${App.S.committees.map(x => `<option value="${x.id}" ${x.id === s.comite_id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>
        <label>Fecha y hora</label><div class="row"><input class="fld" type="date" data-s="fecha" value="${esc(s.fecha)}" ${dis}><input class="fld" type="time" data-s="hora_ini" value="${esc(s.hora_ini || '')}" ${dis} style="max-width:120px"><span class="faint">a</span><input class="fld" type="time" data-s="hora_fin" value="${esc(s.hora_fin || '')}" ${dis} style="max-width:120px"></div>
        <label>Estado</label><select class="fld" data-s="estado" ${dis}>${ESTADOS.map(e => `<option ${e === (s.estado || 'Programada') ? 'selected' : ''}>${e}</option>`).join('')}</select>
        <label>Lugar</label><input class="fld" data-s="lugar" value="${esc(s.lugar || '')}" placeholder="Sala, piso…" ${dis}>
        <label>Enlace</label><div class="row"><input class="fld" data-s="enlace" value="${esc(s.enlace || '')}" placeholder="Enlace de Teams" ${dis}>${s.enlace && /^https?:\/\//i.test(s.enlace) ? `<a class="btn sm" href="${esc(s.enlace)}" target="_blank" rel="noopener">Abrir ↗</a>` : ''}</div>
        <label>Proyectos</label><div class="chips-sel" id="sProj">${projHTML()}</div>
      </div>
      <h4>Orden del día y temas</h4><textarea class="fld" data-s="temas" rows="4" ${dis} placeholder="1. Avance de proyectos…">${esc(s.temas || '')}</textarea>
      <h4>Asistentes</h4><textarea class="fld" data-s="asistentes" rows="2" ${dis}>${esc(s.asistentes || '')}</textarea>
      <h4>Decisiones</h4><textarea class="fld" data-s="decisiones" rows="4" ${dis} placeholder="Lo que se decidió en la sesión">${esc(s.decisiones || '')}</textarea>
      ${App.vista && App.vista.nueva ? '<div id="sDec" style="margin:12px 0"></div>' : ''}
      <h4>Compromisos</h4><div id="sComp">${compHTML()}</div>${ro ? '' : '<button class="btn sm" data-cadd="1" style="margin-top:4px">+ Compromiso</button>'}
      <datalist id="pplList">${App.S.people.map(u => `<option value="${esc(u.name)}">`).join('')}</datalist>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:22px"><a class="btn" href="/api/sesiones/${s.id}/ics" download>⇩ Agregar a Outlook (.ics)</a>${App.vista && App.vista.nueva ? `<a class="btn amarillo" href="#/agenda/preparar/${s.id}" data-prep="1">⎙ Preparar el comité</a>` : ''}${ro ? '' : '<button class="btn" data-rep="1">↻ Repetir…</button><span style="flex:1"></span><button class="btn danger" data-sdel="1">Eliminar sesión</button>'}</div>
      <div class="meta-line">${s.updated_by_name ? `Última edición: ${esc(s.updated_by_name)}, ${esc(App.d.ago(s.updated_at))}` : ''}</div>`, { onClose: () => App.render() });

    const saveComp = () => App.patch('sessions', id, { compromisos: comp }).catch(() => {});
    if ($('#sDec', d)) App.Mejoras.decisionesEditor($('#sDec', d), s, ro);
    const cabecera = () => {
      const s2 = App.byId('sessions', id); if (!s2) return; const c2 = comite(s2);
      const top = $('.d-top > div', d); if (top) top.innerHTML = `<span class="pill cl-${colorOf(s2)}">${esc(c2 ? c2.name : 'Sin comité')}</span><span class="tag ${s2.estado === 'Cancelada' ? '' : 'warn'}">${esc(s2.estado || 'Programada')}</span>`;
      const h = $('h2', d); if (h) { h.textContent = tituloOf(s2); const fl = h.nextElementSibling; if (fl) fl.textContent = App.d.fmtLong(s2.fecha) + (s2.hora_ini ? ' · ' + s2.hora_ini + (s2.hora_fin ? ' a ' + s2.hora_fin : '') : ''); }
    };
    d.onchange = e => {
      const t = e.target;
      if (t.dataset.s) {
        const f = t.dataset.s; let v = t.value;
        if (f === 'fecha' && !v) { t.value = s.fecha; return; }
        if (f === 'comite_id') v = v || null;
        // Solo se actualiza el encabezado: redibujar todo el panel borraría lo que se está escribiendo
        App.patch('sessions', id, { [f]: v }).then(() => { if (f === 'fecha') mes = v.slice(0, 7); cabecera(); }).catch(() => {});
      } else if (t.dataset.ci != null) {
        const k = comp[+t.dataset.ci]; k[t.dataset.ck] = t.type === 'checkbox' ? t.checked : t.value;
        if (t.type === 'checkbox') $('#sComp', d).innerHTML = compHTML();
        saveComp();
      }
    };
    d.onclick = e => {
      if (e.target.closest('[data-close]')) return App.closeDrawer();
      const gp = e.target.closest('[data-goproj]'); if (gp) { App.closeDrawer(); return App.go('#/proyectos/' + gp.dataset.goproj); }
      if (e.target.closest('[data-prep]')) { App.closeDrawer(); return; }
      if (ro) return;
      if (e.target.closest('[data-addproj]')) return App.pickList(e.target.closest('[data-addproj]'), {
        items: App.projectsSorted().map(p => ({ id: p.id, label: App.projectName(p), color: App.projectColor(p) })),
        selected: s.proyectos || [], placeholder: 'Buscar proyecto…', empty: 'No hay proyectos',
        onSave: ids => App.patch('sessions', id, { proyectos: ids }).then(() => { $('#sProj', d).innerHTML = projHTML(); }).catch(() => {}),
      });
      if (e.target.closest('[data-cadd]')) { comp.push({ texto: '', responsable: '', fecha: null, hecho: false }); $('#sComp', d).innerHTML = compHTML(); const ins = $$('[data-ck=texto]', d); ins[ins.length - 1].focus(); return; }
      const cd = e.target.closest('[data-cdel]'); if (cd) { comp.splice(+cd.dataset.cdel, 1); $('#sComp', d).innerHTML = compHTML(); return saveComp(); }
      if (e.target.closest('[data-sdel]')) { if (!confirm('¿Eliminar esta sesión?')) return; return App.guard(async () => { await App.remove('sessions', id); App.closeDrawer(); }); }
      if (e.target.closest('[data-rep]')) return repetir(e.target.closest('[data-rep]'), s);
    };
  }
  function repetir(anchor, s) {
    const p = App.openPop(anchor, `<div class="lbl">Repetir esta sesión</div><div class="row" style="padding:0 4px"><select data-r="cada" style="flex:1;width:auto"><option value="7">Cada semana</option><option value="14" selected>Cada 2 semanas</option><option value="m">Cada mes</option></select></div><div class="row" style="padding:0 4px"><input type="number" data-r="n" value="6" min="1" max="52" style="width:80px"><span class="hint" style="margin:0">veces más</span></div><div class="row" style="padding:4px"><button class="btn primary" data-r="ok">Crear sesiones</button></div><div class="hint">Copia comité, hora, lugar, enlace, proyectos y temas. No copia decisiones ni compromisos.</div>`, { width: 280, nofocus: true });
    p.onclick = e => {
      if (!e.target.closest('[data-r=ok]')) return;
      const cada = $('[data-r=cada]', p).value, n = Math.max(1, Math.min(52, +$('[data-r=n]', p).value || 1));
      App.closePop(true);
      App.guard(async () => {
        for (let i = 1; i <= n; i++) {
          let f;
          if (cada === 'm') { const d = App.d.toDate(s.fecha); const day = d.getUTCDate(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + i); const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate(); d.setUTCDate(Math.min(day, last)); f = App.d.iso(d); }
          else f = App.d.add(s.fecha, i * Number(cada));
          await App.create('sessions', { comite_id: s.comite_id, titulo: s.titulo || '', fecha: f, hora_ini: s.hora_ini, hora_fin: s.hora_fin, estado: 'Programada', lugar: s.lugar || '', enlace: s.enlace || '', proyectos: s.proyectos || [], temas: s.temas || '', compromisos: [] });
        }
        App.toast(`Se crearon ${n} sesiones`);
        App.render();
      });
    };
  }

  App.Agenda = { openSession, openNewSession, tituloOf, colorOf };
  App.views.agenda = { render: section };
})();
