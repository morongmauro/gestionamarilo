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
  const ESC_DEF = { pes: { b: -20, c: 10, i: 10 }, opt: { b: 15, c: -5, i: 0 } };
  const ESCALAS = [[1, 'Pesos'], [1e3, 'Miles'], [1e6, 'Millones']];
  let grid = null;
  function editor(el, pid) {
    const c = App.caseOf(pid), ro = !App.canEdit();
    if (grid) { grid.destroy(); grid = null; }
    if (!c) {
      el.innerHTML = `<div class="card-box"><div class="empty-box"><b>Este proyecto aún no tiene caso de negocio</b>${ro ? 'Cuando el equipo lo cree, aparecerá aquí.' : 'Arma la justificación: problema, objetivo, beneficios, costos y la decisión que se le pide al comité. Puedes empezar desde cero o subir el Excel que ya tienes.'}${ro ? '' : '<div style="margin-top:14px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap"><button class="btn primary" data-c="crear">+ Crear caso de negocio</button><button class="btn" data-c="crear-excel">⇪ Crear desde un Excel</button></div>'}</div></div>`;
      const b = $('[data-c=crear]', el); if (b) b.onclick = () => App.guard(async () => { await App.create('cases', nuevoCaso(pid)); App.render(); });
      const bx = $('[data-c=crear-excel]', el); if (bx) bx.onclick = () => App.guard(async () => { await App.create('cases', Object.assign(nuevoCaso(pid), { flujos: [] })); App.render(); const btn = App.$('[data-c=importar]'); if (btn) btn.click(); });
      return;
    }
    const dis = ro ? 'disabled' : '';
    const fl = JSON.parse(JSON.stringify(c.flujos || []));
    const n = () => Math.max(1, Math.min(App.Hoja.MAXY, Math.round(c.anios || 5))) + 1;
    const mon = c.moneda || 'COP';
    const escala = App.store.get('caso.escala', 1);
    const esc0 = Object.assign({}, ESC_DEF, c.escenarios || {});

    const kpiHTML = rows => {
      const f = Finanzas.calc(Object.assign({}, c, { flujos: rows }));
      const k = (l, v, cls, s) => `<div class="kpi"><div class="l">${l}</div><div class="v ${cls || ''}">${v}</div>${s ? `<div class="s">${s}</div>` : ''}</div>`;
      return k('VPN', esc(App.moneyShort(f.vpn, mon)), f.vpn == null ? '' : f.vpn >= 0 ? 'good' : 'bad', `Tasa de descuento ${App.num(c.tasa, 2) || 0}%`) +
        k('TIR', esc(App.pct(f.tir)), f.tir == null ? '' : f.tir * 100 >= (c.tasa || 0) ? 'good' : 'bad', f.tir == null ? 'Necesita flujos negativos y positivos' : f.tirMultiple ? 'El flujo cambia de signo varias veces: puede haber otra TIR' : '') +
        k('Payback', f.payback == null ? '—' : f.payback > 0 && f.payback < 0.05 ? 'menos de 0,1 años' : esc(App.num(f.payback, 1)) + ' años', '', 'Años para recuperar la inversión') +
        k('ROI', esc(App.pct(f.roi)), f.roi == null ? '' : f.roi >= 0 ? 'good' : 'bad', `Inversión ${esc(App.moneyShort(f.totalInversion, mon))} · Beneficio ${esc(App.moneyShort(f.totalBeneficio, mon))}`);
    };
    const sensHTML = rows => {
      const base = Object.assign({}, c, { flujos: rows });
      const r = { pes: Finanzas.calc(Finanzas.ajustar(base, esc0.pes)), base: Finanzas.calc(base), opt: Finanzas.calc(Finanzas.ajustar(base, esc0.opt)) };
      const vcls = v => (v == null ? '' : v >= 0 ? 'good' : 'bad');
      const inp = (k, f) => `<input class="pct" data-e="${k}.${f}" value="${esc(String(esc0[k][f] ?? 0))}" ${dis} inputmode="decimal">%`;
      const m = Finanzas.margen(base), tarde = Finanzas.calc(Finanzas.ajustar(base, { retraso: 1 }));
      const margenTxt = m == null ? 'Agrega beneficios para calcular el margen de seguridad.'
        : m >= 0 ? `Los beneficios pueden caer hasta <b>${esc(App.pct(m))}</b> antes de que el VPN sea negativo.`
        : `Los beneficios tendrían que subir <b>${esc(App.pct(-m))}</b> para que el VPN llegue a cero.`;
      return `<table class="esc"><thead><tr><th></th><th>Pesimista</th><th>Base</th><th>Optimista</th></tr></thead><tbody>
        <tr><td>Beneficios</td><td>${inp('pes', 'b')}</td><td class="faint">tal cual</td><td>${inp('opt', 'b')}</td></tr>
        <tr><td>Costos</td><td>${inp('pes', 'c')}</td><td class="faint">tal cual</td><td>${inp('opt', 'c')}</td></tr>
        <tr><td>Inversión</td><td>${inp('pes', 'i')}</td><td class="faint">tal cual</td><td>${inp('opt', 'i')}</td></tr>
        <tr class="res"><td>VPN</td>${['pes', 'base', 'opt'].map(k => `<td class="${vcls(r[k].vpn)}">${esc(App.moneyShort(r[k].vpn, mon))}</td>`).join('')}</tr>
        <tr class="res"><td>TIR</td>${['pes', 'base', 'opt'].map(k => `<td>${esc(App.pct(r[k].tir))}</td>`).join('')}</tr>
        <tr class="res"><td>Payback</td>${['pes', 'base', 'opt'].map(k => `<td>${r[k].payback == null ? '—' : esc(App.num(r[k].payback, 1)) + ' años'}</td>`).join('')}</tr>
      </tbody></table>
      <div class="sens-notes"><div>${margenTxt}</div>${r.base.vpn != null ? `<div>Si los beneficios llegan un año tarde, el VPN pasa de ${esc(App.moneyShort(r.base.vpn, mon))} a <b class="${vcls(tarde.vpn)}">${esc(App.moneyShort(tarde.vpn, mon))}</b>.</div>` : ''}</div>`;
    };
    const refresh = rows => {
      $('#cKpi', el).innerHTML = kpiHTML(rows);
      $('#cSens', el).innerHTML = sensHTML(rows);
      if (App.Caso.chart) App.Caso.chart($('#cChart', el), Object.assign({}, c, { flujos: rows }), mon);
    };

    el.innerHTML = `<div class="case-grid">
      <div>
        <div class="card-box" style="margin-bottom:14px">
          ${SECCIONES.map(([k, t, h], i) => `<div class="sec"><h3><span class="nm">${i + 1}</span>${t}</h3><div class="help">${h}</div><textarea class="fld" data-f="${k}" rows="3" ${dis} placeholder="${ro ? '' : 'Escribe aquí…'}">${esc(c[k] || '')}</textarea></div>`).join('')}
        </div>
        <div class="card-box" style="margin-bottom:14px">
          <div class="hoja-top">
            <h3 class="hoja-t"><span class="nm">$</span>Flujo financiero año a año</h3>
            <span class="sp"></span>
            <div class="seg no-print" title="Cómo se muestran y se escriben las cifras">${ESCALAS.map(([v, l]) => `<button data-escala="${v}" class="${v === escala ? 'on' : ''}">${l}</button>`).join('')}</div>
            ${ro ? '' : '<button class="btn sm no-print" data-c="undo" title="Deshacer (Ctrl+Z)">↶</button><button class="btn sm no-print" data-c="redo" title="Rehacer (Ctrl+Y)">↷</button>'}
            <button class="btn sm no-print" data-c="atajos">? Atajos</button>
          </div>
          <div class="help" style="margin:4px 0 8px">Cifras en ${escala === 1 ? '' : escala === 1e3 ? 'miles de ' : 'millones de '}${esc(mon)}. El año 0 es el arranque. Se trabaja como en Excel: copia y pega desde Excel, flechas, Enter, =150*12, 1,2M o +5% sobre el año anterior.</div>
          <div class="no-print excel-bar">${ro ? '' : '<button class="btn sm" data-c="importar">⇪ Subir Excel</button>'}<a class="btn sm" href="/api/cases/${c.id}/excel" download>⇩ Descargar Excel</a>${ro ? '' : '<a class="btn sm" href="/api/cases/plantilla/excel" download>⇩ Plantilla vacía</a>'}<input type="file" accept=".xlsx" data-c="archivo" hidden></div>
          <div class="flujo-wrap hoja-wrap" id="cFlujo"></div>
          <div id="cChart" class="cf-chart"></div>
        </div>
        <div class="card-box">
          <div class="sec" style="margin-bottom:6px"><h3><span class="nm">±</span>Escenarios y margen de seguridad</h3><div class="help">Cambia los porcentajes y mira cómo se mueve el caso. Lo que en Excel serían tres hojas copiadas, aquí se recalcula solo.</div></div>
          <div id="cSens"></div>
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
            <label>Horizonte</label><select class="fld" data-f="anios" ${dis}>${Array.from({ length: App.Hoja.MAXY }, (_, i) => i + 1).map(y => `<option value="${y}" ${y === n() - 1 ? 'selected' : ''}>${y} ${y === 1 ? 'año' : 'años'}</option>`).join('')}</select>
            <label>Año 0</label><input class="fld" type="number" data-f="anio_inicio" value="${esc(c.anio_inicio ?? '')}" placeholder="p. ej. ${new Date().getFullYear()}" ${dis}>
          </div>
        </div>
        <div id="cKpi" style="display:flex;flex-direction:column;gap:10px"></div>
        <div class="no-print" style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" data-c="print">⎙ Imprimir / PDF</button>${ro ? '' : '<button class="btn danger" data-c="del">Eliminar caso</button>'}</div>
        <div class="meta-line">${c.updated_by_name ? `Última edición: ${esc(c.updated_by_name)}, ${esc(App.d.ago(c.updated_at))}` : ''}</div>
      </div></div>`;

    // Flujo: se guarda medio segundo después de cada cambio
    let tSave = null;
    const flush = () => { if (tSave) { clearTimeout(tSave); tSave = null; App.patch('cases', c.id, { flujos: fl }).catch(() => {}); } };
    const saveFlujo = () => { clearTimeout(tSave); tSave = setTimeout(flush, 500); };
    App.Caso._flush = flush; // si se cierra o recarga la pestaña, se envía lo pendiente
    grid = App.Hoja.mount($('#cFlujo', el), {
      rows: fl, years: n(), escala, anioInicio: c.anio_inicio || null, ro, tipos: TIPOS,
      onLive: rows => refresh(rows),
      onCommit: rows => { refresh(rows); saveFlujo(); },
      onYears: years => { flush(); App.patch('cases', c.id, { anios: years - 1, flujos: fl }).then(() => { App.toast(`Horizonte ampliado a ${years - 1} años`); editor(el, pid); }).catch(() => {}); },
    });
    refresh(fl);

    // Guardar narrativa, datos generales y escenarios al salir del campo
    el.onchange = e => {
      const t = e.target;
      if (t.dataset.e && !ro) {
        const [k, f] = t.dataset.e.split('.'); const v = Number(String(t.value).replace(',', '.').replace('%', ''));
        esc0[k] = Object.assign({}, esc0[k], { [f]: Number.isFinite(v) ? v : 0 });
        App.patch('cases', c.id, { escenarios: { pes: esc0.pes, opt: esc0.opt } }).catch(() => {});
        $('#cSens', el).innerHTML = sensHTML(fl); return;
      }
      if (t.dataset.c === 'archivo') { const file = t.files[0]; t.value = ''; if (file) App.Caso.importar(file, c, fl, () => { flush(); editor(el, pid); }); return; }
      const f = t.dataset.f; if (!f || ro) return;
      let v = t.value;
      if (f === 'tasa' || f === 'anio_inicio') v = v === '' ? null : Number(v);
      if (f === 'anios') v = Number(v);
      flush();
      App.patch('cases', c.id, { [f]: v }).catch(() => {});
      if (['anios', 'moneda', 'estado', 'tasa', 'anio_inicio'].includes(f)) editor(el, pid);
    };
    el.onclick = e => {
      const es = e.target.closest('[data-escala]');
      if (es) { flush(); App.store.set('caso.escala', Number(es.dataset.escala)); return editor(el, pid); }
      const b = e.target.closest('[data-c]'); if (!b) return;
      const a = b.dataset.c;
      if (a === 'print') return window.print();
      if (a === 'undo') return grid.undo();
      if (a === 'redo') return grid.redo();
      if (a === 'importar') return $('[data-c=archivo]', el).click();
      if (a === 'atajos') return App.openPop(b, `<div class="lbl">Atajos de la hoja</div><div class="atajos">
        <div><b>Flechas · Enter · Tab</b><span>moverse (Shift+Enter sube)</span></div>
        <div><b>Shift + flechas / arrastrar</b><span>seleccionar un rango</span></div>
        <div><b>Ctrl+C · Ctrl+V</b><span>copiar y pegar con Excel, también tablas completas</span></div>
        <div><b>Cuadrito azul</b><span>arrastrar para llenar; con 2 celdas sigue la serie</span></div>
        <div><b>Ctrl+D · Ctrl+R</b><span>llenar hacia abajo · hacia la derecha</span></div>
        <div><b>Supr</b><span>borrar lo seleccionado</span></div>
        <div><b>Ctrl+Z · Ctrl+Y</b><span>deshacer · rehacer</span></div>
        <div><b>Esc · F2</b><span>cancelar lo escrito · editar sin borrar</span></div>
        <div><b>1,2M · 300k</b><span>millones y miles</span></div>
        <div><b>=150*12</b><span>calcular como en Excel</span></div>
        <div><b>+5% · −3%</b><span>sobre el valor del año anterior</span></div>
        <div><b>(1.200)</b><span>número negativo</span></div>
        <div><b>··· en cada fila</b><span>repetir, crecer un %, repartir un total</span></div></div>`, { width: 380, nofocus: true });
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
  window.addEventListener('pagehide', () => { if (App.Caso._flush) App.Caso._flush(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && App.Caso._flush) App.Caso._flush(); });
  App.views.casos = { render: section };
})();
