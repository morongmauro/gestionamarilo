/* ============================================================
   AGENDA DE COMITÉS · calendario mensual y lista
   Cada sesión: comité, fecha y hora, lugar o enlace de Teams,
   proyectos que se presentan, temas, asistentes, decisiones y
   compromisos. Se puede agregar a Outlook (.ics).
   ============================================================ */
'use strict';
(function () {
  const { $, $$, esc } = App;
  const A = Object.assign({ view: 'mes', hidden: [] }, App.store.get('agenda', {}));
  const save = () => App.store.set('agenda', A);
  let mes = App.d.today().slice(0, 7); // 'AAAA-MM'
  const ESTADOS = ['Programada', 'Realizada', 'Cancelada'];

  const comite = s => App.byId('committees', s.comite_id);
  const colorOf = s => (comite(s) || {}).color || 'gris';
  const tituloOf = s => s.titulo || (comite(s) || {}).name || 'Sesión de comité';
  const visibles = () => App.S.sessions.filter(s => s.fecha && !A.hidden.includes(s.comite_id || '_'));
  const byDate = (a, b) => (a.fecha + (a.hora_ini || '')).localeCompare(b.fecha + (b.hora_ini || ''));

  function section(main) {
    const ro = !App.canEdit(), today = App.d.today();
    const [y, m] = mes.split('-').map(Number);
    const first = `${mes}-01`, gridStart = App.d.add(first, -App.d.dow(first));
    const dim = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const weeks = Math.ceil((App.d.dow(first) + dim) / 7);
    const ses = visibles();
    const delMes = ses.filter(s => s.fecha.startsWith(mes)).length;
    const prox = ses.filter(s => s.fecha >= today && s.estado !== 'Cancelada').sort(byDate);

    let cal;
    if (A.view === 'lista') {
      const all = ses.slice().sort(byDate); let cur = '';
      cal = `<div class="ag-list">${all.length ? all.map(s => { const mm = s.fecha.slice(0, 7); const h = mm !== cur ? `<div class="mes" id="m-${mm}">${App.d.MESES[+mm.slice(5) - 1]} ${mm.slice(0, 4)}</div>` : ''; cur = mm; return h + itemHTML(s, true); }).join('') : '<div class="card-box"><div class="empty-box"><b>No hay sesiones</b></div></div>'}</div>`;
    } else {
      let cells = '';
      for (let i = 0; i < weeks * 7; i++) {
        const d = App.d.add(gridStart, i);
        const evs = ses.filter(s => s.fecha === d).sort(byDate);
        cells += `<div class="cal-d ${d.slice(0, 7) !== mes ? 'out' : ''} ${App.d.dow(d) > 4 ? 'we' : ''} ${d === today ? 'today' : ''}" data-day="${d}"><div class="dn"><span>${+d.slice(8)}</span>${ro ? '' : `<button class="add" data-new="${d}" title="Nueva sesión">+</button>`}</div>
          ${evs.map(s => `<button class="ev cl-${colorOf(s)} ${s.estado === 'Cancelada' ? 'cancel' : ''}" data-ses="${s.id}" style="color:var(--c-${colorOf(s)}-i)" title="${esc(tituloOf(s))}">${s.hora_ini ? `<b>${esc(s.hora_ini)}</b>` : ''}${esc(tituloOf(s))}</button>`).join('')}</div>`;
      }
      cal = `<div class="cal"><div class="cal-h">${App.d.DIAS.map(d => `<div>${d}</div>`).join('')}</div><div class="cal-b">${cells}</div></div>`;
    }

    const counts = id => App.S.sessions.filter(s => (s.comite_id || '_') === id && s.fecha >= today && s.estado !== 'Cancelada').length;
    const comps = App.S.sessions.flatMap(s => (s.compromisos || []).map((k, i) => ({ s, k, i }))).filter(x => !x.k.hecho && (x.k.texto || '').trim())
      .sort((a, b) => (a.k.fecha || '9999').localeCompare(b.k.fecha || '9999'));

    main.innerHTML = `<div class="page-h"><button class="burger" data-act="burger">☰</button><div><h1>Agenda de comités</h1><div class="sub">${delMes} ${delMes === 1 ? 'sesión' : 'sesiones'} en ${App.d.MESES[m - 1]}${prox[0] ? ` · próxima: ${esc(tituloOf(prox[0]))}, ${esc(App.d.fmtShort(prox[0].fecha))}` : ''}</div></div><span class="sp"></span>
        <div class="seg"><button data-v="mes" class="${A.view === 'mes' ? 'on' : ''}">Mes</button><button data-v="lista" class="${A.view === 'lista' ? 'on' : ''}">Lista</button></div>
        ${A.view === 'mes' ? `<div style="display:flex;align-items:center;gap:6px"><button class="btn sm" data-nav="-1">‹</button><button class="btn sm" data-nav="0">Hoy</button><button class="btn sm" data-nav="1">›</button><b style="min-width:130px;text-align:center;text-transform:capitalize">${App.d.MESES[m - 1]} ${y}</b></div>` : ''}
        ${ro ? '' : '<button class="btn primary" data-new="">+ Sesión</button>'}</div>
      <div class="ag-grid"><div>${cal}</div>
        <div>
          <div class="side-card"><h3>Comités ${ro ? '' : '<button data-cm-new="1">+ Comité</button>'}</h3>
            ${App.S.committees.map(c => `<div class="cm-item ${A.hidden.includes(c.id) ? 'off' : ''}" data-cm="${c.id}" title="Clic para mostrar u ocultar en el calendario"><i style="background:var(--c-${c.color || 'gris'}-i)"></i><span class="nm">${esc(c.name)}</span><span class="n">${counts(c.id) || ''}</span>${ro ? '' : `<button class="more" data-cm-ed="${c.id}" title="Editar comité">···</button>`}</div>`).join('')}
            ${App.S.sessions.some(s => !s.comite_id) ? `<div class="cm-item ${A.hidden.includes('_') ? 'off' : ''}" data-cm="_"><i style="background:var(--c-gris-i)"></i><span class="nm">Sin comité</span></div>` : ''}
            ${!App.S.committees.length ? '<div class="none">Aún no hay comités</div>' : ''}
          </div>
          <div class="side-card"><h3>Próximas sesiones</h3>${prox.slice(0, 6).map(s => itemHTML(s)).join('') || '<div class="none">No hay sesiones programadas</div>'}</div>
          <div class="side-card"><h3>Compromisos abiertos <span class="faint" style="text-transform:none;letter-spacing:0">${comps.length || ''}</span></h3>
            ${comps.slice(0, 12).map(({ s, k, i }) => `<div class="comp"><input type="checkbox" data-done="${s.id}" data-i="${i}" ${ro ? 'disabled' : ''} title="Marcar como cumplido"><div class="t" data-ses="${s.id}" style="cursor:pointer"><b>${esc(k.texto)}</b><span class="${k.fecha && k.fecha < today ? 'late' : ''}">${esc(k.responsable || 'Sin responsable')}${k.fecha ? ' · vence ' + esc(App.d.fmtShort(k.fecha)) : ''}</span></div></div>`).join('') || '<div class="none">Nada pendiente</div>'}
          </div>
        </div></div>`;

    if (A.view === 'lista') { const el = $(`#m-${mes}`, main) || $(`[id^="m-${today.slice(0, 7)}"]`, main); if (el) el.scrollIntoView({ block: 'start' }); }
    main.onclick = e => {
      if (e.target.closest('.burger')) return App.toggleSide();
      const v = e.target.closest('[data-v]'); if (v) { A.view = v.dataset.v; save(); return App.render(); }
      const nv = e.target.closest('[data-nav]');
      if (nv) { const k = +nv.dataset.nav; if (k === 0) mes = today.slice(0, 7); else { const d = App.d.toDate(`${mes}-01`); d.setUTCMonth(d.getUTCMonth() + k); mes = App.d.iso(d).slice(0, 7); } return App.render(); }
      const ed = e.target.closest('[data-cm-ed]'); if (ed) { e.stopPropagation(); return editComite(ed, ed.dataset.cmEd); }
      if (e.target.closest('[data-cm-new]')) return App.guard(async () => { const c = await App.create('committees', { name: 'Nuevo comité', color: App.COLORS[(App.S.committees.length + 3) % App.COLORS.length], frecuencia: '' }); App.render(); const b = $(`[data-cm-ed="${c.id}"]`, main); if (b) editComite(b, c.id); });
      const cm = e.target.closest('[data-cm]'); if (cm) { const id = cm.dataset.cm; A.hidden = A.hidden.includes(id) ? A.hidden.filter(x => x !== id) : [...A.hidden, id]; save(); return App.render(); }
      const dn = e.target.closest('[data-done]'); if (dn) return;
      const s = e.target.closest('[data-ses]'); if (s) return openSession(s.dataset.ses);
      const nw = e.target.closest('[data-new]'); if (nw) return openNewSession(nw.dataset.new || (mes === today.slice(0, 7) ? today : `${mes}-01`));
    };
    main.ondblclick = e => { const d = e.target.closest('[data-day]'); if (d && App.canEdit() && !e.target.closest('[data-ses]')) openNewSession(d.dataset.day); };
    main.onchange = e => {
      const dn = e.target.closest('[data-done]'); if (!dn) return;
      const s = App.byId('sessions', dn.dataset.done); const comp = JSON.parse(JSON.stringify(s.compromisos || []));
      comp[+dn.dataset.i].hecho = true;
      App.patch('sessions', s.id, { compromisos: comp }).then(() => App.render()).catch(() => {});
    };
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
      <div class="sep"></div><button class="mi danger" data-p="del">🗑 Eliminar comité</button>`, { width: 300, onClose: () => {
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
      <h4>Compromisos</h4><div id="sComp">${compHTML()}</div>${ro ? '' : '<button class="btn sm" data-cadd="1" style="margin-top:4px">+ Compromiso</button>'}
      <datalist id="pplList">${App.S.people.map(u => `<option value="${esc(u.name)}">`).join('')}</datalist>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:22px"><a class="btn" href="/api/sesiones/${s.id}/ics" download>⇩ Agregar a Outlook (.ics)</a>${ro ? '' : '<button class="btn" data-rep="1">↻ Repetir…</button><span style="flex:1"></span><button class="btn danger" data-sdel="1">Eliminar sesión</button>'}</div>
      <div class="meta-line">${s.updated_by_name ? `Última edición: ${esc(s.updated_by_name)}, ${esc(App.d.ago(s.updated_at))}` : ''}</div>`, { onClose: () => App.render() });

    const saveComp = () => App.patch('sessions', id, { compromisos: comp }).catch(() => {});
    d.onchange = e => {
      const t = e.target;
      if (t.dataset.s) {
        const f = t.dataset.s; let v = t.value;
        if (f === 'fecha' && !v) { t.value = s.fecha; return; }
        if (f === 'comite_id') v = v || null;
        App.patch('sessions', id, { [f]: v }).then(() => { if (['comite_id', 'estado', 'fecha', 'titulo', 'hora_ini', 'hora_fin'].includes(f)) { if (f === 'fecha') mes = v.slice(0, 7); openSession(id); } }).catch(() => {});
      } else if (t.dataset.ci != null) {
        const k = comp[+t.dataset.ci]; k[t.dataset.ck] = t.type === 'checkbox' ? t.checked : t.value;
        if (t.type === 'checkbox') $('#sComp', d).innerHTML = compHTML();
        saveComp();
      }
    };
    d.onclick = e => {
      if (e.target.closest('[data-close]')) return App.closeDrawer();
      const gp = e.target.closest('[data-goproj]'); if (gp) { App.closeDrawer(); return App.go('#/proyectos/' + gp.dataset.goproj); }
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
