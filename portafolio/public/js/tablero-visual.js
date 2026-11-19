/* ============================================================
   TABLERO VISUAL, la página principal
   Cada tablero responde una pregunta. Al hacer clic en una barra,
   un punto, una celda o una cifra se abre el detalle con las
   iniciativas que hay detrás y el enlace para ir a cada una.
   ============================================================ */
'use strict';
(function () {
  const { $, esc } = App;
  const m = v => App.moneyShort(v);
  const CAT = { nuevo: '#F08A5D', efi: '#5B9BEA', sin: '#B9B3C7', ingresos: '#F08A5D', ahorro: '#5B9BEA', eficiencia: '#3FC293', tiempo: '#DDA02E', riesgo: '#EE8FB6', otro: '#8E7CE0' };
  const FC = { 1: '#3367CD', 2: '#E07A12', 3: '#16935A', pausa: '#9A96A6', cerrada: '#7E64C8', cancelada: '#C8102E' };
  const FN = { 1: 'Planeación', 2: 'Ejecución, piloto y seguimiento', 3: 'Escalamiento y captura de valor', pausa: 'En pausa', cerrada: 'Cerrada', cancelada: 'Cancelada' };
  const F = Object.assign({ anio: null, fase: '' }, App.store.get('tv', {}));
  const guardar = () => App.store.set('tv', F);
  const plural = (n, s, p) => `${n} ${n === 1 ? s : p}`;
  const fase = p => { const ec = App.estadoCol(); return window.Fases && ec ? Fases.clasificar((p.props || {})[ec.id]) : null; };
  const faseNombre = k => (typeof k === 'number' ? `Fase ${k}, ${FN[k]}` : FN[k] || 'Sin fase');

  function datos() {
    const d = App.Dash.datos({ anio: F.anio, estado: '', tipo: '', alcance: 'todos', dgv: true });
    const foco = p => !App.esEjemplo(p) && (!App.dgvHay() || App.dgvSi(p));
    const pasa = p => foco(p) && (!F.fase || String(fase(p)) === F.fase);
    const X = d.proyectos.filter(x => pasa(x.p)), Xf = d.proyectos.filter(x => foco(x.p));
    const todos = App.projectsSorted().filter(p => pasa(p)), todosF = App.projectsSorted().filter(p => foco(p));
    const ps = todos.filter(p => { const f = fase(p); return f !== 'pausa' && f !== 'cerrada' && f !== 'cancelada'; });
    // Los tipos de beneficio se leen en dos grupos: nuevo negocio y eficiencia (y «sin clasificar» si hay)
    const gA = (x, g, y) => d.cats.filter(k => App.grupoDe(k) === g).reduce((a, k) => a + x.anual(k, y), 0);
    const Y = d.Y, cats = App.GRUPOS.map(g => g[0]).filter(g => X.some(x => d.anios.some(y => gA(x, g, y) > 0)));
    const anual = (x, y) => d.cats.reduce((a, k) => a + x.anual(k, y), 0), capY = x => d.cats.reduce((a, k) => a + x.captado(k, Y), 0);
    const porAnio = d.anios.map(y => ({ y, v: Object.fromEntries(cats.map(g => [g, X.reduce((a, x) => a + gA(x, g, y), 0)])) }));
    const tot = porAnio.reduce((a, z) => a + cats.reduce((q, k) => q + z.v[k], 0), 0);
    // El ritmo se mide solo con las iniciativas que registran su captura; las que no han registrado se cuentan aparte
    const reg = x => App.Dash.registra(x.caso, Y);
    const metaTot = X.reduce((a, x) => a + anual(x, Y), 0), meta = X.filter(reg).reduce((a, x) => a + anual(x, Y), 0), captado = X.reduce((a, x) => a + capY(x), 0);
    // Con plan de captura, lo esperado a hoy es lo programado hasta el último mes cerrado; sin plan, el año repartido en 12
    // Con plan: lo programado de los meses cerrados que ya se confirmaron (lo que falta confirmar se cuenta aparte, no baja el ritmo).
    // Sin plan: el beneficio del año repartido en 12 meses.
    const espX = x => {
      if (!(App.Valor && x.caso && App.Valor.planDe(x.caso))) return anual(x, Y) * d.corrido / 12;
      let s = 0; for (let i = 1; i <= d.corrido; i++) { const ym = `${Y}-${String(i).padStart(2, '0')}`; if ((x.caso.captado || []).some(c => c.mes === ym)) s += App.Valor.programado(x.caso, ym); }
      return s;
    };
    const esperado = X.filter(reg).reduce((a, x) => a + espX(x), 0);
    const porConf = App.Valor ? X.reduce((a, x) => a + (x.caso ? App.Valor.pendientes(x.caso).filter(z => z.mes.startsWith(Y + '-')).length : 0), 0) : 0;
    const sinReg = X.filter(x => anual(x, Y) > 0 && !reg(x)), esperadoSin = sinReg.reduce((a, x) => a + anual(x, Y), 0) * d.corrido / 12;
    // Años fuera de rango: un año que suma más de 4 veces la mediana de los años con valor suele ser un error de unidades
    const totY = porAnio.map(z => ({ y: z.y, v: cats.reduce((q, k) => q + z.v[k], 0) })), nz = totY.map(z => z.v).filter(v => v > 0).sort((a, b) => a - b);
    const med = nz.length >= 3 ? nz[Math.floor(nz.length / 2)] : 0;
    const atip = med > 0 ? totY.filter(z => z.v > 4 * med).map(z => { const top = X.map(x => ({ x, v: anual(x, z.y) })).sort((a, b) => b.v - a.v)[0]; return { ...z, med, top }; }) : [];
    const cap = Array(12).fill(0), capPor = Array.from({ length: 12 }, () => []), capG = { nuevo: Array(12).fill(0), efi: Array(12).fill(0), otro: Array(12).fill(0) };
    X.forEach(x => { for (let i = 0; i < 12; i++) { const ym = `${Y}-${String(i + 1).padStart(2, '0')}`; let t = 0; d.cats.forEach(k => { const v = x.capMes(k, ym); if (v) { t += v; capG[App.grupoDe(k)][i] += v; } }); if (t) { cap[i] += t; capPor[i].push({ x, v: t }); } } });
    const capGT = Object.fromEntries(Object.entries(capG).map(([g, a]) => [g, a.reduce((q, v) => q + v, 0)]));
    const casos = App.S.cases.filter(c => { const p = App.byId('projects', c.project_id); return p && pasa(p); });
    const sg = App.Dash.senales(d).filter(z => pasa(z.x.p));
    return { d, X, Xf, ps, todos, todosF, Y, cats, anual, capY, porAnio, tot, meta, metaTot, captado, esperado, sinReg, esperadoSin, atip, porConf, espX, capG, capGT, ...valorOficial(X, d, Y), vc: X.reduce((a, x) => a + (Number((x.p.props || {}).valor_crear) || 0), 0), vcN: X.filter(x => Number((x.p.props || {}).valor_crear) > 0).length, verif: X.reduce((a, x) => a + (x.caso ? (x.caso.captado || []).filter(c => String(c.mes).startsWith(Y + '-') && App.Mejoras && App.Mejoras.verificado(c, x.caso)).reduce((q, c) => q + (Number(c.valor) || 0), 0) : 0), 0), totAprob: X.filter(x => x.caso && x.caso.estado === 'Aprobado').reduce((a, x) => a + d.anios.reduce((q, y) => q + anual(x, y), 0), 0), cap, capPor, casos, sg, crit: sg.filter(z => z.max >= 3), rev: casos.filter(c => c.estado === 'En revisión'), aprob: casos.filter(c => c.estado === 'Aprobado') };
  }

  // La cifra única de valor: «Valor a crear/capturar» por año del periodo, con lo capturado (aprox.) y lo que falta
  function valorOficial(X, d, Y) {
    const PV = App.periodoValor(), anios = Array.from({ length: PV.n }, (_, i) => PV.d + i), G = ['nuevo', 'efi', 'otro'];
    const ofG = (x, g, y) => d.cats.filter(k => App.grupoDe(k) === g).reduce((a, k) => a + x.oficial(k, y), 0);
    const capG2 = (x, g, y) => d.cats.filter(k => App.grupoDe(k) === g).reduce((a, k) => a + x.captado(k, y), 0);
    const porY = anios.map(y => { const g = Object.fromEntries(G.map(k => [k, { v: X.reduce((a, x) => a + ofG(x, k, y), 0), c: X.reduce((a, x) => a + capG2(x, k, y), 0) }])); return { y, g, v: G.reduce((a, k) => a + g[k].v, 0), c: G.reduce((a, k) => a + g[k].c, 0) }; });
    const ofX = x => anios.reduce((a, y) => a + G.reduce((q, k) => q + ofG(x, k, y), 0), 0);
    return { PV, porY, ofTot: porY.reduce((a, z) => a + z.v, 0), capPer: porY.reduce((a, z) => a + z.c, 0), ofNotion: X.filter(x => x.base === 'notion').reduce((a, x) => a + ofX(x), 0), ofCaso: X.filter(x => x.base === 'caso').reduce((a, x) => a + ofX(x), 0),
      ofY: (porY.find(z => z.y === Y) || { v: 0 }).v, ofGT: Object.fromEntries(G.map(k => [k, porY.reduce((a, z) => a + z.g[k].v, 0)])), ofX, ofGx: ofG, capGx: capG2, sinBase: X.filter(x => !x.base).length };
  }
  function barrasV(D) {
    const { porY } = D, W = 1000, H = 250, B = 44, T = 24, n = porY.length || 1, paso = W / n, bw = Math.min(paso * .5, 160);
    const mx = Math.max(...porY.map(z => z.v), ...porY.map(z => z.c), 1), G = ['efi', 'nuevo', 'otro'];
    return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Valor a crear y capturar por año">${porY.map((z, i) => { const x = paso * i + (paso - bw) / 2; let y = H - B;
      const seg = G.map(g => { const c = z.g[g].c, v = Math.max(z.g[g].v, c), hc = c / mx * (H - B - T), hp = (v - c) / mx * (H - B - T); let s = '';
        if (hc >= .5) { y -= hc; s += `<rect x="${x}" y="${y + 1}" width="${bw}" height="${Math.max(0, hc - 2)}" rx="2" fill="${CAT[g === 'otro' ? 'sin' : g] || '#B9B3C7'}"/>`; }
        if (hp >= .5) { y -= hp; s += `<rect x="${x}" y="${y + 1}" width="${bw}" height="${Math.max(0, hp - 2)}" rx="2" fill="${CAT[g === 'otro' ? 'sin' : g] || '#B9B3C7'}" opacity=".28"/>`; } return s; }).join('');
      return `<g class="tv-hit" tabindex="0" role="button" data-dv="anio:${z.y}"><title>${z.y}: ${esc(m(z.v))} a crear/capturar, ${esc(m(z.c))} capturado (aprox.). Clic para ver las iniciativas</title><rect x="${paso * i}" y="0" width="${paso}" height="${H}" fill="transparent"/>${seg}<text x="${x + bw / 2}" y="${y - 7}" text-anchor="middle" font-size="14" font-weight="800" fill="currentColor">${z.v ? esc(m(z.v)) : ''}</text><text x="${x + bw / 2}" y="${H - 24}" text-anchor="middle" font-size="12.5" font-weight="800">${z.y}</text><text x="${x + bw / 2}" y="${H - 7}" text-anchor="middle" font-size="11.5" class="mu">${z.c ? `capturado ${esc(m(z.c))}` : z.y > +D.d.hoy.slice(0, 4) ? 'por venir' : 'sin captura'}</text></g>`; }).join('')}<line x1="0" x2="${W}" y1="${H - B}" y2="${H - B}" class="ax"/></svg>`;
  }

  /* ---------- el detalle: una lista de iniciativas con su enlace ---------- */
  function detalle(anchor, titulo, items, pie) {
    const p = App.openPop(anchor, `<div class="lbl">${esc(titulo)}</div>${items.length ? `<div class="tv-dl">${items.map(it => `<a class="tv-di" href="${it.href}"><span class="t">${esc(it.nombre)}${it.sub ? `<small>${esc(it.sub)}</small>` : ''}</span>${it.v != null ? `<b>${esc(it.v)}</b>` : ''}<i class="ico ico-flecha"></i></a>`).join('')}</div>` : '<div class="hint" style="padding:0 12px 12px">No hay iniciativas aquí.</div>'}${pie ? `<div class="tv-dpie">${pie}</div>` : ''}`, { width: 300, nofocus: true });
    p.onclick = e => { if (e.target.closest('a')) App.closePop(true); };
  }
  const nom = p => App.projectName(p);
  const ir = (p, t) => `#/proyectos/${p.id}${t ? '/' + t : ''}`;

  /* ---------- gráficos ---------- */
  function barras(D) {
    const { porAnio, cats, Y } = D, W = 1000, H = 250, B = 26, T = 22, n = porAnio.length || 1, paso = W / n, bw = paso * .58;
    const mx = Math.max(...porAnio.map(z => cats.reduce((a, k) => a + z.v[k], 0)), 1);
    return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Valor a crear por año y tipo de valor">${porAnio.map((z, i) => { const x = paso * i + (paso - bw) / 2; let y = H - B; const t = cats.reduce((a, k) => a + z.v[k], 0);
      const seg = cats.map(k => { const h = z.v[k] / mx * (H - B - T); if (h < .5) return ''; y -= h; return `<rect x="${x}" y="${y + 1}" width="${bw}" height="${Math.max(0, h - 2)}" rx="2" fill="${CAT[k]}"/>`; }).join('');
      return `<g class="tv-hit" tabindex="0" role="button" data-dv="anio:${z.y}"><title>${z.y}: ${esc(m(t))}. Clic para ver las iniciativas</title><rect x="${paso * i}" y="0" width="${paso}" height="${H}" fill="transparent"/>${seg}<text x="${x + bw / 2}" y="${y - 6}" text-anchor="middle" font-size="13" font-weight="800" fill="currentColor">${t ? esc(m(t)) : ''}</text><text x="${x + bw / 2}" y="${H - 8}" text-anchor="middle" font-size="11.5" font-weight="${z.y === Y ? 800 : 500}" class="${z.y === Y ? '' : 'mu'}">${z.y}</text></g>`; }).join('')}<line x1="0" x2="${W}" y1="${H - B}" y2="${H - B}" class="ax"/></svg>`;
  }
  function curva(D) {
    const { capG, Y, d } = D, metaTot = D.ofY, W = 620, H = 220, L = 64, R = 12, T = 14, B = 24;
    const hoyM = d.Y === +d.hoy.slice(0, 4) ? +d.hoy.slice(5, 7) - 1 : (d.Y < +d.hoy.slice(0, 4) ? 12 : 0), n = Math.max(0, Math.min(12, hoyM));
    const acu = a => { let s = 0; return a.map(v => (s += v)); }, aE = acu(capG.efi), aN = acu(capG.nuevo), aO = acu(capG.otro);
    const tot = aE.map((v, i) => v + aN[i] + aO[i]);
    const mx = Math.max(metaTot, ...tot, 1), x = i => L + (W - L - R) / 11 * i, y = v => T + (1 - v / mx) * (H - T - B);
    const espM = metaTot / 12, linE = Array.from({ length: 12 }, (_, i) => `${i ? 'L' : 'M'}${x(i)} ${y(espM * (i + 1))}`).join('');
    const area = (top, base, col) => n ? `<path d="${top.slice(0, n).map((v, i) => `${i ? 'L' : 'M'}${x(i)} ${y(v)}`).join('')}${base.slice(0, n).map((v, i) => [i, v]).reverse().map(([i, v]) => `L${x(i)} ${y(v)}`).join('')}Z" fill="${col}" opacity=".85"/>` : '';
    const base0 = Array(12).fill(0), topE = aE, topN = aE.map((v, i) => v + aN[i]), topO = tot;
    const ult = n ? tot[n - 1] : 0;
    return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Captura acumulada por nuevo negocio y eficiencia">${[0, .5, 1].map(f => `<line x1="${L}" x2="${W - R}" y1="${y(f * mx)}" y2="${y(f * mx)}" class="gr"/><text x="${L - 6}" y="${y(f * mx) + 4}" text-anchor="end" font-size="10.5" class="mu">${esc(m(f * mx))}</text>`).join('')}
      ${area(topE, base0, CAT.efi)}${area(topN, topE, CAT.nuevo)}${area(topO, topN, '#B9B3C7')}
      <path d="${linE}" fill="none" class="esp" stroke-width="2" stroke-dasharray="5 4"/>
      ${n ? `<text x="${x(n - 1) - 6}" y="${y(ult) - 10}" text-anchor="end" font-size="12" font-weight="800" fill="currentColor">${esc(m(ult))}</text>` : ''}
      <text x="${x(11)}" y="${y(metaTot) - 8}" text-anchor="end" font-size="11.5" font-weight="700" class="mu">por capturar en el año ${esc(m(metaTot))}</text>
      ${App.d.MES3.map((mm, i) => `<g class="tv-hit" tabindex="0" role="button" data-dv="mes:${i}"><title>${mm} ${Y}: ${esc(m(D.cap[i]))} (nuevo negocio ${esc(m(capG.nuevo[i]))}, eficiencia ${esc(m(capG.efi[i]))}). Clic para ver de quién</title><rect x="${x(i) - (W - L - R) / 22}" y="${T}" width="${(W - L - R) / 11}" height="${H - T}" fill="transparent"/><text x="${x(i)}" y="${H - 6}" text-anchor="middle" font-size="10.5" class="${i === hoyM ? '' : 'mu'}" font-weight="${i === hoyM ? 800 : 500}">${mm}</text></g>`).join('')}</svg>`;
  }
  function embudo(D) {
    const { todosF: todos, Xf: X, capY } = D, lista = k => todos.filter(p => fase(p) === k);
    const act = [1, 2, 3].map(k => ({ k, l: lista(k) })), inact = ['pausa', 'cerrada', 'cancelada'].map(k => ({ k, l: lista(k) })).filter(z => z.l.length);
    const mx = Math.max(...act.map(z => z.l.length), 1), dos = p => { const c = App.caseOf(p.id); return c && App.Avance ? App.Avance.dosAnios(Finanzas.calc(c)) || 0 : 0; };
    const capt = X.filter(x => capY(x) > 0);
    const fila = (k, n, v, nombre, sub, cl) => `<div class="tv-fr ${cl || ''} ${F.fase ? (F.fase === String(k) ? 'sel' : 'dim') : ''}" ${k === 'capt' ? `data-dv="fase:${k}" title="Clic para ver cuáles"` : `data-fx="${k}" title="Clic para filtrar el tablero por esta fase"`} role="button" tabindex="0"><span class="n"><b>${esc(nombre)}</b><span>${esc(sub)}</span></span><span><span class="bar" style="width:${Math.max(12, n / mx * 100)}%;background:${FC[k] || '#160B29'}">${n}</span></span><span class="v">${v ? esc(m(v)) : '—'}</span>${k === 'capt' ? '' : `<button class="tv-ver" data-dv="fase:${k}" title="Ver las iniciativas">Ver</button>`}</div>`;
    return `<div class="tv-fun">${act.map(z => fila(z.k, z.l.length, z.l.reduce((a, p) => a + dos(p), 0), `Fase ${z.k}`, FN[z.k])).join('')}
      ${fila('capt', capt.length, D.captado, 'Capturando', 'ya capturan valor')}
      ${inact.length ? `<div class="tv-sep">Fuera del flujo</div>${inact.map(z => fila(z.k, z.l.length, 0, FN[z.k], plural(z.l.length, 'iniciativa', 'iniciativas'), 'off')).join('')}` : ''}</div>`;
  }
  function mapa(D) {
    const W = 440, H = 240, L = 40, B = 28, T = 14, R = 12;
    const pts = D.ps.map(p => { const v = p.props || {}; return { p, e: Number(v.ice_esfuerzo), i: Number(v.ice_income), f: fase(p) }; }).filter(z => z.e > 0 && z.i > 0);
    if (!pts.length) return '<p class="tv-vacio">Aún no hay iniciativas con Income y Esfuerzo.</p>';
    const mxI = Math.max(...pts.map(z => z.i), 1), x = v => L + Math.min(100, v) / 100 * (W - L - R), y = v => T + (1 - Math.sqrt(v / mxI)) * (H - T - B);
    // Nombres solo de las que más valor dan con poco esfuerzo, sin que se monten unos sobre otros
    const top = []; pts.filter(z => z.e <= 60).sort((a, b) => b.i - a.i).forEach(z => { if (top.length < 3 && top.every(t => Math.abs(y(t.i) - y(z.i)) > 14 || Math.abs(x(t.e) - x(z.e)) > 150)) top.push(z); });
    return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Valor frente a esfuerzo"><rect x="${L}" y="${T}" width="${(W - L - R) / 2}" height="${(H - T - B) / 2}" class="zona" rx="6"/>
      <text x="${L + 8}" y="${T + 16}" font-size="11" font-weight="800" class="ok">Hacer primero</text><text x="${W - R - 6}" y="${H - B - 8}" text-anchor="end" font-size="11" font-weight="700" class="mu">Revisar si vale la pena</text>
      <line x1="${L}" x2="${W - R}" y1="${H - B}" y2="${H - B}" class="ax"/><line x1="${L}" x2="${L}" y1="${T}" y2="${H - B}" class="ax"/>
      ${pts.map(z => `<g class="tv-hit" tabindex="0" role="button" data-dv="pt:${z.p.id}"><title>${esc(nom(z.p))}: Income ${z.i}, esfuerzo ${z.e} %. Clic para abrir</title><circle cx="${x(z.e)}" cy="${y(z.i)}" r="12" fill="transparent"/><circle cx="${x(z.e)}" cy="${y(z.i)}" r="7" fill="${FC[z.f] || '#9A96A6'}" class="pt"/></g>`).join('')}
      ${top.map(z => `<text x="${Math.min(x(z.e) + 11, W - 150)}" y="${y(z.i) + 4}" font-size="11" font-weight="700" fill="currentColor" pointer-events="none">${esc(nom(z.p).slice(0, 26))}</text>`).join('')}
      <text x="${(L + W) / 2}" y="${H - 8}" text-anchor="middle" font-size="10.5" class="mu">esfuerzo →</text><text x="13" y="${(T + H - B) / 2}" font-size="10.5" class="mu" transform="rotate(-90 13 ${(T + H - B) / 2})" text-anchor="middle">valor (Income) →</text></svg>`;
  }
  function riesgos(D) {
    const R = D.todos.flatMap(p => (App.Riesgos ? App.Riesgos.lista(p) : []).filter(r => r.estado !== 'Cerrado').map(r => ({ p, r })));
    const en = (pp, ii) => R.filter(({ r }) => (r.rp > 0 && r.ri > 0 ? r.rp === pp && r.ri === ii : r.p === pp && r.i === ii));
    const nivel = v => (v >= 15 ? 'cr' : v >= 10 ? 'a' : v >= 5 ? 'm' : 'b');
    return `<div class="tv-hm">${[5, 4, 3, 2, 1].map(pp => `<span class="ax">${pp}</span>` + [1, 2, 3, 4, 5].map(ii => { const n = en(pp, ii).length; return `<button class="c ${nivel(pp * ii)} ${n ? '' : 'v'}" data-dv="rk:${pp},${ii}" ${n ? '' : 'disabled'} title="Probabilidad ${pp} × impacto ${ii}${n ? `: ${plural(n, 'riesgo', 'riesgos')}` : ''}">${n || ''}</button>`; }).join('')).join('')}<span class="ax"></span>${[1, 2, 3, 4, 5].map(i => `<span class="ax">${i}</span>`).join('')}</div>
      <div class="tv-lg"><span><i class="cr"></i>Crítico</span><span><i class="a"></i>Alto</span><span><i class="m"></i>Medio</span><span><i class="b"></i>Bajo</span><span>↑ probabilidad, impacto →</span></div>
      ${R.length ? '' : '<p class="tv-vacio">Aún no hay riesgos registrados en estas iniciativas.</p>'}`;
  }
  function cronos(D) {
    const hoy = D.d.hoy;
    const esp = acts => { let w = 0, s = 0; acts.forEach(a => { if (!a.inicio || !a.fin) return; const dur = Math.max(1, App.d.diff(a.inicio, a.fin) + 1); const k = hoy < a.inicio ? 0 : hoy >= a.fin ? 1 : (App.d.diff(a.inicio, hoy) + 1) / dur; w += dur; s += dur * k * 100; }); return w ? Math.round(s / w) : 0; };
    const l = D.ps.map(p => { const pl = App.planOf(p.id); return pl.acts.length ? { p, av: pl.avance, es: esp(pl.acts) } : null; }).filter(Boolean).sort((a, b) => (b.es - b.av) - (a.es - a.av)).slice(0, 7);
    if (!l.length) return '<p class="tv-vacio">Aún no hay cronogramas cargados.</p>';
    return `<div class="tv-cr">${l.map(z => { const g = z.es - z.av, c = g > 15 ? 'r' : g > 5 ? 'o' : 'g';
      return `<a class="tv-c" href="${ir(z.p)}" title="${esc(nom(z.p))}: lleva ${z.av} %, debería llevar ${z.es} %. Clic para abrir el cronograma"><span class="nm">${esc(nom(z.p))}</span><span class="tr"><i class="${c}" style="width:${z.av}%"></i><u style="left:${z.es}%"></u></span><span class="p">${z.av} %</span></a>`; }).join('')}</div>
      <div class="tv-nota">Rojo: más de 15 puntos detrás de lo planeado. Naranja: entre 5 y 15.</div>`;
  }
  function okrs(D) {
    const mp = new Map();
    D.X.forEach(x => App.okrsDe(x.p).forEach(o => { const z = mp.get(o) || { o, n: 0, pr: 0, ca: 0 }; z.n++; z.pr += D.anual(x, D.Y); z.ca += D.capY(x); mp.set(o, z); }));
    const L = [...mp.values()].sort((a, b) => b.pr - a.pr || b.n - a.n).slice(0, 7);
    if (!L.length) return '<p class="tv-vacio">Las iniciativas aún no tienen OKR asignados.</p>';
    return `<div class="tv-ok">${L.map(z => `<button class="tv-o" data-dv="okr:${esc(z.o)}" title="Clic para ver sus iniciativas"><span class="nm">${esc(z.o)}<small>${plural(z.n, 'iniciativa', 'iniciativas')}${(o => { const a = o && App.Valor.avanceObj(o); return a != null ? `, <b>${a} % de cumplimiento</b>` : ''; })(App.Valor ? App.Valor.objetivos().find(o => o.nombre === z.o) : null)}</small></span><span class="tr"><i style="width:${Math.min(100, z.ca / Math.max(z.pr, 1) * 100)}%"></i>${z.pr ? `<u style="left:${Math.min(100, D.d.corrido / 12 * 100)}%"></u>` : ''}</span><span class="v">${z.pr ? esc(m(z.pr)) : '—'}</span></button>`).join('')}</div>`;
  }
  function agenda(D) {
    const hoy = D.d.hoy, lim = App.d.add(hoy, 30);
    const ev = App.S.sessions.filter(s => s.fecha >= hoy && s.fecha <= lim && s.estado !== 'Cancelada').map(s => ({ f: s.fecha, t: App.Agenda ? App.Agenda.tituloOf(s) : 'Comité', s: plural((s.proyectos || []).length, 'iniciativa', 'iniciativas') + ' en agenda', k: 'c', href: '#/agenda' }))
      .concat(App.S.activities.filter(a => a.hito && !App.esEjemplo(a.project_id) && (a.fin || '') >= hoy && a.fin <= lim).map(a => { const p = App.byId('projects', a.project_id); return p ? { f: a.fin, t: a.name || 'Hito', s: nom(p), k: 'h', href: ir(p) } : null; }).filter(Boolean))
      .sort((a, b) => a.f.localeCompare(b.f)).slice(0, 5);
    if (!ev.length) return '<p class="tv-vacio">Sin comités ni hitos en los próximos 30 días.</p>';
    return `<div class="tv-ag">${ev.map(e => `<a class="tv-a" href="${e.href}"><span class="d"><b>${+e.f.slice(8)}</b><small>${App.d.MES3[+e.f.slice(5, 7) - 1]}</small></span><span class="t"><b>${esc(e.t)}</b><span>${esc(e.s)}</span></span><em class="${e.k}"><i class="ico ${e.k === 'c' ? 'ico-comite' : 'ico-hito'}"></i>${e.k === 'c' ? 'Comité' : 'Hito'}</em></a>`).join('')}</div>`;
  }
  function mini(D) {
    const mx = Math.max(...D.cap, 1), hasta = D.Y === +D.d.hoy.slice(0, 4) ? +D.d.hoy.slice(5, 7) - 1 : 12;
    return `<svg viewBox="0 0 120 34" width="120" height="34" aria-hidden="true">${D.cap.map((v, i) => { const h = v / mx * 30; return `<rect x="${i * 10}" y="${34 - Math.max(h, 1.5)}" width="7" height="${Math.max(h, 1.5)}" rx="1.5" class="${i < hasta ? 'on' : 'off'}"/>`; }).join('')}</svg>`;
  }

  /* ---------- la página ---------- */
  function render(main, sub) {
    const D = datos(), { d, Y } = D;
    const nSin = D.sinReg.length, pc = D.esperado ? D.captado / D.esperado : null;
    const ritmo = pc == null ? (nSin ? ['nr', 'ico-reloj', `Falta registrar en ${plural(nSin, 'iniciativa', 'iniciativas')}`] : null) : pc >= .9 ? ['ok', 'ico-ok', 'Al ritmo'] : pc >= .6 ? ['o', 'ico-reloj', 'Algo por debajo'] : ['r', 'ico-alerta', 'Por debajo del ritmo'];
    const ec = App.estadoCol(), dgv = App.dgvHay();
    main.className = 'tv';
    main.innerHTML = `<div class="tv-h"><button class="burger" data-act="burger" aria-label="Menú">☰</button><h1>Tablero de valor</h1><span class="s">Gerencia de Generación de Valor, datos al ${esc(App.d.fmt(d.hoy))}</span><span class="sp"></span>
        ${F.fase ? `<button class="tv-chip" data-fx="${esc(F.fase)}" title="Quitar el filtro">Mostrando ${esc(faseNombre(isNaN(+F.fase) ? F.fase : +F.fase))} <b>✕</b></button>` : ''}</div>
      ${sub}
      
      <div class="tv-kpi">
        <button class="tv-p tv-k k1" data-dv="kpi:cap"><span><span class="l">Capturado en ${Y}, aprox.</span><span class="n">${esc(m(D.captado))}</span>${App.aud() ? `<span class="c"><b>${esc(m(D.verif))}</b> verificado${D.captado ? ` (${Math.round(D.verif / D.captado * 100)} %)` : ''}</span>` : ''}<span class="c">de ${esc(m(D.ofY))} por capturar en ${Y}</span><span class="c tv-gr"><span><i style="background:${CAT.nuevo}"></i><b>${esc(m(D.capGT.nuevo))}</b> nuevo negocio</span><span><i style="background:${CAT.efi}"></i><b>${esc(m(D.capGT.efi))}</b> eficiencia</span></span></span></button>
        <button class="tv-p tv-k" data-dv="kpi:vc"><span class="l">Capturado ${D.PV.d}–${D.PV.h}, aprox.</span><span class="n">${esc(m(D.capPer))}</span><span class="c">de ${esc(m(D.ofTot))} a crear/capturar${D.ofTot ? ` (${Math.round(D.capPer / D.ofTot * 100)} %)` : ''}</span></button>
        <button class="tv-p tv-k" data-dv="kpi:aprob"><span class="l">Casos aprobados</span><span class="n">${D.aprob.length}</span><span class="c">${esc(m(D.aprob.reduce((a, c) => a + (App.Avance ? App.Avance.dosAnios(Finanzas.calc(c)) : 0), 0)))} a dos años</span></button>
        <button class="tv-p tv-k" data-dv="kpi:rev"><span class="l">Por decidir en comité</span><span class="n">${D.rev.length}</span><span class="c">${D.rev.length ? plural(D.rev.length, 'caso en revisión', 'casos en revisión') : 'nada pendiente'}</span></button>
        <button class="tv-p tv-k" data-dv="kpi:rojo"><span class="l">Iniciativas en rojo</span><span class="n">${D.crit.length}</span><span class="c">con atrasos o riesgos críticos</span>${D.crit.length ? '<span class="st r"><i class="ico ico-flecha"></i>Ver cuáles</span>' : ''}</button>
      </div>
      <div class="tv-g"><section class="tv-p"><div class="tv-t"><h2>¿Cuánto valor vamos a crear y capturar?</h2><small>valor a crear/capturar ${D.PV.d}–${D.PV.h}, por año: lo capturado (color lleno) y lo que falta (claro); clic en un año</small><span class="sp"></span>${App.esAdmin && App.esAdmin() ? `<button class="t-lnk" data-periodo>Periodo ${D.PV.d}–${D.PV.h}</button>` : ''}</div>
        <div class="tv-big"><div><div class="n">${esc(m(D.ofTot))}</div><div class="s">${D.ofNotion ? `${esc(m(D.ofNotion))} es la cifra de Notion` : 'Aún no hay valor a crear/capturar'}${D.ofCaso ? `; ${esc(m(D.ofCaso))} viene de casos de negocio de iniciativas sin cifra en Notion` : ''}.</div>
          <div class="tv-rows">${['nuevo', 'efi', 'otro'].filter(g => D.ofGT[g] > 0).map(g => `<div><i style="background:${CAT[g === 'otro' ? 'sin' : g]}"></i><span>${esc(App.grupoLabel(g))}</span><b>${esc(m(D.ofGT[g]))}</b><em>${D.ofTot ? Math.round(D.ofGT[g] / D.ofTot * 100) : 0} %</em></div>`).join('')}</div>
          <div class="tv-cap2"><span>Capturado a la fecha, aprox. <b>${esc(m(D.capPer))}</b></span><span>Por capturar <b>${esc(m(Math.max(0, D.ofTot - D.capPer)))}</b></span></div></div>${D.ofTot ? barrasV(D) : '<p class="tv-vacio">Aún no hay valor a crear/capturar ni casos con beneficios en el periodo.</p>'}</div>
        <p class="tv-nota">Aparte, los casos de negocio proyectan ${esc(m(D.tot))} a ${d.anios.length} años: <a href="#/casos">ver en Valor</a>.${D.atip.length ? ` Hay un caso con años fuera de rango: <a href="#/proyectos/${D.atip[0].top.x.p.id}/caso">${esc(nom(D.atip[0].top.x.p))}</a> (revisar si sus cifras están en pesos o millones).` : ''}</p></section></div>
      <div class="tv-g g2">
        <section class="tv-p"><div class="tv-t"><h2>¿Cuánto se va capturando?</h2><small>aproximado, acumulado en el año, clic en un mes</small><span class="sp"></span><label class="tv-mini">Año <select data-tvf="anio">${d.anios.map(y => `<option ${y === Y ? 'selected' : ''}>${y}</option>`).join('')}</select></label></div>
          <div class="tv-lg"><span><i style="background:${CAT.nuevo}"></i>Nuevo negocio</span><span><i style="background:${CAT.efi}"></i>Eficiencia</span><span><i class="dash"></i>Por capturar en el año</span></div>${curva(D)}<div class="tv-nota">Valores aproximados: en las iniciativas en escalamiento se toma su valor a crear/capturar (o su caso, si no tiene cifra) repartido por mes desde que escalaron. Si alguien registra la cifra real de un mes, esa reemplaza la aproximada.</div></section>
        <section class="tv-p"><div class="tv-t"><h2>¿Dónde está el portafolio?</h2><small>clic en una fase para ver solo esa en todo el tablero</small></div>${embudo(D)}</section>
      </div>
      <div class="tv-g g3">
        <section class="tv-p"><div class="tv-t"><h2>¿Qué priorizar?</h2><small>valor frente a esfuerzo</small></div><div class="tv-lg">${[1, 2, 3].map(k => `<span><i style="background:${FC[k]};border-radius:50%"></i>Fase ${k}</span>`).join('')}</div>${mapa(D)}</section>
        <section class="tv-p"><div class="tv-t"><h2>¿Qué riesgos pesan?</h2><small>probabilidad × impacto</small><span class="sp"></span><a href="#/riesgos">Ver riesgos</a></div>${riesgos(D)}</section>
        <section class="tv-p"><div class="tv-t"><h2>¿Cumplen los cronogramas?</h2><small>avance real, │ lo que debería llevar hoy</small></div>${cronos(D)}</section>
      </div>
      <div class="tv-g g2b">
        <section class="tv-p"><div class="tv-t"><h2>¿Cómo vamos en cada OKR?</h2><small>capturado frente a lo proyectado ${Y}</small></div>${okrs(D)}</section>
        <section class="tv-p"><div class="tv-t"><h2>Próximos 30 días</h2><small>comités e hitos</small><span class="sp"></span><a href="#/agenda">Ver agenda</a></div>${agenda(D)}</section>
      </div>`;

    main.onchange = e => { const k = e.target.dataset.tvf; if (!k) return; F[k] = k === 'anio' ? Number(e.target.value) : e.target.value; guardar(); App.render(); };
    main.onclick = e => {
      if (e.target.closest('.burger')) return App.toggleSide();
      if (e.target.closest('[data-dgv]')) { App.store.set('alcance.dgv', App.soloDgv() ? 'todas' : 'si'); return App.render(); }
      const fx = e.target.closest('[data-fx]'); if (fx && !e.target.closest('[data-dv]')) { F.fase = F.fase === fx.dataset.fx ? '' : fx.dataset.fx; guardar(); return App.render(); }
      const pe = e.target.closest('[data-periodo]'); if (pe) { const PV = App.periodoValor(), ys = Array.from({ length: 16 }, (_, i) => 2020 + i), op = s => ys.map(y => `<option ${y === s ? 'selected' : ''}>${y}</option>`).join('');
        const pp = App.openPop(pe, `<div class="lbl">Periodo del valor a crear/capturar</div><div class="vl-f"><label>Desde<select data-pv="d">${op(PV.d)}</select></label><label>Hasta<select data-pv="h">${op(PV.h)}</select></label><p class="faint" style="margin:0">La cifra de cada iniciativa se reparte en partes iguales entre estos años.</p></div><div class="row"><button class="btn primary sm" data-pv="ok">Guardar</button></div>`, { width: 300, auto: false });
        pp.onclick = ev => { if (!ev.target.closest('[data-pv=ok]')) return; const d0 = +pp.querySelector('[data-pv=d]').value, h0 = +pp.querySelector('[data-pv=h]').value; if (h0 < d0) return App.toast('«Hasta» no puede ser antes de «Desde»', true);
          App.guard(async () => { App.S.tablero = await App.api('PUT', '/api/config/tablero', { valor_desde: d0, valor_hasta: h0 }); App.closePop(true); App.render(); }); }; return; }
      if (e.target.closest('[data-qe-ed]')) return App.Mejoras.editarQueEs(e.target.closest('[data-qe-ed]'));
      const t = e.target.closest('[data-dv]'); if (!t) return;
      if (App.aud() && t.dataset.dv === 'kpi:rev') return App.go('#/agenda');
      const [k, ...rest] = t.dataset.dv.split(':'), v = rest.join(':');
      if (k === 'anio') { const y = +v, G = ['nuevo', 'efi', 'otro']; return detalle(t, `Valor a crear/capturar en ${y}`, D.X.map(x => ({ x, val: G.reduce((a, g) => a + D.ofGx(x, g, y), 0), cap: G.reduce((a, g) => a + D.capGx(x, g, y), 0) })).filter(z => z.val > 0 || z.cap > 0).sort((a, b) => b.val - a.val).map(z => ({ nombre: nom(z.x.p), sub: `${z.x.base === 'caso' ? 'según su caso' : 'cifra de Notion'}${z.cap ? `, capturado ${m(z.cap)}` : ''}`, v: m(z.val), href: ir(z.x.p, 'valor/captura') }))); }
      if (k === 'mes') { const i = +v, l = D.capPor[i].sort((a, b) => b.v - a.v); return detalle(t, `Capturado en ${App.d.MESES ? App.d.MESES[i] : App.d.MES3[i]} de ${Y}`, l.map(z => ({ nombre: nom(z.x.p), v: m(z.v), href: ir(z.x.p, 'caso') }))); }
      if (k === 'fase') {
        const l = v === 'capt' ? D.Xf.filter(x => D.capY(x) > 0).map(x => x.p) : D.todosF.filter(p => String(fase(p)) === v);
        const dos = p => { const c = App.caseOf(p.id); return c && App.Avance ? App.Avance.dosAnios(Finanzas.calc(c)) || 0 : 0; };
        return detalle(t, v === 'capt' ? 'Ya registran valor' : faseNombre(isNaN(+v) ? v : +v), l.map(p => ({ nombre: nom(p), sub: (App.planOf(p.id).acts.length ? `${App.planOf(p.id).avance} % de avance` : 'sin cronograma') + (App.caseOf(p.id) ? '' : ', sin caso'), v: dos(p) ? m(dos(p)) : null, href: ir(p) })), v === 'capt' ? '' : `<a href="#/proyectos" data-fase-ir="${v}">Ver en el Portafolio</a>`);
      }
      if (k === 'pt') { const p = App.byId('projects', v); if (p) App.go(ir(p, 'info')); return; }
      if (k === 'rk') { const [pp, ii] = v.split(',').map(Number); const l = D.todos.flatMap(p => (App.Riesgos ? App.Riesgos.lista(p) : []).filter(r => r.estado !== 'Cerrado' && (r.rp > 0 && r.ri > 0 ? r.rp === pp && r.ri === ii : r.p === pp && r.i === ii)).map(r => ({ p, r })));
        return detalle(t, `Riesgos con probabilidad ${pp} e impacto ${ii}`, l.map(z => ({ nombre: z.r.titulo || 'Riesgo', sub: nom(z.p), href: ir(z.p, 'riesgos') }))); }
      if (k === 'okr') { const l = D.X.filter(x => App.okrsDe(x.p).includes(v)); return detalle(t, v, l.map(x => ({ nombre: nom(x.p), sub: `${m(D.capY(x))} capturados en ${Y}`, v: D.anual(x, Y) ? m(D.anual(x, Y)) : null, href: ir(x.p) }))); }
      if (k === 'kpi') {
        if (v === 'cap') return detalle(t, `Capturado en ${Y}, aprox.`, D.X.filter(x => D.capY(x) > 0).sort((a, b) => D.capY(b) - D.capY(a)).map(x => ({ nombre: nom(x.p), sub: `${App.grupoLabel(App.grupoDe(x.catPrincipal || 'otro'))}${x.desde ? `, escaló en ${App.d.MES3[+x.desde.slice(5) - 1]} ${x.desde.slice(0, 4)}` : ', registrado a mano'}`, v: m(D.capY(x)), href: ir(x.p, 'valor/captura') })));
        if (v === 'vc') return detalle(t, `Capturado ${D.PV.d}–${D.PV.h}, aprox.`, D.X.map(x => ({ x, c: D.porY.reduce((a, z) => a + ['nuevo', 'efi', 'otro'].reduce((q, g) => q + D.capGx(x, g, z.y), 0), 0), o: D.ofX(x) })).filter(z => z.c > 0 || z.o > 0).sort((a, b) => b.c - a.c || b.o - a.o).map(z => ({ nombre: nom(z.x.p), sub: `de ${m(z.o)} a crear/capturar${z.x.desde ? `, escaló en ${App.d.MES3[+z.x.desde.slice(5) - 1]} ${z.x.desde.slice(0, 4)}` : ''}`, v: m(z.c), href: ir(z.x.p, 'valor/captura') })));
        if (v === 'vc-viejo') return detalle(t, 'Valor a crear/capturar', D.X.filter(x => Number((x.p.props || {}).valor_crear) > 0).sort((a, b) => b.p.props.valor_crear - a.p.props.valor_crear).map(x => ({ nombre: nom(x.p), sub: faseNombre(fase(x.p)), v: m(Number(x.p.props.valor_crear)), href: ir(x.p, 'info') })), `${D.X.filter(x => !(Number((x.p.props || {}).valor_crear) > 0)).length} iniciativas del foco aún no tienen esta cifra`);
        if (v === 'proy') return detalle(t, 'Lo que más valor proyecta', D.X.filter(x => x.caso).map(x => ({ x, t: d.anios.reduce((a, y) => a + D.anual(x, y), 0) })).filter(z => z.t > 0).sort((a, b) => b.t - a.t).map(z => ({ nombre: nom(z.x.p), sub: App.grupoLabel(App.grupoDe(z.x.catPrincipal || 'otro')), v: m(z.t), href: ir(z.x.p, 'caso') })));
        if (v === 'aprob') return detalle(t, 'Casos aprobados', D.aprob.map(c => { const p = App.byId('projects', c.project_id), f = Finanzas.calc(c); return { nombre: nom(p), sub: 'valor a dos años', v: m(App.Avance ? App.Avance.dosAnios(f) : 0), href: ir(p, 'caso') }; }));
        if (v === 'rev') return detalle(t, 'Por decidir en comité', D.rev.map(c => { const p = App.byId('projects', c.project_id), f = Finanzas.calc(c); return { nombre: nom(p), sub: 'valor a dos años', v: m(App.Avance ? App.Avance.dosAnios(f) : 0), href: ir(p, 'caso') }; }), '<a href="#/agenda">Ver la agenda del comité</a>');
        if (v === 'rojo') return detalle(t, 'Iniciativas en rojo', D.crit.map(z => ({ nombre: nom(z.x.p), sub: (z.out.filter(o => o.sev >= 3)[0] || {}).t || '', href: ir(z.x.p) })));
      }
    };
    // Al pasar el mouse por una barra, un mes o un punto: se resalta, lo demás se atenúa y aparece el dato
    let tip = document.querySelector('.tv-tip'); if (!tip) { tip = document.createElement('div'); tip.className = 'tv-tip'; tip.hidden = true; document.body.appendChild(tip); }
    const quitar = () => { tip.hidden = true; main.querySelectorAll('svg.tv-hov').forEach(x => x.classList.remove('tv-hov')); main.querySelectorAll('.tv-hit.on').forEach(x => x.classList.remove('on')); };
    main.onmousemove = e => {
      const h = e.target.closest && e.target.closest('.tv-hit'); if (!h) return quitar();
      const t = h.querySelector('title'); if (t) { h.dataset.tip = t.textContent; t.remove(); }
      if (!h.classList.contains('on')) { quitar(); h.classList.add('on'); const sv = h.closest('svg'); if (sv) sv.classList.add('tv-hov'); }
      const [a, ...r] = String(h.dataset.tip || '').split('. '); tip.innerHTML = `<b>${esc(a)}</b>${esc(r.join('. '))}`; tip.hidden = false;
      const w = tip.offsetWidth; tip.style.left = Math.min(innerWidth - w - 12, e.clientX + 16) + 'px'; tip.style.top = (e.clientY + 14) + 'px';
    };
    main.onmouseleave = quitar;
    window.addEventListener('hashchange', quitar, { once: true });
    // «Ver en el Portafolio» desde el detalle de una fase
    const pop = document.getElementById('pop');
    if (pop && !pop._tvFase) { pop._tvFase = true; pop.addEventListener('click', e => { const a = e.target.closest('[data-fase-ir]'); if (!a || !App.Portafolio || !App.Portafolio.filtrarFase) return; e.preventDefault(); App.closePop(true); App.Portafolio.filtrarFase(a.dataset.faseIr); }); }
  }
  document.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('tv-hit')) { e.preventDefault(); e.target.dispatchEvent(new MouseEvent('click', { bubbles: true })); } });
  App.TableroVisual = { atipicoDe: pid => { try { return datos().atip.filter(z => z.top && z.top.x.p.id === pid); } catch (e) { return []; } }, render };
})();
