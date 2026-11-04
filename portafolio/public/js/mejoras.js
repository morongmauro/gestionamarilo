/* ============================================================
   VISTA MEJORADA · las piezas nuevas
   «Qué es la Dirección» · evidencia detrás de la cifra · decisiones del
   comité · próximos hitos · preparar el comité · proponer una necesidad ·
   lista de desactualizados. Todo se usa solo cuando App.vista.nueva es true.
   ============================================================ */
'use strict';
(function () {
  const { $, $$, esc } = App;
  const hoy = () => App.d.today();

  /* ---------- siglas con explicación ---------- */
  const SIGLAS = {
    VPN: 'Valor presente neto: lo que vale hoy el flujo del caso, descontado a la tasa',
    TIR: 'Tasa interna de retorno: la rentabilidad anual del caso',
    ICE: 'Impacto × Confianza × Facilidad (cada uno de 1 a 10): prioridad relativa',
    ROI: 'Retorno sobre la inversión: (beneficio − egresos) / egresos',
    Payback: 'Años que tarda en recuperarse la inversión',
    Income: 'Valor anual estimado cuando aún no hay caso de negocio',
    Habilitador: 'Quien patrocina la iniciativa y abre puertas en su área',
    Realizador: 'Quien ejecuta la iniciativa día a día',
  };
  const sigla = k => (SIGLAS[k] ? `<abbr class="sg" title="${esc(SIGLAS[k])}">${esc(k)}</abbr>` : esc(k));

  /* ---------- «Qué es la Dirección» ---------- */
  const QUE_ES_DEF = 'La Dirección de Generación de Valor convierte necesidades de las áreas en iniciativas con caso de negocio, las ejecuta con cronograma y las lleva a comité hasta que el valor se captura y se comprueba.\nCada peso que aparece aquí tiene una iniciativa, un responsable y una fuente detrás.';
  function direccion() { return Object.assign({ que_es: '', correo_propuestas: '', responsable_propuestas: '' }, App.S.direccion || {}); }
  function queEs() {
    const d = direccion(), txt = (d.que_es || QUE_ES_DEF).split('\n').filter(Boolean);
    return `<div class="dash-card span-12 que-es"><div class="qe-t">Qué es la Dirección</div>
      <div class="qe-b">${txt.map(l => `<p>${esc(l)}</p>`).join('')}</div>
      <div class="qe-a"><a class="btn amarillo" href="#/proponer">Proponer una necesidad</a><a class="btn ghost" href="#/proyectos">Ver el portafolio</a>${App.isAdmin() ? '<button class="btn ghost" data-qe="editar">Editar este texto</button>' : ''}</div></div>`;
  }
  function editarQueEs(anchor) {
    const d = direccion();
    const p = App.openPop(anchor, `<div class="lbl">Qué es la Dirección (dos o tres líneas)</div><textarea rows="5" data-qe="txt" placeholder="${esc(QUE_ES_DEF)}">${esc(d.que_es || '')}</textarea>
      <div class="lbl">Correo que recibe las propuestas</div><input data-qe="correo" value="${esc(d.correo_propuestas || '')}" placeholder="valor@amarilo.com">
      <div class="lbl">Quién responde las propuestas</div><input data-qe="resp" value="${esc(d.responsable_propuestas || '')}" placeholder="Nombre">
      <div class="row" style="justify-content:flex-end"><button class="btn primary sm" data-qe="ok">Guardar</button></div>`, { width: 420, nofocus: true });
    p.onclick = e => {
      if (!e.target.closest('[data-qe=ok]')) return;
      const v = { que_es: $('[data-qe=txt]', p).value, correo_propuestas: $('[data-qe=correo]', p).value, responsable_propuestas: $('[data-qe=resp]', p).value };
      App.guard(async () => { App.S.direccion = await App.api('PUT', '/api/config/direccion', v); App.closePop(true); App.toast('Guardado'); App.render(); });
    };
  }

  /* ---------- evidencia detrás de la cifra ---------- */
  // Una validación por iniciativa y año: «validado hasta tal mes, por tal persona».
  // Todo lo captado hasta ese mes cuenta como verificado; lo posterior, como preliminar.
  const validacionDe = (caso, anio) => (caso && caso.validacion && caso.validacion[String(anio)]) || null;
  const verificado = (c, caso) => { if (!c || !c.mes) return false; const v = validacionDe(caso, c.mes.slice(0, 4)); return !!(v && v.hasta && c.mes <= v.hasta); };
  function capturasDelAnio(Y, filas) {
    const out = [];
    filas.forEach(x => { if (!x.caso || x.caso.moneda === 'USD') return;
      (x.caso.captado || []).forEach(c => { if (c.mes && c.mes.startsWith(Y + '-') && Number(c.valor)) out.push({ p: x.p, c, caso: x.caso }); }); });
    return out.sort((a, b) => b.c.mes.localeCompare(a.c.mes) || Number(b.c.valor) - Number(a.c.valor));
  }
  const mesLargo = m => (m ? `${App.d.MES3[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}` : '');
  function evidenciaHTML(Y, filas) {
    const caps = capturasDelAnio(Y, filas);
    if (!caps.length) return '<div class="faint" style="padding:8px 0">Aún no hay capturas registradas en este año.</div>';
    const por = new Map();
    caps.forEach(({ p, c, caso }) => { const g = por.get(p.id) || { p, caso, ver: 0, pre: 0, ult: '' }; if (verificado(c, caso)) g.ver += Number(c.valor); else g.pre += Number(c.valor); if (c.mes > g.ult) g.ult = c.mes; por.set(p.id, g); });
    const gs = [...por.values()].sort((a, b) => (b.ver + b.pre) - (a.ver + a.pre));
    return `<table class="lst ev-tbl"><thead><tr><th>Iniciativa</th><th class="n">Capturado</th><th class="n">Verificado</th><th class="n">Preliminar</th><th>Validación</th></tr></thead><tbody>
      ${gs.map(g => { const v = validacionDe(g.caso, Y);
        return `<tr><td><a href="#/proyectos/${g.p.id}/caso">${esc(App.projectName(g.p))}</a></td><td class="n"><b>${esc(App.moneyShort(g.ver + g.pre))}</b></td><td class="n good">${esc(App.moneyShort(g.ver))}</td><td class="n">${esc(App.moneyShort(g.pre))}</td>
          <td>${v && v.hasta ? `hasta ${esc(mesLargo(v.hasta))}${v.por ? ' · ' + esc(v.por) : ''}${v.fecha ? ' · ' + esc(App.d.fmtShort(v.fecha)) : ''}${v.url ? ` · <a href="${esc(v.url)}" target="_blank" rel="noopener">soporte ↗</a>` : ''}` : '<span class="faint">sin validar · capturado hasta ' + esc(mesLargo(g.ult)) + '</span>'}</td></tr>`; }).join('')}
    </tbody></table><div class="faint" style="font-size:12px;margin-top:8px">Verificado = capturado hasta el mes que el área validó. Se marca en el caso de negocio con un clic: «validado hasta…, por…».</div>`;
  }
  // Validación dentro del caso de negocio (lo llama caso.js): una línea, no una tabla
  function evidenciaEditor(box, caso, anio, ro) {
    const caps = (caso.captado || []).filter(c => c.mes && c.mes.startsWith(anio + '-') && Number(c.valor));
    const meses = [...new Set(caps.map(c => c.mes))].sort();
    const v = validacionDe(caso, anio) || {};
    const dis = ro ? 'disabled' : '';
    const ver = caps.filter(c => verificado(c, caso)).reduce((a, c) => a + Number(c.valor), 0), tot = caps.reduce((a, c) => a + Number(c.valor), 0);
    box.innerHTML = `<div class="val-box"><div class="val-t">Validación del valor captado · ${anio}</div>
      ${meses.length ? `<div class="val-r">
        <label>Validado hasta<select class="fld" data-val="hasta" ${dis}><option value="">— sin validar —</option>${meses.map(m => `<option value="${m}" ${m === v.hasta ? 'selected' : ''}>${esc(mesLargo(m))}</option>`).join('')}</select></label>
        <label>Por<input class="fld" data-val="por" value="${esc(v.por || '')}" placeholder="Quién lo confirmó en el área" list="pplList" ${dis}></label>
        <label>Soporte (opcional)<input class="fld" data-val="url" value="${esc(v.url || '')}" placeholder="Enlace al informe o correo" ${dis}></label>
      </div>
      <div class="val-s">${v.hasta ? `<span class="badge good">Verificado ${esc(App.moneyShort(ver))}</span> de ${esc(App.moneyShort(tot))} capturados${v.fecha ? ` · validado el ${esc(App.d.fmtShort(v.fecha))}` : ''}` : `<span class="badge warn">Preliminar ${esc(App.moneyShort(tot))}</span> · nada validado todavía`}</div>`
      : '<div class="faint" style="font-size:12.5px">Cuando registres valor captado en este año, aquí lo marcas como validado en un clic.</div>'}</div>`;
    box.onchange = e => {
      const t = e.target; if (!t.dataset.val) return;
      const val = Object.assign({}, caso.validacion || {}); const cur = Object.assign({}, val[String(anio)] || {});
      cur[t.dataset.val] = t.value;
      if (t.dataset.val === 'hasta') { if (t.value) { cur.fecha = hoy(); if (!cur.por) cur.por = App.S.me.name; } else { delete cur.fecha; } }
      val[String(anio)] = cur; caso.validacion = val;
      App.patch('cases', caso.id, { validacion: val }).then(() => evidenciaEditor(box, caso, anio, ro)).catch(() => {});
    };
  }

  /* ---------- decisiones del comité ---------- */
  const TIPOS_DEC = ['Acelerar', 'Replantear', 'Detener', 'Aprobar caso', 'Aplazar', 'Otra'];
  const decisiones = () => App.S.sessions.flatMap(s => (s.decisiones_reg || []).filter(d => (d.texto || '').trim()).map(d => ({ ...d, s })));
  const decisionesDe = pid => decisiones().filter(d => d.project_id === pid).sort((a, b) => (b.fecha || b.s.fecha).localeCompare(a.fecha || a.s.fecha));
  function decisionHTML(d, conProyecto) {
    const p = d.project_id ? App.byId('projects', d.project_id) : null;
    return `<div class="dec ${d.estado === 'Cumplida' ? 'ok' : ''}"><span class="dec-t">${esc(d.tipo || 'Decisión')}</span><span class="dec-b"><b>${esc(d.texto || '')}</b>${conProyecto && p ? ` · <a href="#/proyectos/${p.id}">${esc(App.projectName(p))}</a>` : ''}<span class="dec-m">${esc(App.d.fmtShort(d.fecha || d.s.fecha))} · ${esc(App.Agenda.tituloOf(d.s))}${d.responsable ? ' · ' + esc(d.responsable) : ''} · ${d.estado === 'Cumplida' ? 'cumplida' : 'pendiente'}</span></span></div>`;
  }
  function decisionesRecientes() {
    const desde = App.d.add(hoy(), -60);
    const lista = decisiones().filter(d => (d.fecha || d.s.fecha) >= desde || d.estado !== 'Cumplida').sort((a, b) => (b.fecha || b.s.fecha).localeCompare(a.fecha || a.s.fecha)).slice(0, 6);
    const prox = App.S.sessions.filter(s => s.fecha >= hoy() && s.estado !== 'Cancelada').sort((a, b) => a.fecha.localeCompare(b.fecha)).slice(0, 3);
    return `<div class="dash-card span-4 card-dec"><h3>Decisiones del comité</h3><div class="sub">Lo decidido en los últimos 60 días y lo que sigue pendiente.</div>
      ${lista.length ? `<div class="decs">${lista.map(d => decisionHTML(d, true)).join('')}</div>` : '<div class="faint" style="padding:6px 0 10px">Aún no hay decisiones registradas. Se anotan en cada sesión de la agenda.</div>'}
      <h3 style="margin-top:14px">Próximos comités</h3>
      ${prox.length ? `<div class="prox">${prox.map(s => `<a href="#/agenda/preparar/${s.id}"><span class="dt"><b>${s.fecha.slice(8)}</b>${esc(App.d.MES3[Number(s.fecha.slice(5, 7)) - 1])}</span><span><b>${esc(App.Agenda.tituloOf(s))}</b><span class="dec-m">${(s.proyectos || []).length} iniciativa${(s.proyectos || []).length === 1 ? '' : 's'} · preparar →</span></span></a>`).join('')}</div>` : '<div class="faint">No hay sesiones programadas.</div>'}</div>`;
  }
  // Editor dentro del cajón de la sesión (lo llama agenda.js)
  function decisionesEditor(box, s, ro) {
    const reg = JSON.parse(JSON.stringify(s.decisiones_reg || []));
    const dis = ro ? 'disabled' : '';
    const proyectos = (s.proyectos || []).map(pid => App.byId('projects', pid)).filter(Boolean);
    const fila = (d, i) => `<div class="dec-ed"><select class="fld" data-di="${i}" data-dk="tipo" ${dis}>${TIPOS_DEC.map(t => `<option ${t === (d.tipo || 'Otra') ? 'selected' : ''}>${t}</option>`).join('')}</select>
      <input class="fld" data-di="${i}" data-dk="texto" value="${esc(d.texto || '')}" placeholder="Qué se decidió" ${dis}>
      <select class="fld" data-di="${i}" data-dk="project_id" ${dis}><option value="">Sin iniciativa</option>${proyectos.map(p => `<option value="${p.id}" ${p.id === d.project_id ? 'selected' : ''}>${esc(App.projectName(p))}</option>`).join('')}</select>
      <input class="fld" data-di="${i}" data-dk="responsable" value="${esc(d.responsable || '')}" placeholder="Responsable" list="pplList" ${dis}>
      <input class="fld" type="date" data-di="${i}" data-dk="fecha" value="${esc(d.fecha || '')}" ${dis} title="Fecha límite">
      <select class="fld" data-di="${i}" data-dk="estado" ${dis}><option ${d.estado !== 'Cumplida' ? 'selected' : ''}>Pendiente</option><option ${d.estado === 'Cumplida' ? 'selected' : ''}>Cumplida</option></select>
      ${ro ? '' : `<button class="btn sm" data-ddel="${i}" title="Quitar">✕</button>`}</div>`;
    const pintar = () => { box.innerHTML = `<h4>Decisiones registradas</h4><div class="help" style="margin-bottom:6px">Una por decisión: qué, sobre cuál iniciativa, quién responde y para cuándo. Aparecen en la ficha y en el inicio.</div><div>${reg.map(fila).join('')}</div>${ro ? '' : '<button class="btn sm" data-dadd="1" style="margin-top:4px">+ Decisión</button>'}`; };
    pintar();
    const guardar = () => App.patch('sessions', s.id, { decisiones_reg: reg }).catch(() => {});
    box.addEventListener('change', e => { const t = e.target; if (t.dataset.di == null) return; reg[+t.dataset.di][t.dataset.dk] = t.value || (t.dataset.dk === 'project_id' ? null : ''); guardar(); });
    box.addEventListener('click', e => {
      if (e.target.closest('[data-dadd]')) { reg.push({ id: App.uid(), tipo: 'Otra', texto: '', project_id: proyectos[0] ? proyectos[0].id : null, responsable: '', fecha: s.fecha, estado: 'Pendiente' }); pintar(); const ins = $$('[data-dk=texto]', box); ins[ins.length - 1].focus(); return; }
      const d = e.target.closest('[data-ddel]'); if (d) { reg.splice(+d.dataset.ddel, 1); pintar(); guardar(); }
    });
  }

  /* ---------- próximos hitos ---------- */
  function hitos(pid, n = 3) {
    return App.actsOf(pid).filter(a => a.hito && (a.avance || 0) < 100 && a.fin).sort((a, b) => a.fin.localeCompare(b.fin)).slice(0, n);
  }
  function hitosHTML(pid) {
    const h = hitos(pid); if (!h.length) return '<span class="faint">sin hitos marcados en el plan</span>';
    return h.map(a => `<span class="hito ${a.fin < hoy() ? 'tarde' : ''}"><b>${esc(App.d.fmtShort(a.fin))}</b> ${esc(a.name)}</span>`).join('');
  }

  /* ---------- iniciativas en realización (inicio) ---------- */
  function enRealizacion(d) {
    const filas = d.filas.filter(x => x.real).sort((a, b) => (a.pc ?? 9) - (b.pc ?? 9));
    if (!filas.length) return '';
    const ec = App.estadoCol();
    return `<div class="dash-card span-8 card-real"><h3>Iniciativas en realización</h3><div class="sub">Estado, avance y lo que viene en cada una.</div>
      <div class="reales">${filas.map(x => { const pl = App.planOf(x.p.id), ultima = decisionesDe(x.p.id)[0];
        return `<a class="real" href="#/proyectos/${x.p.id}"><span class="nm"><b>${esc(App.projectName(x.p))}</b>${ec ? `<span class="pill cl-${App.optColor(ec, x.estado)}">${esc(x.estado || '')}</span>` : ''}${x.p.frase ? `<span class="fr">${esc(x.p.frase)}</span>` : ''}</span>
          <span class="av">${pl.acts.length ? `<span class="bar-mini"><i style="width:${pl.avance}%"></i></span><b>${pl.avance}%</b>${pl.atrasadas ? `<span class="crit"> · ${pl.atrasadas} atrasada${pl.atrasadas > 1 ? 's' : ''}</span>` : ''}` : '<span class="faint">sin cronograma</span>'}</span>
          <span class="hi">${hitosHTML(x.p.id)}</span>
          <span class="dm">${ultima ? `<span class="dec-t">${esc(ultima.tipo)}</span> ${esc(ultima.texto)}` : '<span class="faint">sin decisiones registradas</span>'}</span></a>`; }).join('')}</div></div>`;
  }

  /* ---------- ficha: la historia antes que los campos (lo llama proyecto.js) ---------- */
  function historia(p, { pl, caso, f, prox, ro, d }) {
    const Y = Number(hoy().slice(0, 4));
    const caps = (caso && caso.moneda !== 'USD' ? caso.captado || [] : []).filter(c => c.mes && c.mes.startsWith(Y + '-'));
    const ver = caps.filter(c => verificado(c, caso)).reduce((a, c) => a + (Number(c.valor) || 0), 0), pre = caps.filter(c => !verificado(c, caso)).reduce((a, c) => a + (Number(c.valor) || 0), 0);
    const ultima = decisionesDe(p.id)[0];
    const hab = habilitador(p);
    const porque = caso && (caso.problema || caso.objetivo);
    return `<div class="card-box historia">
      <div class="hs"><div class="hs-k">En una frase</div><div class="hs-v frase ${p.frase ? '' : 'empty'}" data-h="frase">${p.frase ? esc(p.frase) : (ro ? '—' : 'Escribe en una frase qué cambia con esta iniciativa')}</div></div>
      <div class="hs"><div class="hs-k">Por qué existe</div><div class="hs-v">${porque ? `${caso.problema ? `<p><b>Problema u oportunidad.</b> ${esc(caso.problema)}</p>` : ''}${caso.objetivo ? `<p><b>Objetivo.</b> ${esc(caso.objetivo)}</p>` : ''}` : `<span class="faint">Sin caso de negocio todavía${ro ? '' : ' · <a href="#/proyectos/' + p.id + '/caso">crearlo</a>'}</span>`}</div></div>
      <div class="hs"><div class="hs-k">Dónde va</div><div class="hs-v hs-grid">
        <div><span class="l">Avance</span>${pl.acts.length ? `<span class="bar-mini"><i style="width:${pl.avance}%"></i></span> <b>${pl.avance}%</b>${pl.atrasadas ? ` <span class="crit">· ${pl.atrasadas} atrasada${pl.atrasadas > 1 ? 's' : ''}</span>` : ''}` : '<span class="faint">sin cronograma</span>'}</div>
        <div><span class="l">Próximos hitos</span><span class="hitos">${hitosHTML(p.id)}</span></div>
        <div><span class="l">Próximo comité</span>${prox ? `<a href="#/agenda/preparar/${prox.id}"><b>${esc(App.d.fmtShort(prox.fecha))}</b> · ${esc(App.Agenda.tituloOf(prox))}</a>` : '<span class="faint">ninguno programado</span>'}</div>
        <div><span class="l">Última decisión</span>${ultima ? `<span class="dec-t">${esc(ultima.tipo)}</span> ${esc(ultima.texto)} <span class="faint">· ${esc(App.d.fmtShort(ultima.fecha || ultima.s.fecha))}</span>` : '<span class="faint">ninguna registrada</span>'}</div>
      </div></div>
      <div class="hs"><div class="hs-k">Qué vale</div><div class="hs-v hs-grid">
        <div><span class="l">Proyectado ${Y}</span><b>${esc(App.moneyShort(d ? d.proy : 0))}</b></div>
        <div><span class="l">${sigla('VPN')}</span>${f && f.vpn != null ? `<b class="${f.vpn < 0 ? 'crit' : ''}">${esc(App.moneyShort(f.vpn, caso.moneda))}</b> <span class="faint">· ${sigla('TIR')} ${f.tir != null ? esc(App.pct(f.tir)) : '—'}</span>` : '<span class="faint">sin caso</span>'}</div>
        <div><span class="l">Captado ${Y}</span><b>${esc(App.moneyShort(ver + pre))}</b> <span class="faint">· verificado ${esc(App.moneyShort(ver))} · preliminar ${esc(App.moneyShort(pre))}</span></div>
        <div><span class="l">Evidencia</span>${caps.length ? `<a href="#/proyectos/${p.id}/caso">${validacionDe(caso, Y) && validacionDe(caso, Y).hasta ? 'validado hasta ' + esc(mesLargo(validacionDe(caso, Y).hasta)) + ' por ' + esc(validacionDe(caso, Y).por || '') : 'sin validar'} →</a>` : '<span class="faint">sin capturas este año</span>'}</div>
      </div></div>
      <div class="hs-acc">${prox ? `<a class="btn amarillo" href="#/agenda/preparar/${prox.id}">Preparar el comité</a>` : ''}${ro ? '' : `<a class="btn" href="#/proyectos/${p.id}/caso">Registrar captura</a>`}${hab && hab.email ? `<a class="btn ghost" href="mailto:${esc(hab.email)}?subject=${encodeURIComponent(App.projectName(p))}">Escribir a ${esc(hab.name.split(' ')[0])}</a>` : ''}</div>
    </div>`;
  }
  function habilitador(p) {
    const col = App.S.columns.find(c => c.type === 'people' && /habilit|patroc|sponsor/i.test(c.name)) || App.S.columns.find(c => c.type === 'people');
    const v = col ? (p.props || {})[col.id] : null; const first = Array.isArray(v) ? v[0] : v; if (!first) return null;
    return App.S.people.find(u => u.id === first || u.name === first) || { name: String(first), email: '' };
  }

  /* ---------- preparar el comité (vista imprimible por sesión) ---------- */
  function preparar(main, sid) {
    const s = App.byId('sessions', sid);
    if (!s) { main.innerHTML = '<div class="empty-box"><b>Esa sesión no existe</b><a class="back" href="#/agenda">← Comités</a></div>'; return; }
    const ec = App.estadoCol(), Y = Number(hoy().slice(0, 4));
    const ps = (s.proyectos || []).map(pid => App.byId('projects', pid)).filter(Boolean);
    const pend = decisiones().filter(d => d.estado !== 'Cumplida' && ps.some(p => p.id === d.project_id));
    const comp = (s.compromisos || []).filter(k => !k.hecho && (k.texto || '').trim());
    const compPrev = App.S.sessions.filter(x => x.id !== s.id && x.fecha < s.fecha).flatMap(x => (x.compromisos || []).filter(k => !k.hecho && (k.texto || '').trim()).map(k => ({ ...k, s: x })));
    main.innerHTML = `<div class="page-h no-print"><button class="burger" data-act="burger">☰</button><a class="back" href="#/agenda">← Comités y decisiones</a><span class="sp"></span><button class="btn primary" data-print="1">⎙ Imprimir / PDF</button></div>
      <div class="card-box prep">
        <div class="eyebrow">Preparación del comité</div><h1>${esc(App.Agenda.tituloOf(s))}</h1>
        <div class="sub">${esc(App.d.fmtLong(s.fecha))}${s.hora_ini ? ' · ' + esc(s.hora_ini) + (s.hora_fin ? ' a ' + esc(s.hora_fin) : '') : ''}${s.lugar ? ' · ' + esc(s.lugar) : ''} · ${ps.length} iniciativa${ps.length === 1 ? '' : 's'}</div>
        ${s.temas ? `<h3>Orden del día</h3><div class="pre">${esc(s.temas)}</div>` : ''}
        ${compPrev.length ? `<h3>Compromisos abiertos de sesiones anteriores</h3><ul class="prep-lista">${compPrev.map(k => `<li><b>${esc(k.texto)}</b> · ${esc(k.responsable || 'sin responsable')}${k.fecha ? ` · vence ${esc(App.d.fmtShort(k.fecha))}${k.fecha < hoy() ? ' <span class="crit">(vencido)</span>' : ''}` : ''} <span class="faint">· ${esc(App.Agenda.tituloOf(k.s))} ${esc(App.d.fmtShort(k.s.fecha))}</span></li>`).join('')}</ul>` : ''}
        ${ps.map(p => { const pl = App.planOf(p.id), caso = App.caseOf(p.id), f = caso ? Finanzas.calc(caso) : null, ult = decisionesDe(p.id)[0];
          const caps = (caso ? caso.captado || [] : []).filter(c => c.mes && c.mes.startsWith(Y + '-')), cap = caps.reduce((a, c) => a + (Number(c.valor) || 0), 0);
          const alertas = [];
          if (pl.atrasadas) alertas.push(`${pl.atrasadas} actividad${pl.atrasadas > 1 ? 'es' : ''} atrasada${pl.atrasadas > 1 ? 's' : ''}`);
          if (p.fecha_meta && pl.fin && pl.fin > p.fecha_meta) alertas.push('termina después de la fecha meta');
          if (f && f.vpn != null && f.vpn < 0) alertas.push('VPN negativo');
          const vencidos = App.S.sessions.flatMap(x => (x.proyectos || []).includes(p.id) ? (x.compromisos || []) : []).filter(k => !k.hecho && k.fecha && k.fecha < hoy()).length; if (vencidos) alertas.push(`${vencidos} compromiso${vencidos > 1 ? 's' : ''} vencido${vencidos > 1 ? 's' : ''}`);
          return `<div class="prep-p"><div class="prep-h"><h2>${esc(App.projectName(p))}</h2>${ec ? `<span class="pill cl-${App.optColor(ec, (p.props || {})[ec.id])}">${esc((p.props || {})[ec.id] || '')}</span>` : ''}</div>
            ${p.frase ? `<p class="fr">${esc(p.frase)}</p>` : ''}
            <div class="prep-g">
              <div><span class="l">Avance</span>${pl.acts.length ? `<b>${pl.avance}%</b> · ${esc(App.d.fmt(pl.ini))} – ${esc(App.d.fmt(pl.fin))}` : '<span class="faint">sin cronograma</span>'}</div>
              <div><span class="l">Caso</span>${caso ? `${esc(caso.estado || 'Borrador')}${f.vpn != null ? ` · VPN ${esc(App.moneyShort(f.vpn, caso.moneda))} · TIR ${f.tir != null ? esc(App.pct(f.tir)) : '—'}` : ''}` : '<span class="faint">sin caso</span>'}</div>
              <div><span class="l">Captado ${Y}</span><b>${esc(App.moneyShort(cap))}</b> <span class="faint">· ${validacionDe(caso, Y) && validacionDe(caso, Y).hasta ? 'validado hasta ' + esc(mesLargo(validacionDe(caso, Y).hasta)) : 'sin validar'}</span></div>
              <div><span class="l">Alertas</span>${alertas.length ? `<span class="crit">${esc(alertas.join(' · '))}</span>` : '<span class="good">sin alertas</span>'}</div>
              <div><span class="l">Próximos hitos</span>${hitosHTML(p.id)}</div>
              <div><span class="l">Última decisión</span>${ult ? `${esc(ult.tipo)}: ${esc(ult.texto)} <span class="faint">(${esc(App.d.fmtShort(ult.fecha || ult.s.fecha))})</span>` : '<span class="faint">ninguna</span>'}</div>
            </div>
            ${caso && caso.recomendacion ? `<div class="prep-dec"><b>Decisión que se pide:</b> ${esc(caso.recomendacion)}</div>` : ''}
            <div class="prep-dec faint">Decisión de esta sesión: ______________________________________________</div></div>`; }).join('')}
        ${pend.length ? `<h3>Decisiones pendientes de cumplir</h3><div class="decs">${pend.map(d => decisionHTML(d, true)).join('')}</div>` : ''}
        ${comp.length ? `<h3>Compromisos de esta sesión</h3><ul class="prep-lista">${comp.map(k => `<li><b>${esc(k.texto)}</b> · ${esc(k.responsable || '')}${k.fecha ? ' · ' + esc(App.d.fmtShort(k.fecha)) : ''}</li>`).join('')}</ul>` : ''}
        <div class="meta-line">Generado desde el portafolio el ${esc(App.d.fmt(hoy()))}. Las decisiones se registran en la sesión («Decisiones registradas») y quedan en la ficha de cada iniciativa.</div>
      </div>`;
    main.onclick = e => { if (e.target.closest('.burger')) return App.toggleSide(); if (e.target.closest('[data-print]')) window.print(); };
  }

  /* ---------- proponer una necesidad ---------- */
  function proponer(main) {
    const d = direccion();
    main.innerHTML = `<div class="page-h"><button class="burger" data-act="burger">☰</button><div><h1>Proponer una necesidad</h1><div class="sub">Entra al portafolio como idea; la Dirección la evalúa y te responde${d.responsable_propuestas ? ` (${esc(d.responsable_propuestas)})` : ''}.</div></div></div>
      <div class="card-box prop"><form id="propForm">
        <label>Título de la necesidad</label><input class="fld" name="titulo" required maxlength="120" placeholder="Ej.: Radicar facturas de proveedores sin papel">
        <label>Qué problema u oportunidad hay</label><textarea class="fld" name="problema" rows="3" required placeholder="Qué pasa hoy, a quién afecta y por qué vale la pena resolverlo"></textarea>
        <label>Beneficio esperado, en una frase <span class="faint">(opcional)</span></label><input class="fld" name="beneficio" maxlength="300" placeholder="Ej.: 2 días menos por factura y cero extravíos">
        <div class="row"><div style="flex:1"><label>Área</label><input class="fld" name="area" maxlength="80" placeholder="Comercial, Cartera, TI…"></div>
        <div><label>Urgencia</label><select class="fld" name="urgencia"><option value="baja">Baja</option><option value="media" selected>Media</option><option value="alta">Alta</option></select></div></div>
        <div class="row" style="margin-top:14px;justify-content:space-between;align-items:center"><span class="faint" style="font-size:12px">Queda registrada a tu nombre (${esc(App.S.me.name)})${d.correo_propuestas ? ` y puedes escribir a <a href="mailto:${esc(d.correo_propuestas)}">${esc(d.correo_propuestas)}</a>` : ''}.</span><button class="btn amarillo" type="submit">Enviar propuesta</button></div>
        <div class="err"></div></form></div>`;
    main.onclick = e => { if (e.target.closest('.burger')) App.toggleSide(); };
    const f = $('#propForm', main);
    f.onsubmit = async e => {
      e.preventDefault(); const b = $('button[type=submit]', f); b.disabled = true; $('.err', f).textContent = '';
      try {
        const doc = await App.api('POST', '/api/ideas', Object.fromEntries(new FormData(f).entries()));
        App.S.projects.push(doc);
        main.innerHTML = `<div class="card-box prop"><div class="empty-box"><b>Gracias. Tu propuesta quedó registrada como idea del portafolio.</b><a class="btn" href="#/proyectos/${doc.id}">Ver la idea</a> <a class="btn ghost" href="#/proponer">Proponer otra</a></div></div>`;
      } catch (ex) { $('.err', f).textContent = ex.message; b.disabled = false; }
    };
  }

  /* ---------- desactualizados (administración) ---------- */
  function desactualizados() {
    const lim = new Date(Date.now() - 21 * 86400e3).toISOString(), Y = hoy().slice(0, 4), mesPasado = hoy().slice(0, 7);
    const viejos = App.S.projects.filter(p => App.enRealizacion(p) && (p.updated_at || p.created_at || '') < lim);
    const sinEv = App.S.cases.map(c => { const xs = (c.captado || []).filter(x => x.mes && x.mes.startsWith(Y + '-') && x.mes < mesPasado && Number(x.valor) && !verificado(x, c)); return xs.length ? { c, desde: xs.map(x => x.mes).sort()[0], total: xs.reduce((a, x) => a + Number(x.valor), 0) } : null; }).filter(Boolean);
    const vencidos = App.S.sessions.flatMap(s => (s.compromisos || []).filter(k => !k.hecho && k.fecha && k.fecha < hoy() && (k.texto || '').trim()).map(k => ({ k, s })));
    const ideas = App.S.projects.filter(p => p.origen && p.origen.tipo === 'propuesta' && (p.created_at || '') < new Date(Date.now() - 10 * 86400e3).toISOString() && /idea/i.test(((p.props || {})[(App.estadoCol() || {}).id] || '')));
    const item = (href, t, s) => `<a class="des" href="${href}"><b>${esc(t)}</b><span>${esc(s)}</span></a>`;
    return `<div class="card-box" style="margin-bottom:16px"><h3 style="font-size:14px;font-weight:800;margin-bottom:4px">Qué está desactualizado</h3><div class="muted" style="font-size:12.5px;margin-bottom:10px">Se calcula solo. Cuando esta lista está vacía, el portafolio está al día.</div>
      ${!viejos.length && !sinEv.length && !vencidos.length && !ideas.length ? '<div class="atn-ok">Todo al día.</div>' : ''}
      ${viejos.map(p => item('#/proyectos/' + p.id, App.projectName(p), 'en realización sin cambios desde ' + App.d.ago(p.updated_at || p.created_at))).join('')}
      ${sinEv.map(({ c, desde, total }) => { const p = App.byId('projects', c.project_id); return p ? item(`#/proyectos/${p.id}/caso`, App.projectName(p), `captado sin validar desde ${App.d.MES3[Number(desde.slice(5)) - 1]} (${App.moneyShort(total)})`) : ''; }).join('')}
      ${vencidos.map(({ k, s }) => item('#/agenda', k.texto, `compromiso vencido el ${App.d.fmtShort(k.fecha)} · ${k.responsable || 'sin responsable'} · ${App.Agenda.tituloOf(s)}`)).join('')}
      ${ideas.map(p => item('#/proyectos/' + p.id, App.projectName(p), 'propuesta sin respuesta hace más de 10 días · ' + (p.origen.nombre || ''))).join('')}
    </div>`;
  }
  function adminExtras(main) {
    const d = direccion();
    const box = document.createElement('div');
    box.innerHTML = desactualizados() + `<div class="card-box" style="margin-bottom:16px"><h3 style="font-size:14px;font-weight:800;margin-bottom:4px">Qué es la Dirección</h3><div class="muted" style="font-size:12.5px;margin-bottom:8px">El texto que abre el inicio en la vista mejorada, y a quién llegan las propuestas.</div>
        <div class="pre" style="font-size:13px">${esc(d.que_es || QUE_ES_DEF)}</div><div class="faint" style="font-size:12px;margin:6px 0 10px">Propuestas: ${esc(d.correo_propuestas || 'sin correo')}${d.responsable_propuestas ? ' · responde ' + esc(d.responsable_propuestas) : ''}</div><button class="btn" data-qe="editar">Editar</button></div>
      <div class="card-box" style="margin-bottom:16px"><h3 style="font-size:14px;font-weight:800;margin-bottom:6px">Más herramientas</h3><div style="display:flex;gap:8px;flex-wrap:wrap"><a class="btn" href="#/historial">Historial de cambios</a><a class="btn" href="#/cronograma">Cronogramas de todo el portafolio</a><a class="btn" href="#/casos">Casos de negocio</a><a class="btn ghost" href="#/sistema">Sistema de diseño</a></div></div>`;
    const first = $('.card-box', main); if (first) first.insertAdjacentElement('beforebegin', box); else main.appendChild(box);
    box.addEventListener('click', e => { const b = e.target.closest('[data-qe=editar]'); if (b) editarQueEs(b); });
  }

  App.Mejoras = { sigla, queEs, editarQueEs, verificado, validacionDe, capturasDelAnio, evidenciaHTML, evidenciaEditor, decisionesRecientes, decisionesEditor, decisionesDe, hitos, hitosHTML, enRealizacion, historia, preparar, proponer, desactualizados, adminExtras };
  App.views.proponer = { render: proponer };
})();
