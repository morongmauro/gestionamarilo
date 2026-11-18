/* ============================================================
   RIESGOS DE CADA INICIATIVA
   Identificar (con preguntas guía), evaluar en la matriz de
   probabilidad × impacto (antes y después de mitigar), responder
   (mitigar, transferir, aceptar, evitar) con un plan de acciones
   con responsable y fecha, y vigilar: lo vencido y lo crítico
   aparece en el Tablero, en el Portafolio y en el comité.
   Se guarda en la iniciativa (campo «riesgos»).
   ============================================================ */
'use strict';
(function () {
  const { $, esc } = App;
  const CATS = [
    ['financiero', 'Financiero', ['¿Qué pasa si los ingresos o ahorros llegan más tarde o más bajos de lo proyectado?', '¿Qué costo puede subir más de lo previsto?', '¿Depende de una tasa, un precio o una tarifa que puede cambiar?']],
    ['regulatorio', 'Regulatorio y tributario', ['¿Necesita permisos, licencias o registros que pueden demorarse?', '¿Un cambio de norma o impuesto afecta el caso?', '¿Hay obligaciones contractuales o legales nuevas?']],
    ['ejecucion', 'Ejecución y proveedores', ['¿Un proveedor o contratista clave puede fallar o demorarse?', '¿El equipo tiene la capacidad y el tiempo para ejecutarlo?', '¿Hay dependencias con otras iniciativas o áreas?']],
    ['adopcion', 'Adopción y cambio', ['¿Los usuarios o clientes pueden no adoptar la solución?', '¿Un área puede resistirse al cambio de proceso?', '¿Falta un patrocinador que empuje la decisión?']],
    ['tecnologia', 'Tecnología y datos', ['¿La tecnología puede no funcionar como se espera o no integrarse?', '¿Los datos necesarios existen y tienen calidad?', '¿Hay riesgos de seguridad de la información?']],
    ['reputacion', 'Reputación y clientes', ['¿Puede afectar la experiencia de clientes o compradores?', '¿Puede generar quejas, reclamos o exposición pública?']],
  ];
  const catLabel = k => (CATS.find(c => c[0] === k) || [k, 'Otro'])[1];
  const RESP = [['mitigar', 'Mitigar'], ['transferir', 'Transferir'], ['aceptar', 'Aceptar'], ['evitar', 'Evitar']];
  const ESTADOS = ['Abierto', 'En tratamiento', 'Materializado', 'Cerrado'];
  const P_TXT = ['', 'muy baja', 'baja', 'media', 'alta', 'casi segura'], I_TXT = ['', 'mínimo', 'menor', 'moderado', 'mayor', 'grave'];
  const nivelDe = v => (v >= 15 ? ['cr', 'Crítico'] : v >= 10 ? ['a', 'Alto'] : v >= 5 ? ['m', 'Medio'] : ['b', 'Bajo']);
  const val = (p, i) => (p > 0 && i > 0 ? p * i : 0);
  // El nivel que manda es el residual (después de mitigar) si ya se evaluó; si no, el de antes
  const actual = r => (r.rp > 0 && r.ri > 0 ? val(r.rp, r.ri) : val(r.p, r.i));
  const activo = r => r.estado !== 'Cerrado';
  const hoy = () => App.d.today();
  const lista = p => (Array.isArray(p && p.riesgos) ? p.riesgos : []);
  const codigo = (p, r) => 'R' + (lista(p).indexOf(r) + 1);
  const vencidas = r => (r.acciones || []).filter(a => !a.hecha && a.fecha && a.fecha < hoy());
  const proxima = r => (r.acciones || []).filter(a => !a.hecha).sort((a, b) => (a.fecha || '9999').localeCompare(b.fecha || '9999'))[0] || null;
  const badge = v => { if (!v) return '<span class="faint">sin evaluar</span>'; const [c, t] = nivelDe(v); return `<span class="rk-niv ${c}">${t} ${v}</span>`; };

  // Señales para el Tablero, el Portafolio y el comité
  function alertas(p) {
    const out = [];
    lista(p).filter(activo).forEach(r => {
      const v = actual(r), venc = vencidas(r).length;
      if (v >= 15 && !(r.acciones || []).some(a => !a.hecha)) out.push({ sev: 3, txt: `Riesgo crítico sin plan: ${r.titulo || 'sin título'}`, href: `#/proyectos/${p.id}/riesgos` });
      else if (venc) out.push({ sev: v >= 15 ? 3 : 2, txt: `${venc} acción${venc === 1 ? '' : 'es'} de riesgo vencida${venc === 1 ? '' : 's'}: ${r.titulo || ''}`.trim(), href: `#/proyectos/${p.id}/riesgos` });
    });
    return out;
  }
  function resumen(p) {
    const l = lista(p).filter(activo);
    return { n: l.length, criticos: l.filter(r => actual(r) >= 15).length, altos: l.filter(r => actual(r) >= 10 && actual(r) < 15).length, sinEvaluar: l.filter(r => !val(r.p, r.i)).length, vencidas: l.reduce((a, r) => a + vencidas(r).length, 0) };
  }

  /* ---------- pestaña de la iniciativa ---------- */
  const S = { sel: null, modo: 'antes' };
  function render(box, pid) {
    const p = App.byId('projects', pid); if (!p) return;
    const ro = !App.canEdit(), rs = lista(p);
    if (!rs.some(r => r.id === S.sel)) S.sel = (rs[0] || {}).id || null;
    const r = rs.find(x => x.id === S.sel) || null, R = resumen(p);
    const dots = (pp, ii) => rs.filter(activo).map(x => {
      const a = S.modo !== 'despues' && x.p === pp && x.i === ii ? `<span class="rk-dot inh ${x.id === S.sel ? 'sel' : ''}" data-rk-sel="${x.id}" title="${esc(x.titulo || '')}, antes de mitigar">${codigo(p, x)}</span>` : '';
      const d = S.modo !== 'antes' && x.rp === pp && x.ri === ii ? `<span class="rk-dot res ${x.id === S.sel ? 'sel' : ''}" data-rk-sel="${x.id}" title="${esc(x.titulo || '')}, después de mitigar">${codigo(p, x)}</span>` : '';
      return a + d; }).join('');
    const celdaSel = r && (S.modo === 'despues' ? [r.rp, r.ri] : [r.p, r.i]);
    const matriz = `<div class="rk-mz">${[5, 4, 3, 2, 1].map(pp => `<div class="rk-ax">${pp}</div>` + [1, 2, 3, 4, 5].map(ii => `<div class="rk-c ${nivelDe(pp * ii)[0]} ${celdaSel && celdaSel[0] === pp && celdaSel[1] === ii ? 'sel' : ''}" data-rk-celda="${pp},${ii}" title="Probabilidad ${pp} (${P_TXT[pp]}) × impacto ${ii} (${I_TXT[ii]}) = ${pp * ii}">${dots(pp, ii)}</div>`).join('')).join('')}
      <div></div>${[1, 2, 3, 4, 5].map(ii => `<div class="rk-ax">${ii}</div>`).join('')}</div>
      <div class="rk-ejes"><span>↑ Probabilidad</span><span>Impacto →</span></div>`;
    const pasos = (campo, v, txts) => `<span class="rk-esc" role="group">${[1, 2, 3, 4, 5].map(n => `<button class="${v >= n ? 'on' : ''}" data-rk-paso="${campo}:${n}" ${ro ? 'disabled' : ''} title="${n}, ${txts[n]}">${n}</button>`).join('')}<em>${v ? txts[v] : 'sin evaluar'}</em></span>`;
    const campo = (k, lbl, ph, multi) => `<div class="rk-f"><label>${lbl}</label>${ro ? `<span>${esc(r[k] || '—')}</span>` : multi ? `<textarea class="rk-in" data-rk-f="${k}" rows="2" placeholder="${ph}">${esc(r[k] || '')}</textarea>` : `<input class="rk-in" data-rk-f="${k}" value="${esc(r[k] || '')}" placeholder="${ph}">`}</div>`;
    const dos = (() => { const c = App.caseOf(pid); const f = c && c.moneda !== 'USD' ? Finanzas.calc(c) : null; return f && App.Avance ? App.Avance.dosAnios(f) : 0; })();
    const sugerido = r && Number(r.costo) > 0 && dos > 0 ? (q => (q >= 0.3 ? 5 : q >= 0.15 ? 4 : q >= 0.05 ? 3 : q >= 0.01 ? 2 : 1))(Number(r.costo) / dos) : null;
    const detalle = !r ? `<section class="t-card t-pad rk-det"><div class="t-vacio">${rs.length ? 'Elija un riesgo de la lista.' : `<b>Esta iniciativa aún no tiene riesgos identificados.</b><br>Empiece con «+ Riesgo»: le mostramos preguntas guía por categoría.${ro ? '' : '<br><button class="btn primary sm" data-rk="nuevo" style="margin-top:10px">+ Riesgo</button>'}`}</div></section>`
      : `<section class="t-card t-pad rk-det">
        <div class="rk-tit"><span class="rk-cod">${codigo(p, r)}</span>${ro ? `<b>${esc(r.titulo || '')}</b>` : `<input class="rk-in rk-titin" data-rk-f="titulo" value="${esc(r.titulo || '')}" placeholder="Qué puede pasar">`}${badge(val(r.p, r.i))}${val(r.rp, r.ri) ? ` <span class="faint">→</span> ${badge(val(r.rp, r.ri))}` : ''}</div>
        <div class="rk-f"><label>Categoría</label>${ro ? `<span>${esc(catLabel(r.categoria))}</span>` : `<select class="rk-in" data-rk-f="categoria">${CATS.map(([k, l]) => `<option value="${k}" ${r.categoria === k ? 'selected' : ''}>${l}</option>`).join('')}</select>`}</div>
        ${campo('causa', 'Causa', 'Por qué podría pasar')}
        ${campo('consecuencia', 'Si pasa', 'Qué le pasa a la iniciativa', false)}
        <div class="rk-f"><label>Costo si pasa</label>${ro ? `<span>${r.costo ? esc(App.moneyShort(Number(r.costo))) : '—'}</span>` : `<span class="rk-costo"><input class="rk-in" data-rk-f="costo" inputmode="decimal" value="${r.costo ? esc(App.num(Number(r.costo))) : ''}" placeholder="Opcional: p. ej. 500M">${sugerido ? `<button class="t-lnk" data-rk-paso="i:${sugerido}">Usar impacto sugerido: ${sugerido}</button>` : dos ? '' : '<em class="faint">con el caso de negocio se sugiere el impacto</em>'}</span>`}</div>
        ${campo('disparador', 'Disparador', 'Qué señal avisa que está pasando')}
        <div class="rk-f"><label>Probabilidad</label>${pasos('p', r.p, P_TXT)}</div>
        <div class="rk-f"><label>Impacto</label>${pasos('i', r.i, I_TXT)}</div>
        <div class="rk-f"><label>Respuesta</label><span class="rk-chips">${RESP.map(([k, l]) => `<button class="rk-chip ${r.respuesta === k ? 'on' : ''}" data-rk-resp="${k}" ${ro ? 'disabled' : ''}>${l}</button>`).join('')}</span></div>
        <div class="rk-plan"><div class="rk-pt">Plan de acción</div>
          ${(r.acciones || []).map((a, k) => `<div class="rk-a ${a.hecha ? 'ok' : ''}"><input type="checkbox" data-rk-hecha="${k}" ${a.hecha ? 'checked' : ''} ${ro ? 'disabled' : ''} aria-label="Hecha">
            ${ro ? `<span class="t">${esc(a.texto || '')}</span>` : `<input class="rk-in t" data-rk-a="${k}:texto" value="${esc(a.texto || '')}" placeholder="Qué se va a hacer">`}
            ${ro ? `<span>${esc(a.responsable || '')}</span>` : `<input class="rk-in w" data-rk-a="${k}:responsable" value="${esc(a.responsable || '')}" placeholder="Responsable" list="rkPersonas">`}
            ${ro ? `<span>${esc(a.fecha || '')}</span>` : `<input class="rk-in f" type="date" data-rk-a="${k}:fecha" value="${esc(a.fecha || '')}">`}
            ${!a.hecha && a.fecha && a.fecha < hoy() ? '<b class="rk-venc">vencida</b>' : ''}
            ${ro ? '' : a.act_id ? '<span class="faint" title="Ya está en el cronograma">✓ en cronograma</span>' : `<button class="t-lnk" data-rk-crono="${k}">Pasar al cronograma</button>`}
            ${ro ? '' : `<button class="rk-x" data-rk-del-a="${k}" title="Quitar acción" aria-label="Quitar acción">✕</button>`}</div>`).join('') || '<div class="faint" style="font-size:13px">Sin acciones todavía.</div>'}
          ${ro ? '' : '<button class="t-lnk" data-rk="accion">+ Acción</button>'}</div>
        <div class="rk-f"><label>Después de mitigar</label><span class="rk-res">${pasos('rp', r.rp, P_TXT).replace('<span class="rk-esc"', '<span class="rk-esc pq"')} <span class="faint">×</span> ${pasos('ri', r.ri, I_TXT).replace('<span class="rk-esc"', '<span class="rk-esc pq"')}</span></div>
        <div class="rk-f"><label>Estado</label>${ro ? `<span>${esc(r.estado || 'Abierto')}</span>` : `<select class="rk-in" data-rk-f="estado">${ESTADOS.map(e => `<option ${(r.estado || 'Abierto') === e ? 'selected' : ''}>${e}</option>`).join('')}</select>`}</div>
        ${ro ? '' : '<div class="rk-pie"><button class="t-lnk rk-borrar" data-rk="borrar">Eliminar este riesgo</button></div>'}
      </section>`;
    const tabla = rs.length ? `<section class="t-card pf-tbl-card rk-lista"><div class="pf-wrap"><table class="pf-tbl"><thead><tr><th>Riesgo</th><th>Nivel <small>antes → después</small></th><th>Respuesta</th><th>Próxima acción</th><th>Responsable</th><th>Estado</th><th aria-hidden="true"></th></tr></thead><tbody>
      ${rs.map(x => { const pa = proxima(x), venc = pa && pa.fecha && pa.fecha < hoy(); return `<tr class="${x.id === S.sel ? 'rk-on' : ''} ${activo(x) ? '' : 'pf-inact'}" data-rk-sel="${x.id}"><td><b>${codigo(p, x)}</b> ${esc(x.titulo || 'Sin título')}<small class="rk-cat">${esc(catLabel(x.categoria))}</small></td>
        <td>${badge(val(x.p, x.i))}${val(x.rp, x.ri) ? ` → ${badge(val(x.rp, x.ri))}` : ''}</td><td>${esc((RESP.find(q => q[0] === x.respuesta) || ['', '—'])[1])}</td>
        <td class="${venc ? 'rk-venc' : ''}">${pa ? `${esc(pa.texto || '')}${pa.fecha ? `, ${venc ? 'vencida ' : ''}${esc(App.d.fmtShort(pa.fecha))}` : ''}` : '<span class="faint">—</span>'}</td><td>${esc((pa && pa.responsable) || '')}</td><td>${esc(x.estado || 'Abierto')}</td><td class="go" aria-hidden="true">›</td></tr>`; }).join('')}
      </tbody></table></div></section>` : '';
    box.innerHTML = `<div class="rk-bar vl-bar">
        <span class="kl"><span><b>${R.n}</b>riesgos activos</span><span title="Nivel actual: después de mitigar si ya se evaluó"><b class="${R.criticos ? 'r' : ''}">${R.criticos}</b>críticos hoy</span><span><b class="${R.vencidas ? 'r' : ''}">${R.vencidas}</b>acciones vencidas</span>${R.sinEvaluar ? `<span><b>${R.sinEvaluar}</b>sin evaluar</span>` : ''}</span><span class="sp"></span>
        <div class="seg" title="Qué puntos se ven en la matriz">${[['antes', 'Antes de mitigar'], ['despues', 'Después'], ['ambos', 'Ambos']].map(([k, l]) => `<button data-rk-modo="${k}" class="${S.modo === k ? 'on' : ''}">${l}</button>`).join('')}</div>${ro ? '' : '<button class="btn primary sm" data-rk="nuevo">+ Riesgo</button>'}</div>
      <div class="rk-grid"><section class="t-card t-pad"><div class="rk-tt">${r && !ro ? `Haga clic en una celda para evaluar <b>${codigo(p, r)}</b> ${S.modo === 'despues' ? 'después de mitigar' : 'antes de mitigar'}` : 'Matriz de riesgos'}</div>${matriz}
        <div class="rk-ley"><span><i class="rk-dot inh"></i>antes de mitigar</span><span><i class="rk-dot res"></i>después (residual)</span></div></section>${detalle}</div>
      ${tabla}<datalist id="rkPersonas">${(App.S.people || []).map(u => `<option value="${esc(u.name)}">`).join('')}</datalist>`;

    // --- guardar ---
    const guardar = (fn, repintar = true) => { const l = JSON.parse(JSON.stringify(lista(App.byId('projects', pid)))); const x = l.find(q => q.id === S.sel); fn(l, x); return App.guard(async () => { await App.patch('projects', pid, { riesgos: l }); if (repintar) render(box, pid); }); };
    box.onclick = e => {
      const t = e.target;
      const md = t.closest('[data-rk-modo]'); if (md) { S.modo = md.dataset.rkModo; return render(box, pid); }
      const sl = t.closest('[data-rk-sel]'); if (sl && !t.closest('[data-rk-celda]') || sl && t.classList.contains('rk-dot')) { S.sel = sl.dataset.rkSel; if (S.modo === 'ambos') S.modo = 'antes'; return render(box, pid); }
      if (ro) return;
      const cel = t.closest('[data-rk-celda]'); if (cel && r) { const [pp, ii] = cel.dataset.rkCelda.split(',').map(Number); return guardar((l, x) => { if (S.modo === 'despues') { x.rp = pp; x.ri = ii; } else { x.p = pp; x.i = ii; } }); }
      const ps = t.closest('[data-rk-paso]'); if (ps && r) { const [k, n] = ps.dataset.rkPaso.split(':'); return guardar((l, x) => { x[k] = Number(n); }); }
      const rp = t.closest('[data-rk-resp]'); if (rp && r) return guardar((l, x) => { x.respuesta = x.respuesta === rp.dataset.rkResp ? '' : rp.dataset.rkResp; });
      const hc = t.closest('[data-rk-hecha]'); if (hc && r) return guardar((l, x) => { x.acciones[+hc.dataset.rkHecha].hecha = hc.checked; });
      const da = t.closest('[data-rk-del-a]'); if (da && r) return guardar((l, x) => { x.acciones.splice(+da.dataset.rkDelA, 1); });
      const cr = t.closest('[data-rk-crono]'); if (cr && r) return pasarCronograma(pid, r, +cr.dataset.rkCrono, () => render(box, pid));
      const b = t.closest('[data-rk]'); if (!b) return;
      if (b.dataset.rk === 'nuevo') return nuevo(b, pid, id => { S.sel = id; S.modo = 'antes'; render(box, pid); });
      if (b.dataset.rk === 'accion') return guardar((l, x) => { x.acciones = x.acciones || []; x.acciones.push({ id: App.uid(), texto: '', responsable: '', fecha: '', hecha: false }); });
      if (b.dataset.rk === 'borrar') { if (!confirm(`¿Eliminar el riesgo «${r.titulo || 'sin título'}»?`)) return; return guardar(l => { l.splice(l.findIndex(q => q.id === S.sel), 1); S.sel = null; }); }
    };
    box.onchange = e => {
      if (ro || !r) return;
      const t = e.target;
      if (t.dataset.rkF) { let v = t.value; if (t.dataset.rkF === 'costo') { v = App.Hoja.parseQty(v); if (v == null) { App.toast('No entendí el costo: escriba p. ej. 500M o 1.200.000.000', true); return; } } return guardar((l, x) => { x[t.dataset.rkF] = v; }, ['categoria', 'estado', 'costo', 'titulo'].includes(t.dataset.rkF)); }
      if (t.dataset.rkA) { const [k, f] = t.dataset.rkA.split(':'); return guardar((l, x) => { x.acciones[+k][f] = t.value; }, f === 'fecha'); }
    };
  }

  function nuevo(anchor, pid, listo) {
    const p = App.openPop(anchor, `<div class="lbl">Nuevo riesgo, elija una pregunta guía o escriba el suyo</div>
      <div style="padding:0 10px 8px"><input class="fld" data-n="t" placeholder="Qué puede pasar, en una frase" style="width:100%"></div>
      <div class="rk-guia">${CATS.map(([k, l, qs]) => `<div class="rk-gc"><b>${l}</b>${qs.map(q => `<button class="rk-gq" data-cat="${k}">${esc(q)}</button>`).join('')}</div>`).join('')}</div>
      <div class="row" style="justify-content:flex-end;padding:6px 10px 10px"><button class="btn primary sm" data-n="ok">Crear riesgo</button></div>`, { width: 560 });
    let cat = 'financiero';
    p.onclick = e => {
      const q = e.target.closest('.rk-gq'); if (q) { cat = q.dataset.cat; const inp = p.querySelector('[data-n=t]'); inp.value = ''; inp.placeholder = 'Respuesta a: ' + q.textContent; inp.focus(); p.querySelectorAll('.rk-gq').forEach(x => x.classList.toggle('on', x === q)); return; }
      if (!e.target.closest('[data-n=ok]')) return;
      const titulo = p.querySelector('[data-n=t]').value.trim(); if (!titulo) { App.toast('Escriba qué puede pasar', true); return; }
      const r = { id: App.uid(), titulo: titulo.slice(0, 300), categoria: cat, p: 0, i: 0, rp: 0, ri: 0, respuesta: '', acciones: [], estado: 'Abierto', creado: hoy() };
      App.closePop(true);
      App.guard(async () => { await App.patch('projects', pid, { riesgos: lista(App.byId('projects', pid)).concat(r) }); listo(r.id); });
    };
    setTimeout(() => { const i = p.querySelector('[data-n=t]'); if (i) i.focus(); }, 30);
  }

  // Una acción del plan pasa al cronograma de la iniciativa como actividad
  function pasarCronograma(pid, r, k, listo) {
    const a = (r.acciones || [])[k]; if (!a || !(a.texto || '').trim()) return App.toast('Escriba primero la acción', true);
    const acts = App.S.activities.filter(x => x.project_id === pid), id = App.uid();
    const act = { id, name: `Riesgo: ${a.texto}`.slice(0, 500), responsable: a.responsable || null, inicio: a.fecha || null, fin: a.fecha || null, avance: 0, position: acts.reduce((m, x) => Math.max(m, x.position || 0), -1) + 1, notas: `Acción del plan del riesgo «${r.titulo}»` };
    App.guard(async () => {
      const res = await App.api('POST', '/api/plan/' + pid, { activities: { upsert: [act], remove: [] }, sections: { upsert: [], remove: [] }, registrar: true });
      if (res && res.activities) App.S.activities = App.S.activities.filter(x => x.project_id !== pid).concat(res.activities);
      const l = JSON.parse(JSON.stringify(lista(App.byId('projects', pid)))); const x = l.find(q => q.id === r.id); x.acciones[k].act_id = id;
      await App.patch('projects', pid, { riesgos: l });
      App.toast('Acción agregada al cronograma'); listo();
    });
  }

  /* ---------- vista del portafolio: todos los riesgos ---------- */
  function portafolioHTML(ps) {
    const todos = ps.flatMap(p => lista(p).filter(activo).map(r => ({ p, r, v: actual(r) })));
    const celda = (pp, ii) => todos.filter(x => (x.r.rp > 0 && x.r.ri > 0 ? x.r.rp === pp && x.r.ri === ii : x.r.p === pp && x.r.i === ii));
    const top = todos.filter(x => x.v).sort((a, b) => b.v - a.v).slice(0, 10);
    const sinRiesgos = ps.filter(p => !lista(p).length).length, sinEval = todos.filter(x => !x.v).length;
    return `<div class="rk-grid rk-port"><section class="t-card t-pad"><div class="rk-tt">Todos los riesgos activos, nivel actual (después de mitigar, si ya se evaluó)</div>
        <div class="rk-mz">${[5, 4, 3, 2, 1].map(pp => `<div class="rk-ax">${pp}</div>` + [1, 2, 3, 4, 5].map(ii => { const c = celda(pp, ii); return `<div class="rk-c ${nivelDe(pp * ii)[0]}" title="${esc(c.map(x => App.projectName(x.p) + ': ' + (x.r.titulo || '')).join('\n'))}">${c.length ? `<span class="rk-n">${c.length}</span>` : ''}</div>`; }).join('')).join('')}
        <div></div>${[1, 2, 3, 4, 5].map(ii => `<div class="rk-ax">${ii}</div>`).join('')}</div><div class="rk-ejes"><span>↑ Probabilidad</span><span>Impacto →</span></div>
        <div class="t-pie" style="padding:10px 0 0"><span class="t-tag">${todos.length} riesgos en ${ps.length - sinRiesgos} iniciativas${sinEval ? `, ${sinEval} sin evaluar` : ''}, ${sinRiesgos} iniciativas sin riesgos identificados</span></div></section>
      <section class="t-card pf-tbl-card"><div class="rk-tt" style="padding:14px 16px 0">Los 10 riesgos más altos</div><div class="pf-wrap"><table class="pf-tbl"><thead><tr><th>Iniciativa</th><th>Riesgo</th><th>Nivel</th><th>Próxima acción</th><th aria-hidden="true"></th></tr></thead><tbody>
        ${top.map(x => { const pa = proxima(x.r), venc = pa && pa.fecha && pa.fecha < hoy(); return `<tr data-rk-ir="${x.p.id}"><td class="pf-nm"><b>${esc(App.projectName(x.p))}</b></td><td>${esc(x.r.titulo || '')}</td><td>${badge(x.v)}</td><td class="${venc ? 'rk-venc' : ''}">${pa ? esc(pa.texto || '') + (pa.fecha ? `, ${esc(App.d.fmtShort(pa.fecha))}` : '') : (x.v >= 15 ? '<b class="rk-venc">sin plan</b>' : '<span class="faint">—</span>')}</td><td class="go" aria-hidden="true">›</td></tr>`; }).join('') || '<tr><td colspan="5"><div class="t-vacio">Aún no hay riesgos evaluados. Se identifican en la pestaña «Riesgos» de cada iniciativa.</div></td></tr>'}
      </tbody></table></div></section></div>`;
  }

  function seccion(main) {
    const ps = App.projectsSorted().filter(p => App.enAlcance(p) && !App.esEjemplo(p));
    const todos = ps.flatMap(p => lista(p).filter(activo).map(r => actual(r)));
    const crit = todos.filter(v => v >= 15).length, venc = ps.reduce((a, p) => a + lista(p).filter(activo).reduce((b, r) => b + vencidas(r).length, 0), 0);
    main.innerHTML = `<div class="pg-top"><button class="burger" data-act="burger" aria-label="Menú">☰</button><h1>Riesgos</h1>
      <div class="kl"><span><b>${todos.length}</b>riesgos activos</span><span><b class="${crit ? 'r' : ''}">${crit}</b>críticos</span><span><b class="${venc ? 'r' : ''}">${venc}</b>acciones vencidas</span></div><span class="sp"></span></div>
      ${portafolioHTML(ps)}
      <div class="t-pie t-pie-row"><span class="t-tag">Clic en un riesgo abre los riesgos de esa iniciativa, con «Siguiente ›» pasa a los de la siguiente</span></div>`;
    main.onclick = e => { if (e.target.closest('.burger')) return App.toggleSide(); const ir = e.target.closest('[data-rk-ir]'); if (ir) App.go('#/proyectos/' + ir.dataset.rkIr + '/riesgos'); };
  }
  App.views.riesgos = { render: seccion };
  App.Riesgos = { render, alertas, resumen, actual, nivelDe, portafolioHTML, lista };
})();
