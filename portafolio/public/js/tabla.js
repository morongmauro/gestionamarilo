/* ============================================================
   PROYECTOS · tabla tipo Notion (y tablero por estado)
   Columnas con tipo, definidas por el equipo. Cada celda se edita
   con un clic. Columnas calculadas al final: cronograma, avance y
   caso de negocio (salen de las otras secciones).
   ============================================================ */
'use strict';
(function () {
  const { $, $$, esc } = App;
  const TYPES = {
    title: { label: 'Título', icon: 'Aa' }, text: { label: 'Texto', icon: '≡' },
    select: { label: 'Selección', icon: '◉' }, multi: { label: 'Selección múltiple', icon: '☰' },
    people: { label: 'Personas', icon: '◎' }, number: { label: 'Número', icon: '#' },
    date: { label: 'Fecha', icon: '▣' }, check: { label: 'Casilla', icon: '☑' }, url: { label: 'Enlace', icon: '⇗' },
  };
  const P = Object.assign({ view: 'tabla', sort: null, filters: [], group: '', collapsed: {}, boardCol: '', calc: true }, App.store.get('tabla', {}));
  const savePrefs = () => App.store.set('tabla', P);
  let q = '';
  let root = null; // contenedor de la sección

  const col = id => App.S.columns.find(c => c.id === id);
  const visibleCols = () => App.S.columns.filter(c => !c.hidden);
  const rowTitle = r => ((r.props || {})[App.titleCol().id] || '').trim();
  const fmtNum = n => App.num(n, 2);

  /* ---------- filtro, búsqueda, orden, agrupación ---------- */
  function textOf(c, v) {
    if (v == null || v === '') return '';
    if (Array.isArray(v)) return v.join(', ');
    if (c.type === 'check') return v ? 'sí' : 'no';
    if (c.type === 'date') return App.d.fmt(v);
    return String(v);
  }
  function matchFilter(r, f) {
    const c = col(f.col); if (!c) return true;
    const v = (r.props || {})[c.id];
    switch (c.type) {
      case 'select': return f.op === 'no' ? v !== f.val : v === f.val;
      case 'multi': case 'people': { const a = Array.isArray(v) ? v : []; return f.op === 'no' ? !a.includes(f.val) : a.includes(f.val); }
      case 'number': { if (v == null || v === '') return false; const n = Number(v), x = Number(f.val); return f.op === '>' ? n > x : f.op === '<' ? n < x : n === x; }
      case 'date': if (!v) return false; return f.op === '<=' ? v <= f.val : v >= f.val;
      case 'check': return !!v === (f.val === 'si');
      default: return String(v || '').toLowerCase().includes(String(f.val || '').toLowerCase());
    }
  }
  function rowsVisibles() {
    const qq = q.trim().toLowerCase();
    let rows = App.S.projects.filter(r => P.filters.every(f => matchFilter(r, f)));
    if (qq) rows = rows.filter(r => App.S.columns.some(c => textOf(c, (r.props || {})[c.id]).toLowerCase().includes(qq)));
    if (P.sort && col(P.sort.col)) {
      const c = col(P.sort.col), dir = P.sort.dir === 'desc' ? -1 : 1;
      const key = r => { const v = (r.props || {})[c.id];
        if (c.type === 'number') return v == null || v === '' ? null : Number(v);
        if (c.type === 'select') return v ? (c.options || []).findIndex(o => o.name === v) : null;
        if (c.type === 'check') return v ? 1 : 0;
        const t = textOf(c, v); return t ? t.toLowerCase() : null; };
      rows = rows.slice().sort((a, b) => { const x = key(a), y = key(b);
        if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1;
        return (x < y ? -1 : x > y ? 1 : 0) * dir; });
    } else rows = rows.slice().sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    return rows;
  }
  function groupRows(rows, colId) {
    const c = col(colId); if (!c) return [{ key: null, rows }];
    const map = new Map();
    const keysOf = r => { const v = (r.props || {})[c.id];
      if (c.type === 'multi' || c.type === 'people') return Array.isArray(v) && v.length ? v : [''];
      if (c.type === 'check') return [v ? 'Marcado' : 'Sin marcar'];
      return [textOf(c, v)]; };
    rows.forEach(r => keysOf(r).forEach(k => { if (!map.has(k)) map.set(k, []); map.get(k).push(r); }));
    const keys = Array.from(map.keys());
    if (c.options && c.options.length) { const order = c.options.map(o => o.name); keys.sort((a, b) => (order.indexOf(a) + 1 || 999) - (order.indexOf(b) + 1 || 999)); }
    else keys.sort((a, b) => (a === '') - (b === '') || a.localeCompare(b));
    return keys.map(k => ({ key: k, rows: map.get(k) }));
  }

  /* ---------- pintar celdas ---------- */
  function renderPills(c, arr) {
    if (!arr || !arr.length) return '';
    const ppl = c.type === 'people';
    return '<div class="pills">' + arr.map(n => `<span class="pill ${ppl ? 'ppl' : ''} cl-${App.optColor(c, n)}">${ppl ? `<span class="av">${esc(App.initials(n))}</span>` : ''}${esc(n)}</span>`).join('') + '</div>';
  }
  function renderValue(c, v) {
    switch (c.type) {
      case 'title': return `<div class="c-in ttl ${v ? '' : 'empty'}">${esc(v || 'Sin título')}</div>`;
      case 'text': return `<div class="c-in txt ${v ? '' : 'empty'}">${esc(v || '·')}</div>`;
      case 'select': return `<div class="c-in">${v ? `<span class="pill cl-${App.optColor(c, v)}">${esc(v)}</span>` : ''}</div>`;
      case 'multi': case 'people': return `<div class="c-in">${renderPills(c, v)}</div>`;
      case 'number': return `<div class="c-in n">${esc(fmtNum(v))}</div>`;
      case 'date': return `<div class="c-in">${esc(App.d.fmt(v))}</div>`;
      case 'check': return `<div class="c-in"><span class="chk ${v ? 'on' : ''}"></span></div>`;
      case 'url': return `<div class="c-in">${v ? `<a href="${esc(/^https?:/i.test(v) ? v : 'https://' + v)}" target="_blank" rel="noopener" data-stop="1">${esc(v)}</a>` : ''}</div>`;
    }
    return `<div class="c-in">${esc(textOf(c, v))}</div>`;
  }
  function cellHTML(c, r) {
    return renderValue(c, (r.props || {})[c.id]) + (c.type === 'title' ? `<button class="open" data-act="open" data-id="${r.id}" title="Abrir proyecto">⤢ Abrir</button>` : '');
  }
  // Columnas calculadas (solo lectura)
  const CALC = [
    { id: '_plan', name: 'Cronograma', icon: '▬', width: 170 },
    { id: '_avance', name: 'Avance', icon: '%', width: 120 },
    { id: '_caso', name: 'Caso de negocio', icon: '$', width: 190 },
    { id: '_ice', name: 'ICE', icon: '★', width: 90 },
  ];
  function calcHTML(k, r) {
    if (k === '_ice') { const v = App.iceOf(r); return `<div class="c-in n">${v == null ? '<span class="faint" title="Llena Impacto, Confianza y Facilidad (1 a 10)">—</span>' : `<b>${v}</b>`}</div>`; }
    if (k === '_plan') { const pl = App.planOf(r.id); return `<div class="c-in">${pl.ini ? `${esc(App.d.fmtShort(pl.ini))} – ${esc(App.d.fmt(pl.fin))}` : '<span class="faint">Sin cronograma</span>'}${pl.atrasadas ? ` <span class="pill cl-rojo">${pl.atrasadas} atrasada${pl.atrasadas > 1 ? 's' : ''}</span>` : ''}</div>`; }
    if (k === '_avance') { const pl = App.planOf(r.id); return pl.acts.length ? `<div class="c-in"><span class="bar-mini"><i style="width:${pl.avance}%"></i></span>${pl.avance}%</div>` : '<div class="c-in"></div>'; }
    if (k === '_caso') { const c = App.caseOf(r.id); if (!c) return '<div class="c-in"><span class="faint">Sin caso</span></div>';
      const f = Finanzas.calc(c); return `<div class="c-in"><span class="pill cl-${App.Caso.estadoColor(c.estado)}">${esc(c.estado || 'Borrador')}</span> ${f.vpn != null ? `<span class="muted">VPN ${esc(App.moneyShort(f.vpn, c.moneda))}</span>` : ''}</div>`; }
    return '';
  }

  /* ---------- sección ---------- */
  function render(main) {
    root = main;
    const ro = !App.canEdit();
    main.innerHTML = `<div class="page-h"><button class="burger" data-act="burger">☰</button><div><h1>Proyectos</h1><div class="sub">${App.S.projects.length} ${App.S.projects.length === 1 ? 'proyecto' : 'proyectos'} en el portafolio</div></div><span class="sp"></span>
        <div class="seg"><button data-view="tabla" class="${P.view === 'tabla' ? 'on' : ''}">▤ Tabla</button><button data-view="tablero" class="${P.view === 'tablero' ? 'on' : ''}">▦ Tablero</button></div></div>
      <div class="toolbar">
        <label class="search"><span>⌕</span><input id="tq" placeholder="Buscar en todas las columnas…" value="${esc(q)}"></label>
        <button class="tb ${P.filters.length ? 'on' : ''}" data-act="filtro">⚲ Filtrar</button>
        <button class="tb ${P.sort ? 'on' : ''}" data-act="orden">↕ Ordenar</button>
        <button class="tb ${P.group ? 'on' : ''}" data-act="grupo">▤ Agrupar</button>
        <button class="tb ${App.S.columns.some(c => c.hidden) || !P.calc ? 'on' : ''}" data-act="cols">▥ Columnas</button>
        <span class="sp"></span>
        <button class="tb" data-act="csv" title="Descargar como CSV (se abre en Excel)">⇩ CSV</button>
        ${ro ? '' : '<button class="tb primary" data-act="new">+ Nuevo proyecto</button>'}
      </div>
      <div class="chips" id="tchips"></div>
      <div id="tview"></div>`;
    $('#tq', main).addEventListener('input', e => { q = e.target.value; paint(); });
    main.onclick = onClick;
    main.onmousedown = onResize;
    main.ondragstart = e => { const c = e.target.closest('.card'); if (!c) return; dragId = c.dataset.id; c.classList.add('drag'); };
    main.ondragend = e => { const c = e.target.closest('.card'); if (c) c.classList.remove('drag'); $$('.bcol.over', main).forEach(x => x.classList.remove('over')); };
    main.ondragover = e => { const l = e.target.closest('.bcol'); if (!l || !dragId) return; e.preventDefault(); $$('.bcol.over', main).forEach(x => x.classList.remove('over')); l.classList.add('over'); };
    main.ondrop = e => { const l = e.target.closest('.bcol'); if (!l || !dragId) return; e.preventDefault(); setValue(dragId, boardColumn().id, l.dataset.lane); dragId = null; };
    paint();
  }
  let dragId = null;
  function paint() {
    if (!root) return;
    $$('.seg button', root).forEach(b => b.classList.toggle('on', b.dataset.view === P.view));
    renderChips();
    if (P.view === 'tablero') renderTablero(); else renderTabla();
  }
  function renderChips() {
    const parts = [];
    if (P.sort && col(P.sort.col)) parts.push(`<span class="chip">↕ <b>${esc(col(P.sort.col).name)}</b> ${P.sort.dir === 'desc' ? 'descendente' : 'ascendente'} <button data-chip="sort" title="Quitar">×</button></span>`);
    P.filters.forEach((f, i) => { const c = col(f.col); if (!c) return;
      const opName = { es: 'es', no: 'no es', contiene: 'contiene', '=': '=', '>': '>', '<': '<', '>=': 'desde', '<=': 'hasta' }[f.op] || f.op;
      const val = c.type === 'check' ? (f.val === 'si' ? 'marcado' : 'sin marcar') : c.type === 'date' ? App.d.fmt(f.val) : f.val;
      parts.push(`<span class="chip">⚲ <b>${esc(c.name)}</b> ${esc(opName)} «${esc(val)}» <button data-chip="f${i}" title="Quitar">×</button></span>`); });
    if (P.group && col(P.group)) parts.push(`<span class="chip">▤ Agrupado por <b>${esc(col(P.group).name)}</b> <button data-chip="group" title="Quitar">×</button></span>`);
    $('#tchips', root).innerHTML = parts.join('');
  }
  function renderTabla() {
    const cols = visibleCols(), rows = rowsVisibles(), tc = App.titleCol(), calc = P.calc ? CALC : [];
    const groups = P.group && col(P.group) ? groupRows(rows, P.group) : [{ key: null, rows }];
    const total = cols.reduce((a, c) => a + (c.width || 180), 0) + calc.reduce((a, c) => a + c.width, 0) + 46 + 40;
    const colgroup = `<colgroup>${cols.map(c => `<col style="width:${c.width || 180}px">`).join('')}${calc.map(c => `<col style="width:${c.width}px">`).join('')}<col style="width:46px"><col style="width:40px"></colgroup>`;
    const thead = `<thead><tr>${cols.map(c => `<th data-col="${c.id}"><div class="th-in" data-act="colmenu" data-col="${c.id}"><span class="ic">${TYPES[c.type].icon}</span><span class="nm">${esc(c.name)}</span>${P.sort && P.sort.col === c.id ? `<span class="srt">${P.sort.dir === 'desc' ? '▼' : '▲'}</span>` : ''}<span class="rz" data-act="resize" data-col="${c.id}"></span></div></th>`).join('')}${calc.map(c => `<th title="Columna calculada: sale del ${c.id === '_caso' ? 'caso de negocio' : 'cronograma'}"><div class="th-in" style="cursor:default"><span class="ic">${c.icon}</span><span class="nm">${esc(c.name)}</span></div></th>`).join('')}<th class="addc">${App.canEdit() ? '<div class="th-in" data-act="addcol" title="Agregar columna">+</div>' : ''}</th><th></th></tr></thead>`;
    const trRow = r => `<tr data-id="${r.id}">${cols.map(c => `<td class="cell ${c.id === tc.id ? 'ttl-col' : ''}" data-act="edit" data-id="${r.id}" data-col="${c.id}">${cellHTML(c, r)}</td>`).join('')}${calc.map(c => `<td class="cell" data-act="calc" data-id="${r.id}" data-k="${c.id}">${calcHTML(c.id, r)}</td>`).join('')}<td></td><td class="menu-col">${App.canEdit() ? `<button data-act="rowmenu" data-id="${r.id}" title="Opciones">···</button>` : ''}</td></tr>`;
    const span = cols.length + calc.length + 2;
    const newBtn = (g) => App.canEdit() ? `<tr class="newrow"><td colspan="${span}"><button data-act="new" data-gkey="${g.key === null ? '' : esc(g.key)}" data-gcol="${P.group || ''}">+ Nuevo</button></td></tr>` : '';
    const bodies = groups.map(g => {
      const gc = P.group ? col(P.group) : null; const closed = g.key !== null && P.collapsed[g.key];
      const head = g.key === null ? '' : `<tr class="grp"><td colspan="${span}" data-act="toggle" data-key="${esc(g.key)}"><div class="g-in"><span class="ar">${closed ? '▶' : '▼'}</span>${g.key === '' ? `<span class="pill cl-gris">Sin ${esc(gc.name.toLowerCase())}</span>` : (gc.type === 'select' || gc.type === 'multi') ? `<span class="pill cl-${App.optColor(gc, g.key)}">${esc(g.key)}</span>` : gc.type === 'people' ? `<span class="pill ppl cl-${App.optColor(gc, g.key)}"><span class="av">${esc(App.initials(g.key))}</span>${esc(g.key)}</span>` : `<span>${esc(g.key)}</span>`}<span class="n">${g.rows.length}</span></div></td></tr>`;
      return `<tbody>${head}${closed ? '' : g.rows.map(trRow).join('') + newBtn(g)}</tbody>`;
    }).join('');
    const empty = !App.S.projects.length ? `<tbody><tr><td colspan="${span}"><div class="empty-state"><b>Aún no hay proyectos</b>${App.canEdit() ? 'Haz clic en «+ Nuevo proyecto». Cada celda se edita con un clic, como en Notion.' : 'Cuando el equipo cree proyectos, aparecerán aquí.'}</div></td></tr>${newBtn({ key: null })}</tbody>` : '';
    const tfoot = `<tfoot><tr><td colspan="${span}">${rows.length} ${rows.length === 1 ? 'proyecto' : 'proyectos'}${rows.length !== App.S.projects.length ? ` de ${App.S.projects.length}` : ''}</td></tr></tfoot>`;
    $('#tview', root).innerHTML = `<div class="tbl-wrap"><table class="tbl" style="width:${total}px">${colgroup}${thead}${empty || bodies}${tfoot}</table></div>`;
  }
  function boardColumn() { const c = col(P.boardCol); if (c && c.type === 'select') return c; return App.estadoCol() || null; }
  function renderTablero() {
    const bc = boardColumn();
    if (!bc) { $('#tview', root).innerHTML = `<div class="tbl-wrap"><div class="empty-state"><b>El tablero necesita una columna de selección</b>Agrega una columna de tipo «Selección» (por ejemplo, Estado).</div></div>`; return; }
    const rows = rowsVisibles(), tc = App.titleCol();
    const show = visibleCols().filter(c => c.id !== bc.id && c.id !== tc.id && ['select', 'multi', 'people', 'number', 'date'].includes(c.type)).slice(0, 4);
    const lanes = [{ name: '', color: 'gris' }, ...(bc.options || [])];
    $('#tview', root).innerHTML = '<div class="board">' + lanes.map(o => {
      const items = rows.filter(r => ((r.props || {})[bc.id] || '') === o.name);
      if (!o.name && !items.length) return '';
      return `<div class="bcol" data-lane="${esc(o.name)}"><div class="bh">${o.name ? `<span class="pill cl-${o.color}">${esc(o.name)}</span>` : `<span class="pill cl-gris">Sin ${esc(bc.name.toLowerCase())}</span>`}<span class="n">${items.length}</span>${App.canEdit() ? `<button data-act="new" data-gcol="${bc.id}" data-gkey="${esc(o.name)}" title="Nuevo aquí">+</button>` : ''}</div>` +
        items.map(r => { const pl = App.planOf(r.id);
          return `<div class="card" draggable="${App.canEdit()}" data-act="open" data-id="${r.id}"><div class="ct ${rowTitle(r) ? '' : 'empty'}">${esc(rowTitle(r) || 'Sin título')}</div>${show.map(c => { const v = (r.props || {})[c.id]; if (v == null || v === '' || (Array.isArray(v) && !v.length)) return '';
            if (c.type === 'select') return `<div class="pills"><span class="pill cl-${App.optColor(c, v)}">${esc(v)}</span></div>`;
            if (c.type === 'number') return `<div class="cn">${esc(c.name)}: <b>${esc(fmtNum(v))}</b></div>`;
            if (c.type === 'date') return `<div class="cn">${esc(c.name)}: ${esc(App.d.fmt(v))}</div>`;
            return renderPills(c, v); }).join('')}${pl.acts.length ? `<div class="cn"><span class="bar-mini"><i style="width:${pl.avance}%"></i></span>${pl.avance}% · ${esc(App.d.fmtShort(pl.ini))} – ${esc(App.d.fmtShort(pl.fin))}</div>` : ''}</div>`; }).join('') +
        (App.canEdit() ? `<div class="newrow"><button data-act="new" data-gcol="${bc.id}" data-gkey="${esc(o.name)}">+ Nuevo</button></div>` : '') + '</div>';
    }).join('') + '</div>';
  }

  /* ---------- edición ---------- */
  async function setValue(rowId, colId, value) {
    const r = App.byId('projects', rowId); if (!r) return;
    if (JSON.stringify((r.props || {})[colId]) === JSON.stringify(value)) return;
    const p = App.patch('projects', rowId, { props: { [colId]: value } });
    App.render(); // repinta la vista actual (tabla, tablero o página del proyecto)
    await p.catch(() => {});
  }
  function openEditor(anchor, rowId, colId) {
    if (!App.canEdit()) return;
    const c = col(colId), r = App.byId('projects', rowId); if (!c || !r) return;
    const v = (r.props || {})[colId];
    if (c.type === 'check') return setValue(rowId, colId, !v);
    if (c.type === 'title' || c.type === 'text' || c.type === 'url') return App.editText(anchor, v, { multi: c.type === 'text', log: c.log, placeholder: c.name, onSave: x => setValue(rowId, colId, x) });
    if (c.type === 'number') return App.editNumber(anchor, v, x => setValue(rowId, colId, x));
    if (c.type === 'date') return App.editDate(anchor, v, x => setValue(rowId, colId, x));
    openSelectEditor(anchor, rowId, c);
  }
  function openSelectEditor(anchor, rowId, c) {
    const r = App.byId('projects', rowId);
    const multi = c.type !== 'select';
    let sel = multi ? (Array.isArray(r.props[c.id]) ? r.props[c.id].slice() : []) : (r.props[c.id] ? [r.props[c.id]] : []);
    let qq = '', hl = 0, dirty = false;
    // En columnas de personas también salen los usuarios de la app
    const allOpts = () => {
      const opts = (c.options || []).slice();
      if (c.type === 'people') App.S.people.forEach(u => { if (!opts.some(o => o.name === u.name)) opts.push({ name: u.name, color: 'azul', user: true }); });
      return opts;
    };
    let p;
    const draw = () => {
      const opts = allOpts().filter(o => !qq || o.name.toLowerCase().includes(qq.toLowerCase()));
      const canCreate = qq.trim() && !allOpts().some(o => o.name.toLowerCase() === qq.trim().toLowerCase());
      const ppl = c.type === 'people';
      p.innerHTML = `<div class="selbox">${sel.map(n => `<span class="pill ${ppl ? 'ppl' : ''} cl-${App.optColor(c, n)}">${ppl ? `<span class="av">${esc(App.initials(n))}</span>` : ''}${esc(n)}<button data-rm="${esc(n)}" title="Quitar">×</button></span>`).join('')}<input placeholder="${sel.length ? '' : ppl ? 'Escribe un nombre…' : 'Busca o crea una opción…'}" value="${esc(qq)}"></div>
        <div class="lbl">${ppl ? 'Personas' : 'Opciones'}</div>
        ${opts.map((o, i) => `<div class="opt ${i === hl ? 'hl' : ''}" data-pick="${esc(o.name)}"><span class="ck">${sel.includes(o.name) ? '✓' : ''}</span><span class="pill ${ppl ? 'ppl' : ''} cl-${o.color}">${ppl ? `<span class="av">${esc(App.initials(o.name))}</span>` : ''}${esc(o.name)}</span>${o.user ? '<span class="faint" style="font-size:10.5px;margin-left:auto">usuario</span>' : `<button class="more" data-opt="${esc(o.name)}" title="Editar opción">···</button>`}</div>`).join('')}
        ${canCreate ? `<div class="opt ${hl === opts.length ? 'hl' : ''}" data-create="${esc(qq.trim())}"><span class="ck">+</span>Crear <span class="pill cl-gris">${esc(qq.trim())}</span></div>` : ''}
        ${!opts.length && !canCreate ? '<div class="hint">Escribe para crear una opción</div>' : ''}`;
      const inp = $('input', p); inp.focus(); inp.setSelectionRange(qq.length, qq.length);
      inp.oninput = () => { qq = inp.value; hl = 0; draw(); };
      inp.onkeydown = e => {
        const n = opts.length + (canCreate ? 1 : 0);
        if (e.key === 'ArrowDown') { hl = (hl + 1) % Math.max(n, 1); draw(); e.preventDefault(); }
        else if (e.key === 'ArrowUp') { hl = (hl - 1 + n) % Math.max(n, 1); draw(); e.preventDefault(); }
        else if (e.key === 'Enter') { e.preventDefault(); if (hl < opts.length) pick(opts[hl].name); else if (canCreate) create(qq.trim()); else if (!multi) App.closePop(false); }
        else if (e.key === 'Backspace' && !qq && sel.length) { sel.pop(); dirty = true; draw(); }
        else if (e.key === 'Tab') App.closePop(false);
      };
    };
    const ensureOpt = name => { c.options = c.options || []; if (!c.options.some(o => o.name === name)) { c.options.push({ name, color: c.type === 'people' ? 'azul' : App.COLORS[c.options.length % App.COLORS.length] }); App.saveColumns(); } };
    const pick = name => { dirty = true; if (c.type === 'people') ensureOpt(name);
      if (multi) { sel.includes(name) ? sel.splice(sel.indexOf(name), 1) : sel.push(name); qq = ''; draw(); } else { sel = [name]; App.closePop(false); } };
    const create = name => { ensureOpt(name); pick(name); };
    p = App.openPop(anchor, '<div></div>', { width: 300, nofocus: true, onClose: cancel => { if (cancel && !dirty) return; setValue(rowId, c.id, multi ? sel : (sel[0] || '')); } });
    p.onclick = e => {
      const rm = e.target.closest('[data-rm]'); if (rm) { sel = sel.filter(n => n !== rm.dataset.rm); dirty = true; draw(); return; }
      const more = e.target.closest('[data-opt]'); if (more) { e.stopPropagation(); openOptionMenu(p, c, more.dataset.opt, draw); return; }
      const cr = e.target.closest('[data-create]'); if (cr) { create(cr.dataset.create); return; }
      const pk = e.target.closest('[data-pick]'); if (pk) pick(pk.dataset.pick);
    };
    draw();
  }
  // Opción: renombrar, color, eliminar (dentro del selector)
  function openOptionMenu(p, c, name, redraw) {
    const o = (c.options || []).find(x => x.name === name); if (!o) return;
    const oldClick = p.onclick;
    p.onclick = null;
    p.innerHTML = `<div class="lbl">Opción</div><input type="text" value="${esc(o.name)}" style="margin:0 4px 4px;width:calc(100% - 8px)"><div class="colors">${App.COLORS.map(k => `<i class="cl-${k} ${o.color === k ? 'on' : ''}" data-color="${k}" title="${k}"></i>`).join('')}</div><div class="sep"></div><button class="mi" data-p="ok">Guardar</button><button class="mi danger" data-p="del">Eliminar opción</button><button class="mi" data-p="back">← Volver</button>`;
    const back = () => { p.onclick = oldClick; redraw(); };
    const inp = $('input', p); inp.focus();
    const rename = (from, to) => App.S.projects.forEach(r => { const v = (r.props || {})[c.id];
      if (Array.isArray(v) && v.includes(from)) App.patch('projects', r.id, { props: { [c.id]: to == null ? v.filter(n => n !== from) : v.map(n => (n === from ? to : n)) } });
      else if (v === from) App.patch('projects', r.id, { props: { [c.id]: to == null ? '' : to } }); });
    const save = () => { const nn = inp.value.trim() || o.name; if (nn !== o.name) { rename(o.name, nn); o.name = nn; } App.saveColumns(); back(); App.render(); };
    p.onclick = e => {
      const ci = e.target.closest('[data-color]'); if (ci) { o.color = ci.dataset.color; $$('.colors i', p).forEach(x => x.classList.toggle('on', x.dataset.color === o.color)); App.saveColumns(); return; }
      const b = e.target.closest('[data-p]'); if (!b) return;
      if (b.dataset.p === 'ok') save();
      if (b.dataset.p === 'back') back();
      if (b.dataset.p === 'del') { if (!confirm(`¿Eliminar la opción «${o.name}»? Se quita de todos los proyectos.`)) return; c.options = c.options.filter(x => x !== o); rename(o.name, null); App.saveColumns(); back(); App.render(); }
    };
    inp.onkeydown = e => { if (e.key === 'Enter') save(); };
  }

  /* ---------- menús ---------- */
  function openColMenu(anchor, colId) {
    if (!App.canEdit()) return openSortFor(anchor, colId);
    const c = col(colId); if (!c) return;
    const isTitle = c.type === 'title';
    const p = App.openPop(anchor, `<input type="text" value="${esc(c.name)}" style="margin:2px 4px 6px;width:calc(100% - 8px)">
      <div class="lbl">Tipo</div><select ${isTitle ? 'disabled' : ''} style="margin:0 4px 6px;width:calc(100% - 8px)">${Object.entries(TYPES).filter(([k]) => k !== 'title' || isTitle).map(([k, t]) => `<option value="${k}" ${k === c.type ? 'selected' : ''}>${t.icon}  ${t.label}</option>`).join('')}</select>
      ${c.type === 'text' ? `<label class="mi" style="cursor:pointer"><input type="checkbox" ${c.log ? 'checked' : ''} data-p="log" style="width:auto"> Bitácora con fecha («+ Entrada de hoy»)</label>` : ''}
      <div class="sep"></div>
      <button class="mi" data-p="asc">↑ Ordenar ascendente</button><button class="mi" data-p="desc">↓ Ordenar descendente</button>
      <button class="mi" data-p="filter">⚲ Filtrar por esta columna</button>
      ${['select', 'multi', 'people', 'check'].includes(c.type) ? '<button class="mi" data-p="group">▤ Agrupar por esta columna</button>' : ''}
      <div class="sep"></div>
      <button class="mi" data-p="left">← Mover a la izquierda</button><button class="mi" data-p="right">→ Mover a la derecha</button>
      ${isTitle ? '' : '<button class="mi" data-p="hide">◌ Ocultar columna</button><div class="sep"></div><button class="mi danger" data-p="del">🗑 Eliminar columna</button>'}`, { width: 280, nofocus: true });
    const inp = $('input[type=text]', p), sel = $('select', p);
    const saveName = () => { const nn = inp.value.trim(); if (nn && nn !== c.name) { c.name = nn; App.saveColumns(); App.render(); } };
    inp.onkeydown = e => { if (e.key === 'Enter') { saveName(); App.closePop(true); } };
    inp.onblur = saveName;
    sel.onchange = () => { c.type = sel.value; if (['select', 'multi', 'people'].includes(c.type)) c.options = c.options || []; App.saveColumns(); App.closePop(true); App.render(); };
    p.onclick = e => {
      const log = e.target.closest('[data-p=log]'); if (log) { c.log = log.checked; App.saveColumns(); return; }
      const b = e.target.closest('button[data-p]'); if (!b) return; const a = b.dataset.p;
      if (a === 'asc' || a === 'desc') P.sort = { col: c.id, dir: a };
      if (a === 'filter') { App.closePop(true); return openFilterMenu($('[data-act=filtro]', root), c.id); }
      if (a === 'group') P.group = c.id;
      if (a === 'left' || a === 'right') { const cs = App.S.columns, i = cs.indexOf(c), j = a === 'left' ? i - 1 : i + 1; if (j >= 0 && j < cs.length) { cs.splice(i, 1); cs.splice(j, 0, c); App.saveColumns(); } }
      if (a === 'hide') { c.hidden = true; App.saveColumns(); }
      if (a === 'del') { if (!confirm(`¿Eliminar la columna «${c.name}»? Se pierde su contenido en todos los proyectos.`)) return;
        App.S.columns = App.S.columns.filter(x => x !== c); if (P.sort && P.sort.col === c.id) P.sort = null; if (P.group === c.id) P.group = ''; P.filters = P.filters.filter(f => f.col !== c.id); App.saveColumns(); }
      savePrefs(); App.closePop(true); App.render();
    };
  }
  function openSortFor(anchor, colId) {
    App.menu(anchor, [{ id: 'asc', label: '↑ Ordenar ascendente' }, { id: 'desc', label: '↓ Ordenar descendente' }], d => { P.sort = { col: colId, dir: d }; savePrefs(); paint(); });
  }
  function openAddColumn(anchor) {
    const p = App.openPop(anchor, `<div class="lbl">Nueva columna</div><input type="text" placeholder="Nombre" style="margin:0 4px 6px;width:calc(100% - 8px)"><select style="margin:0 4px 6px;width:calc(100% - 8px)">${Object.entries(TYPES).filter(([k]) => k !== 'title').map(([k, t]) => `<option value="${k}">${t.icon}  ${t.label}</option>`).join('')}</select><div class="row" style="padding:0 4px 4px"><button class="btn primary" data-p="ok">Agregar</button></div>`, { width: 260 });
    const inp = $('input', p), sel = $('select', p);
    const ok = () => { const name = inp.value.trim(); if (!name) { inp.focus(); return; }
      const c = { id: App.uid(), name, type: sel.value, width: 180 }; if (['select', 'multi', 'people'].includes(c.type)) c.options = [];
      App.S.columns.push(c); App.saveColumns(); App.closePop(true); App.render(); };
    inp.onkeydown = e => { if (e.key === 'Enter') ok(); };
    $('[data-p=ok]', p).onclick = ok;
  }
  function openRowMenu(anchor, rowId) {
    App.menu(anchor, [{ id: 'open', label: '⤢ Abrir proyecto' }, { id: 'dup', label: '⧉ Duplicar' }, '-', { id: 'del', label: '🗑 Eliminar', danger: true }], async a => {
      const r = App.byId('projects', rowId);
      if (a === 'open') App.go('#/proyectos/' + rowId);
      if (a === 'dup') App.guard(async () => { const props = JSON.parse(JSON.stringify(r.props || {})); const t = App.titleCol().id; props[t] = (props[t] || 'Proyecto') + ' (copia)'; await App.create('projects', { props }); App.render(); });
      if (a === 'del') App.Proyecto.confirmDelete(rowId);
    });
  }
  function openFilterMenu(anchor, presetCol) {
    let p;
    const draw = () => {
      const c = col(presetCol) || App.S.columns[0];
      const ops = ['select', 'multi', 'people'].includes(c.type) ? [['es', c.type === 'select' ? 'es' : 'incluye'], ['no', c.type === 'select' ? 'no es' : 'no incluye']]
        : c.type === 'number' ? [['=', '='], ['>', 'mayor que'], ['<', 'menor que']] : c.type === 'date' ? [['>=', 'desde'], ['<=', 'hasta']] : c.type === 'check' ? [['es', 'está']] : [['contiene', 'contiene']];
      const val = ['select', 'multi', 'people'].includes(c.type) ? `<select data-p="val">${(c.options || []).map(o => `<option>${esc(o.name)}</option>`).join('')}</select>${!(c.options || []).length ? '<div class="hint">Esta columna aún no tiene opciones</div>' : ''}`
        : c.type === 'number' ? '<input type="number" step="any" data-p="val">' : c.type === 'date' ? '<input type="date" data-p="val">' : c.type === 'check' ? '<select data-p="val"><option value="si">marcado</option><option value="no">sin marcar</option></select>' : '<input type="text" data-p="val" placeholder="texto…">';
      p.innerHTML = `<div class="lbl">Filtrar</div><select data-p="col" style="margin:0 4px 6px;width:calc(100% - 8px)">${App.S.columns.map(x => `<option value="${x.id}" ${x.id === c.id ? 'selected' : ''}>${TYPES[x.type].icon}  ${esc(x.name)}</option>`).join('')}</select><div class="row" style="padding:0 4px"><select data-p="op" style="width:auto;flex:1">${ops.map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></div><div class="row" style="padding:0 4px">${val}</div><div class="row" style="padding:4px 4px 4px"><button class="btn primary" data-p="ok">Aplicar</button>${P.filters.length ? '<button class="btn" data-p="clear">Quitar todos</button>' : ''}</div>`;
      $('select[data-p=col]', p).onchange = e => { presetCol = e.target.value; draw(); };
      $('[data-p=ok]', p).onclick = () => { const v = $('[data-p=val]', p); const vv = v ? v.value : ''; if (vv === '' && c.type !== 'check') { v && v.focus(); return; } P.filters.push({ col: c.id, op: $('[data-p=op]', p).value, val: c.type === 'number' ? Number(vv) : vv }); savePrefs(); App.closePop(true); paint(); };
      const cl = $('[data-p=clear]', p); if (cl) cl.onclick = () => { P.filters = []; savePrefs(); App.closePop(true); paint(); };
      const vi = $('input[data-p=val]', p); if (vi) vi.onkeydown = e => { if (e.key === 'Enter') $('[data-p=ok]', p).click(); };
    };
    p = App.openPop(anchor, '<div></div>', { width: 280, nofocus: true }); draw();
  }
  function openSortMenu(anchor) {
    const p = App.openPop(anchor, `<div class="lbl">Ordenar por</div><select data-p="col" style="margin:0 4px 6px;width:calc(100% - 8px)">${App.S.columns.map(x => `<option value="${x.id}" ${P.sort && P.sort.col === x.id ? 'selected' : ''}>${TYPES[x.type].icon}  ${esc(x.name)}</option>`).join('')}</select><div class="row" style="padding:0 4px"><select data-p="dir" style="flex:1;width:auto"><option value="asc" ${!P.sort || P.sort.dir === 'asc' ? 'selected' : ''}>Ascendente</option><option value="desc" ${P.sort && P.sort.dir === 'desc' ? 'selected' : ''}>Descendente</option></select></div><div class="row" style="padding:4px 4px 4px"><button class="btn primary" data-p="ok">Aplicar</button>${P.sort ? '<button class="btn" data-p="clear">Quitar orden</button>' : ''}</div>`, { width: 260, nofocus: true });
    $('[data-p=ok]', p).onclick = () => { P.sort = { col: $('[data-p=col]', p).value, dir: $('[data-p=dir]', p).value }; savePrefs(); App.closePop(true); paint(); };
    const cl = $('[data-p=clear]', p); if (cl) cl.onclick = () => { P.sort = null; savePrefs(); App.closePop(true); paint(); };
  }
  function openGroupMenu(anchor) {
    const cands = App.S.columns.filter(c => ['select', 'multi', 'people', 'check'].includes(c.type));
    const isBoard = P.view === 'tablero';
    const cur = isBoard ? (boardColumn() || {}).id : P.group;
    const p = App.openPop(anchor, `<div class="lbl">${isBoard ? 'Columnas del tablero por' : 'Agrupar por'}</div>${(isBoard ? cands.filter(c => c.type === 'select') : cands).map(c => `<button class="mi" data-g="${c.id}">${TYPES[c.type].icon} ${esc(c.name)} ${cur === c.id ? '<span class="k">✓</span>' : ''}</button>`).join('')}${!isBoard ? '<div class="sep"></div><button class="mi" data-g="">Sin agrupar</button>' : ''}`, { width: 240, nofocus: true });
    p.onclick = e => { const b = e.target.closest('[data-g]'); if (!b) return; if (isBoard) P.boardCol = b.dataset.g; else P.group = b.dataset.g; savePrefs(); App.closePop(true); paint(); };
  }
  function openColsMenu(anchor) {
    const p = App.openPop(anchor, `<div class="lbl">Columnas visibles</div>${App.S.columns.map(c => `<label class="mi" style="cursor:pointer"><input type="checkbox" data-c="${c.id}" ${c.hidden ? '' : 'checked'} ${c.type === 'title' || !App.canEdit() ? 'disabled' : ''} style="width:auto"> ${TYPES[c.type].icon} ${esc(c.name)}</label>`).join('')}<div class="sep"></div><label class="mi" style="cursor:pointer"><input type="checkbox" data-calc="1" ${P.calc ? 'checked' : ''} style="width:auto"> Columnas calculadas (cronograma, avance, caso)</label>${App.canEdit() ? '<div class="sep"></div><button class="mi" data-p="add">+ Agregar columna</button>' : ''}`, { width: 300, nofocus: true });
    p.onchange = e => {
      if (e.target.dataset.calc) { P.calc = e.target.checked; savePrefs(); paint(); return; }
      const cb = e.target.closest('[data-c]'); if (!cb) return; col(cb.dataset.c).hidden = !cb.checked; App.saveColumns(); paint();
    };
    p.onclick = e => { if (e.target.closest('[data-p=add]')) { App.closePop(true); openAddColumn(anchor); } };
  }
  function downloadCSV() {
    const cols = visibleCols(), rows = rowsVisibles();
    const cell = s => { s = String(s == null ? '' : s); return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const head = [...cols.map(c => c.name), 'Inicio', 'Fin', 'Avance %', 'Estado del caso', 'VPN'];
    const lines = [head.map(cell).join(';'), ...rows.map(r => { const pl = App.planOf(r.id), cs = App.caseOf(r.id), f = cs ? Finanzas.calc(cs) : null;
      return [...cols.map(c => { const v = (r.props || {})[c.id]; return Array.isArray(v) ? v.join(', ') : c.type === 'check' ? (v ? 'Sí' : 'No') : v; }), pl.ini || '', pl.fin || '', pl.acts.length ? pl.avance : '', cs ? cs.estado || 'Borrador' : '', f && f.vpn != null ? Math.round(f.vpn) : ''].map(cell).join(';'); })];
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `proyectos-${App.d.today()}.csv`; a.click(); URL.revokeObjectURL(a.href);
  }
  async function nuevo(gcol, gkey) {
    const props = {};
    const c = gcol && col(gcol);
    if (c && gkey) props[gcol] = c.type === 'multi' || c.type === 'people' ? [gkey] : c.type === 'check' ? gkey === 'Marcado' : gkey;
    await App.guard(async () => {
      const r = await App.create('projects', { props }); App.render();
      const td = root && $(`.tbl td.cell[data-id="${r.id}"][data-col="${App.titleCol().id}"]`, root);
      if (td) { td.scrollIntoView({ block: 'nearest' }); openEditor(td, r.id, App.titleCol().id); } else App.go('#/proyectos/' + r.id);
    });
  }

  function onClick(e) {
    if (e.target.closest('[data-stop]')) return;
    const v = e.target.closest('.seg [data-view]'); if (v) { P.view = v.dataset.view; savePrefs(); paint(); return; }
    const ch = e.target.closest('[data-chip]');
    if (ch) { const k = ch.dataset.chip; if (k === 'sort') P.sort = null; else if (k === 'group') P.group = ''; else P.filters.splice(Number(k.slice(1)), 1); savePrefs(); paint(); return; }
    const t = e.target.closest('[data-act]'); if (!t) return;
    const a = t.dataset.act;
    if (a === 'burger') App.toggleSide();
    else if (a === 'open') { e.stopPropagation(); App.go('#/proyectos/' + t.dataset.id); }
    else if (a === 'edit') openEditor(t, t.dataset.id, t.dataset.col);
    else if (a === 'calc') App.go(`#/proyectos/${t.dataset.id}/${t.dataset.k === '_caso' ? 'caso' : t.dataset.k === '_ice' ? 'info' : 'cronograma'}`);
    else if (a === 'colmenu') { if (e.target.classList.contains('rz')) return; openColMenu(t, t.dataset.col); }
    else if (a === 'addcol') openAddColumn(t);
    else if (a === 'rowmenu') openRowMenu(t, t.dataset.id);
    else if (a === 'new') nuevo(t.dataset.gcol, t.dataset.gkey);
    else if (a === 'toggle') { P.collapsed[t.dataset.key] = !P.collapsed[t.dataset.key]; savePrefs(); paint(); }
    else if (a === 'filtro') openFilterMenu(t);
    else if (a === 'orden') openSortMenu(t);
    else if (a === 'grupo') openGroupMenu(t);
    else if (a === 'cols') openColsMenu(t);
    else if (a === 'csv') downloadCSV();
  }
  function onResize(e) {
    const h = e.target.closest('.rz'); if (!h || !App.canEdit()) return; e.preventDefault(); e.stopPropagation();
    const c = col(h.dataset.col), x0 = e.clientX, w0 = c.width || 180; h.classList.add('on');
    const table = $('.tbl', root), colEl = $$('.tbl colgroup col', root)[visibleCols().indexOf(c)], tw0 = table.offsetWidth;
    const mv = ev => { c.width = Math.max(70, w0 + ev.clientX - x0); if (colEl) colEl.style.width = c.width + 'px'; table.style.width = (tw0 + c.width - w0) + 'px'; };
    const up = () => { document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); h.classList.remove('on'); App.saveColumns(); };
    document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up);
  }

  App.Tabla = { TYPES, renderValue, openEditor, render };
  App.views.proyectos = { render: main => render(main) };
})();
