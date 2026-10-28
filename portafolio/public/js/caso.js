/* ============================================================
   CASO DE NEGOCIO · uno por proyecto
   Narrativa (problema, objetivo, alcance, beneficios, riesgos…),
   flujo financiero por año y sus indicadores: VPN, TIR, payback, ROI.
   ============================================================ */
'use strict';
(function () {
  const { $, $$, esc } = App;
  const ESTADOS = [
    { name: 'Borrador', color: 'gris' }, { name: 'En revisión', color: 'amarillo' }, { name: 'Aprobado', color: 'verde' },
    { name: 'Aplazado', color: 'naranja' }, { name: 'Rechazado', color: 'rojo' }];
  const estadoColor = e => (ESTADOS.find(x => x.name === e) || ESTADOS[0]).color;
  const SECCIONES = [
    ['problema', 'Problema u oportunidad', '¿Qué pasa hoy y por qué vale la pena resolverlo?'],
    ['objetivo', 'Objetivo', '¿Qué se logra y cómo se mide?'],
    ['alcance', 'Alcance', 'Qué incluye el proyecto.'],
    ['fuera_alcance', 'Fuera de alcance', 'Qué no incluye, para evitar malentendidos.'],
    ['beneficios_cual', 'Beneficios cualitativos', 'Lo que no se traduce en plata: experiencia, riesgo, cumplimiento…'],
    ['riesgos', 'Riesgos', 'Qué puede salir mal y cómo se mitiga.'],
    ['supuestos', 'Supuestos', 'Lo que se da por cierto para que los números se cumplan.'],
    ['recomendacion', 'Recomendación y decisión solicitada', 'Qué se le pide al comité.'],
  ];
  const TIPOS = [['inversion', 'Inversión'], ['costo', 'Costos de operación'], ['beneficio', 'Beneficios']];

  function nuevoCaso(pid) {
    return { project_id: pid, estado: 'Borrador', tasa: 12, anios: 5, moneda: 'COP', flujos: [
      { id: App.uid(), concepto: 'Inversión inicial', tipo: 'inversion', valores: [] },
      { id: App.uid(), concepto: 'Costos de operación', tipo: 'costo', valores: [] },
      { id: App.uid(), concepto: 'Beneficio esperado', tipo: 'beneficio', valores: [] }] };
  }

  /* ---------- editor (en la sección y en la pestaña del proyecto) ---------- */
  function editor(el, pid) {
    const c = App.caseOf(pid), ro = !App.canEdit();
    if (!c) {
      el.innerHTML = `<div class="card-box"><div class="empty-box"><b>Este proyecto aún no tiene caso de negocio</b>${ro ? 'Cuando el equipo lo cree, aparecerá aquí.' : 'Arma la justificación: problema, objetivo, beneficios, costos y la decisión que se le pide al comité.'}${ro ? '' : '<div style="margin-top:14px"><button class="btn primary" data-c="crear">+ Crear caso de negocio</button></div>'}</div></div>`;
      const b = $('[data-c=crear]', el); if (b) b.onclick = () => App.guard(async () => { await App.create('cases', nuevoCaso(pid)); App.render(); });
      return;
    }
    const dis = ro ? 'disabled' : '';
    let fl = JSON.parse(JSON.stringify(c.flujos || []));
    const n = () => Math.max(1, Math.min(15, Math.round(c.anios || 5))) + 1;
    const mon = c.moneda || 'COP';

    const kpiHTML = () => {
      const f = Finanzas.calc(Object.assign({}, c, { flujos: fl }));
      const k = (l, v, cls, s) => `<div class="kpi"><div class="l">${l}</div><div class="v ${cls || ''}">${v}</div>${s ? `<div class="s">${s}</div>` : ''}</div>`;
      return k('VPN', esc(App.moneyShort(f.vpn, mon)), f.vpn == null ? '' : f.vpn >= 0 ? 'good' : 'bad', `Tasa de descuento ${App.num(c.tasa, 2) || 0}%`) +
        k('TIR', esc(App.pct(f.tir)), f.tir == null ? '' : f.tir * 100 >= (c.tasa || 0) ? 'good' : 'bad', f.tir == null ? 'Necesita flujos negativos y positivos' : '') +
        k('Payback', f.payback == null ? '—' : esc(App.num(f.payback, 1)) + ' años', '', 'Años para recuperar la inversión') +
        k('ROI', esc(App.pct(f.roi)), f.roi == null ? '' : f.roi >= 0 ? 'good' : 'bad', `Inversión ${esc(App.moneyShort(f.totalInversion, mon))} · Beneficio ${esc(App.moneyShort(f.totalBeneficio, mon))}`);
    };
    const totRows = () => {
      const f = Finanzas.calc(Object.assign({}, c, { flujos: fl }));
      const cells = arr => arr.map(v => `<td><span class="${v < 0 ? 'neg' : ''}">${esc(App.num(v))}</span></td>`).join('');
      const sum = arr => arr.reduce((a, b) => a + b, 0);
      return `<tr class="tot"><td>Inversión</td>${cells(f.inversion)}<td>${esc(App.num(sum(f.inversion)))}</td><td></td></tr>
        <tr class="tot"><td>Costos</td>${cells(f.costos)}<td>${esc(App.num(sum(f.costos)))}</td><td></td></tr>
        <tr class="tot"><td>Beneficios</td>${cells(f.beneficios)}<td>${esc(App.num(sum(f.beneficios)))}</td><td></td></tr>
        <tr class="tot neto"><td>Flujo neto</td>${cells(f.netos)}<td><span class="${sum(f.netos) < 0 ? 'neg' : ''}">${esc(App.num(sum(f.netos)))}</span></td><td></td></tr>
        <tr class="tot"><td>Acumulado</td>${cells(f.acumulado)}<td></td><td></td></tr>`;
    };
    const flujoHTML = () => {
      const N = n();
      const head = `<tr><th>Concepto</th>${Array.from({ length: N }, (_, t) => `<th>Año ${t}</th>`).join('')}<th>Total</th><th></th></tr>`;
      const body = TIPOS.map(([tipo, lbl]) => {
        const rows = fl.map((r, i) => ({ r, i })).filter(x => x.r.tipo === tipo);
        return `<tr class="grp"><td colspan="${N + 3}">${lbl}${ro ? '' : `<button data-c="addrow" data-tipo="${tipo}">+ fila</button>`}</td></tr>` +
          rows.map(({ r, i }) => `<tr><td><input class="cpt" data-i="${i}" data-k="concepto" value="${esc(r.concepto || '')}" ${dis} placeholder="Concepto"></td>${Array.from({ length: N }, (_, t) => `<td><input data-i="${i}" data-t="${t}" value="${esc(App.num((r.valores || [])[t]))}" ${dis} inputmode="decimal" placeholder="0"></td>`).join('')}<td class="rt" data-rt="${i}">${esc(App.num((r.valores || []).slice(0, N).reduce((a, b) => a + (Number(b) || 0), 0)))}</td><td>${ro ? '' : `<button class="x" data-c="delrow" data-i="${i}" title="Quitar fila">✕</button>`}</td></tr>`).join('');
      }).join('');
      return `<table class="flujo"><thead>${head}</thead><tbody>${body}</tbody><tbody id="cTot">${totRows()}</tbody></table>`;
    };

    el.innerHTML = `<div class="case-grid">
      <div>
        <div class="card-box" style="margin-bottom:14px">
          ${SECCIONES.map(([k, t, h], i) => `<div class="sec"><h3><span class="nm">${i + 1}</span>${t}</h3><div class="help">${h}</div><textarea class="fld" data-f="${k}" rows="3" ${dis} placeholder="${ro ? '' : 'Escribe aquí…'}">${esc(c[k] || '')}</textarea></div>`).join('')}
        </div>
        <div class="card-box">
          <div class="sec" style="margin-bottom:8px"><h3><span class="nm">$</span>Flujo financiero</h3><div class="help">Valores por año en ${esc(mon)}. El año 0 es el arranque (normalmente la inversión). Puedes pegar cifras como 1.250.000.</div></div>
          <div class="flujo-wrap" id="cFlujo">${flujoHTML()}</div>
        </div>
      </div>
      <div class="case-side">
        <div class="card-box">
          <div class="case-meta">
            <label>Estado</label><select class="estado-sel cl-${estadoColor(c.estado)}" data-f="estado" ${dis}>${ESTADOS.map(e => `<option ${e.name === (c.estado || 'Borrador') ? 'selected' : ''}>${e.name}</option>`).join('')}</select>
            <label>Sponsor</label><input class="fld" data-f="sponsor" value="${esc(c.sponsor || '')}" ${dis} placeholder="Quién lo patrocina">
            <label>Comité</label><input class="fld" type="date" data-f="fecha_comite" value="${esc(c.fecha_comite || '')}" ${dis}>
            <label>Moneda</label><select class="fld" data-f="moneda" ${dis}>${['COP', 'USD'].map(m => `<option ${m === mon ? 'selected' : ''}>${m}</option>`).join('')}</select>
            <label>Tasa (%)</label><input class="fld" type="number" step="0.1" data-f="tasa" value="${esc(c.tasa ?? '')}" ${dis}>
            <label>Horizonte</label><select class="fld" data-f="anios" ${dis}>${Array.from({ length: 10 }, (_, i) => i + 1).map(y => `<option value="${y}" ${y === n() - 1 ? 'selected' : ''}>${y} ${y === 1 ? 'año' : 'años'}</option>`).join('')}</select>
          </div>
        </div>
        <div id="cKpi" style="display:flex;flex-direction:column;gap:10px">${kpiHTML()}</div>
        <div class="no-print" style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" data-c="print">⎙ Imprimir / PDF</button>${ro ? '' : '<button class="btn danger" data-c="del">Eliminar caso</button>'}</div>
        <div class="meta-line">${c.updated_by_name ? `Última edición: ${esc(c.updated_by_name)}, ${esc(App.d.ago(c.updated_at))}` : ''}</div>
      </div></div>`;

    // Guardar narrativa y datos generales al salir del campo
    el.onchange = e => {
      const f = e.target.dataset.f; if (!f || ro) return;
      let v = e.target.value;
      if (f === 'tasa') v = v === '' ? null : Number(v);
      if (f === 'anios') v = Number(v);
      flush();
      App.patch('cases', c.id, { [f]: v }).catch(() => {});
      if (['anios', 'moneda', 'estado', 'tasa'].includes(f)) editor(el, pid);
    };
    // Flujo: se recalcula mientras se escribe y se guarda medio segundo después
    let tSave = null;
    const flush = () => { if (tSave) { clearTimeout(tSave); tSave = null; App.patch('cases', c.id, { flujos: fl }).catch(() => {}); } };
    const saveFlujo = () => { clearTimeout(tSave); tSave = setTimeout(flush, 600); };
    const refresh = () => { $('#cTot', el).innerHTML = totRows(); $('#cKpi', el).innerHTML = kpiHTML();
      fl.forEach((r, i) => { const td = $(`[data-rt="${i}"]`, el); if (td) td.textContent = App.num((r.valores || []).slice(0, n()).reduce((a, b) => a + (Number(b) || 0), 0)); }); };
    el.oninput = e => {
      const t = e.target; if (t.dataset.i == null) return;
      const r = fl[+t.dataset.i];
      if (t.dataset.k === 'concepto') r.concepto = t.value;
      else { r.valores = r.valores || []; while (r.valores.length <= +t.dataset.t) r.valores.push(0); r.valores[+t.dataset.t] = App.parseNum(t.value); refresh(); }
      saveFlujo();
    };
    // Al salir de una cifra se muestra con separadores de miles
    el._fl = fl;
    if (!el._fo) { el._fo = true; el.addEventListener('focusout', e => { const t = e.target; if (t.dataset && t.dataset.t != null && t.dataset.i != null && el._fl[+t.dataset.i]) t.value = App.num((el._fl[+t.dataset.i].valores || [])[+t.dataset.t]); }); }
    el.onclick = e => {
      const b = e.target.closest('[data-c]'); if (!b) return;
      const a = b.dataset.c;
      if (a === 'print') return window.print();
      if (a === 'addrow') { fl.push({ id: App.uid(), concepto: '', tipo: b.dataset.tipo, valores: [] }); App.patch('cases', c.id, { flujos: fl }).catch(() => {}); $('#cFlujo', el).innerHTML = flujoHTML(); const ins = $$(`input.cpt`, el); const last = ins.find(x => +x.dataset.i === fl.length - 1); if (last) last.focus(); }
      if (a === 'delrow') { fl.splice(+b.dataset.i, 1); App.patch('cases', c.id, { flujos: fl }).catch(() => {}); $('#cFlujo', el).innerHTML = flujoHTML(); refresh(); }
      if (a === 'del') { if (!confirm('¿Eliminar el caso de negocio de este proyecto? Se pierde toda su información.')) return; App.guard(async () => { await App.remove('cases', c.id); App.render(); }); }
    };
  }

  /* ---------- sección «Casos de negocio» ---------- */
  let filtro = App.store.get('casos.filtro', 'todos');
  function section(main, params) {
    if (params[0]) return detalle(main, params[0]);
    const ps = App.projectsSorted();
    const rows = ps.map(p => { const c = App.caseOf(p.id); return { p, c, f: c ? Finanzas.calc(c) : null }; })
      .filter(x => filtro === 'todos' || (filtro === 'con' ? x.c : !x.c));
    const casos = App.S.cases, aprob = casos.filter(c => c.estado === 'Aprobado');
    const sum = (arr, k) => arr.reduce((a, c) => { const v = Finanzas.calc(c)[k]; return a + (Number.isFinite(v) ? v : 0); }, 0);
    const rev = casos.filter(c => c.estado === 'En revisión').length;
    const ec = App.estadoCol();
    main.innerHTML = `<div class="page-h"><button class="burger" data-act="burger">☰</button><div><h1>Casos de negocio</h1><div class="sub">${casos.length} de ${ps.length} proyectos tienen caso${rev ? ` · ${rev} en revisión` : ''}</div></div><span class="sp"></span>
        <div class="seg">${[['todos', 'Todos'], ['con', 'Con caso'], ['sin', 'Sin caso']].map(([k, l]) => `<button data-f="${k}" class="${filtro === k ? 'on' : ''}">${l}</button>`).join('')}</div></div>
      <div class="kpis">
        <div class="kpi"><div class="l">Aprobados</div><div class="v">${aprob.length}</div><div class="s">de ${casos.length} ${casos.length === 1 ? 'caso' : 'casos'}</div></div>
        <div class="kpi"><div class="l">Inversión aprobada</div><div class="v">${esc(App.moneyShort(sum(aprob, 'totalInversion')))}</div><div class="s">suma de casos aprobados</div></div>
        <div class="kpi"><div class="l">Beneficio aprobado</div><div class="v">${esc(App.moneyShort(sum(aprob, 'totalBeneficio')))}</div><div class="s">en el horizonte de cada caso</div></div>
        <div class="kpi"><div class="l">VPN aprobado</div><div class="v ${sum(aprob, 'vpn') >= 0 ? 'good' : 'bad'}">${esc(App.moneyShort(sum(aprob, 'vpn')))}</div><div class="s">valor presente neto</div></div>
      </div>
      <div class="card-box" style="padding:0;overflow:auto">${rows.length ? `<table class="lst"><thead><tr><th>Proyecto</th><th>Estado del caso</th><th>Sponsor</th><th class="n">Inversión</th><th class="n">Beneficio</th><th class="n">VPN</th><th class="n">TIR</th><th class="n">Payback</th><th class="n">ROI</th></tr></thead><tbody>
        ${rows.map(({ p, c, f }) => `<tr class="clic" data-pid="${p.id}"><td><b>${esc(App.projectName(p))}</b>${ec && (p.props || {})[ec.id] ? ` <span class="pill cl-${App.optColor(ec, p.props[ec.id])}" style="margin-left:6px">${esc(p.props[ec.id])}</span>` : ''}</td>
          ${c ? `<td><span class="pill cl-${estadoColor(c.estado)}">${esc(c.estado || 'Borrador')}</span></td><td>${esc(c.sponsor || '')}</td><td class="n">${esc(App.moneyShort(f.totalInversion, c.moneda))}</td><td class="n">${esc(App.moneyShort(f.totalBeneficio, c.moneda))}</td><td class="n" style="color:${f.vpn == null ? '' : f.vpn >= 0 ? 'var(--good)' : 'var(--crit)'};font-weight:700">${esc(App.moneyShort(f.vpn, c.moneda))}</td><td class="n">${esc(App.pct(f.tir))}</td><td class="n">${f.payback == null ? '—' : esc(App.num(f.payback, 1)) + ' a'}</td><td class="n">${esc(App.pct(f.roi))}</td>`
            : `<td colspan="8" class="faint">Sin caso de negocio${App.canEdit() ? ' · clic para crearlo' : ''}</td>`}</tr>`).join('')}
      </tbody></table>` : '<div class="empty-box"><b>No hay proyectos en esta vista</b></div>'}</div>`;
    main.onclick = e => {
      const f = e.target.closest('[data-f]'); if (f) { filtro = f.dataset.f; App.store.set('casos.filtro', filtro); return App.render(); }
      const r = e.target.closest('[data-pid]'); if (r) App.go('#/casos/' + r.dataset.pid);
      if (e.target.closest('.burger')) App.toggleSide();
    };
  }
  function detalle(main, pid) {
    const p = App.byId('projects', pid);
    if (!p) { main.innerHTML = '<div class="empty-box"><b>Proyecto no encontrado</b><a href="#/casos" class="back">← Casos de negocio</a></div>'; return; }
    main.innerHTML = `<div class="page-h"><button class="burger" data-act="burger">☰</button><a class="back" href="#/casos">← Casos de negocio</a><div><h1>${esc(App.projectName(p))}</h1><div class="sub">Caso de negocio</div></div><span class="sp"></span><a class="btn" href="#/proyectos/${pid}">Ver proyecto →</a></div><div id="cBox"></div>`;
    main.onclick = e => { if (e.target.closest('.burger')) App.toggleSide(); };
    editor($('#cBox', main), pid);
  }

  App.Caso = { editor, estadoColor, ESTADOS };
  App.views.casos = { render: section };
})();
