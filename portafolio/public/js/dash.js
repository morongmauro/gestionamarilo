/* ============================================================
   TABLERO DEL PORTAFOLIO
   - Valor a captar por año (casos de negocio, o Income si no hay caso)
     y valor captado (lo que el equipo registra mes a mes).
   - Esperado a la fecha: el valor del año repartido por meses, según
     los meses que van corridos.
   - Tipo de valor: ahorro, nuevos ingresos, eficiencia, tiempo, riesgo, otro.
   - ICE y estado de cada proyecto.
   Colores validados (paleta categórica en orden fijo, escala ordinal de
   estados, colores de estado con ícono y texto). Cada gráfica tiene
   detalle al pasar el mouse y la tabla de abajo es su vista en tabla.
   ============================================================ */
'use strict';
(function () {
  const { $, $$, esc } = App;
  const F = Object.assign({ anio: null, estado: '', tipo: '', alcance: 'todos', orden: 'cumpl', tabla: false }, App.store.get('dash', {}));
  const saveF = () => App.store.set('dash', F);
  let lastKey = '';

  /* ---------- cálculo ---------- */
  function datos() {
    const hoy = App.d.today(), hoyY = +hoy.slice(0, 4), hoyM = +hoy.slice(5, 7);
    const diasMes = new Date(Date.UTC(hoyY, hoyM, 0)).getUTCDate();
    const corrido = y => (y < hoyY ? 12 : y > hoyY ? 0 : hoyM - 1 + (+hoy.slice(8)) / diasMes); // meses corridos del año
    const unidad = (App.S.tablero && App.S.tablero.income_unidad) || 1e6;
    const ec = App.estadoCol(), tv = App.S.columns.find(c => c.id === 'tipo_valor') || App.S.columns.find(c => /tipo de valor/i.test(c.name));
    const cats = App.CATS.map(c => c.id).filter(id => !F.tipo || id === F.tipo);
    let usd = 0;
    const proyectos = App.projectsSorted().filter(p => !F.estado || !ec || (p.props || {})[ec.id] === F.estado).map(p => {
      const caso = App.caseOf(p.id);
      const real = App.enRealizacion(p);
      const esUSD = caso && caso.moneda === 'USD'; if (esUSD) usd++;
      const conBen = caso && !esUSD && (caso.flujos || []).some(f => f.tipo === 'beneficio' && (f.valores || []).some(Number));
      const inc = Number((p.props || {}).income) || 0;
      const fuente = conBen ? 'caso' : inc > 0 ? 'income' : null;
      const y0 = caso ? App.anioCero(caso) : hoyY, nAnios = caso ? Math.round(caso.anios || 5) + 1 : 0;
      const catInc = App.catDeTipoValor(tv ? (p.props || {})[tv.id] : '');
      const anual = (cat, y) => {
        if (fuente === 'caso') { const t = y - y0; if (t < 0 || t >= nAnios) return 0; return caso.flujos.filter(f => f.tipo === 'beneficio' && App.catOf(f) === cat).reduce((a, f) => a + (Number((f.valores || [])[t]) || 0), 0); }
        if (fuente === 'income') return cat === catInc && y >= hoyY && y < hoyY + 5 ? inc * unidad : 0;
        return 0;
      };
      const captado = (cat, y, mes) => (caso && !esUSD ? (caso.captado || []) : []).filter(x => x.categoria === cat && x.mes.startsWith(y + '-') && (!mes || +x.mes.slice(5) <= mes)).reduce((a, x) => a + (Number(x.valor) || 0), 0);
      const vpn = caso && !esUSD ? Finanzas.calc(caso).vpn : null;
      const catsP = App.CATS.map(c => c.id).filter(id => [hoyY, hoyY + 1, hoyY + 2].some(y => anual(id, y) > 0));
      return { p, caso, real, fuente, anual, captado, vpn, ice: App.iceOf(p), estado: ec ? (p.props || {})[ec.id] || '' : '', catPrincipal: catsP[0] || (fuente === 'income' ? catInc : null), y0, nAnios };
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
    return { hoy, hoyY, hoyM, Y, anios, cats, porAnio, proyectadoY, esperadoY, captadoY, curva, mesHasta, filas, reales, usd, unidad, corrido: corrido(Y) };
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
  const cvar = k => `var(--cat-${k})`;

  /* ---------- salud de cada proyecto (para «Requiere atención» y la matriz) ---------- */
  // Reglas a la vista: nada se decide en secreto. Cada señal dice de dónde sale.
  function senales(d) {
    const hoy = d.hoy, en14 = App.d.add(hoy, 14);
    return d.filas.map(x => {
      const p = x.p, pl = App.planOf(p.id), out = [];
      const st = estadoDe(x.pc);
      if (st && st[0] !== 'good') out.push({ sev: st[0] === 'critical' ? 3 : 2, txt: `Captura ${st[0] === 'critical' ? 'rezagada' : 'por debajo'}: ${Math.round(x.pc * 100)}% de lo esperado a la fecha`, href: `#/casos/${p.id}` });
      if (pl.atrasadas) out.push({ sev: pl.atrasadas >= 3 ? 3 : 2, txt: `${pl.atrasadas} actividad${pl.atrasadas > 1 ? 'es' : ''} atrasada${pl.atrasadas > 1 ? 's' : ''} en el cronograma`, href: `#/cronograma/${p.id}` });
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
  const ico = id => `<svg aria-hidden="true"><use href="#${id}"/></svg>`;

  /* ---------- 1 · cifra principal + resumen en una frase ---------- */
  function hero(d, sg) {
    const pc = d.esperadoY > 0 ? d.captadoY / d.esperadoY : null, st = estadoDe(pc);
    const R = 54, fill = Math.max(0, Math.min(1, pc || 0));
    const col = st ? `var(--st-${st[0]})` : 'var(--viz-muted)';
    const nAt = sg.filter(z => z.max >= 2).length;
    const frase = d.esperadoY > 0
      ? `En ${d.Y} el portafolio ha capturado <b>${esc(m(d.captadoY))}</b>, el <b>${Math.round(pc * 100)}%</b> de lo esperado a la fecha. <b>${d.reales.length} de ${d.filas.length}</b> iniciativas están en realización${nAt ? ` y <b>${nAt} ${nAt === 1 ? 'tiene' : 'tienen'} alertas</b> de ejecución o de valor` : ' y ninguna tiene alertas'}.`
      : d.Y > d.hoyY ? `${d.Y} aún no empieza: se proyectan <b>${esc(m(d.proyectadoY))}</b> para el año.` : `Aún no hay proyectos en realización con valor esperado en ${d.Y}.`;
    return `<div class="dash-card span-8"><div class="exec">
        <svg class="ring" width="132" height="132" viewBox="0 0 136 136" role="img" aria-label="Cumplimiento ${pc == null ? 'sin dato' : Math.round(pc * 100) + '%'}${st ? ', ' + st[2] : ''}">
          <circle class="trk" cx="68" cy="68" r="${R}" style="stroke:${col};stroke-opacity:.16"/>
          <circle class="val draw" pathLength="1" cx="68" cy="68" r="${R}" style="stroke:${col};stroke-dasharray:${fill} 1;stroke-dashoffset:0"/>
          <text x="68" y="70" text-anchor="middle" style="font-size:26px;font-weight:800;fill:var(--ink)">${pc == null ? '—' : Math.round(pc * 100) + '%'}</text>
          <text x="68" y="88" text-anchor="middle" style="font-size:9.5px;font-weight:700;fill:var(--muted)">cumplimiento</text>
        </svg>
        <div style="min-width:0">
          <div class="lbl">Valor captado en ${d.Y}${st ? ` · <span class="badge ${st[0] === 'good' ? 'good' : st[0] === 'warning' ? 'warn' : 'crit'}" style="vertical-align:1px">${ico(st[0] === 'good' ? 'i-check' : st[0] === 'warning' ? 'i-alerta' : 'i-x')}${esc(st[2])}</span>` : ''}</div>
          <div class="big" data-count="${d.captadoY}">${esc(m(d.captadoY))}</div>
          <p class="frase">${frase}</p>
          <div class="det">Esperado a la fecha: <b>${esc(m(d.esperadoY))}</b> · Proyectado para todo ${d.Y}: <b>${esc(m(d.proyectadoY))}</b> · prorrateado por los meses corridos de los proyectos en realización</div>
        </div></div></div>`;
  }

  /* ---------- 1b · requiere atención ---------- */
  function atencion(d, sg) {
    // Una fila por iniciativa (su alerta más grave) para no repetir nombres
    const filas = sg.filter(z => z.out.length).map(z => { const o = z.out.slice().sort((a, b) => b.sev - a.sev); return { z, o: o[0], mas: o.length - 1 }; })
      .sort((a, b) => b.o.sev - a.o.sev || b.mas - a.mas).slice(0, 6);
    const nAt = sg.filter(z => z.max >= 2).length;
    return `<div class="dash-card span-4"><h3>Requiere atención</h3><div class="sub">${nAt ? `${nAt} de ${sg.length} iniciativas con alertas; primero lo más grave.` : 'Lo que necesita una decisión o seguimiento.'}</div>
      ${filas.length ? `<div class="atn">${filas.map(({ z, o, mas }) => { const [c, i, l] = SEV[o.sev];
        return `<a href="${o.href}" title="${esc(z.out.map(x => '• ' + x.txt).join('\n'))}"><span class="badge ${c}">${ico(i)}${l}</span><span style="min-width:0"><span class="p" style="display:block">${esc(App.projectName(z.x.p))}</span><span class="r">${esc(o.txt)}${mas ? ` · <b>+${mas} más</b>` : ''}</span></span><svg class="go" aria-hidden="true"><use href="#i-flecha"/></svg></a>`; }).join('')}</div>`
        : `<div class="atn-ok">${ico('i-check')}Todo al día: sin alertas con estos filtros.</div>`}</div>`;
  }

  /* ---------- 1c · indicadores ---------- */
  function indicadores(d, sg) {
    const vpn = d.filas.reduce((a, x) => a + (x.vpn || 0), 0);
    const inv = d.filas.reduce((a, x) => a + (x.caso && x.caso.moneda !== 'USD' ? Finanzas.calc(x.caso).totalInversion || 0 : 0), 0);
    const nCasos = d.filas.filter(x => x.caso && x.caso.moneda !== 'USD').length;
    const ices = d.filas.map(x => x.ice).filter(v => v != null);
    const nAt = sg.filter(z => z.max >= 2).length;
    const k = (l, v, s, cls, t) => `<div class="xk ${cls || ''}"${t ? ` title="${esc(t)}"` : ''}><div class="l">${l}</div><div class="v">${v}</div><div class="s">${s}</div></div>`;
    return `<div class="dash-card span-12 xks">
      ${k(`Proyectado ${d.Y}`, esc(m(d.proyectadoY)), `por captar: ${esc(m(Math.max(0, d.proyectadoY - d.captadoY)))}`, '', 'Suma del valor anual de los casos de negocio (o del Income) para el año')}
      ${k('Inversión de los casos', esc(m(inv)), `${nCasos} caso${nCasos === 1 ? '' : 's'} de negocio`, '', 'Suma de las filas de inversión de los casos de negocio en pesos')}
      ${k('VPN del portafolio', esc(m(vpn)), 'valor presente neto sumado', '', 'Suma del VPN de cada caso de negocio, con su tasa de descuento')}
      ${k('ICE promedio', ices.length ? Math.round(ices.reduce((a, b) => a + b, 0) / ices.length) : '—', `${ices.length} de ${d.filas.length} con ICE`, '', 'Impacto × Confianza × Facilidad (cada uno de 1 a 10)')}
      ${k('Iniciativas con alertas', `${nAt}<span style="font-size:14px;color:var(--muted);font-weight:600"> / ${d.filas.length}</span>`, nAt ? 'ver «Requiere atención»' : 'sin alertas', nAt ? 'alerta' : '')}
    </div>`;
  }

  /* ---------- 1d · matriz de decisión ---------- */
  function matriz(d, sg) {
    const conIce = sg.filter(z => z.x.ice != null).map(z => z.x.ice).sort((a, b) => a - b);
    const med = conIce.length ? conIce[Math.floor(conIce.length / 2)] : null;
    const Q = { acelerar: [], replantear: [], sostener: [], revisar: [] };
    sg.forEach(z => {
      const alto = med != null && z.x.ice != null && z.x.ice >= med;
      const q = z.pausado || (z.x.vpn != null && z.x.vpn < 0) ? 'revisar' : alto ? (z.malo ? 'replantear' : 'acelerar') : (z.malo ? 'revisar' : 'sostener');
      Q[q].push(z);
    });
    const val = z => (z.x.proy ? m(z.x.proy) + ` en ${d.Y}` : z.x.vpn != null ? 'VPN ' + m(z.x.vpn) : 'sin valor');
    const caja = (k, ic, t, sub) => `<div class="q ${k}"><h4><span class="qi" aria-hidden="true">${ic}</span><span>${t}<em>${sub}</em></span></h4>${Q[k].length ? Q[k].sort((a, b) => (b.x.proy || 0) - (a.x.proy || 0)).map(z => `<a href="#/proyectos/${z.x.p.id}">${esc(App.projectName(z.x.p))}<span>${esc(val(z))}</span></a>`).join('') : '<div class="vac">Ninguna</div>'}</div>`;
    return `<div class="dash-card span-7"><h3>¿Qué hacer con cada iniciativa?</h3><div class="sub">Sugerencia según potencial (ICE) y salud de ejecución. La decisión es del comité.</div>
      <div class="mtx">
        <div class="ax-y">Potencial (ICE) ↑</div>
        ${caja('replantear', '↻', 'Replantear', 'alto potencial, con alertas')}${caja('acelerar', '↑', 'Acelerar', 'alto potencial, sana')}
        ${caja('revisar', '■', 'Revisar continuidad', 'bajo potencial con alertas, pausada o VPN negativo')}${caja('sostener', '→', 'Sostener', 'bajo potencial, sana')}
        <div></div><div class="ax-x">Salud de ejecución →</div>
      </div>
      <details class="regla"><summary>¿Cómo se calcula?</summary>Potencial alto: ICE igual o mayor a la mediana del portafolio (${med ?? '—'}). Con alertas: captura bajo 90% de lo esperado, actividades atrasadas, ruta crítica en riesgo, fin después de la fecha meta, VPN negativo o compromisos de comité vencidos. Sin ICE cuenta como potencial bajo.</details></div>`;
  }

  /* ---------- 2 · valor por año (apilado por tipo) + captado ---------- */
  function porAnio(d, W) {
    const H = 270, L = 64, R = 12, T = 22, B = 30;
    const present = d.cats.filter(k => d.porAnio.some(a => a.cats[k] > 0));
    const tot = a => present.reduce((s, k) => s + a.cats[k], 0);
    const hi = Math.max(1, ...d.porAnio.map(a => Math.max(tot(a), a.captado)));
    const tk = ticks(hi), top = tk.at(-1);
    const y = v => T + (1 - v / top) * (H - T - B);
    const band = (W - L - R) / d.anios.length, bw = Math.min(24, band * 0.36), cw = Math.min(12, band * 0.18);
    const xs = i => L + band * i + band / 2;
    let bars = '';
    d.porAnio.forEach((a, i) => {
      const x0 = xs(i) - (bw + cw + 3) / 2;
      let acc = 0; const segs = present.filter(k => a.cats[k] > 0);
      segs.forEach((k, j) => {
        const v = a.cats[k], y1 = y(acc + v), y2 = y(acc), h = Math.max(0, y2 - y1 - (j ? 2 : 0));
        const last = j === segs.length - 1, r = Math.min(4, h / 2);
        bars += last
          ? `<path class="grow" style="fill:${cvar(k)};animation-delay:${i * 40}ms" d="M${x0} ${y1 + h}V${y1 + r}Q${x0} ${y1} ${x0 + r} ${y1}H${x0 + bw - r}Q${x0 + bw} ${y1} ${x0 + bw} ${y1 + r}V${y1 + h}Z"/>`
          : `<rect class="grow" style="fill:${cvar(k)};animation-delay:${i * 40}ms" x="${x0}" y="${y1}" width="${bw}" height="${h}"/>`;
        acc += v;
      });
      if (a.captado > 0) { const yc = y(a.captado), h = y(0) - yc, r = Math.min(3, h / 2); bars += `<path class="grow" style="fill:var(--ink);animation-delay:${i * 40 + 120}ms" d="M${x0 + bw + 3} ${y(0)}V${yc + r}Q${x0 + bw + 3} ${yc} ${x0 + bw + 3 + r} ${yc}H${x0 + bw + 3 + cw - r}Q${x0 + bw + 3 + cw} ${yc} ${x0 + bw + 3 + cw} ${yc + r}V${y(0)}Z"/>`; }
      if (a.y === d.Y && tot(a) > 0) bars += `<text class="lbl fade" x="${x0 + bw / 2}" y="${y(tot(a)) - 7}" text-anchor="middle">${esc(mm(tot(a)))}</text>`;
    });
    const sel = d.anios.indexOf(d.Y);
    return `<div class="dash-card span-12"><div class="hd"><div><h3>Valor a captar por año y valor captado</h3><div class="sub">Columnas: lo que proyectan los casos de negocio (o el Income), por tipo de valor. Barra oscura: lo captado. Clic en un año para verlo en detalle.</div></div><span class="sp"></span><button class="tbl-toggle" data-dash="tabla">${F.tabla ? 'Ver gráfica' : 'Ver tabla'}</button></div>
      <div class="lgd">${present.map(k => `<span><i class="sw" style="--c:${cvar(k)}"></i>${esc(App.catLabel(k))}</span>`).join('')}<span><i class="sw" style="--c:var(--ink)"></i>Captado (real)</span></div>
      ${F.tabla ? `<div class="flujo-wrap"><table class="lst"><thead><tr><th>Año</th>${present.map(k => `<th class="n">${esc(App.catLabel(k))}</th>`).join('')}<th class="n">Proyectado</th><th class="n">Captado</th></tr></thead><tbody>${d.porAnio.map(a => `<tr${a.y === d.Y ? ' style="font-weight:700"' : ''}><td>${a.y}</td>${present.map(k => `<td class="n">${esc(mm(a.cats[k]))}</td>`).join('')}<td class="n"><b>${esc(mm(tot(a)))}</b></td><td class="n">${esc(mm(a.captado))}</td></tr>`).join('')}</tbody></table></div>`
      : `<svg class="viz" viewBox="0 0 ${W} ${H}" height="${H}" role="img" aria-label="Valor a captar por año y captado">
        ${sel >= 0 ? `<rect class="band" x="${L + band * sel + 2}" y="${T - 14}" width="${band - 4}" height="${H - T - B + 14}" rx="10"/>` : ''}
        <g class="grid">${tk.map(v => `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/>`).join('')}</g>
        <g class="axis">${tk.map(v => `<text x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${esc(mm(v))}</text>`).join('')}${d.anios.map((yy, i) => `<text x="${xs(i)}" y="${H - 10}" text-anchor="middle" style="${yy === d.Y ? 'fill:var(--ink);font-weight:800' : ''}">${yy}</text>`).join('')}</g>
        <line class="zero" x1="${L}" x2="${W - R}" y1="${y(0)}" y2="${y(0)}"/>
        ${bars}
        ${d.anios.map((yy, i) => `<rect class="hit" data-anio="${yy}" data-i="${i}" x="${L + band * i}" y="${T - 14}" width="${band}" height="${H - T - B + 14}"/>`).join('')}
      </svg>`}</div>`;
  }

  /* ---------- 3 · curva del año: esperado vs captado acumulado ---------- */
  function curva(d, W) {
    const H = 250, L = 64, R = 70, T = 16, B = 30;
    const hi = Math.max(1, ...d.curva.map(c => Math.max(c.esperado, c.captado)));
    const tk = ticks(hi), top = tk.at(-1);
    const x = i => L + (W - L - R) * i / 11, y = v => T + (1 - v / top) * (H - T - B);
    const hasta = d.mesHasta;
    const pts = d.curva.slice(0, Math.max(hasta, 0));
    const capLine = pts.map((c, i) => `${i ? 'L' : 'M'}${x(i)} ${y(c.captado)}`).join('');
    const capArea = pts.length ? `${capLine}L${x(pts.length - 1)} ${y(0)}L${x(0)} ${y(0)}Z` : '';
    const espLine = d.curva.map((c, i) => `${i ? 'L' : 'M'}${x(i)} ${y(c.esperado)}`).join('');
    const hoyX = d.Y === d.hoyY ? x(d.hoyM - 1 + (+d.hoy.slice(8)) / 31) : null;
    const lastC = pts.at(-1);
    return `<div class="dash-card span-7"><h3>Curva de captura ${d.Y}</h3><div class="sub">Acumulado mes a mes de los proyectos en realización: lo esperado según los casos y lo captado.</div>
      <div class="lgd"><span><i class="ln dash" style="--c:var(--viz-muted)"></i>Esperado acumulado</span><span><i class="ln" style="--c:var(--cat-ahorro)"></i>Captado acumulado</span></div>
      <svg class="viz" viewBox="0 0 ${W} ${H}" height="${H}" role="img" aria-label="Curva de captura">
        <g class="grid">${tk.map(v => `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/>`).join('')}</g>
        <g class="axis">${tk.map(v => `<text x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${esc(mm(v))}</text>`).join('')}${App.d.MES3.map((t, i) => `<text x="${x(i)}" y="${H - 10}" text-anchor="middle">${t}</text>`).join('')}</g>
        ${capArea ? `<path class="fade" d="${capArea}" style="fill:var(--cat-ahorro);fill-opacity:.1"/>` : ''}
        <path class="draw" pathLength="1" d="${espLine}" style="fill:none;stroke:var(--viz-muted);stroke-width:2;stroke-dasharray:5 5;stroke-linecap:round"/>
        ${capLine ? `<path class="draw" pathLength="1" d="${capLine}" style="fill:none;stroke:var(--cat-ahorro);stroke-width:2.5;stroke-linejoin:round;stroke-linecap:round"/>` : ''}
        ${hoyX != null ? `<line class="today" x1="${hoyX}" x2="${hoyX}" y1="${T}" y2="${H - B}"/><text class="lbl2" x="${hoyX + 5}" y="${T + 10}">Hoy</text>` : ''}
        ${lastC ? `<circle class="pop" cx="${x(pts.length - 1)}" cy="${y(lastC.captado)}" r="5" style="fill:var(--cat-ahorro);stroke:var(--card);stroke-width:2"/><text class="lbl fade" x="${x(pts.length - 1) + 9}" y="${y(lastC.captado) + 4}">${esc(mm(lastC.captado))}</text>` : ''}
        <text class="lbl2 fade" x="${x(11) + 6}" y="${y(d.curva[11].esperado) + 4}">${esc(mm(d.curva[11].esperado))}</text>
        <line class="xh" x1="0" x2="0" y1="${T}" y2="${H - B}" style="stroke:var(--ink);stroke-opacity:.25;stroke-width:1" visibility="hidden"/>
        ${d.curva.map((c, i) => `<rect class="hit" data-mes="${i}" x="${x(i) - (W - L - R) / 22}" y="${T}" width="${(W - L - R) / 11}" height="${H - T - B}"/>`).join('')}
      </svg></div>`;
  }

  /* ---------- 4 · mezcla por tipo de valor (dona) ---------- */
  function mezcla(d) {
    const a = d.porAnio.find(z => z.y === d.Y) || { cats: {} };
    const items = d.cats.map(k => ({ k, v: a.cats[k] || 0 })).filter(z => z.v > 0);
    const tot = items.reduce((s, z) => s + z.v, 0);
    if (!tot) return `<div class="dash-card span-5"><h3>Mezcla del valor ${d.Y}</h3><div class="dash-empty">No hay valor proyectado para ${d.Y} con estos filtros.</div></div>`;
    const R = 78, r = 52, cx = 96, cy = 96; let ang = -Math.PI / 2;
    const arc = (a0, a1) => { const big = a1 - a0 > Math.PI ? 1 : 0, p = (rr, a) => `${cx + rr * Math.cos(a)} ${cy + rr * Math.sin(a)}`;
      return `M${p(R, a0)}A${R} ${R} 0 ${big} 1 ${p(R, a1)}L${p(r, a1)}A${r} ${r} 0 ${big} 0 ${p(r, a0)}Z`; };
    const segs = items.map((z, i) => { const a0 = ang, a1 = ang + 2 * Math.PI * z.v / tot - (items.length > 1 ? 0.0001 : 0.0001); ang = a1;
      return `<path class="pop seg" data-k="${z.k}" style="fill:${cvar(z.k)};stroke:var(--card);stroke-width:2;animation-delay:${i * 70}ms" d="${arc(a0, Math.min(a1, a0 + 2 * Math.PI - 0.0001))}"/>`; }).join('');
    return `<div class="dash-card span-5"><h3>Mezcla del valor ${d.Y}</h3><div class="sub">Qué tipo de valor trae el portafolio este año.</div>
      <div style="display:flex;gap:18px;align-items:center;flex-wrap:wrap">
        <svg width="192" height="192" viewBox="0 0 192 192" role="img" aria-label="Mezcla del valor por tipo">${segs}
          <text x="96" y="92" text-anchor="middle" style="font-size:20px;font-weight:800;fill:var(--ink)">${esc(m(tot))}</text>
          <text x="96" y="112" text-anchor="middle" style="font-size:11px;font-weight:700;fill:var(--muted)">proyectado ${d.Y}</text></svg>
        <div style="flex:1;min-width:160px;display:flex;flex-direction:column;gap:8px">${items.sort((p, q) => q.v - p.v).map(z => `<div style="display:flex;align-items:center;gap:8px;font-size:12.5px"><span class="cat-dot cat-${z.k}" style="margin:0"></span><span style="flex:1">${esc(App.catLabel(z.k))}</span><b style="font-variant-numeric:tabular-nums">${esc(m(z.v))}</b><span class="faint" style="width:42px;text-align:right;font-variant-numeric:tabular-nums">${Math.round(z.v / tot * 100)}%</span></div>`).join('')}</div>
      </div></div>`;
  }

  /* ---------- 5 · cumplimiento por proyecto ---------- */
  function cumplimiento(d) {
    const rows = d.filas.filter(x => x.esp > 0).sort((a, b) => (a.pc ?? 9) - (b.pc ?? 9));
    if (!rows.length) return `<div class="dash-card"><h3>Cumplimiento por proyecto</h3><div class="dash-empty">${d.Y > d.hoyY ? `${d.Y} aún no empieza.` : 'Ningún proyecto en realización tiene valor esperado a la fecha con estos filtros.'}</div></div>`;
    const max = Math.max(...rows.map(x => Math.max(x.esp, x.cap)));
    return `<div class="dash-card"><h3>Cumplimiento por proyecto · ${d.Y}</h3><div class="sub">Barra: captado. Raya: esperado a la fecha. Primero los más rezagados.</div>
      <div class="bul">${rows.map((x, i) => { const st = estadoDe(x.pc);
        return `<a class="nm" href="#/proyectos/${x.p.id}/caso" title="${esc(App.projectName(x.p))}">${esc(App.projectName(x.p))}</a>
          <div class="trk" data-bul="${x.p.id}"><div class="bg" style="width:100%"></div><div class="fg growx" style="width:${x.cap / max * 100}%;background:var(--st-${st[0]});animation-delay:${i * 60}ms"></div><div class="tk" style="left:calc(${x.esp / max * 100}% - 1px)"></div></div>
          <div class="pc"><span class="st-ico ${st[0]}" title="${esc(st[2])}">${st[1]}</span>${Math.round(x.pc * 100)}%</div>`; }).join('')}</div></div>`;
  }

  /* ---------- 6 · ICE vs valor ---------- */
  function iceValor(d, W) { // ocupa todo el ancho
    const pts = d.filas.filter(x => x.ice != null);
    const sin = d.filas.length - pts.length;
    if (!pts.length) return `<div class="dash-card span-12"><h3>Prioridad: ICE vs valor</h3><div class="dash-empty">Ningún proyecto tiene ICE todavía. Llena Impacto, Confianza y Facilidad (1 a 10) en la tabla de Proyectos.</div></div>`;
    const H = 280, L = 64, R = 18, T = 18, B = 40;
    const xmax = Math.max(100, ...pts.map(x => x.ice)) * 1.1, ymaxRaw = Math.max(1, ...pts.map(x => x.proy)), tk = ticks(ymaxRaw), ymax = tk.at(-1);
    const X = v => L + v / xmax * (W - L - R), Y = v => T + (1 - v / ymax) * (H - T - B);
    const med = a => { const s = a.slice().sort((p, q) => p - q); return s[Math.floor(s.length / 2)]; };
    const mx = med(pts.map(x => x.ice)), my = med(pts.map(x => x.proy));
    const top = pts.filter(x => x.proy > ymax * 0.05).sort((a, b) => b.proy - a.proy).slice(0, 3).map(x => x.p.id);
    // etiquetas que no se encimen: si dos quedan muy cerca, la segunda baja una línea
    const puestas = [];
    const etiqueta = x => {
      const nm = App.projectName(x.p), t = nm.length > 24 ? nm.slice(0, 23) + '…' : nm, right = X(x.ice) < W * 0.6;
      const w = t.length * 6.2, x0 = right ? X(x.ice) + 10 : X(x.ice) - 10 - w;
      let yy = Y(x.proy) + 4;
      for (let k = 0; k < 6 && puestas.some(q => Math.abs(q.y - yy) < 14 && x0 < q.x1 && x0 + w > q.x0); k++) yy += 14;
      puestas.push({ x0, x1: x0 + w, y: yy });
      return `<text class="lbl2 fade" x="${right ? X(x.ice) + 10 : X(x.ice) - 10}" y="${yy}" text-anchor="${right ? 'start' : 'end'}">${esc(t)}</text>`;
    };
    const xt = ticks(xmax / 1.1, 4);
    return `<div class="dash-card span-12"><h3>Prioridad: ICE vs valor ${d.Y}</h3><div class="sub">Arriba a la derecha: alto valor y alto ICE, los que conviene priorizar. Las líneas marcan la mediana del portafolio; se nombran los 3 de más valor.${sin ? ` ${sin} sin ICE no aparecen.` : ''}</div>
      <div class="lgd"><span><i class="dt" style="--c:var(--cat-ahorro)"></i>En realización</span><span><i class="dt" style="--c:var(--viz-muted)"></i>Otros</span></div>
      <svg class="viz" viewBox="0 0 ${W} ${H}" height="${H}" role="img" aria-label="ICE contra valor">
        <g class="grid">${tk.map(v => `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}"/>`).join('')}</g>
        <g class="axis">${tk.map(v => `<text x="${L - 8}" y="${Y(v) + 4}" text-anchor="end">${esc(mm(v))}</text>`).join('')}${xt.map(v => `<text x="${X(v)}" y="${H - 22}" text-anchor="middle">${v}</text>`).join('')}<text x="${(L + W - R) / 2}" y="${H - 5}" text-anchor="middle" style="font-weight:700">ICE (impacto × confianza × facilidad)</text></g>
        <line x1="${X(mx)}" x2="${X(mx)}" y1="${T}" y2="${H - B}" style="stroke:var(--line-2);stroke-width:1"/><line x1="${L}" x2="${W - R}" y1="${Y(my)}" y2="${Y(my)}" style="stroke:var(--line-2);stroke-width:1"/>
        ${pts.map((x, i) => `<circle class="pop" style="fill:${x.real ? 'var(--cat-ahorro)' : 'var(--viz-muted)'};stroke:var(--card);stroke-width:2;animation-delay:${i * 50}ms" cx="${X(x.ice)}" cy="${Y(x.proy)}" r="${top.includes(x.p.id) ? 7 : 5.5}"/>`).join('')}
        ${pts.filter(x => top.includes(x.p.id)).sort((a, b) => b.proy - a.proy).map(etiqueta).join('')}
        ${pts.map(x => `<circle class="hit" data-ice="${x.p.id}" cx="${X(x.ice)}" cy="${Y(x.proy)}" r="14"/>`).join('')}
      </svg></div>`;
  }

  /* ---------- 7 · estado del portafolio ---------- */
  function estado(d) {
    const ec = App.estadoCol();
    const opts = ec ? (ec.options || []) : [];
    const pausa = n => /paus|cancel|suspend|descart/i.test(n);
    const activos = opts.filter(o => !pausa(o.name));
    const color = o => (pausa(o.name) ? 'var(--ord-paus)' : `var(--ord-${Math.min(5, 1 + Math.round(activos.indexOf(o) * 4 / Math.max(1, activos.length - 1)))})`);
    const cuenta = opts.map(o => ({ o, n: d.filas.filter(x => x.estado === o.name).length })).filter(z => z.n);
    const sinE = d.filas.filter(x => !x.estado).length;
    const total = d.filas.length || 1;
    const hoy = App.d.today();
    const atras = d.filas.filter(x => App.planOf(x.p.id).atrasadas > 0).length, sinCron = d.filas.filter(x => !App.planOf(x.p.id).acts.length).length;
    const casosE = ['Aprobado', 'En revisión', 'Borrador'].map(e => ({ e, n: d.filas.filter(x => x.caso && (x.caso.estado || 'Borrador') === e).length }));
    let acc = 0;
    return `<div class="dash-card"><h3>Estado del portafolio</h3><div class="sub">${d.filas.length} proyectos en la vista, por etapa.</div>
      <svg class="viz" viewBox="0 0 1000 46" preserveAspectRatio="none" height="46" role="img" aria-label="Proyectos por estado">${cuenta.map((z, i) => { const w = z.n / total * 1000, x0 = acc; acc += w;
        return `<rect class="growx" data-est="${esc(z.o.name)}" x="${x0 + (i ? 1 : 0)}" y="4" width="${Math.max(0, w - (i ? 2 : 0))}" height="38" rx="6" style="fill:${color(z.o)};animation-delay:${i * 60}ms"/>`; }).join('')}${sinE ? `<rect x="${acc + 1}" y="4" width="${sinE / total * 1000 - 1}" height="38" rx="6" style="fill:var(--sunk)"/>` : ''}</svg>
      <div class="lgd" style="margin-top:8px">${cuenta.map(z => `<span><i class="sw" style="--c:${color(z.o)}"></i>${esc(z.o.name)} <b style="color:var(--ink)">${z.n}</b></span>`).join('')}${sinE ? `<span><i class="sw" style="--c:var(--sunk)"></i>Sin estado <b style="color:var(--ink)">${sinE}</b></span>` : ''}</div>
      <div class="chips2">
        <div class="chip2"><span class="st-ico ${atras ? 'critical' : 'good'}">${atras ? '✕' : '✓'}</span><b>${atras}</b> con actividades atrasadas</div>
        <div class="chip2"><b>${d.filas.length - atras - sinCron}</b> con cronograma al día</div>
        <div class="chip2"><b>${sinCron}</b> sin cronograma</div>
        ${casosE.map(c => `<div class="chip2"><span class="pill cl-${App.Caso.estadoColor(c.e)}">${c.e}</span><b>${c.n}</b> casos</div>`).join('')}
      </div></div>`;
  }

  /* ---------- 8 · tabla de proyectos ---------- */
  function tabla(d) {
    const ec = App.estadoCol();
    const cols = [['nombre', 'Proyecto'], ['estado', 'Estado'], ['tipo', 'Tipo de valor'], ['ice', 'ICE'], ['proy', `Proyectado ${d.Y}`], ['cap', `Captado ${d.Y}`], ['cumpl', 'Cumplimiento'], ['vpn', 'VPN']];
    const key = { nombre: x => App.projectName(x.p).toLowerCase(), estado: x => x.estado, tipo: x => x.catPrincipal || 'zz', ice: x => -(x.ice ?? -1), proy: x => -x.proy, cap: x => -x.cap, cumpl: x => x.pc ?? 9, vpn: x => -(x.vpn ?? -1e18) }[F.orden] || (x => 0);
    const rows = d.filas.slice().sort((a, b) => { const p = key(a), q = key(b); return p < q ? -1 : p > q ? 1 : 0; });
    return `<div class="dash-card span-12"><h3>Proyectos</h3><div class="sub">Clic en un encabezado para ordenar; clic en un proyecto para abrirlo.${d.usd ? ` ${d.usd} casos en USD no se suman.` : ''} Los proyectos sin caso usan el Income (en ${d.unidad === 1e6 ? 'millones' : d.unidad === 1e3 ? 'miles' : 'pesos'}) como valor anual.</div>
      <div class="flujo-wrap"><table class="lst dash-tbl"><thead><tr>${cols.map(([k, l]) => `<th data-orden="${k}" class="${['ice', 'proy', 'cap', 'cumpl', 'vpn'].includes(k) ? 'n' : ''} ${F.orden === k ? 'on' : ''}">${l}${F.orden === k ? ' ▾' : ''}</th>`).join('')}</tr></thead><tbody>
        ${rows.map(x => { const st = estadoDe(x.pc);
          return `<tr class="clic" data-pid="${x.p.id}"><td><b>${esc(App.projectName(x.p))}</b>${x.fuente === 'income' ? ' <span class="tag">por Income</span>' : !x.fuente ? ' <span class="tag">sin valor</span>' : ''}</td>
            <td>${x.estado && ec ? `<span class="pill cl-${App.optColor(ec, x.estado)}">${esc(x.estado)}</span>` : ''}</td>
            <td>${x.catPrincipal ? `<span class="cat-dot cat-${x.catPrincipal}"></span>${esc(App.catLabel(x.catPrincipal))}` : '<span class="faint">—</span>'}</td>
            <td class="n">${x.ice ?? '<span class="faint">—</span>'}</td><td class="n">${esc(mm(x.proy))}</td><td class="n">${esc(mm(x.cap))}</td>
            <td class="n">${st ? `<span style="display:inline-flex;align-items:center;gap:6px"><span class="st-ico ${st[0]}">${st[1]}</span>${Math.round(x.pc * 100)}%</span>` : '<span class="faint">—</span>'}</td>
            <td class="n">${x.vpn == null ? '<span class="faint">—</span>' : esc(m(x.vpn))}</td></tr>`; }).join('')}
      </tbody></table></div></div>`;
  }

  /* ---------- sección ---------- */
  function render(main) {
    const d = datos();
    const ec = App.estadoCol();
    const key = JSON.stringify([F.anio, F.estado, F.tipo, F.alcance, F.tabla]);
    const anim = key !== lastKey; lastKey = key;
    const nF = (F.estado ? 1 : 0) + (F.tipo ? 1 : 0);
    main.innerHTML = `<div class="dash-head"><button class="burger" data-act="burger" aria-label="Menú">☰</button><div><div class="eyebrow">Portafolio de Generación de Valor</div><h1>Tablero ejecutivo</h1><div class="sub">Datos al ${esc(App.d.fmt(d.hoy))} · ${d.filas.length} iniciativa${d.filas.length === 1 ? '' : 's'} en la vista · cifras en pesos colombianos</div></div><span class="sp"></span>
      <div class="dash-f" role="group" aria-label="Filtros del tablero">
        <select data-f="anio" aria-label="Año">${d.anios.map(y => `<option ${y === d.Y ? 'selected' : ''}>${y}</option>`).join('')}</select>
        <div class="seg"><button data-f-alc="todos" class="${F.alcance !== 'real' ? 'on' : ''}" aria-pressed="${F.alcance !== 'real'}">Todas</button><button data-f-alc="real" class="${F.alcance === 'real' ? 'on' : ''}" aria-pressed="${F.alcance === 'real'}">En realización</button></div>
        <button class="btn ghost" data-f-mas aria-haspopup="true"><svg aria-hidden="true"><use href="#i-filtro"/></svg>Filtros${nF ? ` <span class="n">${nF}</span>` : ''}</button>
        ${App.canEdit() ? '<button class="btn ghost" data-f-aj title="Ajustes del tablero" aria-label="Ajustes del tablero"><svg aria-hidden="true"><use href="#i-ajustes"/></svg></button>' : ''}
      </div></div>
      ${nF ? `<div class="f-act">${F.estado ? `<button data-quitar="estado" title="Quitar filtro">Estado: ${esc(F.estado)} <span>✕</span></button>` : ''}${F.tipo ? `<button data-quitar="tipo" title="Quitar filtro">Tipo de valor: ${esc(App.catLabel(F.tipo))} <span>✕</span></button>` : ''}</div>` : ''}
      <div class="dash-grid ${anim ? 'anim' : ''}" id="dashGrid"></div>`;
    const grid = $('#dashGrid', main);
    const draw = () => {
      const W = Math.max(320, (grid.clientWidth || 1000) - 36);
      const W7 = Math.max(320, (grid.clientWidth >= 1100 ? grid.clientWidth * 7 / 12 - 14 : grid.clientWidth) - 36);
      const W6 = Math.max(320, (grid.clientWidth >= 1100 ? grid.clientWidth / 2 - 7 : grid.clientWidth) - 36);
      const sg = senales(d);
      grid.innerHTML = hero(d, sg) + atencion(d, sg) + indicadores(d, sg) + porAnio(d, W) + matriz(d, sg) + `<div class="span-5 dash-col">${cumplimiento(d)}${estado(d)}</div>` + curva(d, W7) + mezcla(d) + iceValor(d, W) + tabla(d);
      // la cifra principal cuenta hasta su valor
      const big = $('.big[data-count]', grid);
      if (big && grid.classList.contains('anim') && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
        const target = +big.dataset.count, t0 = performance.now();
        const step = t => { const k = Math.min(1, (t - t0) / 900), e = 1 - Math.pow(1 - k, 3); big.textContent = m(target * e); if (k < 1) requestAnimationFrame(step); };
        requestAnimationFrame(step);
      }
    };
    draw();
    // interacción
    main.onclick = e => {
      if (e.target.closest('.burger')) return App.toggleSide();
      const a = e.target.closest('[data-f-alc]'); if (a) { F.alcance = a.dataset.fAlc; saveF(); return App.render(); }
      const q = e.target.closest('[data-quitar]'); if (q) { F[q.dataset.quitar] = ''; saveF(); return App.render(); }
      const fm = e.target.closest('[data-f-mas]');
      if (fm) {
        const p = App.openPop(fm, `<div class="lbl">Filtrar el tablero</div>
          ${ec ? `<label class="mi" style="display:block;cursor:default">Estado<select class="fld" data-pf="estado" style="margin-top:4px"><option value="">Todos</option>${(ec.options || []).map(o => `<option ${F.estado === o.name ? 'selected' : ''}>${esc(o.name)}</option>`).join('')}</select></label>` : ''}
          <label class="mi" style="display:block;cursor:default">Tipo de valor<select class="fld" data-pf="tipo" style="margin-top:4px"><option value="">Todos</option>${App.CATS.map(c => `<option value="${c.id}" ${F.tipo === c.id ? 'selected' : ''}>${esc(c.label)}</option>`).join('')}</select></label>
          ${nF ? '<div class="sep"></div><button class="mi" data-limpiar="1">Quitar todos los filtros</button>' : ''}`, { width: 260, nofocus: true });
        p.onchange = ev => { const t = ev.target; if (!t.dataset.pf) return; F[t.dataset.pf] = t.value; saveF(); App.closePop(true); App.render(); };
        p.onclick = ev => { if (ev.target.closest('[data-limpiar]')) { F.estado = ''; F.tipo = ''; saveF(); App.closePop(true); App.render(); } };
        return;
      }
      const aj = e.target.closest('[data-f-aj]');
      if (aj) {
        const p = App.openPop(aj, `<div class="lbl">Ajustes del tablero</div><label class="mi" style="display:block;cursor:default">La columna Income de Proyectos está en<select class="fld" data-unidad style="margin-top:4px">${[[1e6, 'millones'], [1e3, 'miles'], [1, 'pesos']].map(([v, l]) => `<option value="${v}" ${d.unidad === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label><div class="hint" style="padding:0 10px 8px">Se usa como valor anual de los proyectos que aún no tienen caso de negocio.</div>`, { width: 280, nofocus: true });
        p.onchange = ev => { if (!ev.target.hasAttribute('data-unidad')) return; const v = Number(ev.target.value); App.closePop(true); App.guard(async () => { App.S.tablero = await App.api('PUT', '/api/config/tablero', { income_unidad: v }); App.render(); }); };
        return;
      }
      if (e.target.closest('[data-dash=tabla]')) { F.tabla = !F.tabla; saveF(); return App.render(); }
      const yr = e.target.closest('[data-anio]'); if (yr) { F.anio = +yr.dataset.anio; saveF(); hideTip(); return App.render(); }
      const o = e.target.closest('[data-orden]'); if (o) { F.orden = o.dataset.orden; saveF(); lastKey = key; return App.render(); }
      const ice = e.target.closest('[data-ice]'); if (ice) { hideTip(); return App.go('#/proyectos/' + ice.dataset.ice); }
      const tr = e.target.closest('tr[data-pid]'); if (tr) return App.go('#/proyectos/' + tr.dataset.pid);
    };
    main.onchange = e => {
      const t = e.target, f = t.dataset.f; if (!f) return;
      if (f === 'unidad') return App.guard(async () => { App.S.tablero = await App.api('PUT', '/api/config/tablero', { income_unidad: Number(t.value) }); App.render(); });
      F[f] = f === 'anio' ? Number(t.value) : t.value; saveF(); App.render();
    };
    main.onmousemove = e => {
      const h = e.target.closest('[data-anio],[data-mes],[data-ice],[data-bul],.seg[data-k]');
      const xh = $('.xh', main);
      if (!h) { hideTip(); if (xh) xh.setAttribute('visibility', 'hidden'); return; }
      if (h.dataset.anio) {
        const a = d.porAnio[+h.dataset.i]; const tot = d.cats.reduce((s, k) => s + a.cats[k], 0);
        showTip(e, `<div class="t">${a.y}${a.y === d.Y ? ' · seleccionado' : ''}</div>${d.cats.filter(k => a.cats[k] > 0).map(k => row(cvar(k), App.catLabel(k), m(a.cats[k]))).join('')}<div class="sep">${row('', 'Proyectado', m(tot), true)}${row('var(--ink)', 'Captado', m(a.captado), true)}${tot ? row('', 'Captado / proyectado', App.pct(a.captado / tot)) : ''}</div>`);
      } else if (h.dataset.mes != null) {
        const i = +h.dataset.mes, c = d.curva[i];
        if (xh) { xh.setAttribute('x1', +h.getAttribute('x') + +h.getAttribute('width') / 2); xh.setAttribute('x2', +h.getAttribute('x') + +h.getAttribute('width') / 2); xh.setAttribute('visibility', 'visible'); }
        const vis = i < d.mesHasta;
        showTip(e, `<div class="t">${App.d.MESES[i].replace(/^./, s => s.toUpperCase())} ${d.Y}</div>${row('var(--viz-muted)', 'Esperado acumulado', m(c.esperado))}${row('var(--cat-ahorro)', 'Captado acumulado', vis ? m(c.captado) : '—', true)}${vis ? `<div class="sep">${row('', 'Brecha', m(c.captado - c.esperado), true)}</div>` : ''}`);
      } else if (h.dataset.ice) {
        const x = d.filas.find(z => z.p.id === h.dataset.ice);
        showTip(e, `<div class="t">${esc(App.projectName(x.p))}</div>${row('', 'ICE', String(x.ice), true)}${row('', `Valor proyectado ${d.Y}`, m(x.proy), true)}${row('', 'Estado', x.estado || '—')}${row('', 'En realización', x.real ? 'Sí' : 'No')}`);
      } else if (h.dataset.bul) {
        const x = d.filas.find(z => z.p.id === h.dataset.bul), st = estadoDe(x.pc);
        showTip(e, `<div class="t">${esc(App.projectName(x.p))}</div>${row(`var(--st-${st[0]})`, 'Captado', m(x.cap), true)}${row('var(--ink)', 'Esperado a la fecha', m(x.esp))}${row('', `Proyectado ${d.Y}`, m(x.proy))}<div class="sep">${row('', st[2], App.pct(x.pc), true)}</div>`);
      }
    };
    main.onmouseleave = hideTip;
    // redibujar al cambiar el tamaño de la ventana
    clearTimeout(render._rz);
    window.onresize = () => { clearTimeout(render._rz); render._rz = setTimeout(() => { if (location.hash.startsWith('#/tablero')) { grid.classList.remove('anim'); draw(); } }, 200); };
  }

  App.views.tablero = { render };
})();
