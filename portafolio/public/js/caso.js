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
  const TIPOS = [['supuesto', 'Supuestos · no suman, se usan en fórmulas (unidades, precios, %)'], ['beneficio', 'Beneficios'], ['costo', 'Costos de operación'], ['inversion', 'Inversión']];

  function nuevoCaso(pid) {
    return { project_id: pid, estado: 'Borrador', tasa: 12, anios: 5, moneda: 'COP', flujos: [
      { id: App.uid(), concepto: 'Inversión inicial', tipo: 'inversion', valores: [] },
      { id: App.uid(), concepto: 'Costos de operación', tipo: 'costo', valores: [] },
      { id: App.uid(), concepto: 'Beneficio esperado', tipo: 'beneficio', valores: [] }] };
  }

  // Caso preliminar desde el ICE, para iniciativas que llegaron de Notion con Income pero sin caso.
  // Valor a dos años: la columna «Valor a crear/capturar» si existe; si no, el MÍNIMO del rango del Income
  // (lo conservador). Se reparte en los años 1 y 2. Inversión y costos quedan para el equipo.
  const MIN_INCOME = { 1: 25e6, 2: 51e6, 3: 201e6, 5: 601e6, 8: 1201e6, 13: 2201e6, 21: 4201e6, 34: 8201e6, 55: 16201e6 };
  function preliminar(p) {
    if (!p || App.caseOf(p.id)) return null;
    const v = p.props || {}, inc = App.ICE.fib(v.ice_income), vc = Number(v.valor_crear) || 0;
    if (!inc && !(vc > 0)) return null;
    const valor = vc > 0 ? vc : MIN_INCOME[inc];
    const tv = App.S.columns.find(c => c.id === 'tipo_valor') || App.S.columns.find(c => /tipo de valor/i.test(c.name));
    const cat = App.catDeTipoValor(tv ? v[tv.id] : ''), mitad = Math.round(valor / 2);
    const fuente = vc > 0 ? 'valor a crear/capturar registrado' : `Income ${inc}: mínimo del rango (${App.moneyShort(valor)} a dos años)`;
    return { porque: vc > 0 ? `valor a crear registrado (${App.moneyShort(vc)})` : `Income ${inc} registrado en el ICE`, caso: {
      project_id: p.id, estado: 'Borrador', origen: 'ice', tasa: 12, anios: 2, moneda: 'COP', anio_inicio: +App.d.today().slice(0, 4),
      supuestos: `Caso preliminar construido desde el ICE (${fuente}). Reemplazar con las cifras reales.`,
      flujos: [
        { id: App.uid(), concepto: 'Inversión (por definir)', tipo: 'inversion', valores: [] },
        { id: App.uid(), concepto: 'Costos de operación (por definir)', tipo: 'costo', valores: [] },
        { id: App.uid(), concepto: `${App.catLabel(cat)} estimado desde el ICE`, tipo: 'beneficio', categoria: cat, valores: [0, mitad, valor - mitad] }] } };
  }
  // Administración: armar de una vez los casos preliminares que falten
  function tarjetaPreliminares() {
    const box = document.createElement('div'); box.className = 'card-box'; box.style.marginBottom = '16px';
    const pintar = () => {
      const ps = App.S.projects.map(p => ({ p, pre: preliminar(p) })).filter(x => x.pre);
      box.innerHTML = `<h3 style="font-size:14px;font-weight:800;margin-bottom:4px">Casos preliminares desde el ICE</h3>
        <div class="muted" style="font-size:12.5px;margin-bottom:10px">${ps.length ? `<b>${ps.length}</b> iniciativa${ps.length === 1 ? '' : 's'} tiene${ps.length === 1 ? '' : 'n'} Income (o valor a crear) pero no caso de negocio. Se arma un caso en borrador con el mínimo del rango del Income a dos años; la inversión queda para el equipo. No toca ninguna iniciativa que ya tenga caso.` : 'Todas las iniciativas con Income ya tienen caso de negocio.'}</div>
        ${ps.length ? `<div class="faint" style="font-size:12px;margin-bottom:8px">${ps.slice(0, 8).map(x => esc(App.projectName(x.p))).join(' · ')}${ps.length > 8 ? ` y ${ps.length - 8} más` : ''}</div><button class="btn" data-pre="1">Armar ${ps.length} caso${ps.length === 1 ? '' : 's'} preliminar${ps.length === 1 ? '' : 'es'}</button>` : ''}`;
      const b = box.querySelector('[data-pre]');
      if (b) b.onclick = () => { if (!confirm(`¿Armar ${ps.length} casos preliminares desde el ICE?`)) return; b.disabled = true;
        App.guard(async () => { for (const x of ps) await App.create('cases', x.pre.caso); App.toast(`Listo: ${ps.length} casos preliminares`); pintar(); }).finally(() => { b.disabled = false; }); };
    };
    pintar(); return box;
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
      const pre = preliminar(App.byId('projects', pid));
      if (pre && !ro) { const box = $('.empty-box', el); if (box) box.insertAdjacentHTML('beforeend', `<div class="cs-prelim" style="margin-top:12px;text-align:left">⤴ <span>Esta iniciativa ya tiene ${esc(pre.porque)}. <b>Arma un caso preliminar</b> con ese valor y complétalo después.</span><button class="btn primary sm" data-c="crear-ice">Armar caso desde el ICE</button></div>`); }
      const bi = $('[data-c=crear-ice]', el); if (bi) bi.onclick = () => App.guard(async () => { await App.create('cases', pre.caso); App.toast('Caso preliminar creado'); App.render(); });
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
      const k = (v, l, cls, t) => `<span${t ? ` title="${esc(t)}"` : ''}><b class="${cls || ''}">${v}</b>${l}</span>`;
      const dos = App.Avance ? App.Avance.dosAnios(f) : 0, inc = dos > 0 ? App.ICE.BANDAS_INCOME.find(([lim]) => dos <= lim)[1] : null;
      const sinInv = !(f.totalInversion > 0);
      return (sinInv ? k('—', 'VPN y TIR: aparecen al poner la inversión', '', 'Sin inversión el VPN y la TIR saldrían inflados') :
        k(esc(App.moneyShort(f.vpn, mon)), 'VPN', f.vpn == null ? '' : f.vpn >= 0 ? 'good' : 'bad', `Tasa de descuento ${App.num(c.tasa, 2) || 0} %`) +
        k(esc(App.pct(f.tir)), 'TIR', f.tir == null ? '' : f.tir * 100 >= (c.tasa || 0) ? 'good' : 'bad', f.tirMultiple ? 'El flujo cambia de signo varias veces: puede haber otra TIR' : '') +
        k(f.payback == null ? '—' : esc(App.num(f.payback, 1)) + ' años', 'payback', '', 'Años para recuperar la inversión') +
        k(esc(App.pct(f.roi)), 'ROI', f.roi == null ? '' : f.roi >= 0 ? 'good' : 'bad')) +
        k(esc(App.moneyShort(dos, mon)), `valor a dos años${inc ? ` → Income ${inc}` : ''}`, '', 'Beneficios de los dos primeros años con beneficios: la base del Income del ICE');
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

    const llenos = ['sponsor', 'fecha_comite', ...SECCIONES.map(x => x[0])].filter(k => String(c[k] || '').trim()).length;
    const paso = (n, t, sub, extra) => `<div class="t-paso"><i>${n}</i><b>${t}</b><small>${sub}</small><span class="sp"></span>${extra || ''}</div>`;
    el.innerHTML = `<div class="cs-top"><div class="kl" id="cKpi"></div><span class="sp"></span>
        <select class="estado-sel cl-${estadoColor(c.estado)}" data-f="estado" ${dis} title="Estado del caso">${ESTADOS.map(e => `<option ${e.name === (c.estado || 'Borrador') ? 'selected' : ''}>${e.name}</option>`).join('')}</select>
        <span class="no-print cs-acc">${ro ? '' : '<button class="btn sm" data-c="importar">⇪ Subir Excel</button>'}<a class="btn sm" href="/api/cases/${c.id}/excel" download>⇩ Excel</a><button class="btn sm" data-c="print">⎙ PDF</button></span>
        <input type="file" accept=".xlsx" data-c="archivo" hidden></div>
      ${c.origen === 'ice' ? `<div class="cs-prelim">⚠️ <span><b>Caso preliminar, construido desde el ICE.</b> Las cifras son una estimación: reemplázalas con las reales y agrega la inversión cuando el equipo las tenga.</span>${ro ? '' : '<button class="btn sm" data-c="prelim-ok">Ya tiene cifras reales</button>'}</div>` : ''}
      ${paso(1, 'Flujo del caso', 'barras: flujo neto de cada año · línea: acumulado')}
      <section class="t-card t-pad"><div id="cChart" class="cf-chart"></div></section>
      ${paso(2, 'Tabla del caso', 'se edita como Excel: celdas, filas, años y fórmulas', `<div class="seg no-print" title="Cómo se muestran y se escriben las cifras">${ESCALAS.map(([v, l]) => `<button data-escala="${v}" class="${v === escala ? 'on' : ''}">${l}</button>`).join('')}</div>${ro ? '' : '<button class="btn sm no-print" data-c="undo" title="Deshacer (Ctrl+Z)">↶</button><button class="btn sm no-print" data-c="redo" title="Rehacer (Ctrl+Y)">↷</button>'}<button class="btn sm no-print" data-c="atajos">? Atajos</button>`)}
      <section class="t-card t-pad">
        <div class="cs-param"><span class="cs-pt">Parámetros</span>
          <label>Moneda <select class="fld" data-f="moneda" ${dis}>${['COP', 'USD'].map(m => `<option ${m === mon ? 'selected' : ''}>${m}</option>`).join('')}</select></label>
          <label>Tasa de descuento <input class="fld" type="number" step="0.1" data-f="tasa" value="${esc(c.tasa ?? '')}" ${dis}> %</label>
          <label>Año 0 <input class="fld" type="number" data-f="anio_inicio" value="${esc(c.anio_inicio ?? '')}" placeholder="${new Date().getFullYear()}" ${dis}></label>
          <label>Horizonte <select class="fld" data-f="anios" ${dis}>${Array.from({ length: App.Hoja.MAXY }, (_, i) => i + 1).map(y => `<option value="${y}" ${y === n() - 1 ? 'selected' : ''}>${y} ${y === 1 ? 'año' : 'años'}</option>`).join('')}</select></label>
          ${ro ? '' : '<a class="t-lnk" href="/api/cases/plantilla/excel" download>Plantilla vacía</a>'}</div>
        <div class="help" style="margin:2px 0 8px">Cifras en ${escala === 1 ? '' : escala === 1e3 ? 'miles de ' : 'millones de '}${esc(mon)}. El año 0 es el arranque. Copia y pega desde Excel, usa flechas y Enter, =150*12, 1,2M o +5% sobre el año anterior. <b>Fórmulas entre filas:</b> <code>=[Unidades vendidas]*[Precio promedio]*(1-[Comisión])</code> toma cada fila del mismo año y se recalcula sola. Flujo neto y acumulado se calculan solos.</div>
        <div class="flujo-wrap hoja-wrap" id="cFlujo"></div>
      </section>
      ${paso(3, 'Escenarios y margen de seguridad', 'cambia los porcentajes y mira cómo se mueve el caso')}
      <section class="t-card t-pad"><div id="cSens"></div></section>
      ${paso(4, 'Valor captado (real)', 'lo que la iniciativa ya generó, mes a mes')}
      <section class="t-card t-pad" id="cCapt"></section>
      ${paso(5, 'Contexto para el comité', 'lo que no son cifras')}
      <details class="t-card cs-ctx" ${llenos ? '' : 'open'}><summary><b>Sponsor · fecha de comité · problema · objetivo · alcance · riesgos · recomendación</b><span class="faint"> — ${llenos} de ${SECCIONES.length + 2} llenos</span><span class="t-lnk cs-abrir">Abrir ▾</span></summary>
        <div class="cs-ctx-in"><div class="cs-param"><label>Sponsor <input class="fld" data-f="sponsor" value="${esc(c.sponsor || '')}" ${dis} placeholder="Quién lo patrocina"></label><label>Fecha de comité <input class="fld" type="date" data-f="fecha_comite" value="${esc(c.fecha_comite || '')}" ${dis}></label></div>
        ${SECCIONES.map(([k, t, h], i) => `<div class="sec"><h3><span class="nm">${i + 1}</span>${t}</h3><div class="help">${h}</div><textarea class="fld" data-f="${k}" rows="3" ${dis} placeholder="${ro ? '' : 'Escribe aquí…'}">${esc(c[k] || '')}</textarea></div>`).join('')}</div></details>
      <div class="meta-line">${c.updated_by_name ? `Última edición: ${esc(c.updated_by_name)}, ${esc(App.d.ago(c.updated_at))}` : ''}${ro ? '' : ' · <button class="t-lnk" data-c="del" style="color:var(--crit)">Eliminar caso</button>'}</div>`;

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

    // Valor captado (real), mes a mes, por tipo de valor
    const cap = JSON.parse(JSON.stringify(c.captado || []));
    const y0 = App.anioCero(c), hoyY = Number(App.d.today().slice(0, 4)), hoyM = Number(App.d.today().slice(5, 7));
    let anioCap = Math.min(Math.max(hoyY, y0), y0 + n() - 1);
    const extraCats = new Set();
    let tCap = null;
    const saveCap = () => { clearTimeout(tCap); tCap = setTimeout(() => { tCap = null; App.patch('cases', c.id, { captado: cap }).catch(() => {}); }, 500); };
    const capVal = (mes, cat) => { const e = cap.find(x => x.mes === mes && x.categoria === cat); return e ? Number(e.valor) || 0 : 0; };
    const setCap = (mes, cat, v) => { const i = cap.findIndex(x => x.mes === mes && x.categoria === cat); if (!v) { if (i >= 0) cap.splice(i, 1); } else if (i >= 0) cap[i].valor = v; else cap.push({ mes, categoria: cat, valor: v }); };
    const esperadoAnual = (cat, year) => { const t = year - y0; if (t < 0 || t >= n()) return 0; return fl.filter(f => f.tipo === 'beneficio' && App.catOf(f) === cat).reduce((a, f) => a + (Number((f.valores || [])[t]) || 0), 0); };
    const dec = escala === 1 ? 0 : 2, show = v => (v ? App.num(v / escala, dec) : ''), fmt = v => App.num(v / escala, dec);
    const meses = () => Array.from({ length: 12 }, (_, i) => `${anioCap}-${String(i + 1).padStart(2, '0')}`);
    const capCats = () => {
      const ben = fl.filter(f => f.tipo === 'beneficio').map(App.catOf), con = cap.filter(x => x.mes.startsWith(anioCap + '-')).map(x => x.categoria);
      return App.CATS.map(x => x.id).filter(id => ben.includes(id) || con.includes(id) || extraCats.has(id));
    };
    function resumenCap() {
      const cats = capCats(), ms = meses();
      const totMes = ms.map(m => cats.reduce((a, k) => a + capVal(m, k), 0));
      const espMes = cats.reduce((a, k) => a + esperadoAnual(k, anioCap), 0) / 12;
      const corrido = anioCap < hoyY ? 12 : anioCap > hoyY ? 0 : hoyM - 1 + Number(App.d.today().slice(8)) / new Date(Date.UTC(hoyY, hoyM, 0)).getUTCDate();
      const captado = totMes.reduce((a, b) => a + b, 0), esperado = espMes * corrido, pc = esperado > 0 ? captado / esperado : null;
      return { cats, ms, totMes, espMes, captado, esperado, pc };
    }
    const sumHTML = r => {
      const est = r.pc == null ? null : r.pc >= 0.9 ? ['good', '✓', 'En meta'] : r.pc >= 0.7 ? ['warning', '!', 'Por debajo'] : ['critical', '✕', 'Rezagado'];
      return est ? `<div class="cap-sum st-${est[0]}"><span class="ico">${est[1]}</span><b>${esc(est[2])}:</b> captado ${esc(App.moneyShort(r.captado, mon))} de ${esc(App.moneyShort(r.esperado, mon))} esperados a la fecha en ${anioCap} (${esc(App.pct(r.pc))})</div>`
        : `<div class="cap-sum">${r.espMes ? `${anioCap} aún no empieza: no hay valor esperado a la fecha.` : `Este caso no proyecta beneficios para ${anioCap}.`}</div>`;
    };
    function updateCap() { // solo totales y resumen: los campos no se redibujan (Tab y Enter no pierden el foco)
      const box = $('#cCapt', el), r = resumenCap();
      $('#capSum', box).innerHTML = sumHTML(r);
      r.cats.forEach(k => { const td = $(`[data-capt="${k}"]`, box); if (td) td.innerHTML = `<b>${esc(fmt(r.ms.reduce((a, m) => a + capVal(m, k), 0)))}</b>`; });
      r.totMes.forEach((v, i) => { const td = $(`[data-captm="${i}"]`, box); if (td) td.textContent = fmt(v); });
      const tt = $('[data-capt="_tot"]', box); if (tt) tt.innerHTML = `<b>${esc(fmt(r.captado))}</b>`;
    }
    function renderCap() {
      const box = $('#cCapt', el); if (!box) return;
      const r = resumenCap();
      const futuro = m => anioCap > hoyY || (anioCap === hoyY && Number(m.slice(5)) > hoyM);
      box.innerHTML = `<div class="hoja-top"><span class="sp"></span>
          <div class="seg">${Array.from({ length: n() }, (_, t) => y0 + t).map(y => `<button data-capy="${y}" class="${y === anioCap ? 'on' : ''}">${y}</button>`).join('')}</div></div>
        <div class="help" style="margin:4px 0 10px">Registra cada mes lo que el proyecto ya generó, por tipo de valor. El tablero lo compara con lo que el caso proyecta a la fecha. Cifras en ${escala === 1 ? '' : escala === 1e3 ? 'miles de ' : 'millones de '}${esc(mon)}; acepta 1,2M, 300k y =fórmulas.</div>
        <div id="capSum">${sumHTML(r)}</div>
        ${r.cats.length ? `<div class="flujo-wrap"><table class="cap-tbl"><thead><tr><th>Tipo de valor</th>${r.ms.map(m => `<th class="${futuro(m) ? 'fut' : ''}">${App.d.MES3[Number(m.slice(5)) - 1]}</th>`).join('')}<th>Total</th><th>Esperado año</th></tr></thead><tbody>
          ${r.cats.map(k => `<tr><td><span class="cat-dot cat-${k}"></span>${esc(App.catLabel(k))}</td>${r.ms.map(m => `<td class="${futuro(m) ? 'fut' : ''}"><input data-capm="${m}" data-capc="${k}" value="${esc(show(capVal(m, k)))}" inputmode="decimal" ${dis} placeholder="·"></td>`).join('')}<td class="n" data-capt="${k}"><b>${esc(fmt(r.ms.reduce((a, m) => a + capVal(m, k), 0)))}</b></td><td class="n faint">${esc(fmt(esperadoAnual(k, anioCap)))}</td></tr>`).join('')}
          <tr class="tot"><td>Captado</td>${r.totMes.map((v, i) => `<td class="n" data-captm="${i}">${esc(fmt(v))}</td>`).join('')}<td class="n" data-capt="_tot"><b>${esc(fmt(r.captado))}</b></td><td></td></tr>
          <tr class="tot"><td>Esperado</td>${r.ms.map(() => `<td class="n faint">${esc(fmt(r.espMes))}</td>`).join('')}<td class="n faint">${esc(fmt(r.espMes * 12))}</td><td></td></tr>
        </tbody></table></div>` : '<div class="faint" style="font-size:12.5px">Agrega beneficios al flujo para registrar lo captado.</div>'}
        ${ro ? '' : `<div style="margin-top:8px"><select class="fld" data-capnew style="width:auto"><option value="">+ Otro tipo de valor…</option>${App.CATS.filter(x => !r.cats.includes(x.id)).map(x => `<option value="${x.id}">${esc(x.label)}</option>`).join('')}</select></div>`}<div id="cEvid"></div>`;
      if (App.vista && App.vista.nueva) App.Mejoras.evidenciaEditor($('#cEvid', box), c, anioCap, ro);
    }
    renderCap();
    $('#cCapt', el).addEventListener('change', e => {
      const t = e.target;
      if (t.dataset.capm) {
        const v = App.Hoja.parseCell(t.value, 0, escala);
        if (v == null) { App.toast(`No entendí «${t.value}». Escribe un número, 1,2M, 300k o =fórmula`, true); t.value = show(capVal(t.dataset.capm, t.dataset.capc)); return; }
        setCap(t.dataset.capm, t.dataset.capc, v); t.value = show(v); saveCap(); updateCap();
      }
      if (t.dataset.capnew !== undefined && t.value) { extraCats.add(t.value); renderCap(); }
    });
    $('#cCapt', el).addEventListener('focusin', e => { if (e.target.dataset && e.target.dataset.capm) e.target.select(); });
    $('#cCapt', el).addEventListener('click', e => { const b = e.target.closest('[data-capy]'); if (b) { anioCap = Number(b.dataset.capy); renderCap(); } });
    $('#cCapt', el).addEventListener('keydown', e => { // Enter baja a la fila siguiente, como en Excel
      const t = e.target; if (!t.dataset || !t.dataset.capm || e.key !== 'Enter') return;
      e.preventDefault(); const nx = $(`[data-capm="${t.dataset.capm}"]`, $('#cCapt', el).querySelectorAll('tbody tr')[[...$('#cCapt', el).querySelectorAll('tbody tr')].indexOf(t.closest('tr')) + 1] || document.createElement('tr'));
      t.blur(); if (nx) nx.focus(); else t.focus();
    });

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
      if (a === 'prelim-ok') return App.guard(async () => { await App.patch('cases', c.id, { origen: '' }); editor(el, pid); });
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
        <div><b>=[Unidades]*[Precio]</b><span>fórmula con otras filas (mismo año); al llenar se copia</span></div>
        <div><b>5%</b><span>en una fila de supuestos: porcentaje</span></div>
        <div><b>+5% · −3%</b><span>sobre el valor del año anterior</span></div>
        <div><b>(1.200)</b><span>número negativo</span></div>
        <div><b>··· en cada fila</b><span>repetir, crecer un %, repartir un total</span></div></div>`, { width: 380, nofocus: true });
      if (a === 'del') { if (!confirm('¿Eliminar el caso de negocio de este proyecto? Se pierde toda su información.')) return; App.guard(async () => { await App.remove('cases', c.id); App.render(); }); }
    };
  }

  /* ---------- sección «Casos de negocio» ---------- */
  /* ---------- lista de casos (Casos de negocio) ---------- */
  const CF = Object.assign({ q: '', estado: '', fase: '', cat: '', modo: 'cap' }, App.store.get('casos.f', {}));
  const guardarCF = () => App.store.set('casos.f', { estado: CF.estado, fase: CF.fase, cat: CF.cat, modo: CF.modo });
  const GRUPOS = [
    { k: 'rev', t: 'Por aprobar en comité', de: e => e === 'En revisión' },
    { k: 'apr', t: 'Aprobados', de: e => e === 'Aprobado' },
    { k: 'bor', t: 'Borradores', de: e => !e || e === 'Borrador' },
    { k: 'apl', t: 'Aplazados o rechazados', de: e => e === 'Aplazado' || e === 'Rechazado' },
  ];
  const supuestoClave = c => {
    const t = String(c.supuestos || '').split(/\n|•|;|\. /).map(x => x.replace(/^[-*\s]+/, '').trim()).find(Boolean);
    if (t) return t;
    const r = (c.flujos || []).find(x => x && x.tipo === 'supuesto' && (x.concepto || '').trim());
    return r ? r.concepto.trim() : '';
  };
  const responsablesDe = p => { const v = p.props || {}; return [].concat(v.habilitadores || [], v.realizadores || []).filter(Boolean).slice(0, 2); };

  function section(main, params) {
    if (params[0]) return detalle(main, params[0]);
    const D = App.Dash.datos({}), Y = D.Y, frac = D.corrido / 12;
    const porId = new Map(D.proyectos.map(x => [x.p.id, x]));
    const ec = App.estadoCol();
    const todos = App.projectsSorted().map(p => {
      const c = App.caseOf(p.id), x = porId.get(p.id), f = c ? Finanzas.calc(c) : null;
      const usd = c && c.moneda === 'USD';
      const proy = x && !usd ? D.cats.reduce((a, k) => a + x.anual(k, Y), 0) : 0;
      const cap = x && !usd ? D.cats.reduce((a, k) => a + x.captado(k, Y), 0) : 0;
      const cats = c ? [...new Set((c.flujos || []).filter(fl => fl && fl.tipo === 'beneficio').map(App.catOf))] : [];
      const est = ec ? (p.props || {})[ec.id] || '' : '', fase = window.Fases ? Fases.clasificar(est) : null;
      return { p, c, f, usd, proy, cap, esp: proy * frac, cats, est, fase };
    });
    const casos = todos.filter(r => r.c);
    const nq = App.norm ? App.norm(CF.q) : CF.q.toLowerCase();
    const pasa = r => (!CF.q || (App.norm ? App.norm(App.projectName(r.p)) : App.projectName(r.p).toLowerCase()).includes(nq))
      && (!CF.estado || (CF.estado === 'Sin caso' ? !r.c : r.c && (r.c.estado || 'Borrador') === CF.estado))
      && (!CF.fase || String(r.fase) === CF.fase)
      && (!CF.cat || r.cats.includes(CF.cat));
    const vis = todos.filter(pasa);
    const aprob = casos.filter(r => r.c.estado === 'Aprobado'), aprobCOP = aprob.filter(r => !r.usd), nUSD = aprob.length - aprobCOP.length;
    const vpnAprob = aprobCOP.reduce((a, r) => a + (Number.isFinite(r.f.vpn) ? r.f.vpn : 0), 0);
    const capT = casos.reduce((a, r) => a + r.cap, 0), proyT = casos.reduce((a, r) => a + r.proy, 0);
    const nRev = casos.filter(r => r.c.estado === 'En revisión').length;
    const m = v => App.moneyShort(v);
    const cap = CF.modo === 'cap';
    const bullet = r => {
      if (!r.c) return '';
      if (r.usd) return '<span class="faint">Caso en USD: va aparte</span>';
      if (!r.proy) return `<span class="faint">Sin flujos en ${Y}</span>`;
      const w = Math.min(100, r.cap / r.proy * 100), e = Math.min(100, r.esp / r.proy * 100);
      const bajo = D.corrido > 0 && r.cap < r.esp * 0.9;
      return `<span class="cn-bul ${bajo ? 'bajo' : ''}" title="Captado ${esc(m(r.cap))} de ${esc(m(r.proy))} proyectado en ${Y} · esperado a hoy ${esc(m(r.esp))}"><span class="t"><i style="width:${w}%"></i>${D.corrido > 0 ? `<u style="left:${e}%"></u>` : ''}</span><span class="v"><b>${esc(m(r.cap))}</b> / ${esc(m(r.proy))}</span></span>`;
    };
    const fila = r => {
      const nm = esc(App.projectName(r.p)), per = responsablesDe(r.p);
      const sub = `${per.map(n => `<span class="pf-per" title="${esc(n)}"><i class="cl-${App.colorPersona(n)}"></i>${esc(n)}</span>`).join('')}${r.est ? `<span class="cn-fase">${esc(window.Fases && Fases.de(r.est) ? Fases.de(r.est).corto : r.est)}</span>` : ''}`;
      if (!r.c) return `<tr class="cn-sin" data-pid="${r.p.id}"><td class="pf-nm"><b>${nm}</b><small>${sub}</small></td><td colspan="8" class="faint">${App.canEdit() ? '<span class="t-lnk">+ Crear caso de negocio</span> · ' : ''}${(r.p.props || {}).income ? `con su Income se arma un caso preliminar` : 'sin caso todavía'}</td><td class="cn-go">↗</td></tr>`;
      const c = r.c, f = r.f, mo = c.moneda, sc = supuestoClave(c);
      return `<tr data-pid="${r.p.id}"><td class="pf-nm"><b title="${nm}">${nm}</b><small>${sub}</small></td>
        <td><span class="pill cl-${estadoColor(c.estado)}">${esc(c.estado || 'Borrador')}</span>${c.origen === 'ice' ? ' <span class="cn-pre" title="Caso preliminar construido desde el ICE">preliminar</span>' : ''}</td>
        <td class="n">${f.totalInversion ? esc(App.moneyShort(f.totalInversion, mo)) : '<span class="faint">—</span>'}</td>
        <td class="n cn-vpn">${f.vpn == null || !f.totalInversion ? '<span class="faint">—</span>' : `<b class="${f.vpn >= 0 ? '' : 'neg'}">${esc(App.moneyShort(f.vpn, mo))}</b>`}</td>
        <td class="n">${f.tir == null ? '<span class="faint">—</span>' : esc(App.pct(f.tir))}</td>
        <td class="n">${f.payback == null ? '<span class="faint">—</span>' : esc(App.num(f.payback, 1)) + ' años'}</td>
        <td>${cap ? bullet(r) : `<span class="cn-proy"><b>${r.proy ? esc(m(r.proy)) : '—'}</b> <small>${esc(App.moneyShort(f.totalBeneficio, mo))} en ${Math.round(c.anios || 0)} años</small></span>`}</td>
        <td class="cn-sup" title="${esc(sc)}">${sc ? esc(sc) : '<span class="faint">—</span>'}</td>
        <td class="cn-act">${c.updated_at ? esc(App.d.ago(c.updated_at)) : ''}</td><td class="cn-go">↗</td></tr>`;
    };
    const grupos = GRUPOS.map(g => ({ g, l: vis.filter(r => r.c && g.de(r.c.estado)) })).filter(z => z.l.length);
    const sin = vis.filter(r => !r.c);
    const COLS = 10;
    const cuerpo = grupos.map(z => `<tr class="cn-grp"><td colspan="${COLS}"><b>${z.g.t}</b> <small>${z.l.length} ${z.l.length === 1 ? 'caso' : 'casos'}</small></td></tr>${z.l.map(fila).join('')}`).join('')
      + (sin.length ? `<tr class="cn-grp"><td colspan="${COLS}"><b>Sin caso de negocio</b> <small>${sin.length} ${sin.length === 1 ? 'iniciativa' : 'iniciativas'}</small></td></tr>${sin.map(fila).join('')}` : '');
    const sel = (attr, label, val, opts) => `<label class="cn-f"><span>${label}</span><select data-cf="${attr}">${opts.map(([v, t]) => `<option value="${esc(v)}" ${String(val) === String(v) ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>`;
    main.innerHTML = `<div class="pg-top"><button class="burger" data-act="burger" aria-label="Menú">☰</button><h1>Casos de negocio</h1>
        <div class="kl"><span><b>${casos.length}</b>${casos.length === 1 ? 'caso' : 'casos'}</span><span><b>${esc(m(vpnAprob))}</b>VPN total aprobado${nUSD ? ` · ${nUSD} en USD aparte` : ''}</span><span><b>${esc(m(capT))}</b>captado ${Y} de ${esc(m(proyT))}</span><span><b class="${nRev ? 'r' : ''}">${nRev}</b>por aprobar en comité</span></div>
        <span class="sp"></span><button class="btn ghost sm" data-cn="csv">Exportar a Excel</button>${App.canEdit() ? '<button class="btn primary sm" data-cn="nuevo">+ Nuevo caso</button>' : ''}</div>
      <div class="pf-bar"><label class="search"><span>⌕</span><input id="cnq" placeholder="Buscar caso o iniciativa…" value="${esc(CF.q)}"></label>
        ${sel('estado', 'Estado', CF.estado, [['', 'Todos'], ...ESTADOS.map(e => [e.name, e.name]), ['Sin caso', 'Sin caso']])}
        ${sel('fase', 'Etapa', CF.fase, [['', 'Todas'], ...(window.Fases ? Fases.FASES.map(x => [String(x.id), x.fuera ? x.nombre : x.corto + ' · ' + x.nombre.split(' · ')[1].split(',')[0]]) : [])])}
        ${sel('cat', 'Tipo de valor', CF.cat, [['', 'Todos'], ...App.CATS.map(x => [x.id, App.catLabel(x.id)])])}
        <span class="sp"></span><div class="seg"><button data-modo="cap" class="${cap ? 'on' : ''}" aria-pressed="${cap}">Captado vs. proyectado</button><button data-modo="proy" class="${cap ? '' : 'on'}" aria-pressed="${!cap}">Proyectado</button></div></div>
      <section class="t-card pf-tbl-card"><div class="pf-wrap"><table class="pf-tbl cn-tbl">
        <thead><tr><th>Iniciativa <small>responsables · fase</small></th><th>Estado del caso</th><th class="n">Inversión</th><th class="n">VPN</th><th class="n">TIR</th><th class="n">Payback</th>
          <th>${cap ? `Captado ${Y} <small>real / proyectado · ┃ esperado a hoy</small>` : `Beneficio ${Y} <small>proyectado · total del caso</small>`}</th><th>Supuesto clave</th><th>Actualizado</th><th></th></tr></thead>
        <tbody>${cuerpo || `<tr><td colspan="${COLS}"><div class="t-vacio">${todos.length ? 'Ningún caso cumple estos filtros.' : 'Aún no hay iniciativas.'}</div></td></tr>`}</tbody></table></div>
        <div class="t-pie t-pie-row"><span class="t-tag">Clic en una fila abre el caso con su tabla y flujos</span><span class="t-tag">Cifras en pesos · VPN con la tasa de descuento de cada caso${D.usd ? ' · casos en USD aparte' : ''}</span></div></section>`;
    const q = $('#cnq', main);
    q.oninput = () => { CF.q = q.value; const pos = q.selectionStart; section(main, params); const n = $('#cnq', main); n.focus(); n.setSelectionRange(pos, pos); };
    main.onchange = e => { const s2 = e.target.closest('[data-cf]'); if (s2) { CF[s2.dataset.cf] = s2.value; guardarCF(); section(main, params); } };
    main.onclick = e => {
      if (e.target.closest('.burger')) return App.toggleSide();
      const md = e.target.closest('[data-modo]'); if (md) { CF.modo = md.dataset.modo; guardarCF(); return section(main, params); }
      const b = e.target.closest('[data-cn]');
      if (b && b.dataset.cn === 'csv') return csvCasos(vis.filter(r => r.c), Y);
      if (b && b.dataset.cn === 'nuevo') return nuevoCaso2(b);
      const r = e.target.closest('tr[data-pid]'); if (r) App.go('#/casos/' + r.dataset.pid);
    };
  }
  function nuevoCaso2(btn) {
    const sin = App.projectsSorted().filter(p => !App.caseOf(p.id));
    const pop = App.openPop(btn, `<div class="lbl">¿Para qué iniciativa es el caso?</div>
      ${sin.length ? `<div style="padding:0 10px 6px"><input class="fld" data-n="q" placeholder="Buscar iniciativa…" style="width:100%"></div><div data-n="l" style="max-height:300px;overflow:auto">${sin.map(p => `<button class="mi" data-n-pid="${p.id}">${esc(App.projectName(p))}</button>`).join('')}</div>`
        : '<div style="padding:4px 12px 10px" class="faint">Todas las iniciativas ya tienen caso. Crea primero la iniciativa en Portafolio.</div>'}`, { width: 340 });
    const q = pop.querySelector('[data-n=q]'); if (q) { q.focus(); q.oninput = () => { const t = q.value.toLowerCase(); pop.querySelectorAll('[data-n-pid]').forEach(b => { b.style.display = b.textContent.toLowerCase().includes(t) ? '' : 'none'; }); }; }
    pop.onclick = e => { const b = e.target.closest('[data-n-pid]'); if (b) { App.closePop(true); App.go('#/casos/' + b.dataset.nPid); } };
  }
  function csvCasos(lista, Y) {
    const cell = v => { let s = String(v == null ? '' : v); if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+([.,]\d+)?$/.test(s)) s = "'" + s; return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const head = ['Iniciativa', 'Estado del caso', 'Moneda', 'Inversión', 'Beneficio total', 'VPN', 'TIR %', 'Payback (años)', 'Proyectado ' + Y, 'Captado ' + Y, 'Esperado a hoy', 'Supuesto clave', 'Sponsor', 'Actualizado'];
    const lines = [head.map(cell).join(';'), ...lista.map(r => [App.projectName(r.p), r.c.estado || 'Borrador', r.c.moneda || 'COP', Math.round(r.f.totalInversion) || '', Math.round(r.f.totalBeneficio) || '', r.f.vpn != null ? Math.round(r.f.vpn) : '', r.f.tir != null ? Math.round(r.f.tir * 1000) / 10 : '', r.f.payback != null ? Math.round(r.f.payback * 10) / 10 : '', Math.round(r.proy) || '', Math.round(r.cap) || '', Math.round(r.esp) || '', supuestoClave(r.c), r.c.sponsor || '', (r.c.updated_at || '').slice(0, 10)].map(cell).join(';'))];
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'casos-de-negocio-' + App.d.today() + '.csv'; a.click(); URL.revokeObjectURL(a.href);
  }
  function detalle(main, pid) {
    const p = App.byId('projects', pid);
    if (!p) { main.innerHTML = '<div class="empty-box"><b>Proyecto no encontrado</b><a href="#/casos" class="back">← Casos de negocio</a></div>'; return; }
    main.innerHTML = `<div class="page-h"><button class="burger" data-act="burger">☰</button><a class="back" href="#/casos">← Casos de negocio</a><div><h1>${esc(App.projectName(p))}</h1><div class="sub">Caso de negocio</div></div><span class="sp"></span><a class="btn" href="#/proyectos/${pid}">Ver proyecto →</a></div><div id="cBox"></div>`;
    main.onclick = e => { if (e.target.closest('.burger')) App.toggleSide(); };
    editor($('#cBox', main), pid);
  }

  App.Caso = { editor, estadoColor, ESTADOS, preliminar, tarjetaPreliminares };
  window.addEventListener('pagehide', () => { if (App.Caso._flush) App.Caso._flush(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && App.Caso._flush) App.Caso._flush(); });
  App.views.casos = { render: section };
})();
