/* ============================================================
   TABLERO · «Plano de valor»
   La primera página del sitio. Responde, en este orden:
   cuánto llevamos en el año, qué cambió en la semana, qué tiene
   que decidir la gerencia, dónde está el portafolio y cuáles
   iniciativas traen más valor. Todo sale de los datos: nadie
   tiene que reportarlo.
   Rutas: #/tablero (pulso) · #/tablero/okr · #/tablero/analisis
   (el tablero anterior, con los gráficos) · #/tablero/pantalla
   El lenguaje visual sale de los planos de obra: cotas para medir
   y el cuadrado de Amarilo como marca de estado.
   ============================================================ */
'use strict';
(function () {
  const { $, esc } = App;
  const analisis = App.views.tablero; // el tablero de gráficos sigue en «Valor a crear año por año»
  const m = v => App.moneyShort(v);
  const DIA = 864e5;
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const fechaLarga = iso => { const d = App.d.toDate(iso); return `${DIAS[d.getUTCDay()]} ${d.getUTCDate()} de ${MESES[d.getUTCMonth()]}`; };
  const fechaCorta = iso => { const d = App.d.toDate(iso); return `${d.getUTCDate()} de ${MESES[d.getUTCMonth()]}`; };
  const lunes = iso => { const d = App.d.toDate(iso), w = (d.getUTCDay() + 6) % 7; return App.d.add(iso, -w); };
  const plural = (n, s, p) => `${n} ${n === 1 ? s : p}`;
  const txt = o => o.t || o.txt || '';
  const hora = h => { if (!h) return ''; const [H, M] = h.split(':').map(Number); const h12 = H % 12 || 12; return ` a las ${h12}${M ? ':' + String(M).padStart(2, '0') : ''} ${H < 12 ? 'a. m.' : 'p. m.'}`; };

  let cache = { hist: null, fotos: null, t: 0 };
  async function traer() {
    if (cache.hist && Date.now() - cache.t < 60e3) return cache;
    const [hist, fotos] = await Promise.all([App.api('GET', '/api/historial').catch(() => []), App.api('GET', '/api/pulso/fotos').catch(() => ({}))]);
    cache = { hist: Array.isArray(hist) ? hist : [], fotos: fotos || {}, t: Date.now() };
    return cache;
  }

  /* ---------- lo que se calcula ---------- */
  function datos() {
    const d = App.Dash.datos({ anio: null, estado: '', tipo: '', alcance: 'todos', dgv: true });
    const sg = App.Dash.senales(d).filter(z => !App.esEjemplo(z.x.p));
    const ps = App.projectsSorted().filter(p => App.enAlcance(p) && !App.esEjemplo(p));
    const X = d.proyectos.filter(x => !App.esEjemplo(x.p));
    const pr = x => d.cats.reduce((a, k) => a + x.anual(k, d.Y), 0), ca = x => d.cats.reduce((a, k) => a + x.captado(k, d.Y), 0);
    const casos = App.S.cases.filter(c => !App.esEjemplo(c.project_id) && App.byId('projects', c.project_id));
    const rev = casos.filter(c => c.estado === 'En revisión');
    const crit = sg.filter(z => z.max >= 3).sort((a, b) => b.out.filter(o => o.sev >= 3).length - a.out.filter(o => o.sev >= 3).length);
    const top = X.filter(x => x.caso).map(x => ({ x, pr: pr(x), ca: ca(x), esp: pr(x) * d.corrido / 12 })).filter(z => z.pr > 0).sort((a, b) => b.pr - a.pr).slice(0, 5);
    const ec = App.estadoCol(), fase = p => (window.Fases && ec ? Fases.clasificar((p.props || {})[ec.id]) : null);
    const fases = [1, 2, 3].map(k => { const l = ps.filter(p => fase(p) === k); return { k, l, v: l.reduce((a, p) => { const c = App.caseOf(p.id); return a + (c && App.Avance ? App.Avance.dosAnios(Finanzas.calc(c)) || 0 : 0); }, 0) }; });
    const capt = X.filter(x => ca(x) > 0);
    const prox = App.S.sessions.filter(s => s.fecha >= d.hoy && s.estado !== 'Cancelada').sort((a, b) => (a.fecha + (a.hora_ini || '')).localeCompare(b.fecha + (b.hora_ini || '')))[0] || null;
    const venc = App.S.sessions.flatMap(s => s.compromisos || []).filter(k => !k.hecho && k.fecha && k.fecha < d.hoy && (k.texto || '').trim()).length;
    const riesgos = ps.flatMap(p => (App.Riesgos ? App.Riesgos.lista(p) : []).filter(r => r.estado !== 'Cerrado').map(r => ({ p, r, v: App.Riesgos.actual(r) })));
    const proyTotal = X.reduce((a, x) => a + d.anios.reduce((q, y) => q + d.cats.reduce((s, k) => s + x.anual(k, y), 0), 0), 0);
    const brecha = top.filter(z => z.esp > z.ca).sort((a, b) => (b.esp - b.ca) - (a.esp - a.ca))[0] || null;
    return { d, sg, ps, X, pr, ca, casos, rev, crit, top, fases, capt, prox, venc, riesgos, proyTotal, brecha, meta: d.proyectadoY };
  }

  // Lo que pasó en los últimos 7 días, desde el historial y los datos
  function semana(D, hist) {
    const hoy = D.d.hoy, desde = App.d.add(hoy, -7), en = x => (x.created_at || '').slice(0, 10) > desde;
    const H = hist.filter(en);
    const ec = App.estadoCol();
    const nom = x => String(x.nombre || '').replace(/^Caso de negocio · /, '').replace(/ \(desde .*\)$/, '');
    const casosNuevos = H.filter(x => x.coll === 'cases' && /^cre/.test(x.accion || '') && !App.esEjemplo(x.record_id && (App.S.cases.find(c => c.id === x.record_id) || {}).project_id)).map(nom);
    const fase = H.filter(x => x.coll === 'projects' && (x.campos || []).includes(ec ? ec.id : 'estado') && !App.esEjemplo(x.record_id)).map(nom);
    const ultimaFase = hist.filter(x => x.coll === 'projects' && (x.campos || []).includes(ec ? ec.id : 'estado')).map(x => x.created_at.slice(0, 10)).sort().pop() || null;
    const hitos = App.S.activities.filter(a => a.hito && !App.esEjemplo(a.project_id) && App.enAlcance(App.byId('projects', a.project_id) || {}) && a.fin && a.fin > desde && a.fin <= hoy);
    const cumplidos = hitos.filter(a => Number(a.avance) >= 100).length;
    const rNuevos = D.riesgos.filter(z => (z.r.creado || '') > desde);
    return { casosNuevos: [...new Set(casosNuevos)], fase: [...new Set(fase)], ultimaFase, hitos: hitos.length, cumplidos, rNuevos, rCrit: rNuevos.filter(z => z.v >= 15).length };
  }

  /* ---------- piezas ---------- */
  // La cota: una línea de medida como en un plano, de enero a la meta del año
  function cota(D) {
    const { d, meta } = D; if (!meta) return '';
    const pos = v => Math.max(0, Math.min(100, v / meta * 100)), pc = pos(d.captadoY), pe = pos(d.esperadoY), cerca = Math.abs(pc - pe) < 14;
    return `<div class="pv-cota" role="img" aria-label="Capturado ${esc(m(d.captadoY))} de una meta de ${esc(m(meta))}; esperado a hoy ${esc(m(d.esperadoY))}">
      <div class="eje"></div><div class="lleno" style="width:${pc}%"></div>
      <div class="m ini abajo"><span>enero</span></div>
      <div class="m${pc > 88 ? ' fin' : ''}" style="left:${pc}%"><b>${esc(m(d.captadoY))}</b><span>capturado</span><i></i></div>
      <div class="m abajo${cerca ? ' lejos' : ''}" style="left:${pe}%"><i></i><b>${esc(m(d.esperadoY))}</b><span>esperado a hoy</span></div>
      ${pc > 88 ? '' : `<div class="m fin"><b>${esc(m(meta))}</b><span>meta del año</span></div>`}</div>`;
  }
  const btn = (href, t, cl) => `<a class="pv-btn ${cl || ''}" href="${href}">${t}</a>`;

  function decisiones(D) {
    const out = [];
    D.rev.slice(0, 2).forEach(c => { const p = App.byId('projects', c.project_id), f = Finanzas.calc(c);
      out.push(`<div class="pv-d"><i class="ico ico-caso" aria-hidden="true"></i><div><h3>Aprobar el caso de ${esc(App.projectName(p))}</h3><p>${f.vpn != null ? `VPN de ${esc(m(f.vpn))}` : 'Sin VPN todavía'}${f.tir != null ? ` y TIR de ${esc(App.pct(f.tir))}` : ''}${f.totalInversion ? `, con una inversión de ${esc(m(f.totalInversion))}` : ''}.${D.prox ? ` Va al comité del ${esc(fechaCorta(D.prox.fecha))}.` : ' No hay comité programado.'}</p></div>${btn(`#/proyectos/${p.id}/caso`, 'Ver el caso')}</div>`); });
    D.crit.slice(0, 3 - out.length).forEach(z => { const fuertes = z.out.filter(o => o.sev >= 3).map(txt), crono = fuertes.some(t => /cronograma|ruta crítica|atrasad/i.test(t));
      out.push(`<div class="pv-d"><i class="ico ico-alerta r" aria-hidden="true"></i><div><h3>${esc(App.projectName(z.x.p))} ${crono ? 'se está atrasando' : 'necesita atención'}</h3><p>${esc(fuertes.slice(0, 2).join('. '))}.</p></div>${btn(`#/proyectos/${z.x.p.id}${crono ? '' : '/info'}`, crono ? 'Ver el cronograma' : 'Ver la iniciativa', 'cl')}</div>`); });
    return out.length ? out.join('') : '<p class="pv-vacio">Nada pendiente para la gerencia esta semana.</p>';
  }

  function cambios(D, S, fotos) {
    const sem = lunes(D.d.hoy), prev = Object.keys(fotos).filter(k => k < sem).sort().pop(), fp = prev ? fotos[prev] : null;
    const dCap = fp && fp.anio === D.d.Y ? D.d.captadoY - fp.captado : null;
    const celda = (b, p, s, cl) => `<div><b>${b}</b><p>${p}</p><span class="${cl || ''}">${s}</span></div>`;
    return `<div class="pv-sem">
      ${dCap != null ? celda(esc(m(Math.max(0, dCap))), 'capturados en la semana', dCap > 0 ? `${esc(m(D.d.captadoY))} en lo corrido del año` : 'no se registró captura', dCap > 0 ? 'up' : '') : celda(esc(m(D.d.captadoY)), `capturados en ${D.d.Y}`, 'la comparación semanal empieza la próxima semana')}
      ${celda(S.casosNuevos.length, S.casosNuevos.length === 1 ? 'caso de negocio nuevo' : 'casos de negocio nuevos', S.casosNuevos.length ? esc(S.casosNuevos.slice(0, 2).join(' y ')) + (S.casosNuevos.length > 2 ? ` y ${S.casosNuevos.length - 2} más` : '') : 'ninguno esta semana')}
      ${celda(S.hitos ? `${S.cumplidos} de ${S.hitos}` : '0', 'hitos cumplidos a tiempo', S.hitos ? (S.hitos - S.cumplidos ? `${plural(S.hitos - S.cumplidos, 'se corrió', 'se corrieron')}` : 'todos a tiempo') : 'no vencía ninguno', !S.hitos ? '' : S.hitos - S.cumplidos ? 'dn' : 'up')}
      ${celda(S.fase.length, S.fase.length === 1 ? 'cambio de fase' : 'cambios de fase', S.fase.length ? esc(S.fase.slice(0, 2).join(' y ')) : S.ultimaFase ? `el último fue el ${esc(fechaCorta(S.ultimaFase))}` : 'ninguno registrado')}
      ${celda(S.rNuevos.length, S.rNuevos.length === 1 ? 'riesgo nuevo' : 'riesgos nuevos', S.rNuevos.length ? (S.rCrit ? `${plural(S.rCrit, 'es crítico', 'son críticos')}` : 'ninguno crítico') : `${plural(D.riesgos.length, 'riesgo abierto', 'riesgos abiertos')} en total`, S.rCrit ? 'dn' : '')}
    </div>`;
  }

  function embudo(D) {
    const fila = (n, s, cant, v, cl) => `<div class="pv-e"><div class="n">${n}<span>${s}</span></div><div class="sqs" aria-label="${cant} iniciativas">${`<i class="${cl || ''}"></i>`.repeat(cant)}</div><div class="v">${v ? esc(m(v)) : '—'}</div></div>`;
    return `<div class="pv-emb">${D.fases.map((z, i) => fila(`Fase ${z.k}`, ['planeación', 'ejecución y piloto', 'escalamiento'][i], z.l.length, z.v)).join('')}${fila('Capturando', 'ya registran valor', D.capt.length, D.d.captadoY, 'y')}</div>`;
  }

  function topCinco(D) {
    if (!D.top.length) return '<p class="pv-vacio">Aún no hay casos de negocio con beneficios para este año.</p>';
    return `<div class="pv-top">${D.top.map(z => { const mx = Math.max(z.pr, 1);
      return `<a class="pv-t" href="#/proyectos/${z.x.p.id}/caso"><div class="h"><b>${esc(App.projectName(z.x.p))}</b><span>${esc(m(z.pr))} proyectados</span></div><div class="c"><span class="e"></span><span class="l" style="width:${Math.min(100, z.ca / mx * 100)}%"></span><span class="x" style="left:${Math.min(100, z.esp / mx * 100)}%" title="Esperado a hoy: ${esc(m(z.esp))}"></span></div><div class="s">${z.ca ? `${esc(m(z.ca))} capturados, ${Math.round(z.ca / Math.max(z.esp, 1) * 100)} % de lo esperado a hoy` : 'Aún no registra captura'}</div></a>`; }).join('')}</div>`;
  }

  function comite(D) {
    const s = D.prox; if (!s) return `<section class="pv-com"><p>No hay comité programado.</p>${btn('#/agenda', 'Programar uno')}</section>`;
    return `<section class="pv-com"><p>El próximo comité es el <b>${esc(fechaLarga(s.fecha))}</b>${esc(hora(s.hora_ini))}, con ${plural((s.proyectos || []).length, 'iniciativa', 'iniciativas')} en agenda${D.venc ? ` y ${plural(D.venc, 'compromiso vencido', 'compromisos vencidos')}` : ''}.</p>${btn('#/agenda', 'Ver la agenda', 'cl')}<button class="pv-btn" data-pv="prep">Preparar la presentación</button></section>`;
  }

  const sub = act => `<nav class="pv-sub" aria-label="Vistas del tablero">${[['', 'Esta semana'], ['okr', 'Cómo vamos en cada OKR'], ['analisis', 'Valor a crear año por año']].map(([k, l]) => `<a href="#/tablero${k ? '/' + k : ''}" class="${act === k ? 'on' : ''}">${l}</a>`).join('')}<span class="sp"></span><a href="#/tablero/pantalla" class="pv-pant">Modo pantalla</a></nav>`;

  /* ---------- vistas ---------- */
  async function pulso(main) {
    const D = datos();
    const rango = `${fechaCorta(App.d.add(D.d.hoy, -7)).replace(/ de \w+$/, m0 => (App.d.add(D.d.hoy, -7).slice(5, 7) === D.d.hoy.slice(5, 7) ? '' : m0))} al ${fechaCorta(D.d.hoy)}`;
    const pc = D.d.esperadoY ? D.d.captadoY / D.d.esperadoY : null;
    const lema = D.d.esperadoY ? `En ${D.d.Y} llevamos ${m(D.d.captadoY)} de los ${m(D.d.esperadoY)} que esperábamos a esta altura del año.` : D.meta ? `En ${D.d.Y} llevamos ${m(D.d.captadoY)} capturados de una meta de ${m(D.meta)}.` : `Aún no hay casos de negocio con beneficios para ${D.d.Y}.`;
    const frases = [D.brecha ? `La mayor brecha está en ${App.projectName(D.brecha.x.p)}.` : '', D.rev.length ? `${plural(D.rev.length, 'caso espera', 'casos esperan')} la decisión del comité${D.prox ? ' del ' + fechaCorta(D.prox.fecha) : ''}.` : '', D.crit.length ? `${plural(D.crit.length, 'iniciativa tiene', 'iniciativas tienen')} alertas críticas.` : 'Ninguna iniciativa tiene alertas críticas.'].filter(Boolean).join(' ');
    const dgv = App.dgvHay() ? `<button class="pv-alc" data-dgv title="Cambiar qué iniciativas cuentan">${App.soloDgv() ? 'Cuenta las iniciativas con revisión DGV' : 'Cuenta todas las iniciativas'}</button>` : '';
    main.className = 'pv';
    main.innerHTML = `<div class="pv-top-bar"><button class="burger" data-act="burger" aria-label="Menú">☰</button><h1>Generación de Valor, semana del ${esc(rango)}</h1><span class="sp"></span>${dgv}</div>
      <p class="lema">${esc(lema)}</p>
      <p class="lema-s">${esc(frases)} El portafolio proyecta ${esc(m(D.proyTotal))} en ${D.d.anios.length} años.</p>
      ${cota(D)}
      ${sub('')}
      <section class="pv-sec"><h2 class="pv-q">¿Qué cambió esta semana?<small>sale de los datos, nadie tiene que reportarlo</small></h2><div id="pvSem"><p class="pv-vacio">Cargando…</p></div></section>
      <section class="pv-sec"><h2 class="pv-q">¿Qué tiene que decidir la gerencia?</h2><div class="pv-dec">${decisiones(D)}</div></section>
      <section class="pv-sec pv-two">
        <div><h2 class="pv-q">¿Dónde está el portafolio?<small>cada cuadrado es una iniciativa</small></h2>${embudo(D)}<p class="pv-nota">La cifra de cada fase es el valor a dos años de sus casos de negocio.</p></div>
        <div><h2 class="pv-q">¿Cuáles traen más valor en ${D.d.Y}?</h2>${topCinco(D)}</div>
      </section>
      ${comite(D)}`;
    main.onclick = e => {
      if (e.target.closest('.burger')) return App.toggleSide();
      if (e.target.closest('[data-dgv]')) { App.store.set('alcance.dgv', App.soloDgv() ? 'todas' : 'si'); return App.render(); }
      if (e.target.closest('[data-pv=prep]') && D.prox) return App.go('#/agenda');
    };
    const { hist, fotos } = await traer();
    const box = $('#pvSem', main); if (!box) return;
    box.innerHTML = cambios(D, semana(D, hist), fotos);
    // Foto de la semana (una sola vez por semana) para comparar la próxima
    const sem = lunes(D.d.hoy);
    if (!fotos[sem]) App.api('POST', '/api/pulso/fotos', { semana: sem, captado: Math.round(D.d.captadoY), esperado: Math.round(D.d.esperadoY), anio: D.d.Y, riesgos: D.riesgos.length, criticos: D.riesgos.filter(z => z.v >= 15).length }).then(f => { cache.fotos = f; }).catch(() => {});
    void pc;
  }

  function okr(main) {
    const D = datos(), { d } = D;
    const mapa = new Map();
    D.X.forEach(x => (App.okrsDe(x.p).length ? App.okrsDe(x.p) : ['Sin OKR asignado']).forEach(o => { const z = mapa.get(o) || { o, l: [], pr: 0, ca: 0 }; z.l.push(x); z.pr += D.pr(x); z.ca += D.ca(x); mapa.set(o, z); }));
    const L = [...mapa.values()].sort((a, b) => (a.o === 'Sin OKR asignado') - (b.o === 'Sin OKR asignado') || b.pr - a.pr || b.l.length - a.l.length);
    const est = z => { const e = z.pr * d.corrido / 12; if (!z.pr) return ['', 'sin cifras para este año']; const r = e ? z.ca / e : 1; return r >= .9 ? ['g', 'va en lo esperado'] : r >= .6 ? ['o', 'va por debajo'] : ['r', 'va muy por debajo']; };
    main.className = 'pv';
    main.innerHTML = `<div class="pv-top-bar"><button class="burger" data-act="burger" aria-label="Menú">☰</button><h1>Generación de Valor, ${d.Y}</h1></div>
      <p class="lema">¿Cómo vamos en cada OKR?</p>
      <p class="lema-s">Cada fila compara lo capturado con lo que se esperaba a esta altura del año. La línea roja es lo esperado a hoy.</p>
      ${sub('okr')}
      <div class="pv-okr">${L.map(z => { const [c, t] = est(z), e = z.pr * d.corrido / 12, mx = Math.max(z.pr, 1), best = z.l.slice().sort((a, b) => D.pr(b) - D.pr(a))[0];
        return `<div class="pv-o"><i class="ico ${c === 'g' ? 'ico-ok g' : c === 'o' ? 'ico-reloj o' : c === 'r' ? 'ico-alerta r' : 'ico-pendiente n'}" aria-hidden="true"></i><div class="o"><b>${esc(z.o)}</b><span>${t} · ${plural(z.l.length, 'iniciativa', 'iniciativas')}</span></div>
          <div class="pv-t"><div class="c"><span class="e"></span><span class="l" style="width:${Math.min(100, z.ca / mx * 100)}%"></span>${z.pr ? `<span class="x" style="left:${Math.min(100, e / mx * 100)}%"></span>` : ''}</div><div class="s">${z.pr ? `${esc(m(z.ca))} de ${esc(m(e))} esperados a hoy` : 'Sus iniciativas aún no tienen beneficios para este año'}</div></div>
          <div class="v"><b>${z.pr ? esc(m(z.pr)) : '—'}</b><span>proyectado ${d.Y}</span></div>
          <a class="mejor" href="#/proyectos/${best.p.id}">${esc(App.projectName(best.p))}<span>la que más aporta</span></a></div>`; }).join('')}</div>`;
    main.onclick = e => { if (e.target.closest('.burger')) App.toggleSide(); };
  }

  // Modo pantalla: para el televisor de la oficina o para abrir el comité. Pocas palabras, cifras grandes.
  function pantalla(main) {
    const D = datos(), { d } = D;
    document.documentElement.classList.add('pv-pantalla');
    const lim = App.d.add(d.hoy, 30);
    const evs = App.S.sessions.filter(s => s.fecha >= d.hoy && s.fecha <= lim && s.estado !== 'Cancelada').map(s => ({ f: s.fecha, t: App.Agenda ? App.Agenda.tituloOf(s) : 'Comité', s: plural((s.proyectos || []).length, 'iniciativa', 'iniciativas') + ' en agenda', k: 'c' }))
      .concat(App.S.activities.filter(a => a.hito && !App.esEjemplo(a.project_id) && (a.fin || a.inicio) >= d.hoy && (a.fin || a.inicio) <= lim).map(a => ({ f: a.fin || a.inicio, t: a.name || 'Hito', s: App.projectName(App.byId('projects', a.project_id) || {}), k: 'h' })))
      .sort((a, b) => a.f.localeCompare(b.f)).slice(0, 5);
    const pend = D.rev.slice(0, 1).map(c => ({ n: App.projectName(App.byId('projects', c.project_id)), s: `caso por aprobar, VPN ${m(Finanzas.calc(c).vpn)}`, k: 'y' }))
      .concat(D.crit.slice(0, 3).map(z => ({ n: App.projectName(z.x.p), s: txt(z.out.filter(o => o.sev >= 3)[0] || {}).toLowerCase(), k: 'r' })));
    main.className = 'pv-pm';
    main.innerHTML = `<div class="pm-top"><span>Generación de Valor</span><span class="sp"></span><span>${esc(fechaLarga(d.hoy))}</span><a href="#/tablero" class="pm-x" title="Salir del modo pantalla (Esc)">Salir</a></div>
      <p class="pm-lema">Llevamos <b>${esc(m(d.captadoY))}</b> en ${d.Y}${d.esperadoY ? `, el ${Math.round(d.captadoY / d.esperadoY * 100)} % de lo esperado a hoy` : ''}.</p>
      ${cota(D)}
      <div class="pm-dos"><section><h2>Piden atención</h2>${pend.map(x => `<div class="pm-i"><i class="ico ${x.k === 'r' ? 'ico-alerta r' : 'ico-caso'}"></i><div><b>${esc(x.n)}</b><span>${esc(x.s)}</span></div></div>`).join('') || '<p>Nada pendiente.</p>'}</section>
        <section><h2>Próximos 30 días</h2>${evs.map(e => `<div class="pm-i"><span class="pm-f">${+e.f.slice(8)}<small>${App.d.MES3[+e.f.slice(5, 7) - 1]}</small></span><div><b>${esc(e.t)}</b><span>${e.k === 'c' ? 'Comité, ' : 'Hito de '}${esc(e.s)}</span></div></div>`).join('') || '<p>Sin comités ni hitos.</p>'}</section></div>
      <div class="pm-pie"><span>El portafolio proyecta <b>${esc(m(D.proyTotal))}</b> en ${d.anios.length} años</span><span><b>${D.ps.length}</b> iniciativas activas</span><span><b>${D.capt.length}</b> ya capturan valor</span></div>`;
    main.onclick = null;
  }
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.documentElement.classList.contains('pv-pantalla')) App.go('#/tablero'); });
  window.addEventListener('hashchange', () => { if (!/^#\/tablero\/pantalla/.test(location.hash)) document.documentElement.classList.remove('pv-pantalla'); });

  function render(main, params) {
    const k = (params || [])[0];
    if (k !== 'pantalla') document.documentElement.classList.remove('pv-pantalla');
    if (k === 'okr') return okr(main);
    if (k === 'pantalla') return pantalla(main);
    if (k === 'analisis' && analisis) {
      main.className = '';
      analisis.render(main, params);
      main.insertAdjacentHTML('afterbegin', sub('analisis'));
      return;
    }
    return pulso(main).catch(err => { console.error(err); main.insertAdjacentHTML('beforeend', '<p class="pv-vacio">No se pudo leer el historial de la semana.</p>'); });
  }
  App.views.tablero = { render };
})();
