/* ============================================================
   CRONOGRAMA · Gantt del portafolio y de cada proyecto
   - Filas por proyecto (con barra resumen) y sus actividades.
   - Barras: arrastrar para mover, bordes para cambiar inicio o fin.
   - Hitos (rombo) y sesiones de comité (rombos de color arriba).
   ============================================================ */
'use strict';
(function () {
  const { $, $$, esc } = App;
  const G = Object.assign({ zoom: 'semanas', collapsed: {}, comites: true, estado: '' }, App.store.get('gantt', {}));
  const save = () => App.store.set('gantt', G);
  const PPD = { dias: 26, semanas: 9, meses: 3.2 };
  const scrollMem = {};

  function rangeOf(groups, sessions) {
    const ds = [App.d.today()];
    groups.forEach(g => g.acts.forEach(a => { if (a.inicio) ds.push(a.inicio); if (a.fin) ds.push(a.fin); }));
    sessions.forEach(s => ds.push(s.fecha));
    ds.sort();
    let start = App.d.add(ds[0], -10), end = App.d.add(ds[ds.length - 1], 35);
    // alinear: semanas → lunes, meses → día 1
    if (G.zoom === 'meses') start = start.slice(0, 8) + '01'; else start = App.d.add(start, -App.d.dow(start));
    if (App.d.diff(start, end) < 120) end = App.d.add(start, 120);
    return { start, end, days: App.d.diff(start, end) + 1 };
  }

  function header(start, days, ppd) {
    const top = [], bot = [];
    const x = iso => App.d.diff(start, iso) * ppd;
    // fila superior: meses (o años en zoom «meses»)
    let d = start;
    while (App.d.diff(d, App.d.add(start, days)) > 0) {
      const y = +d.slice(0, 4), m = +d.slice(5, 7);
      const next = G.zoom === 'meses' ? `${y + 1}-01-01` : (m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`);
      const w = Math.min(x(next), days * ppd) - x(d);
      const lbl = G.zoom === 'meses' ? String(y) : (w > 90 ? `${App.d.MESES[m - 1]} ${y}` : App.d.MES3[m - 1]);
      top.push(`<div class="g-hm" style="left:${x(d)}px;width:${w}px">${esc(lbl)}</div>`);
      d = next;
    }
    // fila inferior: días, lunes o meses
    if (G.zoom === 'dias') for (let i = 0; i < days; i++) { const iso = App.d.add(start, i); bot.push(`<div class="g-hd" style="left:${i * ppd}px;width:${ppd}px;${App.d.dow(iso) > 4 ? 'background:rgba(127,120,100,.08)' : ''}">${+iso.slice(8)}</div>`); }
    else if (G.zoom === 'semanas') for (let i = 0; i < days; i += 7) { const iso = App.d.add(start, i); bot.push(`<div class="g-hd" style="left:${i * ppd}px;width:${7 * ppd}px">${+iso.slice(8)}</div>`); }
    else { let m = start; while (App.d.diff(m, App.d.add(start, days)) > 0) { const y = +m.slice(0, 4), mm = +m.slice(5, 7); const nx = mm === 12 ? `${y + 1}-01-01` : `${y}-${String(mm + 1).padStart(2, '0')}-01`; bot.push(`<div class="g-hd" style="left:${x(m)}px;width:${x(nx) - x(m)}px">${App.d.MES3[mm - 1]}</div>`); m = nx; } }
    return top.join('') + bot.join('');
  }

  /* opts: { projectIds:[...], single:bool, key:'...' } */
  function render(el, opts) {
    const single = !!opts.single, ro = !App.canEdit(), key = opts.key || 'gantt';
    const groups = opts.projectIds.map(pid => ({ p: App.byId('projects', pid), acts: App.actsOf(pid) })).filter(g => g.p);
    const sessions = G.comites ? App.S.sessions.filter(s => s.fecha && (!single || (s.proyectos || []).includes(opts.projectIds[0]))) : [];
    const { start, days } = rangeOf(groups, sessions);
    const ppd = PPD[G.zoom], W = days * ppd, today = App.d.today();
    const x = iso => App.d.diff(start, iso) * ppd;
    const firstMon = (7 - App.d.dow(start)) % 7;
    const grid = G.zoom === 'meses' ? '' : `background-image:repeating-linear-gradient(to right, var(--line) 0 1px, transparent 1px ${7 * ppd}px);background-position-x:${firstMon * ppd}px`;

    const leftHead = `<div class="g-c nm">${single ? 'Actividad' : 'Proyecto / actividad'}</div><div class="g-c rs">Responsable</div><div class="g-c dt">Inicio</div><div class="g-c dt">Fin</div><div class="g-c pc">Avance</div><div class="g-c mn"></div>`;
    const rows = [];
    rows.push(`<div class="g-row g-head"><div class="g-left">${leftHead}</div><div class="g-right" style="width:${W}px">${header(start, days, ppd)}</div></div>`);
    if (sessions.length) {
      const dias = sessions.map(s => { const c = App.byId('committees', s.comite_id); const col = c ? c.color : 'gris';
        return `<div class="g-dia cm" data-g="ses" data-id="${s.id}" style="left:${x(s.fecha) + ppd / 2}px;background:var(--c-${col}-i);${s.estado === 'Cancelada' ? 'opacity:.35' : ''}" data-tip="${esc((c ? c.name : 'Comité') + ' · ' + App.d.fmt(s.fecha) + (s.hora_ini ? ' ' + s.hora_ini : ''))}"></div>`; }).join('');
      rows.push(`<div class="g-row"><div class="g-left"><div class="g-c nm" style="color:var(--muted)">◆ Comités</div><div class="g-c rs"></div><div class="g-c dt"></div><div class="g-c dt"></div><div class="g-c pc"></div><div class="g-c mn"></div></div><div class="g-right" style="width:${W}px;${grid}">${dias}</div></div>`);
    }
    if (!groups.length) rows.push(`<div class="g-row"><div class="g-left"><div class="g-c nm faint">No hay proyectos para mostrar</div></div><div class="g-right" style="width:${W}px"></div></div>`);
    groups.forEach(g => {
      const pid = g.p.id, closed = !single && G.collapsed[pid], pl = App.planOf(pid);
      if (!single) {
        const sum = pl.ini ? `<div class="g-sum" style="left:${x(pl.ini)}px;width:${Math.max(ppd, (App.d.diff(pl.ini, pl.fin) + 1) * ppd)}px"><div class="pf" style="width:${pl.avance}%"></div></div>` : '';
        rows.push(`<div class="g-row g-grp"><div class="g-left"><div class="g-c nm" data-g="toggle" data-pid="${pid}"><span class="ar">${closed ? '▶' : '▼'}</span><i style="width:8px;height:8px;border-radius:50%;flex-shrink:0;background:var(--c-${App.projectColor(g.p)}-i)"></i><a href="#/proyectos/${pid}/cronograma" title="Abrir proyecto">${esc(App.projectName(g.p))}</a></div><div class="g-c rs">${g.acts.length} act.</div><div class="g-c dt">${esc(App.d.fmtShort(pl.ini))}</div><div class="g-c dt">${esc(App.d.fmtShort(pl.fin))}</div><div class="g-c pc">${g.acts.length ? pl.avance + '%' : ''}</div><div class="g-c mn"></div></div><div class="g-right" style="width:${W}px;${grid}">${sum}</div></div>`);
      }
      if (closed) return;
      g.acts.forEach(a => {
        const e = ro ? '' : 'ed';
        const late = a.fin && a.fin < today && (a.avance || 0) < 100;
        let right = '';
        if (a.hito && (a.fin || a.inicio)) { const d = a.fin || a.inicio; right = `<div class="g-dia" data-g="bar" data-id="${a.id}" style="left:${x(d) + ppd / 2}px;${(a.avance || 0) >= 100 ? 'background:var(--good)' : late ? 'background:var(--crit)' : ''}" data-tip="${esc(a.name + ' · ' + App.d.fmt(d))}"></div><span class="g-empty-hint" style="left:${x(d) + ppd / 2 + 12}px">${esc(a.name || '')}</span>`; }
        else if (a.inicio) { const fin = a.fin || a.inicio; right = `<div class="g-bar ${(a.avance || 0) >= 100 ? 'done' : ''} ${late ? 'late' : ''}" data-g="bar" data-id="${a.id}" style="left:${x(a.inicio)}px;width:${Math.max(ppd, (App.d.diff(a.inicio, fin) + 1) * ppd)}px" data-tip="${esc(a.name + ' · ' + App.d.fmt(a.inicio) + ' → ' + App.d.fmt(fin) + ' · ' + (a.avance || 0) + '%')}"><div class="pf" style="width:${a.avance || 0}%"></div><span class="hd l"></span><span class="hd r"></span><span class="lb">${esc(a.name || '')}</span></div>`; }
        else right = ro ? '' : `<span class="g-empty-hint" style="left:8px">Sin fechas · haz clic en la línea de tiempo para ubicarla</span>`;
        rows.push(`<div class="g-row" data-aid="${a.id}"><div class="g-left"><div class="g-c nm ${e}" data-g="edit" data-f="name" data-id="${a.id}" style="${single ? '' : 'padding-left:30px'}">${a.hito ? '<span class="hito">◆</span>' : ''}<span class="nmt">${esc(a.name || 'Sin nombre')}</span></div><div class="g-c rs ${e}" data-g="edit" data-f="responsable" data-id="${a.id}">${esc(a.responsable || '')}</div><div class="g-c dt ${e}" data-g="edit" data-f="inicio" data-id="${a.id}">${esc(App.d.fmtShort(a.inicio))}</div><div class="g-c dt ${e}" data-g="edit" data-f="fin" data-id="${a.id}" style="${late ? 'color:var(--crit);font-weight:700' : ''}">${esc(App.d.fmtShort(a.fin))}</div><div class="g-c pc ${e}" data-g="edit" data-f="avance" data-id="${a.id}">${a.avance || 0}%</div><div class="g-c mn">${ro ? '' : `<button data-g="menu" data-id="${a.id}" title="Opciones">···</button>`}</div></div><div class="g-right" data-g="track" data-id="${a.id}" style="width:${W}px;${grid}">${right}</div></div>`);
      });
      if (!ro) rows.push(`<div class="g-row g-add"><div class="g-left"><div class="g-c nm" style="${single ? '' : 'padding-left:24px'};gap:10px"><button data-g="add" data-pid="${pid}">+ Actividad</button><button data-g="add" data-pid="${pid}" data-hito="1">+ Hito</button></div><div class="g-c rs"></div><div class="g-c dt"></div><div class="g-c dt"></div><div class="g-c pc"></div><div class="g-c mn"></div></div><div class="g-right" style="width:${W}px"></div></div>`);
      if (single && !g.acts.length && ro) rows.push(`<div class="g-row"><div class="g-left"><div class="g-c nm faint">Este proyecto aún no tiene cronograma</div></div><div class="g-right" style="width:${W}px"></div></div>`);
    });

    const tools = `<div class="g-tools no-print"><div class="seg">${['dias', 'semanas', 'meses'].map(z => `<button data-g="zoom" data-z="${z}" class="${G.zoom === z ? 'on' : ''}">${{ dias: 'Días', semanas: 'Semanas', meses: 'Meses' }[z]}</button>`).join('')}</div>
      <button class="tb ${G.comites ? 'on' : ''}" data-g="comites">◆ Comités</button>
      <button class="tb" data-g="hoy">◎ Hoy</button>
      ${single ? '' : `<button class="tb" data-g="expand">▼ Expandir</button><button class="tb" data-g="collapse">▶ Contraer</button>`}
      <span class="sp"></span><span class="faint" style="font-size:11.5px">${ro ? 'Solo lectura' : 'Arrastra las barras para moverlas · bordes para cambiar fechas'}</span></div>`;
    el.innerHTML = `${tools}<div class="g-scroll ${ro ? 'ro' : ''}"><div class="g-in">${rows.join('')}<div class="g-today"></div></div></div>`;

    const sc = $('.g-scroll', el), leftW = $('.g-head .g-left', el).offsetWidth;
    $('.g-today', el).style.left = (leftW + x(today) + ppd / 2) + 'px';
    if (scrollMem[key + G.zoom] != null) sc.scrollLeft = scrollMem[key + G.zoom];
    else sc.scrollLeft = Math.max(0, x(today) - 14 * ppd);
    sc.onscroll = () => { scrollMem[key + G.zoom] = sc.scrollLeft; };
    const ctx = { start, ppd, rerender: () => render(el, opts), key };
    el.onclick = e => onClick(e, ctx, el);
    el.onmousedown = e => onDown(e, ctx);
    el.onmousemove = onTip;
    el.onmouseleave = hideTip;
  }

  /* ---------- tooltip ---------- */
  let tip = null;
  function onTip(e) {
    if (dragging) return; // mientras se arrastra, el tooltip lo maneja el arrastre
    const t = e.target.closest('[data-tip]');
    if (!t) return hideTip();
    if (!tip) { tip = document.createElement('div'); tip.className = 'g-tip'; document.body.appendChild(tip); }
    tip.textContent = t.dataset.tip; tip.style.left = (e.clientX + 12) + 'px'; tip.style.top = (e.clientY + 14) + 'px';
  }
  function hideTip() { if (tip) { tip.remove(); tip = null; } }

  /* ---------- clics ---------- */
  function onClick(e, ctx, el) {
    if (justDragged) { justDragged = false; return; }
    const t = e.target.closest('[data-g]'); if (!t) return;
    const g = t.dataset.g;
    if (g === 'zoom') { scrollMem[ctx.key + t.dataset.z] = undefined; G.zoom = t.dataset.z; save(); return ctx.rerender(); }
    if (g === 'comites') { G.comites = !G.comites; save(); return ctx.rerender(); }
    if (g === 'hoy') { const sc = $('.g-scroll', el); sc.scrollLeft = Math.max(0, App.d.diff(ctx.start, App.d.today()) * ctx.ppd - 14 * ctx.ppd); return; }
    if (g === 'expand' || g === 'collapse') { App.S.projects.forEach(p => { G.collapsed[p.id] = g === 'collapse'; }); save(); return ctx.rerender(); }
    if (g === 'toggle') { if (e.target.closest('a')) return; G.collapsed[t.dataset.pid] = !G.collapsed[t.dataset.pid]; save(); return ctx.rerender(); }
    if (g === 'ses') return App.Agenda.openSession(t.dataset.id);
    if (!App.canEdit()) return;
    if (g === 'add') return addAct(t.dataset.pid, !!t.dataset.hito, ctx, el);
    if (g === 'menu') return actMenu(t, t.dataset.id, ctx);
    if (g === 'edit') return editField(t, t.dataset.id, t.dataset.f, ctx);
    if (g === 'track') { // ubicar una actividad sin fechas donde se hizo clic
      const a = App.byId('activities', t.dataset.id); if (!a || a.inicio || a.fin) return;
      const r = t.getBoundingClientRect(); const d = App.d.add(ctx.start, Math.floor((e.clientX - r.left) / ctx.ppd));
      App.patch('activities', a.id, a.hito ? { inicio: d, fin: d } : { inicio: d, fin: App.d.add(d, 6) }).catch(() => {}); ctx.rerender();
    }
  }
  function editField(anchor, id, f, ctx) {
    const a = App.byId('activities', id); if (!a) return;
    const done = patch => { App.patch('activities', id, patch).catch(() => {}); App.render(); };
    if (f === 'name') return App.editText(anchor, a.name, { placeholder: 'Nombre de la actividad', onSave: v => v !== a.name && done({ name: v }) });
    if (f === 'responsable') {
      const names = [...new Set([...App.S.people.map(u => u.name), ...App.S.activities.map(x => x.responsable).filter(Boolean)])].sort();
      App.editText(anchor, a.responsable, { placeholder: 'Responsable', onSave: v => v !== (a.responsable || '') && done({ responsable: v }) });
      const ta = $('#pop textarea'); if (ta && names.length) { const dl = document.createElement('div'); dl.className = 'hint'; dl.textContent = 'Personas: ' + names.slice(0, 8).join(' · '); ta.after(dl); }
      return;
    }
    if (f === 'avance') return App.editNumber(anchor, a.avance || 0, v => done({ avance: Math.max(0, Math.min(100, Math.round(v || 0))) }), { min: 0, max: 100 });
    if (f === 'inicio') return App.editDate(anchor, a.inicio, v => {
      if (v === a.inicio) return;
      if (!v) return done({ inicio: null });
      // mover el inicio conserva la duración (el fin se corre igual)
      const fin = a.fin && a.inicio ? App.d.add(a.fin, App.d.diff(a.inicio, v)) : (a.fin && a.fin >= v ? a.fin : v);
      done({ inicio: v, fin });
    });
    if (f === 'fin') return App.editDate(anchor, a.fin, v => {
      if (v === a.fin) return;
      if (!v) return done({ fin: null });
      done(a.inicio && v < a.inicio ? { inicio: v, fin: v } : { fin: v, inicio: a.inicio || v });
    });
  }
  function actMenu(anchor, id, ctx) {
    const a = App.byId('activities', id); if (!a) return;
    App.menu(anchor, [
      { id: 'hito', label: a.hito ? '▬ Convertir en actividad' : '◆ Convertir en hito' },
      { id: 'done', label: (a.avance || 0) >= 100 ? '↺ Marcar como pendiente' : '✓ Marcar como terminada' },
      { id: 'up', label: '↑ Subir' }, { id: 'down', label: '↓ Bajar' },
      '-', { id: 'del', label: '🗑 Eliminar', danger: true }], async m => {
      if (m === 'hito') { const d = a.fin || a.inicio; await App.patch('activities', id, a.hito ? { hito: false } : { hito: true, inicio: d, fin: d }).catch(() => {}); }
      if (m === 'done') await App.patch('activities', id, { avance: (a.avance || 0) >= 100 ? 0 : 100 }).catch(() => {});
      if (m === 'up' || m === 'down') {
        const list = App.actsOf(a.project_id); const i = list.findIndex(x => x.id === id), j = m === 'up' ? i - 1 : i + 1;
        if (j < 0 || j >= list.length) return;
        [list[i], list[j]] = [list[j], list[i]];
        list.forEach((x, k) => { if (x.position !== k) App.patch('activities', x.id, { position: k }).catch(() => {}); });
      }
      if (m === 'del') { if (!confirm(`¿Eliminar «${a.name || 'actividad'}»?`)) return; await App.guard(() => App.remove('activities', id)); }
      App.render();
    });
  }
  async function addAct(pid, hito, ctx, el) {
    const t = App.d.today(), acts = App.actsOf(pid);
    const last = acts.map(a => a.fin).filter(Boolean).sort().pop();
    const ini = last && last >= t ? App.d.add(last, 1) : t;
    await App.guard(async () => {
      const a = await App.create('activities', hito ? { project_id: pid, name: 'Nuevo hito', hito: true, inicio: App.d.add(ini, 7), fin: App.d.add(ini, 7) } : { project_id: pid, name: 'Nueva actividad', inicio: ini, fin: App.d.add(ini, 6) });
      if (G.collapsed[pid]) { G.collapsed[pid] = false; save(); }
      App.render();
      const cell = $(`[data-g=edit][data-f=name][data-id="${a.id}"]`); if (cell) { cell.scrollIntoView({ block: 'nearest' }); editField(cell, a.id, 'name', ctx); }
    });
  }

  /* ---------- arrastrar barras ---------- */
  let dragging = false, justDragged = false;
  function onDown(e, ctx) {
    if (!App.canEdit() || e.button !== 0) return;
    const bar = e.target.closest('[data-g=bar]'); if (!bar) return;
    const a = App.byId('activities', bar.dataset.id); if (!a || !a.inicio && !a.fin) return;
    e.preventDefault(); hideTip();
    const mode = e.target.classList.contains('hd') ? (e.target.classList.contains('l') ? 'l' : 'r') : 'move';
    const ini0 = a.inicio || a.fin, fin0 = a.fin || a.inicio, x0 = e.clientX, left0 = bar.offsetLeft, w0 = bar.offsetWidth;
    let ni = ini0, nf = fin0, moved = false;
    const isDia = bar.classList.contains('g-dia');
    if (!tip) { tip = document.createElement('div'); tip.className = 'g-tip'; document.body.appendChild(tip); }
    const mv = ev => {
      const dd = Math.round((ev.clientX - x0) / ctx.ppd); if (dd !== 0) moved = true;
      dragging = true;
      if (mode === 'move' || isDia) { ni = App.d.add(ini0, dd); nf = App.d.add(fin0, dd); bar.style.left = (left0 + dd * ctx.ppd) + 'px'; }
      else if (mode === 'l') { ni = App.d.add(ini0, dd); if (ni > fin0) ni = fin0; bar.style.left = (left0 + App.d.diff(ini0, ni) * ctx.ppd) + 'px'; bar.style.width = (w0 - App.d.diff(ini0, ni) * ctx.ppd) + 'px'; }
      else { nf = App.d.add(fin0, dd); if (nf < ini0) nf = ini0; bar.style.width = (w0 + App.d.diff(fin0, nf) * ctx.ppd) + 'px'; }
      if (!tip) { tip = document.createElement('div'); tip.className = 'g-tip'; document.body.appendChild(tip); }
      tip.textContent = isDia ? App.d.fmt(nf) : `${App.d.fmt(ni)} → ${App.d.fmt(nf)} · ${App.d.diff(ni, nf) + 1} días`;
      tip.style.left = (ev.clientX + 12) + 'px'; tip.style.top = (ev.clientY + 14) + 'px';
    };
    const up = () => {
      document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up);
      dragging = false; hideTip();
      if (!moved) return;
      justDragged = true; setTimeout(() => { justDragged = false; }, 50);
      App.patch('activities', a.id, { inicio: ni, fin: nf }).catch(() => {});
      App.render();
    };
    document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up);
  }

  /* ---------- sección «Cronograma» (todo el portafolio) ---------- */
  function section(main) {
    const ec = App.estadoCol();
    const pids = App.projectsSorted().filter(p => !G.estado || !ec || (p.props || {})[ec.id] === G.estado).map(p => p.id);
    const acts = App.S.activities.filter(a => pids.includes(a.project_id));
    const late = acts.filter(a => a.fin && a.fin < App.d.today() && (a.avance || 0) < 100).length;
    const prox = acts.filter(a => a.fin && a.fin >= App.d.today() && a.fin <= App.d.add(App.d.today(), 14) && (a.avance || 0) < 100).length;
    main.innerHTML = `<div class="page-h"><button class="burger" data-act="burger">☰</button><div><h1>Cronograma</h1><div class="sub">${pids.length} proyectos · ${acts.length} actividades${late ? ` · <b style="color:var(--crit)">${late} atrasadas</b>` : ''}${prox ? ` · ${prox} vencen en 2 semanas` : ''}</div></div><span class="sp"></span>
      ${ec ? `<select class="fld" id="gEstado" style="width:auto"><option value="">Todos los estados</option>${(ec.options || []).map(o => `<option ${G.estado === o.name ? 'selected' : ''}>${esc(o.name)}</option>`).join('')}</select>` : ''}</div>
      <div id="gBox"></div>`;
    const sel = $('#gEstado', main); if (sel) sel.onchange = () => { G.estado = sel.value; save(); App.render(); };
    $('.burger', main).onclick = App.toggleSide;
    render($('#gBox', main), { projectIds: pids, single: false, key: 'portafolio' });
  }

  App.Gantt = { render };
  App.views.cronograma = { render: section };
})();
