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
  const CAT = { ingresos: '#F08A5D', ahorro: '#5B9BEA', eficiencia: '#3FC293', tiempo: '#DDA02E', riesgo: '#EE8FB6', otro: '#8E7CE0' };
  const FC = { 1: '#3367CD', 2: '#E07A12', 3: '#16935A', pausa: '#9A96A6', cerrada: '#7E64C8', cancelada: '#C8102E' };
  const FN = { 1: 'Planeación', 2: 'Ejecución, piloto y seguimiento', 3: 'Escalamiento y captura de valor', pausa: 'En pausa', cerrada: 'Cerrada', cancelada: 'Cancelada' };
  const F = Object.assign({ anio: null, fase: '' }, App.store.get('tv', {}));
  const guardar = () => App.store.set('tv', F);
  const plural = (n, s, p) => `${n} ${n === 1 ? s : p}`;
  const fase = p => { const ec = App.estadoCol(); return window.Fases && ec ? Fases.clasificar((p.props || {})[ec.id]) : null; };
  const faseNombre = k => (typeof k === 'number' ? `Fase ${k}, ${FN[k]}` : FN[k] || 'Sin fase');

  function datos() {
    const d = App.Dash.datos({ anio: F.anio, estado: '', tipo: '', alcance: 'todos', dgv: true });
    const pasa = p => !App.esEjemplo(p) && (!F.fase || String(fase(p)) === F.fase);
    const X = d.proyectos.filter(x => pasa(x.p));
    const todos = App.projectsSorted().filter(p => App.enAlcance(p) && pasa(p));
    const ps = todos.filter(p => { const f = fase(p); return f !== 'pausa' && f !== 'cerrada' && f !== 'cancelada'; });
    const Y = d.Y, cats = d.cats.filter(k => X.some(x => d.anios.some(y => x.anual(k, y) > 0)));
    const anual = (x, y) => d.cats.reduce((a, k) => a + x.anual(k, y), 0), capY = x => d.cats.reduce((a, k) => a + x.captado(k, Y), 0);
    const porAnio = d.anios.map(y => ({ y, v: Object.fromEntries(cats.map(k => [k, X.reduce((a, x) => a + x.anual(k, y), 0)])) }));
    const tot = porAnio.reduce((a, z) => a + cats.reduce((q, k) => q + z.v[k], 0), 0);
    const meta = X.reduce((a, x) => a + anual(x, Y), 0), captado = X.reduce((a, x) => a + capY(x), 0);
    const esperado = meta * d.corrido / 12;
    const cap = Array(12).fill(0), capPor = Array.from({ length: 12 }, () => []);
    X.forEach(x => (x.caso && x.caso.captado || []).forEach(c => { if (String(c.mes).startsWith(Y + '-')) { const i = +c.mes.slice(5) - 1, v = Number(c.valor) || 0; cap[i] += v; capPor[i].push({ x, v }); } }));
    const casos = App.S.cases.filter(c => { const p = App.byId('projects', c.project_id); return p && pasa(p) && App.enAlcance(p); });
    const sg = App.Dash.senales(d).filter(z => pasa(z.x.p));
    return { d, X, ps, todos, Y, cats, anual, capY, porAnio, tot, meta, captado, esperado, cap, capPor, casos, sg, crit: sg.filter(z => z.max >= 3), rev: casos.filter(c => c.estado === 'En revisión'), aprob: casos.filter(c => c.estado === 'Aprobado') };
  }

  /* ---------- el detalle: una lista de iniciativas con su enlace ---------- */
  function detalle(anchor, titulo, items, pie) {
    const p = App.openPop(anchor, `<div class="lbl">${esc(titulo)}</div>${items.length ? `<div class="tv-dl">${items.map(it => `<a class="tv-di" href="${it.href}"><span class="t">${esc(it.nombre)}${it.sub ? `<small>${esc(it.sub)}</small>` : ''}</span>${it.v != null ? `<b>${esc(it.v)}</b>` : ''}<i class="ico ico-flecha"></i></a>`).join('')}</div>` : '<div class="hint" style="padding:0 12px 12px">No hay iniciativas aquí.</div>'}${pie ? `<div class="tv-dpie">${pie}</div>` : ''}`, { width: 360, nofocus: true });
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
      return `<g class="tv-hit" data-dv="anio:${z.y}"><title>${z.y}: ${esc(m(t))}. Clic para ver las iniciativas</title><rect x="${paso * i}" y="0" width="${paso}" height="${H}" fill="transparent"/>${seg}<text x="${x + bw / 2}" y="${y - 6}" text-anchor="middle" font-size="13" font-weight="800" fill="currentColor">${t ? esc(m(t)) : ''}</text><text x="${x + bw / 2}" y="${H - 8}" text-anchor="middle" font-size="11.5" font-weight="${z.y === Y ? 800 : 500}" class="${z.y === Y ? '' : 'mu'}">${z.y}</text></g>`; }).join('')}<line x1="0" x2="${W}" y1="${H - B}" y2="${H - B}" class="ax"/></svg>`;
  }
  function curva(D) {
    const { cap, meta, Y, d } = D, W = 620, H = 220, L = 64, R = 12, T = 14, B = 24;
    let ac = 0; const acC = cap.map(v => (ac += v)); const hoyM = d.Y === +d.hoy.slice(0, 4) ? +d.hoy.slice(5, 7) - 1 : (d.Y < +d.hoy.slice(0, 4) ? 12 : 0);
    const mx = Math.max(meta, ...acC, 1), x = i => L + (W - L - R) / 11 * i, y = v => T + (1 - v / mx) * (H - T - B);
    const espM = meta / 12, esp = Array.from({ length: 12 }, (_, i) => espM * (i + 1)), hasta = acC.slice(0, Math.max(0, Math.min(12, hoyM)));
    const linE = esp.map((v, i) => `${i ? 'L' : 'M'}${x(i)} ${y(v)}`).join(''), linC = hasta.map((v, i) => `${i ? 'L' : 'M'}${x(i)} ${y(v)}`).join('');
    const area = hasta.length ? linC + `L${x(hasta.length - 1)} ${y(0)}L${x(0)} ${y(0)}Z` : '';
    return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Capturado frente a esperado, acumulado">${[0, .5, 1].map(f => `<line x1="${L}" x2="${W - R}" y1="${y(f * mx)}" y2="${y(f * mx)}" class="gr"/><text x="${L - 6}" y="${y(f * mx) + 4}" text-anchor="end" font-size="10.5" class="mu">${esc(m(f * mx))}</text>`).join('')}
      <path d="${area}" fill="#FFC900" opacity=".3"/><path d="${linE}" fill="none" class="esp" stroke-width="2" stroke-dasharray="5 4"/><path d="${linC}" fill="none" stroke="currentColor" stroke-width="2.5"/>
      ${hasta.length ? `<circle cx="${x(hasta.length - 1)}" cy="${y(hasta[hasta.length - 1])}" r="5" fill="currentColor"/><text x="${x(hasta.length - 1) - 8}" y="${y(hasta[hasta.length - 1]) - 10}" text-anchor="end" font-size="12" font-weight="800" fill="currentColor">${esc(m(hasta[hasta.length - 1]))}</text>` : ''}
      ${hoyM > 0 && hoyM <= 12 ? `<text x="${x(Math.min(11, hoyM)) - 6}" y="${y(esp[Math.min(11, hoyM)]) - 10}" text-anchor="end" font-size="11.5" font-weight="700" class="mu">esperado ${esc(m(espM * hoyM))}</text>` : ''}
      ${App.d.MES3.map((mm, i) => `<g class="tv-hit" data-dv="mes:${i}"><title>${mm} ${Y}: ${esc(m(cap[i]))} capturados. Clic para ver quién</title><rect x="${x(i) - (W - L - R) / 22}" y="${T}" width="${(W - L - R) / 11}" height="${H - T}" fill="transparent"/><text x="${x(i)}" y="${H - 6}" text-anchor="middle" font-size="10.5" class="${i === hoyM ? '' : 'mu'}" font-weight="${i === hoyM ? 800 : 500}">${mm}</text></g>`).join('')}</svg>`;
  }
  function embudo(D) {
    const { todos, X, capY } = D, lista = k => todos.filter(p => fase(p) === k);
    const act = [1, 2, 3].map(k => ({ k, l: lista(k) })), inact = ['pausa', 'cerrada', 'cancelada'].map(k => ({ k, l: lista(k) })).filter(z => z.l.length);
    const mx = Math.max(...act.map(z => z.l.length), 1), dos = p => { const c = App.caseOf(p.id); return c && App.Avance ? App.Avance.dosAnios(Finanzas.calc(c)) || 0 : 0; };
    const capt = X.filter(x => capY(x) > 0);
    const fila = (k, n, v, nombre, sub, cl) => `<button class="tv-fr ${cl || ''}" data-dv="fase:${k}" title="Clic para ver las iniciativas"><span class="n"><b>${esc(nombre)}</b><span>${esc(sub)}</span></span><span><span class="bar" style="width:${Math.max(12, n / mx * 100)}%;background:${FC[k] || '#160B29'}">${n}</span></span><span class="v">${v ? esc(m(v)) : '—'}</span></button>`;
    return `<div class="tv-fun">${act.map(z => fila(z.k, z.l.length, z.l.reduce((a, p) => a + dos(p), 0), `Fase ${z.k}`, FN[z.k])).join('')}
      ${fila('capt', capt.length, D.captado, 'Capturando', 'ya registran valor')}
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
      ${pts.map(z => `<g class="tv-hit" data-dv="pt:${z.p.id}"><title>${esc(nom(z.p))}: Income ${z.i}, esfuerzo ${z.e} %. Clic para abrir</title><circle cx="${x(z.e)}" cy="${y(z.i)}" r="12" fill="transparent"/><circle cx="${x(z.e)}" cy="${y(z.i)}" r="7" fill="${FC[z.f] || '#9A96A6'}" class="pt"/></g>`).join('')}
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
    const pc = D.esperado ? D.captado / D.esperado : null, ritmo = pc == null ? null : pc >= .9 ? ['ok', 'ico-ok', 'Al ritmo'] : pc >= .6 ? ['o', 'ico-reloj', 'Algo por debajo'] : ['r', 'ico-alerta', 'Por debajo del ritmo'];
    const ec = App.estadoCol(), dgv = App.dgvHay();
    main.className = 'tv';
    main.innerHTML = `<div class="tv-h"><button class="burger" data-act="burger" aria-label="Menú">☰</button><h1>Tablero</h1><span class="s">Datos al ${esc(App.d.fmt(d.hoy))}</span><span class="sp"></span>
        <div class="tv-f"><label>Año <select data-tvf="anio">${d.anios.map(y => `<option ${y === Y ? 'selected' : ''}>${y}</option>`).join('')}</select></label>
        ${dgv ? `<button class="tv-fb" data-dgv>${App.soloDgv() ? 'Foco DGV' : 'Con históricas'}</button>` : ''}
        ${ec ? `<label>Fase <select data-tvf="fase"><option value="">todas</option>${[1, 2, 3, 'pausa', 'cerrada', 'cancelada'].map(k => `<option value="${k}" ${F.fase === String(k) ? 'selected' : ''}>${esc(faseNombre(k))}</option>`).join('')}</select></label>` : ''}</div></div>
      ${sub}
      <div class="tv-kpi">
        <button class="tv-p tv-k k1" data-dv="kpi:cap"><span><span class="l">Capturado en ${Y}</span><span class="n">${esc(m(D.captado))}</span><span class="c">${pc == null ? 'sin captura esperada todavía' : `<b>${Math.round(pc * 100)} %</b> de lo esperado a hoy (${esc(m(D.esperado))})`}</span>${ritmo ? `<span class="st ${ritmo[0]}"><i class="ico ${ritmo[1]}"></i>${ritmo[2]}</span>` : ''}</span><span class="mini">${mini(D)}<span class="c">captura por mes</span></span></button>
        <button class="tv-p tv-k" data-dv="kpi:proy"><span class="l">Valor que proyecta el portafolio</span><span class="n">${esc(m(D.tot))}</span><span class="c">en ${d.anios.length} años, ${plural(D.X.filter(x => x.caso).length, 'caso de negocio', 'casos de negocio')}</span></button>
        <button class="tv-p tv-k" data-dv="kpi:aprob"><span class="l">VPN aprobado</span><span class="n">${esc(m(D.aprob.reduce((a, c) => a + (Finanzas.calc(c).vpn || 0), 0)))}</span><span class="c">${plural(D.aprob.length, 'caso aprobado', 'casos aprobados')}</span></button>
        <button class="tv-p tv-k" data-dv="kpi:rev"><span class="l">Por decidir en comité</span><span class="n">${D.rev.length}</span><span class="c">${D.rev.length ? plural(D.rev.length, 'caso en revisión', 'casos en revisión') : 'nada pendiente'}</span></button>
        <button class="tv-p tv-k" data-dv="kpi:rojo"><span class="l">Iniciativas en rojo</span><span class="n">${D.crit.length}</span><span class="c">con atrasos o captura muy baja</span>${D.crit.length ? '<span class="st r"><i class="ico ico-flecha"></i>Ver cuáles</span>' : ''}</button>
      </div>
      <div class="tv-g"><section class="tv-p"><div class="tv-t"><h2>¿Cuánto valor vamos a crear?</h2><small>lo que proyectan los casos de negocio, año por año, clic en un año para ver las iniciativas</small></div>
        <div class="tv-big"><div><div class="n">${esc(m(D.tot))}</div><div class="s">en ${d.anios.length} años; ${Y} aporta ${esc(m(D.meta))}.</div><div class="tv-rows">${D.cats.map(k => { const v = D.porAnio.reduce((a, z) => a + z.v[k], 0); return `<div><i style="background:${CAT[k]}"></i><span>${esc(App.catLabel(k))}</span><b>${esc(m(v))}</b><em>${D.tot ? Math.round(v / D.tot * 100) : 0} %</em></div>`; }).join('')}</div></div>${D.tot ? barras(D) : '<p class="tv-vacio">Aún no hay casos de negocio con beneficios.</p>'}</div></section></div>
      <div class="tv-g g2">
        <section class="tv-p"><div class="tv-t"><h2>¿Vamos al ritmo?</h2><small>capturado frente a lo esperado, acumulado en ${Y}, clic en un mes</small></div>
          <div class="tv-lg"><span><i class="ink"></i>Capturado</span><span><i class="dash"></i>Esperado según los casos</span></div>${curva(D)}<div class="tv-nota">Meta del año: ${esc(m(D.meta))}. Se actualiza cada vez que alguien registra una captura.</div></section>
        <section class="tv-p"><div class="tv-t"><h2>¿Dónde está el portafolio?</h2><small>iniciativas y valor a 2 años, clic para ver cuáles</small></div>${embudo(D)}</section>
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
      const t = e.target.closest('[data-dv]'); if (!t) return;
      const [k, ...rest] = t.dataset.dv.split(':'), v = rest.join(':');
      if (k === 'anio') { const y = +v; return detalle(t, `Valor que proyectan para ${y}`, D.X.map(x => ({ x, val: D.anual(x, y) })).filter(z => z.val > 0).sort((a, b) => b.val - a.val).map(z => ({ nombre: nom(z.x.p), sub: App.catLabel(z.x.catPrincipal || 'otro'), v: m(z.val), href: ir(z.x.p, 'caso') }))); }
      if (k === 'mes') { const i = +v, l = D.capPor[i].sort((a, b) => b.v - a.v); return detalle(t, `Capturado en ${App.d.MESES ? App.d.MESES[i] : App.d.MES3[i]} de ${Y}`, l.map(z => ({ nombre: nom(z.x.p), v: m(z.v), href: ir(z.x.p, 'caso') }))); }
      if (k === 'fase') {
        const l = v === 'capt' ? D.X.filter(x => D.capY(x) > 0).map(x => x.p) : D.todos.filter(p => String(fase(p)) === v);
        const dos = p => { const c = App.caseOf(p.id); return c && App.Avance ? App.Avance.dosAnios(Finanzas.calc(c)) || 0 : 0; };
        return detalle(t, v === 'capt' ? 'Ya registran valor' : faseNombre(isNaN(+v) ? v : +v), l.map(p => ({ nombre: nom(p), sub: (App.planOf(p.id).acts.length ? `${App.planOf(p.id).avance} % de avance` : 'sin cronograma') + (App.caseOf(p.id) ? '' : ', sin caso'), v: dos(p) ? m(dos(p)) : null, href: ir(p) })), v === 'capt' ? '' : `<a href="#/proyectos" data-fase-ir="${v}">Ver en el Portafolio</a>`);
      }
      if (k === 'pt') { const p = App.byId('projects', v); if (p) App.go(ir(p, 'info')); return; }
      if (k === 'rk') { const [pp, ii] = v.split(',').map(Number); const l = D.todos.flatMap(p => (App.Riesgos ? App.Riesgos.lista(p) : []).filter(r => r.estado !== 'Cerrado' && (r.rp > 0 && r.ri > 0 ? r.rp === pp && r.ri === ii : r.p === pp && r.i === ii)).map(r => ({ p, r })));
        return detalle(t, `Riesgos con probabilidad ${pp} e impacto ${ii}`, l.map(z => ({ nombre: z.r.titulo || 'Riesgo', sub: nom(z.p), href: ir(z.p, 'riesgos') }))); }
      if (k === 'okr') { const l = D.X.filter(x => App.okrsDe(x.p).includes(v)); return detalle(t, v, l.map(x => ({ nombre: nom(x.p), sub: `${m(D.capY(x))} capturados en ${Y}`, v: D.anual(x, Y) ? m(D.anual(x, Y)) : null, href: ir(x.p) }))); }
      if (k === 'kpi') {
        if (v === 'cap') return detalle(t, `Capturado en ${Y}`, D.X.filter(x => D.capY(x) > 0).sort((a, b) => D.capY(b) - D.capY(a)).map(x => ({ nombre: nom(x.p), sub: `esperado a hoy ${m(D.anual(x, Y) * d.corrido / 12)}`, v: m(D.capY(x)), href: ir(x.p, 'caso') })));
        if (v === 'proy') return detalle(t, 'Lo que más valor proyecta', D.X.filter(x => x.caso).map(x => ({ x, t: d.anios.reduce((a, y) => a + D.anual(x, y), 0) })).filter(z => z.t > 0).sort((a, b) => b.t - a.t).map(z => ({ nombre: nom(z.x.p), sub: App.catLabel(z.x.catPrincipal || 'otro'), v: m(z.t), href: ir(z.x.p, 'caso') })));
        if (v === 'aprob') return detalle(t, 'Casos aprobados', D.aprob.map(c => { const p = App.byId('projects', c.project_id), f = Finanzas.calc(c); return { nombre: nom(p), sub: f.tir != null ? `TIR ${App.pct(f.tir)}` : '', v: f.vpn != null ? m(f.vpn) : null, href: ir(p, 'caso') }; }));
        if (v === 'rev') return detalle(t, 'Por decidir en comité', D.rev.map(c => { const p = App.byId('projects', c.project_id), f = Finanzas.calc(c); return { nombre: nom(p), sub: f.vpn != null ? `VPN ${m(f.vpn)}` : '', href: ir(p, 'caso') }; }), '<a href="#/agenda">Ver la agenda del comité</a>');
        if (v === 'rojo') return detalle(t, 'Iniciativas en rojo', D.crit.map(z => ({ nombre: nom(z.x.p), sub: (z.out.filter(o => o.sev >= 3)[0] || {}).t || '', href: ir(z.x.p) })));
      }
    };
    // «Ver en el Portafolio» desde el detalle de una fase
    const pop = document.getElementById('pop');
    if (pop && !pop._tvFase) { pop._tvFase = true; pop.addEventListener('click', e => { const a = e.target.closest('[data-fase-ir]'); if (!a || !App.Portafolio || !App.Portafolio.filtrarFase) return; e.preventDefault(); App.closePop(true); App.Portafolio.filtrarFase(a.dataset.faseIr); }); }
  }
  App.TableroVisual = { render };
})();
