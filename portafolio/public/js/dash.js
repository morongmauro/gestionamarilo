/* ============================================================
   TABLERO DEL PORTAFOLIO
   - datos(): valor a captar por año (casos de negocio, o Income si no hay
     caso), valor captado mes a mes y esperado a la fecha (meses cerrados).
   - senales(): alertas de cada iniciativa (captura, cronograma, ruta
     crítica, fecha meta, VPN, compromisos, próximos comités).
   - render(): la página en orden de lectura (ver más abajo).
   ============================================================ */
'use strict';
(function () {
  const { $, $$, esc } = App;
  const F = Object.assign({ anio: null, estado: '', tipo: '', alcance: 'todos', orden: 'cumpl', tabla: false }, App.store.get('dash', {}));
  const FT = F;
  const saveF = () => App.store.set('dash', F);

  /* ---------- cálculo ---------- */
  // F = filtros del tablero; la ficha del proyecto pasa los suyos (año actual, sin filtros)
  function datos(F = FT) {
    const hoy = App.d.today(), hoyY = +hoy.slice(0, 4), hoyM = +hoy.slice(5, 7);
    // Meses cerrados del año: lo captado se registra por mes, así que el mes en curso aún no cuenta como esperado
    const corrido = y => (y < hoyY ? 12 : y > hoyY ? 0 : hoyM - 1);
    const unidad = (App.S.tablero && App.S.tablero.income_unidad) || 1e6;
    const ec = App.estadoCol(), tv = App.S.columns.find(c => c.id === 'tipo_valor') || App.S.columns.find(c => /tipo de valor/i.test(c.name));
    const cats = App.CATS.map(c => c.id).filter(id => !F.tipo || id === F.tipo);
    let usd = 0;
    const proyectos = App.projectsSorted().filter(p => !F.dgv || App.enAlcance(p)).filter(p => !F.estado || !ec || (p.props || {})[ec.id] === F.estado).map(p => {
      const caso = App.caseOf(p.id);
      const real = App.enRealizacion(p);
      const esUSD = caso && caso.moneda === 'USD'; if (esUSD) usd++;
      const conBen = caso && !esUSD && (caso.flujos || []).some(f => f.tipo === 'beneficio' && (f.valores || []).some(Number));
      const inc = Number((p.props || {}).income) || 0, vc = Number((p.props || {}).valor_crear) || 0;
      const fuente = conBen ? 'caso' : inc > 0 ? 'income' : vc > 0 ? 'valor' : null;
      const y0 = caso ? App.anioCero(caso) : hoyY, nAnios = caso ? Math.round(caso.anios || 5) + 1 : 0;
      const catInc = App.catDeTipoValor(tv ? (p.props || {})[tv.id] : '');
      const anual = (cat, y) => {
        if (fuente === 'caso') { const t = y - y0; if (t < 0 || t >= nAnios) return 0; return caso.flujos.filter(f => f.tipo === 'beneficio' && App.catOf(f) === cat).reduce((a, f) => a + (Number((f.valores || [])[t]) || 0), 0); }
        if (fuente === 'income') return cat === catInc && y >= hoyY && y < hoyY + 5 ? inc * unidad : 0;
        if (fuente === 'valor') return cat === catInc && y >= hoyY && y < hoyY + 5 ? vc / 5 : 0; // «Valor a crear/capturar» total, repartido en 5 años
        return 0;
      };
      const captado = (cat, y, mes) => (caso && !esUSD ? (caso.captado || []) : []).filter(x => x.categoria === cat && x.mes.startsWith(y + '-') && (!mes || +x.mes.slice(5) <= mes)).reduce((a, x) => a + (Number(x.valor) || 0), 0);
      const capVer = (cat, y) => (caso && !esUSD ? (caso.captado || []) : []).filter(x => x.categoria === cat && x.mes.startsWith(y + '-') && App.Mejoras.verificado(x, caso)).reduce((a, x) => a + (Number(x.valor) || 0), 0);
      const vpn = caso && !esUSD ? Finanzas.calc(caso).vpn : null;
      const catsP = App.CATS.map(c => c.id).filter(id => [hoyY, hoyY + 1, hoyY + 2].some(y => anual(id, y) > 0));
      return { p, caso, real, fuente, anual, captado, capVer, vpn, ice: App.iceOf(p), estado: ec ? (p.props || {})[ec.id] || '' : '', catPrincipal: catsP[0] || (fuente === 'income' ? catInc : null), y0, nAnios };
    }).filter(x => F.alcance !== 'real' || x.real);
    // años con datos
    let yMin = hoyY, yMax = hoyY + 4;
    proyectos.forEach(x => { if (x.fuente === 'caso') { yMin = Math.min(yMin, x.y0); yMax = Math.max(yMax, x.y0 + x.nAnios - 1); } });
    yMin = Math.max(yMin, hoyY - 5); yMax = Math.min(yMax, yMin + 11);
    const anios = []; for (let y = yMin; y <= yMax; y++) anios.push(y);
    const Y = F.anio && anios.includes(F.anio) ? F.anio : hoyY;
    const sumP = (fn, lista = proyectos) => lista.reduce((a, x) => a + cats.reduce((b, k) => b + fn(x, k), 0), 0);
    const porAnio = anios.map(y => ({ y, cats: Object.fromEntries(cats.map(k => [k, proyectos.reduce((a, x) => a + x.anual(k, y), 0)])), captado: sumP((x, k) => x.captado(k, y)) }));
    const reales = proyectos.filter(x => x.real);
    const proyectadoY = sumP((x, k) => x.anual(k, Y));
    const esperadoY = sumP((x, k) => x.anual(k, Y), reales) * corrido(Y) / 12;
    const captadoY = sumP((x, k) => x.captado(k, Y));
    const verifY = sumP((x, k) => x.capVer(k, Y));
    // curva mensual del año Y (acumulada)
    const curva = Array.from({ length: 12 }, (_, i) => ({
      mes: i + 1,
      esperado: sumP((x, k) => x.anual(k, Y), reales) * (i + 1) / 12,
      captado: sumP((x, k) => x.captado(k, Y, i + 1)),
    }));
    const mesHasta = Y < hoyY ? 12 : Y > hoyY ? 0 : hoyM;
    const filas = proyectos.map(x => {
      const proy = cats.reduce((a, k) => a + x.anual(k, Y), 0), cap = cats.reduce((a, k) => a + x.captado(k, Y), 0);
      const esp = x.real ? proy * corrido(Y) / 12 : 0;
      return { ...x, proy, cap, esp, pc: esp > 0 ? cap / esp : null };
    });
    return { hoy, hoyY, hoyM, Y, anios, cats, porAnio, proyectadoY, esperadoY, captadoY, verifY, curva, mesHasta, filas, proyectos, reales, usd, unidad, corrido: corrido(Y) };
  }
  const estadoDe = pc => (pc == null ? null : pc >= 0.9 ? ['good', '✓', 'En meta'] : pc >= 0.7 ? ['warning', '!', 'Por debajo'] : ['critical', '✕', 'Rezagado']);
  const m = v => App.moneyShort(v);
  const mm = v => (v === 0 ? '0' : App.moneyShort(v));

  function ticks(hi, n = 4) {
    if (!(hi > 0)) return [0, 1];
    const raw = hi / n, mag = Math.pow(10, Math.floor(Math.log10(raw))), r = raw / mag;
    const step = (r <= 1 ? 1 : r <= 2 ? 2 : r <= 2.5 ? 2.5 : r <= 5 ? 5 : 10) * mag;
    const out = []; for (let v = 0; v <= hi + step * 0.999; v += step) out.push(Math.round(v / step) * step);
    return out;
  }

  /* ---------- tooltip ---------- */
  let tip;
  function showTip(e, html) {
    if (!tip) { tip = document.createElement('div'); tip.className = 'dash-tip'; document.body.appendChild(tip); }
    tip.innerHTML = html; tip.hidden = false;
    const w = tip.offsetWidth, h = tip.offsetHeight;
    let x = e.clientX + 16, y = e.clientY + 14;
    if (x + w > innerWidth - 8) x = e.clientX - w - 16;
    if (y + h > innerHeight - 8) y = e.clientY - h - 14;
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  }
  const hideTip = () => { if (tip) tip.hidden = true; };
  const row = (c, lbl, val, bold) => `<div class="r"><span>${c ? `<i style="--c:${c}"></i>` : ''}${esc(lbl)}</span>${bold ? `<b>${esc(val)}</b>` : esc(val)}</div>`;
  /* ---------- salud de cada proyecto (para «Requiere atención» y la matriz) ---------- */
  // Reglas a la vista: nada se decide en secreto. Cada señal dice de dónde sale.
  function senales(d) {
    const hoy = d.hoy, en14 = App.d.add(hoy, 14);
    return d.filas.map(x => {
      const p = x.p, pl = App.planOf(p.id), out = [];
      const st = estadoDe(x.pc);
      if (st && st[0] !== 'good') out.push({ sev: st[0] === 'critical' ? 3 : 2, txt: `Captura ${st[0] === 'critical' ? 'rezagada' : 'por debajo'}: ${Math.round(x.pc * 100)}% de lo esperado a la fecha`, href: `#/casos/${p.id}` });
      const masVieja = pl.atrasadas ? Math.max(...pl.acts.filter(a => a.fin && a.fin < hoy && (a.avance || 0) < 100).map(a => App.d.diff(a.fin, hoy))) : 0;
      // Crítico: 5 o más actividades atrasadas, o alguna con más de 30 días de atraso. Lo demás es «Atención».
      if (pl.atrasadas) out.push({ sev: pl.atrasadas >= 5 || masVieja > 30 ? 3 : 2, txt: `${pl.atrasadas} actividad${pl.atrasadas > 1 ? 'es' : ''} atrasada${pl.atrasadas > 1 ? 's' : ''} en el cronograma`, href: `#/cronograma/${p.id}` });
      let riesgoRC = 0;
      if (pl.acts.length && App.PlanHost) { try { riesgoRC = App.PlanHost.modelo(p.id).summary.rutaCriticaEnRiesgo || 0; } catch (e) { riesgoRC = 0; } }
      if (riesgoRC) out.push({ sev: 3, txt: `${riesgoRC} actividad${riesgoRC > 1 ? 'es' : ''} de la ruta crítica en riesgo`, href: `#/cronograma/${p.id}` });
      if (p.fecha_meta && pl.fin && pl.fin > p.fecha_meta && window.Plan) { const dif = Plan.cal.difHabiles(p.fecha_meta, pl.fin); out.push({ sev: 2, txt: `Termina ${dif} día${dif === 1 ? '' : 's'} hábil${dif === 1 ? '' : 'es'} después de la fecha meta`, href: `#/cronograma/${p.id}` }); }
      if (x.vpn != null && x.vpn < 0) out.push({ sev: 2, txt: `VPN negativo (${m(x.vpn)})`, href: `#/casos/${p.id}` });
      const vencidos = App.S.sessions.filter(s => (s.proyectos || []).includes(p.id)).flatMap(s => s.compromisos || []).filter(k => !k.hecho && k.fecha && k.fecha < hoy && (k.texto || '').trim()).length;
      if (vencidos) out.push({ sev: 2, txt: `${vencidos} compromiso${vencidos > 1 ? 's' : ''} de comité vencido${vencidos > 1 ? 's' : ''}`, href: '#/agenda' });
      const ses = App.S.sessions.filter(s => (s.proyectos || []).includes(p.id) && s.fecha >= hoy && s.fecha <= en14 && s.estado !== 'Cancelada').sort((a, b) => a.fecha.localeCompare(b.fecha))[0];
      if (ses) out.push({ sev: 1, txt: `Pasa por ${App.Agenda ? App.Agenda.tituloOf(ses) : 'comité'} el ${App.d.fmtShort(ses.fecha)}${x.caso && (x.caso.estado || 'Borrador') !== 'Aprobado' ? ' · caso ' + (x.caso.estado || 'en borrador').toLowerCase() : ''}`, href: `#/proyectos/${p.id}/comites` });
      const pausado = /paus|cancel|suspend|detenid/i.test(x.estado || '');
      const malo = out.some(z => z.sev >= 2);
      return { x, out, pausado, malo, max: out.reduce((mx, z) => Math.max(mx, z.sev), 0) };
    });
  }
  const SEV = { 3: ['crit', 'i-x', 'Crítico'], 2: ['warn', 'i-alerta', 'Atención'], 1: ['info', 'i-info', 'Próximo'] };

  /* ============================================================
     TABLERO · en orden de lectura
     1 Valor a crear (lo que proyectan los casos, año por año)
     2 Captura por iniciativa (año elegido)
     3 Proyectado vs. capturado (curva del año)
     4 Qué requiere atención · 5 Calendario
     Lo azul con → es enlace; las filas con › se abren; el resto es lectura.
     ============================================================ */
  const ORDEN_CAT = ['ingresos', 'ahorro', 'tiempo', 'eficiencia', 'riesgo', 'otro'];
  const PALETA = ORDEN_CAT.map(k => `var(--cat-${k})`);
  // OKRs de una iniciativa: la columna es texto; varios se separan con coma, punto y coma o salto de línea
  const okrsDe = p => String((p.props || {}).okrs || '').split(/[,;\n]/).map(s => s.trim()).filter(s => s && !/^por definir$/i.test(s));
  App.okrsDe = okrsDe;

  // Series del gráfico de valor a crear, según cómo se agrupe
  function series(d, modo) {
    const total = (x, y) => d.cats.reduce((a, k) => a + x.anual(k, y), 0);
    if (modo === 'okr') {
      const nombres = [...new Set(d.filas.flatMap(x => okrsDe(x.p)))].sort((a, b) => a.localeCompare(b));
      const grupos = nombres.map((n, i) => ({ key: n, label: n, color: PALETA[i % PALETA.length] }));
      if (d.filas.some(x => !okrsDe(x.p).length)) grupos.push({ key: '', label: 'Sin OKR asignado', color: 'var(--viz-muted)' });
      const val = (x, y, g) => { const l = okrsDe(x.p); return (l.length ? l.includes(g.key) : g.key === '') ? total(x, y) / Math.max(1, l.length) : 0; };
      return { grupos, val, nota: 'Una iniciativa con varios OKR reparte su valor en partes iguales.' };
    }
    if (modo === 'etapa') {
      const ec = App.estadoCol(), opts = ec ? (ec.options || []) : [];
      const pausa = n => /paus|cancel|suspend|descart/i.test(n), activos = opts.filter(o => !pausa(o.name));
      const color = o => (pausa(o.name) ? 'var(--ord-paus)' : `var(--ord-${Math.min(5, 1 + Math.round(activos.indexOf(o) * 4 / Math.max(1, activos.length - 1)))})`);
      const grupos = opts.map(o => ({ key: o.name, label: o.name, color: color(o) }));
      if (d.filas.some(x => !x.estado)) grupos.push({ key: '', label: 'Sin fase', color: 'var(--viz-muted)' });
      return { grupos, val: (x, y, g) => (x.estado === g.key ? total(x, y) : 0), nota: '' };
    }
    const grupos = ORDEN_CAT.filter(k => d.cats.includes(k)).map(k => ({ key: k, label: App.catLabel(k), color: `var(--cat-${k})` }));
    return { grupos, val: (x, y, g) => x.anual(g.key, y), nota: '' };
  }

  function valorACrear(d) {
    const S = series(d, F.agrupar || 'tipo');
    let filas = d.anios.map(y => ({ y, v: Object.fromEntries(S.grupos.map(g => [g.key, d.filas.reduce((a, x) => a + S.val(x, y, g), 0)])) }));
    filas.forEach(f => { f.t = S.grupos.reduce((a, g) => a + f.v[g.key], 0); });
    // sin años vacíos en las puntas
    while (filas.length > 1 && !filas[0].t) filas.shift();
    while (filas.length > 1 && !filas.at(-1).t) filas.pop();
    const grupos = S.grupos.filter(g => filas.some(f => f.v[g.key] > 0));
    const tot = filas.reduce((a, f) => a + f.t, 0);
    const pico = filas.slice().sort((a, b) => b.t - a.t).slice(0, 2).map(f => f.y).sort();
    const actual = filas.find(f => f.y === d.hoyY);
    const frase = tot
      ? `El mayor valor llega en <b>${pico.join(' y ')}</b>.${actual ? ` <b>${d.hoyY}</b> proyecta <b>${esc(m(actual.t))}</b>.` : ''}`
      : 'Aún no hay valor proyectado: agrega beneficios a los casos de negocio o el Income en la tabla del portafolio.';
    const sumG = grupos.map(g => ({ g, v: filas.reduce((a, f) => a + f.v[g.key], 0) })).sort((a, b) => b.v - a.v);
    valorACrear.ultimo = { filas, grupos };
    return `<section class="t-card t-dest t-hero" aria-labelledby="t1">
      <div class="t-hero-l">
        <div class="t-eyb">Valor proyectado ${filas.length ? `${filas[0].y} – ${filas.at(-1).y}` : ''}</div>
        <div class="t-big">${esc(m(tot))}</div>
        <div class="t-cob"><b>${d.proyectos.filter(x => x.fuente).length} de ${d.proyectos.length}</b> iniciativas con cifras${d.proyectos.some(x => !x.fuente) ? ` · <a class="t-lnk" href="#/casos">${d.proyectos.filter(x => !x.fuente).length} aún sin caso →</a>` : ''}</div>
        <p class="t-frase">${frase}</p>
        <div class="t-grupos">${sumG.slice(0, 7).map(({ g, v }) => `<div class="t-gr"><i style="background:${g.color}"></i><span title="${esc(g.label)}">${esc(g.label)}</span><b>${esc(m(v))}</b><small>${tot ? Math.round(v / tot * 100) : 0} %</small></div>`).join('')}${sumG.length > 7 ? `<div class="t-gr t-mas">y ${sumG.length - 7} más</div>` : ''}</div>
        <div class="t-aviso">Suma solo las iniciativas con caso de negocio. Las que no tienen caso todavía no aportan a esta cifra. La captura real se mide abajo.${S.nota ? ' ' + esc(S.nota) : ''}</div>
      </div>
      <div class="t-hero-r">
        <div class="t-lgd">${grupos.slice(0, 7).map(g => `<span><i style="background:${g.color}"></i>${esc(g.label.length > 34 ? g.label.slice(0, 33) + '…' : g.label)}</span>`).join('')}</div>
        <svg class="t-viz" id="tAnios" height="270" role="img" aria-label="Valor proyectado por año"></svg>
      </div></section>`;
  }
  function dibujarAnios(svg, d) {
    const { filas, grupos } = valorACrear.ultimo, W = svg.clientWidth || 700, H = 270, T = 26, B = 30;
    if (!filas.length) { svg.innerHTML = ''; return; }
    const tk = ticks(Math.max(1, ...filas.map(f => f.t))), top = tk.at(-1);
    const y = v => T + (1 - v / top) * (H - T - B), step = W / filas.length, bw = Math.min(78, step * 0.56);
    let h = tk.slice(1).map(v => `<line x1="0" x2="${W}" y1="${y(v)}" y2="${y(v)}" class="t-grid"/>`).join('');
    filas.forEach((f, i) => {
      const cx = step * i + step / 2, x0 = cx - bw / 2, pasado = f.y < d.hoyY; let acc = 0;
      const segs = grupos.filter(g => f.v[g.key] > 0);
      segs.forEach((g, j) => { const v = f.v[g.key], y1 = y(acc + v), hh = Math.max(0, y(acc) - y1 - (j ? 2 : 0));
        h += `<rect x="${x0}" y="${y1}" width="${bw}" height="${hh}" rx="${j === segs.length - 1 ? 4 : 0}" style="fill:${g.color}${pasado ? ';opacity:.45' : ''}"/>`; acc += v; });
      if (f.y === d.hoyY) h += `<rect x="${x0 - 8}" y="${T - 4}" width="${bw + 16}" height="${H - T - B + 8}" rx="8" class="t-hoyb"/>`;
      if (f.t) h += `<text x="${cx}" y="${y(f.t) - 8}" text-anchor="middle" class="t-val" style="font-size:${step < 80 ? 10 : 13}px">${esc(m(f.t))}</text>`;
      h += `<text x="${cx}" y="${H - 10}" text-anchor="middle" class="t-ax ${f.y === d.hoyY ? 'on' : ''}">${f.y}${step < 90 ? '' : f.y === d.hoyY ? ' · hoy' : pasado ? ' · cerrado' : ''}</text>`;
      h += `<rect class="hit" data-anio2="${i}" x="${step * i}" y="0" width="${step}" height="${H}"/>`;
    });
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.innerHTML = h;
  }

  function capturaIniciativas(d) {
    const ver = x => d.cats.reduce((a, k) => a + x.capVer(k, d.Y), 0);
    let rows = d.filas.filter(x => x.proy > 0 || x.cap > 0).map(x => ({ x, ver: ver(x) }));
    const n = rows.length;
    rows.sort(F.cpi === 'brecha' ? (a, b) => (b.x.esp - b.x.cap) - (a.x.esp - a.x.cap) : (a, b) => b.x.cap - a.x.cap || b.x.proy - a.x.proy);
    rows = rows.slice(0, 8);
    const max = Math.max(1, ...rows.map(r => Math.max(r.x.proy, r.x.cap, r.x.esp)));
    const pct = v => `${Math.max(0, Math.min(100, v / max * 100))}%`;
    return `<section class="t-card t-pad" aria-labelledby="t2">
      ${n ? `<div class="t-lgd"><span><i style="background:var(--good)"></i>Verificado</span><span><i style="background:var(--ink)"></i>Capturado sin verificar</span><span><i class="t-sw-claro"></i>Proyectado ${d.Y}</span><span><i class="t-sw-marca"></i>Esperado a hoy</span></div>
      <div class="t-cpi t-cpi-h"><span>Iniciativa · tipo de valor</span><span>0 — ${esc(m(max))}</span><span class="n">Capturado</span><span class="n">vs. esperado</span></div>
      ${rows.map(({ x, ver: v }) => { const st = estadoDe(x.pc);
        return `<a class="t-cpi" href="#/proyectos/${x.p.id}/caso"><span class="t-nm"><b>${esc(App.projectName(x.p))}</b><small>${x.catPrincipal ? `<i style="background:var(--cat-${x.catPrincipal})"></i>${esc(App.catLabel(x.catPrincipal))}` : 'sin tipo de valor'}</small></span>
          <span class="t-bar"><i class="p" style="width:${pct(x.proy)}"></i><i class="c" style="width:${pct(x.cap)}"></i><i class="v" style="width:${pct(Math.min(v, x.cap))}"></i>${x.esp > 0 ? `<u style="left:${pct(x.esp)}"></u>` : ''}</span>
          <span class="n"><b>${esc(mm(x.cap))}</b><small> / ${esc(mm(x.proy))}</small></span>
          <span class="n">${st ? `<span class="t-pc ${st[0]}">${Math.round(x.pc * 100)} %</span>` : '<span class="faint">—</span>'}</span></a>`; }).join('')}`
      : `<div class="t-vacio">Aún no hay valor proyectado ni capturado en ${d.Y}.</div>`}
      <div class="t-pie"><button class="t-lnk" data-evid="1" aria-expanded="false">¿De dónde sale lo capturado?</button><a class="t-lnk" href="#/casos">Ver ${n > 8 ? `las ${n}` : 'todas'} en Casos de negocio →</a></div>
      <div class="evid" id="evidBox" hidden>${App.Mejoras.evidenciaHTML(d.Y, d.filas)}</div></section>`;
  }

  function curvaDatos(d) {
    const ver = Array.from({ length: 12 }, (_, i) => d.filas.reduce((a, x) => a + (x.caso && x.caso.moneda !== 'USD' ? (x.caso.captado || []).filter(c => c.mes && c.mes.startsWith(d.Y + '-') && +c.mes.slice(5) <= i + 1 && d.cats.includes(c.categoria) && App.Mejoras.verificado(c, x.caso)).reduce((s, c) => s + (Number(c.valor) || 0), 0) : 0), 0));
    return d.curva.map((c, i) => ({ ...c, ver: ver[i] }));
  }
  function dibujarCurva(svg, d) {
    const W = svg.clientWidth || 900, H = 210, L = 64, R = 86, T = 12, B = 26, cv = curvaDatos(d);
    const tk = ticks(Math.max(1, ...cv.map(c => Math.max(c.esperado, c.captado)))), top = tk.at(-1);
    // Cada mes se pinta al cierre; el mes en curso, en el día de hoy
    const hx = d.Y === d.hoyY ? L + (W - L - R) * (d.hoyM - 1 + (+d.hoy.slice(8)) / 31) / 12 : null;
    const xm = i => L + (W - L - R) * (i + 1) / 12, x0 = L, y = v => T + (1 - v / top) * (H - T - B);
    const hasta = d.mesHasta, pts = cv.slice(0, Math.max(0, hasta));
    const x = i => (hx != null && i === d.hoyM - 1 && i < hasta && i === pts.length - 1 ? hx : xm(i));
    const xp = i => xm(i); // la línea proyectada llega a cada cierre de mes
    const linea = (arr, k, fx = x) => `M${x0} ${y(0)}` + arr.map((c, i) => `L${fx(i)} ${y(c[k])}`).join('');
    let h = tk.map(v => `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" class="t-grid"/><text x="${L - 8}" y="${y(v) + 4}" text-anchor="end" class="t-ax">${esc(mm(v))}</text>`).join('');
    h += App.d.MES3.map((t, i) => (W < 640 && i % 3 ? '' : `<text x="${L + (W - L - R) * (i + 0.5) / 12}" y="${H - 6}" text-anchor="middle" class="t-ax">${t}</text>`)).join('');
    h += `<path d="${linea(cv, 'esperado', xp)}" class="t-l-proy"/>`;
    if (pts.length) h += `<path d="${linea(pts, 'captado')}" class="t-l-cap"/><path d="${linea(pts, 'ver')}" class="t-l-ver"/>`;
    if (hx != null) { h += `<line x1="${hx}" x2="${hx}" y1="${T}" y2="${H - B}" class="t-hoy"/><text x="${hx - 6}" y="${H - B - 6}" text-anchor="end" class="t-hoyt">Hoy</text>`; }
    const fin = (i, v, cls, t, dy) => `<circle cx="${x(i)}" cy="${y(v)}" r="4" class="${cls}"/><text x="${x(i) + 8}" y="${y(v) + dy}" class="t-val">${t}</text>`;
    h += `<circle cx="${xp(11)}" cy="${y(cv[11].esperado)}" r="4" class="t-p-proy"/><text x="${xp(11) + 8}" y="${y(cv[11].esperado) + 4}" class="t-val">${esc(m(cv[11].esperado))}</text>`;
    if (pts.length) { const i = pts.length - 1, a = pts[i].captado, b = pts[i].ver, junto = Math.abs(y(a) - y(b)) < 16;
      h += fin(i, a, 't-p-cap', esc(m(a)), junto ? -6 : 4) + fin(i, b, 't-p-ver', esc(m(b)), junto ? 14 : 4); }
    h += cv.map((c, i) => `<rect class="hit" data-mes2="${i}" x="${L + (W - L - R) * i / 12}" y="${T}" width="${(W - L - R) / 12}" height="${H - T - B}"/>`).join('');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.innerHTML = h;
  }

  function atencion2(sg) {
    const filas = sg.filter(z => z.out.some(o => o.sev >= 2)).map(z => { const o = z.out.slice().sort((a, b) => b.sev - a.sev); return { z, o: o[0], mas: o.filter(q => q.sev >= 2).length - 1 }; })
      .sort((a, b) => b.o.sev - a.o.sev || b.mas - a.mas);
    return `<section class="t-card" aria-labelledby="t4">${filas.length ? filas.slice(0, 5).map(({ z, o, mas }) => { const [c, , l] = SEV[o.sev];
      return `<a class="t-row" href="${o.href}"><span class="t-sev ${c}">${c === 'crit' ? '●' : '▲'} ${l}</span><span class="t-tx"><b>${esc(App.projectName(z.x.p))}</b><small>${esc(o.txt)}${mas > 0 ? ` · +${mas} más` : ''}</small></span><span class="t-ch">›</span></a>`; }).join('')
      : '<div class="t-vacio">Todo al día: ninguna iniciativa tiene alertas.</div>'}
      <div class="t-pie t-pie-row"><span class="t-tag">${filas.length} iniciativa${filas.length === 1 ? '' : 's'} con alertas</span><a class="t-lnk" href="#/proyectos">Ver el portafolio →</a></div></section>`;
  }

  function calendario(d) {
    const hoy = d.hoy, lim = App.d.add(hoy, 30);
    const ses = App.S.sessions.filter(s => s.fecha >= hoy && s.fecha <= lim && s.estado !== 'Cancelada')
      .map(s => ({ f: s.fecha, t: App.Agenda ? App.Agenda.tituloOf(s) : 'Comité', s: (s.proyectos || []).length ? `${s.proyectos.length} iniciativa${s.proyectos.length === 1 ? '' : 's'} en agenda` : 'Sin iniciativas en agenda todavía', href: '#/agenda' }));
    const hitos = App.S.activities.filter(a => a.hito && (a.fin || a.inicio) >= hoy && (a.fin || a.inicio) <= lim)
      .map(a => { const p = App.byId('projects', a.project_id); return p ? { f: a.fin || a.inicio, t: 'Hito · ' + (a.name || 'sin nombre'), s: App.projectName(p), href: `#/cronograma/${p.id}` } : null; }).filter(Boolean);
    const ev = ses.concat(hitos).sort((a, b) => a.f.localeCompare(b.f)).slice(0, 5);
    const venc = App.S.sessions.flatMap(s => s.compromisos || []).filter(k => !k.hecho && k.fecha && k.fecha < hoy && (k.texto || '').trim()).length;
    return `<section class="t-card" aria-labelledby="t5">${ev.length ? ev.map(e => `<a class="t-row t-ev" href="${e.href}"><span class="t-f"><b>${+e.f.slice(8)}</b><small>${App.d.MES3[+e.f.slice(5, 7) - 1]}</small></span><span class="t-tx"><b>${esc(e.t)}</b><small>${esc(e.s)}</small></span><span class="t-ch">›</span></a>`).join('')
      : '<div class="t-vacio">No hay comités ni hitos en los próximos 30 días.</div>'}
      <div class="t-pie t-pie-row"><span class="t-tag">${venc ? `${venc} compromiso${venc === 1 ? '' : 's'} vencido${venc === 1 ? '' : 's'}` : 'Sin compromisos vencidos'}</span><a class="t-lnk" href="#/agenda">Ver el comité de valor →</a></div></section>`;
  }

  // Titulares: lo que un gerente pregunta primero
  function titulares(d, sg) {
    const pc = d.esperadoY > 0 ? d.captadoY / d.esperadoY : null, pv = d.captadoY > 0 ? d.verifY / d.captadoY : null;
    const rev = App.S.cases.filter(c => c.estado === 'En revisión').length;
    const prox = App.S.sessions.filter(x => x.fecha >= d.hoy && x.estado !== 'Cancelada').sort((a, b) => a.fecha.localeCompare(b.fecha))[0];
    const conAl = sg.filter(z => z.malo && !z.pausado), crit = conAl.filter(z => z.max >= 3).length;
    const ec = App.estadoCol(), activa = p => { const fa = window.Fases && ec ? Fases.de((p.props || {})[ec.id]) : null; return !fa || !fa.fuera; };
    const sinDatos = d.proyectos.filter(x => activa(x.p) && !x.caso && !App.actsOf(x.p.id).length).length;
    const tono = v => (v == null ? '' : v >= 0.9 ? 'ok' : v >= 0.7 ? 'warn' : 'crit');
    const t = (href, lbl, val, sub, cls) => `<a class="t-tit ${cls || ''}" href="${href}"><span class="l">${lbl}</span><b>${val}</b><small>${sub}</small></a>`;
    return `<div class="t-tits">
      ${t('#/casos', `Captado ${d.Y}`, esc(m(d.captadoY)), pc == null ? `de ${esc(m(d.proyectadoY))} proyectados para el año` : `<em>${Math.round(pc * 100)} %</em> de lo esperado a hoy (${esc(m(d.esperadoY))})`, tono(pc))}
      ${t('#/casos', 'Verificado', pv == null ? '—' : Math.round(pv * 100) + ' %', pv == null ? 'aún no hay captura registrada' : `${esc(m(d.verifY))} de ${esc(m(d.captadoY))} captados; el resto es preliminar`, pv == null ? '' : pv >= 0.8 ? 'ok' : pv >= 0.4 ? 'warn' : 'crit')}
      ${t('#/agenda', 'Casos por aprobar', String(rev), prox ? `próximo comité: ${esc(App.d.fmtShort(prox.fecha))}` : 'no hay comité programado', '')}
      ${t('#/proyectos', 'Con alertas', String(conAl.length), `${crit} crítica${crit === 1 ? '' : 's'} · ${sinDatos} sin datos para medir`, conAl.length ? (crit ? 'crit' : 'warn') : 'ok')}</div>`;
  }
  // A5 · lo desactualizado, a la vista de todos
  function desactualizado() {
    const it = App.Mejoras && App.Mejoras.desactualizadosItems ? App.Mejoras.desactualizadosItems() : [];
    return `<div class="t-sub">Qué está desactualizado <small>se calcula solo</small></div><section class="t-card">${it.length ? it.slice(0, 5).map(x => `<a class="t-row" href="${x.href}"><span class="t-sev des">↻ Actualizar</span><span class="t-tx"><b>${esc(x.t)}</b><small>${esc(x.s)}</small></span><span class="t-ch">›</span></a>`).join('') : '<div class="t-vacio">Nada pendiente de actualizar.</div>'}
      ${it.length > 5 ? `<div class="t-pie t-pie-row"><span class="t-tag">y ${it.length - 5} más</span></div>` : ''}</section>`;
  }

  /* ---------- sección ---------- */
  function render(main) {
    const d = datos({ anio: F.anio, estado: '', tipo: '', alcance: 'todos', dgv: true });
    const sg = senales(d);
    const fuera = App.S.projects.length - d.proyectos.length;
    const alcance = App.dgvHay() ? `<button class="pf-tg ${App.soloDgv() ? 'on' : ''}" data-dgv aria-pressed="${App.soloDgv()}" title="${App.soloDgv() ? `Solo cuenta las iniciativas con «¿Revisión DGV?»: SI. Hay ${fuera} más que no se muestran. Clic para verlas todas.` : 'Cuenta todas las iniciativas. Clic para ver solo las de «¿Revisión DGV?»: SI.'}">¿Revisión DGV?: ${App.soloDgv() ? 'SI' : 'todas'}</button>` : '';
    const paso = (n, t, s, extra) => `<div class="t-paso" id="t${n}"><i>${n}</i><b>${t}</b><small>${s}</small><span class="sp"></span>${extra || ''}</div>`;
    const seg = (k, val, ops) => `<div class="seg t-seg" role="group">${ops.map(([v, l]) => `<button data-${k}="${v}" class="${val === v ? 'on' : ''}" aria-pressed="${val === v}">${l}</button>`).join('')}</div>`;
    main.innerHTML = `<div class="pg-top"><button class="burger" data-act="burger" aria-label="Menú">☰</button><h1>Tablero</h1><span class="pg-meta">Datos al ${esc(App.d.fmt(d.hoy))} · ${d.filas.length} iniciativa${d.filas.length === 1 ? '' : 's'} · ${d.filas.filter(x => x.caso).length} con caso de negocio · pesos colombianos</span><span class="sp"></span>
        ${alcance}<label class="pg-sel">Año de captura <select data-f="anio">${d.anios.map(y => `<option ${y === d.Y ? 'selected' : ''}>${y}</option>`).join('')}</select></label>
        ${App.canEdit() ? '<button class="btn ghost sm" data-f-aj title="Ajustes del tablero" aria-label="Ajustes del tablero"><svg aria-hidden="true"><use href="#i-ajustes"/></svg></button>' : ''}</div>
      ${titulares(d, sg)}
      ${paso(1, 'Valor a crear', 'lo que proyectan los casos de negocio, año por año', seg('agrupar', F.agrupar || 'tipo', [['tipo', 'Por tipo de valor'], ['okr', 'Por OKR'], ['etapa', 'Por fase']]))}
      ${valorACrear(d)}
      ${paso(2, `Captura por iniciativa · ${d.Y}`, 'lo capturado frente a lo que debía llevar a la fecha', seg('cpi', F.cpi === 'brecha' ? 'brecha' : 'valor', [['valor', 'Mayor valor'], ['brecha', 'Mayor brecha']]))}
      ${capturaIniciativas(d)}
      ${paso(3, `Proyectado vs. capturado · ${d.Y}`, 'acumulado mes a mes')}
      <section class="t-card t-pad"><div class="t-lgd"><span><i class="t-sw-l proy"></i>Proyectado</span><span><i class="t-sw-l cap"></i>Capturado</span><span><i class="t-sw-l ver"></i>Verificado</span></div><svg class="t-viz" id="tCurva" height="210" role="img" aria-label="Proyectado contra capturado, acumulado"></svg></section>
      <div class="t-dos"><div>${paso(4, 'Qué requiere atención', 'lo más grave primero')}${atencion2(sg)}${desactualizado()}</div><div>${paso(5, 'Calendario', 'comités e hitos de los próximos 30 días')}${calendario(d)}</div></div>`;
    const draw = () => { const a = $('#tAnios', main), c = $('#tCurva', main); if (a) dibujarAnios(a, d); if (c) dibujarCurva(c, d); };
    draw();
    main.onclick = e => {
      if (e.target.closest('.burger')) return App.toggleSide();
      if (e.target.closest('[data-dgv]')) { App.store.set('alcance.dgv', App.soloDgv() ? 'todas' : 'si'); return App.render(); }
      const v = e.target.closest('[data-agrupar]'); if (v) { F.agrupar = v.dataset.agrupar; saveF(); return App.render(); }
      const c = e.target.closest('[data-cpi]'); if (c) { F.cpi = c.dataset.cpi; saveF(); return App.render(); }
      const ev = e.target.closest('[data-evid]'); if (ev) { const b = $('#evidBox', main); b.hidden = !b.hidden; ev.setAttribute('aria-expanded', !b.hidden); ev.textContent = b.hidden ? '¿De dónde sale lo capturado?' : 'Ocultar la evidencia'; return; }
      const aj = e.target.closest('[data-f-aj]');
      if (aj) {
        const p = App.openPop(aj, `<div class="lbl">Ajustes del tablero</div><label class="mi" style="display:block;cursor:default">La columna Income del portafolio está en<select class="fld" data-unidad style="margin-top:4px">${[[1e6, 'millones'], [1e3, 'miles'], [1, 'pesos']].map(([val, l]) => `<option value="${val}" ${d.unidad === val ? 'selected' : ''}>${l}</option>`).join('')}</select></label><div class="hint" style="padding:0 10px 8px">Se usa como valor anual de las iniciativas que aún no tienen caso de negocio.</div>`, { width: 280, nofocus: true });
        p.onchange = ev2 => { if (!ev2.target.hasAttribute('data-unidad')) return; const val = Number(ev2.target.value); App.closePop(true); App.guard(async () => { App.S.tablero = await App.api('PUT', '/api/config/tablero', { income_unidad: val }); App.render(); }); };
      }
    };
    main.onchange = e => { const t = e.target; if (t.dataset.f === 'anio') { F.anio = Number(t.value); saveF(); App.render(); } };
    main.onmousemove = e => {
      const h = e.target.closest('[data-anio2],[data-mes2]');
      if (!h) return hideTip();
      if (h.dataset.anio2 != null) {
        const { filas, grupos } = valorACrear.ultimo, f = filas[+h.dataset.anio2];
        showTip(e, `<div class="t">${f.y}${f.y === d.hoyY ? ' · año en curso' : f.y < d.hoyY ? ' · cerrado' : ''}</div>${grupos.filter(g => f.v[g.key] > 0).map(g => row(g.color, g.label, m(f.v[g.key]))).join('')}<div class="sep">${row('', 'Total proyectado', m(f.t), true)}</div>`);
      } else {
        const i = +h.dataset.mes2, c = curvaDatos(d)[i], vis = i < d.mesHasta;
        showTip(e, `<div class="t">${App.d.MESES[i].replace(/^./, s => s.toUpperCase())} ${d.Y}</div>${row('var(--viz-muted)', 'Proyectado acumulado', m(c.esperado))}${row('var(--ink)', 'Capturado acumulado', vis ? m(c.captado) : '—', true)}${row('var(--good)', 'Verificado acumulado', vis ? m(c.ver) : '—')}`);
      }
    };
    main.onmouseleave = hideTip;
    clearTimeout(render._rz);
    window.onresize = () => { clearTimeout(render._rz); render._rz = setTimeout(() => { if (location.hash.startsWith('#/tablero')) draw(); }, 200); };
  }

  App.Dash = { datos, senales };
  App.views.tablero = { render };
})();
