/* ============================================================
   PORTAFOLIO · vista Resumen (la que abre por defecto)
   - Dos listas para hacer zoom: por OKR y por tipo de valor.
     Clic en una fila = filtro (se quita con ✕).
   - Una fila por iniciativa con lo que se mira para decidir:
     etapa, OKR, tipo de valor, ICE, avance contra lo esperado,
     cronograma (clic → cronograma) y caso de negocio (clic → caso).
   - Editar celdas sigue en «Tabla completa» (la tabla tipo Notion).
   ============================================================ */
'use strict';
(function () {
  const { $, esc } = App;
  const R = Object.assign({ okr: null, cat: '', etapa: '', q: '', alertas: false, modo: 'tabla' }, App.store.get('portafolio', {}));
  const guardar = () => App.store.set('portafolio', { okr: R.okr, cat: R.cat, etapa: R.etapa, alertas: R.alertas, modo: R.modo });
  const m = v => App.moneyShort(v);
  const ORDEN_CAT = ['ingresos', 'ahorro', 'tiempo', 'eficiencia', 'riesgo', 'otro'];

  // Avance esperado a hoy según las fechas del plan (ponderado por duración, como el avance real)
  function esperadoHoy(acts) {
    const hoy = App.d.today(); let w = 0, s = 0;
    acts.forEach(a => {
      if (!a.inicio || !a.fin) return;
      const dur = Math.max(1, App.d.diff(a.inicio, a.fin) + 1);
      const k = hoy < a.inicio ? 0 : hoy >= a.fin ? 1 : (App.d.diff(a.inicio, hoy) + 1) / dur;
      w += dur; s += dur * k * 100;
    });
    return w ? Math.round(s / w) : null;
  }

  function filas() {
    const d = App.Dash.datos({ anio: null, estado: '', tipo: '', alcance: 'todos' });
    const sg = App.Dash.senales(d), alerta = new Map(sg.map(z => [z.x.p.id, z.out.filter(o => o.sev >= 2).sort((a, b) => b.sev - a.sev)]));
    const tv = App.S.columns.find(c => c.id === 'tipo_valor') || App.S.columns.find(c => /tipo de valor/i.test(c.name));
    return {
      d, rows: d.filas.map(x => {
        const porCat = Object.fromEntries(ORDEN_CAT.map(k => [k, d.anios.reduce((a, y) => a + x.anual(k, y), 0)]));
        let cats = ORDEN_CAT.filter(k => porCat[k] > 0);
        if (!cats.length && tv && (x.p.props || {})[tv.id]) cats = [App.catDeTipoValor((x.p.props || {})[tv.id])];
        const pl = App.planOf(x.p.id), f = x.caso && x.caso.moneda !== 'USD' ? Finanzas.calc(x.caso) : null;
        return { x, p: x.p, okrs: App.okrsDe(x.p), cats, porCat, valor: ORDEN_CAT.reduce((a, k) => a + porCat[k], 0), pl, esp: esperadoHoy(pl.acts), f, al: alerta.get(x.p.id) || [] };
      }),
    };
  }
  const pasaFiltros = (r, sinOkr, sinCat) => (sinOkr || R.okr == null || (R.okr === '' ? !r.okrs.length : r.okrs.includes(R.okr)))
    && (sinCat || !R.cat || r.cats.includes(R.cat))
    && (!R.etapa || r.x.estado === R.etapa)
    && (!R.alertas || r.al.length)
    && (!R.q || App.projectName(r.p).toLowerCase().includes(R.q.toLowerCase()) || r.okrs.join(' ').toLowerCase().includes(R.q.toLowerCase()));

  /* ---------- listas para hacer zoom ---------- */
  function lentes(rows) {
    // OKR: cuenta con los demás filtros puestos (menos el de OKR); el valor se reparte entre los OKR de cada iniciativa
    const base = rows.filter(r => pasaFiltros(r, true, false));
    const okr = new Map();
    base.forEach(r => (r.okrs.length ? r.okrs : ['']).forEach(o => { const z = okr.get(o) || { n: 0, v: 0 }; z.n++; z.v += r.valor / Math.max(1, r.okrs.length); okr.set(o, z); }));
    const lo = [...okr.entries()].sort((a, b) => (a[0] === '') - (b[0] === '') || b[1].v - a[1].v || a[0].localeCompare(b[0]));
    const maxO = Math.max(1, ...lo.map(([, z]) => z.v));
    const baseC = rows.filter(r => pasaFiltros(r, false, true));
    const lc = ORDEN_CAT.map(k => ({ k, n: baseC.filter(r => r.cats.includes(k)).length, v: baseC.reduce((a, r) => a + r.porCat[k], 0) })).filter(z => z.n);
    const maxC = Math.max(1, ...lc.map(z => z.v));
    const fila = (cls, attr, on, chip, nombre, n, v, max, color) => `<button class="pf-lr ${cls} ${on ? 'on' : ''}" ${attr} aria-pressed="${on}">${chip}<span class="nm" title="${esc(nombre)}">${esc(nombre)}</span><span class="cnt">${n} inic.</span><span class="b"><i style="width:${v / max * 100}%;${color ? `background:${color}` : ''}"></i></span><span class="v">${v ? esc(m(v)) : '—'}</span></button>`;
    return `<div class="pf-lentes">
      <section class="t-card pf-lente"><h3>Por OKR <small>clic para ver solo esas iniciativas</small></h3>
        ${lo.length ? lo.slice(0, 8).map(([o, z]) => fila('', `data-okr="${esc(o)}"`, R.okr === o, `<span class="pf-okr ${o ? '' : 'sin'}">${o ? 'OKR' : '—'}</span>`, o || 'Sin OKR asignado', z.n, z.v, maxO)).join('') : '<div class="t-vacio">Ninguna iniciativa tiene OKR todavía (columna «OKRs» del portafolio).</div>'}
        ${lo.length > 8 ? `<div class="pf-mas">y ${lo.length - 8} OKR más: búscalos con el buscador</div>` : ''}</section>
      <section class="t-card pf-lente"><h3>Por tipo de valor <small>cómo se captura el beneficio</small></h3>
        ${lc.length ? lc.map(z => fila('cat', `data-cat="${z.k}"`, R.cat === z.k, `<span class="pf-dot" style="background:var(--cat-${z.k})"></span>`, App.catLabel(z.k), z.n, z.v, maxC, `var(--cat-${z.k})`)).join('') : '<div class="t-vacio">Aún no hay tipos de valor: salen de los beneficios del caso o de la columna «Tipo de valor».</div>'}
        <div class="pf-mas">Una iniciativa puede capturar de varias formas: cuenta en cada una.</div></section></div>`;
  }

  const inactiva = r => { const fa = window.Fases && Fases.de(r.x.estado); return fa && fa.fuera ? 1 : 0; };
  const sinDatos = r => !inactiva(r) && !r.pl.acts.length && !r.x.caso;
  const dosAnios = r => (r.f && App.Avance ? App.Avance.dosAnios(r.f) : 0);
  // «Laura Martínez» → «Laura M.»
  const nombreCorto = n => { const p = String(n || '').trim().split(/\s+/); return p.length > 1 ? `${p[0]} ${p[1][0].toUpperCase()}.` : p[0] || ''; };

  /* ---------- tabla ---------- */
  function mini(r) {
    const pl = r.pl; if (!pl.ini) return `<span class="faint" title="${esc(App.sinPlan(r.p).largo)}">${inactiva(r) ? '—' : 'Sin cronograma'}</span>`;
    const y0 = +App.d.today().slice(0, 4), a = `${y0}-01-01`, b = `${y0 + 1}-12-31`, tot = App.d.diff(a, b);
    const pos = iso => Math.max(0, Math.min(1, App.d.diff(a, iso < a ? a : iso > b ? b : iso) / tot));
    const x0 = pos(pl.ini) * 100, x1 = pos(pl.fin) * 100, hoy = pos(App.d.today()) * 100;
    const tarde = pl.atrasadas > 0;
    return `<span class="pf-gantt ${tarde ? 'tarde' : ''}" title="${esc(App.d.fmt(pl.ini))} – ${esc(App.d.fmt(pl.fin))}"><i style="left:${x0}%;width:${Math.max(1.5, x1 - x0)}%"><b style="width:${pl.avance}%"></b></i><u style="left:${hoy}%"></u><em style="left:50%"></em></span><span class="pf-fin ${tarde ? 'tarde' : ''}">${esc(App.d.MES3[+pl.fin.slice(5, 7) - 1])} ${pl.fin.slice(2, 4)}</span>`;
  }
  function filaHTML(r) {
    const ec = App.estadoCol(), est = r.x.estado, ice = r.x.ice;
    const okr = r.okrs.length ? `<div class="pf-okrbs">${r.okrs.slice(0, 2).map(o => `<button class="pf-okrb ${R.okr === o ? 'on' : ''}" data-okr="${esc(o)}" title="Ver solo las iniciativas de este OKR">${esc(o)}</button>`).join('')}${r.okrs.length > 2 ? `<span class="pf-mas2" title="${esc(r.okrs.slice(2).join('\n'))}">+${r.okrs.length - 2}</span>` : ''}</div>` : '<span class="faint">—</span>';
    const todos = esc(r.cats.map(App.catLabel).join(', '));
    const tipos = r.cats.length ? `<span class="pf-tv" style="--c:var(--cat-${r.cats[0]})" title="${todos}">${esc(App.catLabel(r.cats[0]))}</span>${r.cats.length > 1 ? `<span class="pf-mas2" title="${todos}">+${r.cats.length - 1}</span>` : ''}` : '<span class="faint">—</span>';
    const av = r.pl.acts.length ? `<span class="pf-av"><span class="t"><i style="width:${r.pl.avance}%"></i>${r.esp != null ? `<u style="left:${r.esp}%" title="Esperado a hoy: ${r.esp} %"></u>` : ''}</span><b>${r.pl.avance} %</b></span>` : '<span class="faint">—</span>';
    const v2 = dosAnios(r);
    const caso = r.x.caso ? `<a class="pf-caso" href="#/proyectos/${r.p.id}/caso" title="Valor a dos años: beneficios de los dos primeros años del caso${r.valor ? ` · total del caso ${esc(m(r.valor))}` : ''}${r.f && r.f.vpn != null && r.f.totalInversion ? ` · VPN ${esc(m(r.f.vpn))}` : ''}"><b>${v2 ? esc(m(v2)) : r.valor ? esc(m(r.valor)) : '—'}</b><span class="pill pf-est cl-${App.Caso.estadoColor(r.x.caso.estado)}">${esc(r.x.caso.estado || 'Borrador')}</span> <span class="pf-go">↗</span></a>`
      : r.valor ? `<span class="pf-caso"><b>${esc(m(r.valor))}</b><small class="pf-inc" title="Sin caso de negocio: valor del Income"> Income</small></span>` : (App.canEdit() && !inactiva(r) ? `<a class="pf-crear" href="#/proyectos/${r.p.id}/caso" title="Crear el caso de negocio"><span class="a">Sin caso</span><span class="b">+ Crear caso</span></a>` : '<span class="faint">Sin caso</span>');
    const al = r.al[0];
    return `<tr data-pid="${r.p.id}" class="${inactiva(r) ? 'pf-inact' : ''}">
      <td class="pf-nm"><a href="#/proyectos/${r.p.id}"><b>${esc(App.projectName(r.p))}</b></a><small>${est ? `<span class="pill pf-etapa cl-${App.optColor(ec, est)}" title="${esc(est)}">${esc(corto(est))}</span>` : ''}${responsables(r.p).map(n => `<span class="pf-per" title="${esc(n)}"><i class="cl-${App.colorPersona(n)}"></i>${esc(nombreCorto(n))}</span>`).join('')}</small></td>
      <td>${okr}</td><td><div class="pf-tvs">${tipos}</div></td>
      <td class="n">${ice == null ? '<span class="faint">—</span>' : `<b>${esc(App.num(ice, 1))}</b>`}</td>
      <td>${av}</td>
      <td><a class="pf-crono" href="#/cronograma/${r.p.id}" title="Abrir el cronograma">${mini(r)}</a></td>
      <td>${caso}</td>
      <td>${al ? `<a class="pf-al ${al.sev >= 3 ? 'crit' : 'warn'}" href="${al.href}" title="${esc(r.al.map(o => '• ' + o.txt).join('\n'))}">${al.sev >= 3 ? '●' : '▲'} ${esc(cortoAlerta(al.txt))}${r.al.length > 1 ? ` <em>+${r.al.length - 1}</em>` : ''}</a>` : (() => { const av = App.Avance && App.Avance.de(r.p); return av && av.listo ? `<a class="pf-listo" href="#/proyectos/${r.p.id}" title="Cumple los criterios: confirma el cambio en su ficha">↗ Lista para ${esc(av.sig.corto)}</a>` : inactiva(r) ? '<span class="faint">—</span>' : sinDatos(r) ? '<span class="pf-sd" title="No tiene cronograma ni caso de negocio: no hay con qué medir si va bien">Sin datos</span>' : `<span class="pf-ok" title="Sin alertas en lo que tiene cargado">✓ Al día</span>${!r.x.caso ? '<small class="pf-falta">falta el caso</small>' : !r.pl.acts.length ? '<small class="pf-falta">falta el cronograma</small>' : ''}`; })()}</td></tr>`;
  }
  const corto = e => { const f = window.Fases && Fases.de(e); if (f) return f.corto; const mm = /^(L\d)\b/i.exec(e); return mm ? mm[1].toUpperCase() : e; };
  const cortoAlerta = t => t.replace(/ en el cronograma$/, '').replace(/^(\d+) actividad(?:es)? atrasadas?$/, (_, n) => n + (n === '1' ? ' atrasada' : ' atrasadas')).replace(/^1 compromiso de comité vencido$/, 'Compromiso vencido').replace(/^Captura (rezagada|por debajo): (\d+)%.*/, 'Captura al $2 %').replace(/^Termina (\d+) días? hábil(es)? después de la fecha meta$/, 'Meta +$1 días').replace(/ de comité vencidos?$/, ' vencido').replace(/^(\d+) actividad(es)? de la ruta crítica en riesgo$/, 'Ruta crítica en riesgo');
  function responsables(p) {
    const v = p.props || {}; const n = [].concat(v.habilitadores || [], v.realizadores || []).filter(Boolean);
    return n.slice(0, 2);
  }

  function render(main) {
    const { d, rows } = filas();
    const vis = rows.filter(r => pasaFiltros(r));
    // Las iniciativas cerradas, en pausa o canceladas no compiten en el orden por ICE: van al final
    vis.sort((a, b) => inactiva(a) - inactiva(b) || (b.x.ice ?? -1) - (a.x.ice ?? -1) || App.projectName(a.p).localeCompare(App.projectName(b.p)));
    const ec = App.estadoCol();
    const nAl = rows.filter(r => r.al.length).length, total = rows.reduce((a, r) => a + r.valor, 0);
    const chips = [
      R.okr != null ? `<button class="pf-chip" data-quitar="okr">OKR · ${esc(R.okr || 'Sin OKR asignado')} ✕</button>` : '',
      R.cat ? `<button class="pf-chip" data-quitar="cat">${esc(App.catLabel(R.cat))} ✕</button>` : '',
    ].join('');
    main.innerHTML = `<div class="pg-top"><button class="burger" data-act="burger" aria-label="Menú">☰</button><h1>Portafolio</h1>
        <div class="kl"><span><b>${rows.length}</b>iniciativas</span><span title="Iniciativas en Fase 1, Fase 2 y Fase 3">${[1, 2, 3].map(k => `<b>${rows.filter(r => window.Fases && Fases.clasificar(r.x.estado) === k).length}</b>F${k}`).join(' · ')}</span><span><b class="${nAl ? 'r' : ''}">${nAl}</b>con alertas</span><span><b>${rows.filter(sinDatos).length}</b>sin datos</span><span><b>${esc(m(total))}</b>valor proyectado · ${rows.filter(r => r.valor > 0).length} de ${rows.length} con cifras</span></div>
        <span class="sp"></span><button class="btn ghost sm" data-pf="csv">Exportar a Excel</button>${App.canEdit() ? '<button class="btn primary sm" data-pf="nuevo">+ Nueva iniciativa</button>' : ''}</div>
      ${lentes(rows)}
      <div class="pf-bar"><label class="search"><span>⌕</span><input id="pfq" placeholder="Buscar iniciativa u OKR…" value="${esc(R.q)}"></label>${chips}
        ${ec ? `<select class="pf-sel" data-pf-etapa aria-label="Fase"><option value="">Fase: todas</option>${(ec.options || []).map(o => `<option ${R.etapa === o.name ? 'selected' : ''}>${esc(o.name)}</option>`).join('')}</select>` : ''}
        <button class="pf-tg ${R.alertas ? 'on' : ''}" data-pf="alertas" aria-pressed="${R.alertas}">Solo con alertas</button>
        <span class="sp"></span><div class="seg"><button data-modo="tabla" class="${R.modo !== 'mapa' ? 'on' : ''}" aria-pressed="${R.modo !== 'mapa'}">Resumen</button><button data-modo="mapa" class="${R.modo === 'mapa' ? 'on' : ''}" aria-pressed="${R.modo === 'mapa'}" title="Iniciativas por ICE e Income, en cuadrantes">Mapa ICE</button><button data-vista-pf="tabla" title="Tabla tipo Notion: aquí se editan las columnas">Tabla completa</button><button data-vista-pf="tablero" title="Tarjetas agrupadas por fase">Por fase</button></div></div>
      ${R.modo === 'mapa' ? mapaHTML(vis) : `<section class="t-card pf-tbl-card"><div class="pf-wrap"><table class="pf-tbl">
        <thead><tr><th>Iniciativa <small>fase · responsables</small></th><th>OKR</th><th>Tipo de valor</th><th class="n" title="Prioridad relativa">ICE ▾</th><th>Avance <small>real · ┃ esperado</small></th><th>Cronograma <small>${+d.hoy.slice(0, 4)} – ${+d.hoy.slice(0, 4) + 1}</small></th><th>Valor a 2 años <small>caso de negocio</small></th><th>Alertas</th></tr></thead>
        <tbody>${vis.map(filaHTML).join('') || `<tr><td colspan="8"><div class="t-vacio">${rows.length ? 'Ninguna iniciativa cumple estos filtros.' : 'Aún no hay iniciativas.'}</div></td></tr>`}</tbody></table></div>
        <div class="t-pie t-pie-row"><span class="t-tag">${vis.length} de ${rows.length} iniciativas · ordenadas por ICE${R.okr != null ? ` · OKR «${esc(R.okr || 'sin asignar')}»` : ''}</span><span class="t-tag">Clic en el cronograma o en el caso abre esa pestaña de la iniciativa</span></div></section>`}`;
    const svg = $('#pfMapa', main); if (svg) dibujarMapa(svg, vis);
    const q = $('#pfq', main);
    q.oninput = () => { R.q = q.value; const pos = q.selectionStart; render(main); const n = $('#pfq', main); n.focus(); n.setSelectionRange(pos, pos); };
    main.onclick = e => {
      if (e.target.closest('.burger')) return App.toggleSide();
      const o = e.target.closest('[data-okr]'); if (o) { R.okr = R.okr === o.dataset.okr ? null : o.dataset.okr; guardar(); return render(main); }
      const c = e.target.closest('[data-cat]'); if (c) { R.cat = R.cat === c.dataset.cat ? '' : c.dataset.cat; guardar(); return render(main); }
      const qq = e.target.closest('[data-quitar]'); if (qq) { if (qq.dataset.quitar === 'okr') R.okr = null; else R[qq.dataset.quitar] = ''; guardar(); return render(main); }
      const md = e.target.closest('[data-modo]'); if (md) { R.modo = md.dataset.modo; guardar(); return render(main); }
      const v = e.target.closest('[data-vista-pf]'); if (v) return App.Tabla.setView(v.dataset.vistaPf);
      const b = e.target.closest('[data-pf]'); if (!b) return;
      if (b.dataset.pf === 'alertas') { R.alertas = !R.alertas; guardar(); return render(main); }
      if (b.dataset.pf === 'csv') return csv(vis);
      if (b.dataset.pf === 'nuevo') App.guard(async () => { const p = await App.create('projects', { props: {} }); App.go('#/proyectos/' + p.id); });
    };
    main.onchange = e => { if (e.target.hasAttribute('data-pf-etapa')) { R.etapa = e.target.value; guardar(); render(main); } };
  }

  /* ---------- mapa ICE: cuadrantes ---------- */
  // Eje X: Income (valor a dos años, escala de la Oficina). Eje Y: ICE.
  // Línea vertical: umbral de la Oficina (Income 3). Línea horizontal: ICE mediano del portafolio.
  const COLOR_FASE = { 1: '#5B9BEA', 2: '#F08A5D', 3: '#3FC293' };
  const colorFase = e => { const f = window.Fases && Fases.de(e); return f && COLOR_FASE[f.id] || '#B9B5C6'; };
  function mapaHTML(vis) {
    const con = vis.filter(r => r.x.ice != null).length, sin = vis.length - con;
    return `<section class="t-card t-pad pf-mapa">
      <div class="t-lgd"><span><i style="background:#5B9BEA"></i>Fase 1 · Planeación</span><span><i style="background:#F08A5D"></i>Fase 2 · Ejecución y piloto</span><span><i style="background:#3FC293"></i>Fase 3 · Escalamiento</span><span><i style="background:#B9B5C6"></i>Cerrada, en pausa o cancelada</span></div>
      <svg id="pfMapa" class="t-viz" height="460" role="img" aria-label="Iniciativas por ICE e Income"></svg>
      <div class="t-pie"><span class="t-tag">${con} iniciativa${con === 1 ? '' : 's'} en el mapa${sin ? ` · ${sin} sin ICE no aparecen (complétalo en su ficha)` : ''}</span><span class="t-tag">Clic en un punto abre la iniciativa · pasa el mouse para ver su ICE</span></div></section>`;
  }
  function dibujarMapa(svg, vis) {
    const W = svg.clientWidth || 900, H = 460, L = 56, R2 = 16, T = 16, B = 46;
    const FIB = App.ICE.FIB, pts = vis.map(r => ({ r, d: App.ICE.detalle(r.p) })).filter(z => z.d.ice != null && z.d.income != null);
    const band = (W - L - R2) / FIB.length;
    const tk = (hi => { const raw = hi / 4, mag = Math.pow(10, Math.floor(Math.log10(raw || 1))), st = [1, 2, 2.5, 5, 10].map(k => k * mag).find(k => raw <= k) || 10 * mag; const o = []; for (let v = 0; v <= hi + st * 0.999; v += st) o.push(Math.round(v / st) * st); return o; })(Math.max(10, ...pts.map(z => z.d.ice)));
    const top = tk.at(-1), y = v => T + (1 - v / top) * (H - T - B);
    const xs = FIB.map((_, i) => L + band * i + band / 2);
    const ices = pts.map(z => z.d.ice).sort((a, b) => a - b), med = ices.length ? ices[Math.floor(ices.length / 2)] : top / 2;
    const xU = L + band * 2, yM = y(med); // umbral Oficina: entre Income 2 y 3
    let h = '';
    // cuadrantes
    const q = (x0, y0, x1, y1, fill, t1, t2, anchor, tx, ty) => `<rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" fill="${fill}"/><text x="${tx}" y="${ty}" text-anchor="${anchor}" class="pf-q">${t1}</text><text x="${tx}" y="${ty + 14}" text-anchor="${anchor}" class="pf-q2">${t2}</text>`;
    h += q(xU, T, W - R2, yM, 'rgba(63,194,147,.08)', 'PRIORIZAR', 'mucho valor y alto ICE', 'end', W - R2 - 8, T + 16);
    h += q(L, T, xU, yM, 'rgba(91,155,234,.07)', 'GANANCIA RÁPIDA', 'poco valor, fácil y seguro', 'start', L + 8, T + 16);
    h += q(xU, yM, W - R2, H - B, 'rgba(240,138,93,.07)', 'REPLANTEAR CÓMO', 'mucho valor, ICE bajo', 'end', W - R2 - 8, H - B - 22);
    h += q(L, yM, xU, H - B, 'rgba(22,11,41,.035)', 'CUESTIONAR', 'poco valor y bajo ICE', 'start', L + 8, H - B - 22);
    h += tk.map(v => `<line x1="${L}" x2="${W - R2}" y1="${y(v)}" y2="${y(v)}" class="t-grid"/><text x="${L - 8}" y="${y(v) + 4}" text-anchor="end" class="t-ax">${v}</text>`).join('');
    h += xs.map((x, i) => `<text x="${x}" y="${H - B + 16}" text-anchor="middle" class="t-ax">${FIB[i]}</text>`).join('');
    h += `<text x="${(L + W - R2) / 2}" y="${H - 6}" text-anchor="middle" class="t-ax on">Income · valor a dos años (escala 1 a 55)</text><text transform="translate(14 ${(T + H - B) / 2}) rotate(-90)" text-anchor="middle" class="t-ax on">ICE</text>`;
    h += `<line x1="${xU}" x2="${xU}" y1="${T}" y2="${H - B}" class="pf-umbral"/><text x="${xU + 6}" y="${T + 14}" class="pf-q2">← umbral Oficina (Income 3)</text>`;
    h += `<line x1="${L}" x2="${W - R2}" y1="${yM}" y2="${yM}" class="pf-umbral"/><text x="${W - R2 - 4}" y="${yM - 5}" text-anchor="end" class="pf-q2">ICE mediano ${App.num(med, 1)}</text>`;
    // puntos: los de igual Income se reparten dentro de su franja
    const porI = {}; pts.forEach(z => { (porI[z.d.income] = porI[z.d.income] || []).push(z); });
    const pos = new Map();
    Object.entries(porI).forEach(([inc, l]) => { const i = FIB.indexOf(+inc); l.sort((a, b) => a.d.ice - b.d.ice).forEach((z, k) => { const off = l.length > 1 ? (k / (l.length - 1) - 0.5) * Math.min(band * 0.7, l.length * 14) : 0; pos.set(z, [xs[i] + off, y(z.d.ice)]); }); });
    const nombres = pts.slice().sort((a, b) => b.d.ice - a.d.ice).slice(0, 6);
    pts.forEach(z => { const [cx, cy] = pos.get(z), nm = App.projectName(z.r.p);
      h += `<a href="#/proyectos/${z.r.p.id}"><circle cx="${cx}" cy="${cy}" r="7" fill="${colorFase(z.r.x.estado)}" stroke="var(--card)" stroke-width="2"><title>${esc(nm)}\nICE ${App.num(z.d.ice, 1)} = Income ${z.d.income} × ${z.d.conf} % ÷ ${z.d.esf} % × ${String(z.d.os).replace('.', ',')}\n${esc(z.r.x.estado || 'Sin fase')}</title></circle></a>`; });
    const usadas = [];
    nombres.forEach(z => { const [cx, cy] = pos.get(z); const nm = App.projectName(z.r.p), t = nm.length > 26 ? nm.slice(0, 25) + '…' : nm, der = cx < W * 0.62;
      let yy = cy + 4; for (let k = 0; k < 5 && usadas.some(u => Math.abs(u - yy) < 13); k++) yy += 13; usadas.push(yy);
      h += `<text x="${der ? cx + 11 : cx - 11}" y="${yy}" text-anchor="${der ? 'start' : 'end'}" class="pf-lbl">${esc(t)}</text>`; });
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.innerHTML = h;
  }

  function csv(vis) {
    const cell = s => { s = String(s == null ? '' : s); if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+([.,]\d+)?$/.test(s)) s = "'" + s; return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const head = ['Iniciativa', 'Fase', 'OKR', 'Tipo de valor', 'ICE', 'Avance %', 'Avance esperado %', 'Inicio', 'Fin', 'Valor a dos años', 'Valor proyectado total', 'Estado del caso', 'VPN', 'TIR %', 'Alertas'];
    const lines = [head.map(cell).join(';'), ...vis.map(r => [App.projectName(r.p), r.x.estado, r.okrs.join(', '), r.cats.map(App.catLabel).join(', '), r.x.ice ?? '', r.pl.acts.length ? r.pl.avance : '', r.esp ?? '', r.pl.ini || '', r.pl.fin || '', Math.round(dosAnios(r)) || '', Math.round(r.valor) || '', r.x.caso ? r.x.caso.estado || 'Borrador' : '', r.f && r.f.vpn != null ? Math.round(r.f.vpn) : '', r.f && r.f.tir != null ? Math.round(r.f.tir * 1000) / 10 : '', r.al.length ? r.al.map(o => o.txt).join(' · ') : sinDatos(r) ? 'Sin datos' : ''].map(cell).join(';'))];
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `portafolio-${App.d.today()}.csv`; a.click(); URL.revokeObjectURL(a.href);
  }

  App.Portafolio = { render };
})();
