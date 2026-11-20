/* ============================================================
   GRÁFICO DEL FLUJO AÑO A AÑO (caso de negocio)
   Barras = flujo neto de cada año (azul positivo, rojo negativo, sobre el cero)
   Línea  = acumulado. Una sola escala: las dos cosas están en la misma moneda.
   Al pasar el mouse por un año: inversión, costos, beneficios, neto y acumulado.
   La tabla de la hoja es su vista en tabla.
   ============================================================ */
'use strict';
(function () {
  const { esc } = App;

  function ticks(lo, hi, n) {
    const span = hi - lo || Math.abs(hi) || 1;
    const raw = span / n, mag = Math.pow(10, Math.floor(Math.log10(raw))), r = raw / mag;
    const step = (r <= 1 ? 1 : r <= 2 ? 2 : r <= 2.5 ? 2.5 : r <= 5 ? 5 : 10) * mag;
    const out = []; for (let v = Math.floor(lo / step) * step; v <= hi + step * 1e-9; v += step) out.push(Math.round(v / step) * step);
    return out;
  }
  const short = (v, mon) => (v === 0 ? '0' : App.moneyShort(v, mon).replace(/^\$|^US\$/, mon === 'USD' ? 'US$' : '$'));

  // Colores (los del Tablero para los ingresos; validados para daltonismo): nuevo negocio, eficiencia, sin clasificar, gastos, inversión
  const COL = { nuevo: '#F08A5D', efi: '#5B9BEA', otro: '#B9B3C7', gasto: '#5A4E78', inv: '#C99A00' };
  function chart(el, caso, mon) {
    if (!el) return;
    const f = Finanzas.calc(caso);
    if (!f.netos.some(v => v !== 0)) { el.innerHTML = '<p class="faint">Aún no hay cifras en el flujo.</p>'; return; }
    const n = f.netos.length, W = Math.max(360, el.clientWidth || 640), L = 74, R = 18;
    const band = (W - L - R) / n, x = t => L + band * t + band / 2;
    const anio = t => (caso.anio_inicio ? `${caso.anio_inicio + t}` : `Año ${t + 1}`);
    // ingresos de cada año por grupo (nuevo negocio, eficiencia, sin clasificar)
    const G = { nuevo: Array(n).fill(0), efi: Array(n).fill(0), otro: Array(n).fill(0) };
    (caso.flujos || []).filter(r => r.tipo === 'beneficio').forEach(r => { const g = App.grupoDe ? App.grupoDe(App.catOf(r)) : 'otro'; for (let t = 0; t < n; t++) G[g][t] += Number((r.valores || [])[t]) || 0; });
    const hayG = k => G[k].some(v => v), gruposV = ['nuevo', 'efi', 'otro'].filter(hayG);
    // 1) Ingresos y salidas de cada año: dos barras por año, apiladas, con 2 px de aire entre partes
    const H1 = 220, T1 = 14, B1 = 30, max1 = Math.max(1, ...f.beneficios, ...f.costos.map((v, t) => v + f.inversion[t]));
    const tk1 = ticks(0, max1, 4), hi1 = Math.max(tk1.at(-1), max1), y1 = v => T1 + (1 - v / hi1) * (H1 - T1 - B1), base = y1(0);
    const bw = Math.max(6, Math.min(26, band * 0.3)), gap = Math.max(2, Math.min(4, band * 0.04));
    const pila = (cx, partes) => { let acc = 0; const out = []; partes.filter(p => p.v > 0).forEach((p, i, arr) => {
      const yb = y1(acc) - (i ? 2 : 0), yt = y1(acc + p.v); acc += p.v; if (yb - yt < 0.6) return; const tope = i === arr.length - 1, r = tope ? Math.min(4, (yb - yt) / 2, bw / 2) : 0;
      out.push(`<path fill="${p.c}" d="M${cx - bw / 2} ${yb}V${yt + r}${r ? `Q${cx - bw / 2} ${yt} ${cx - bw / 2 + r} ${yt}H${cx + bw / 2 - r}Q${cx + bw / 2} ${yt} ${cx + bw / 2} ${yt + r}` : `H${cx + bw / 2}`}V${yb}Z"/>`); }); return out.join(''); };
    const barras = f.netos.map((_, t) => pila(x(t) - bw / 2 - gap / 2, gruposV.map(k => ({ v: G[k][t], c: COL[k] })).concat(gruposV.length ? [] : [{ v: f.beneficios[t], c: COL.nuevo }]))
      + pila(x(t) + bw / 2 + gap / 2, [{ v: f.costos[t], c: COL.gasto }, { v: f.inversion[t], c: COL.inv }])).join('');
    // 2) Flujo de caja acumulado: línea con el área hasta el cero (lo que está bajo cero, en rojo suave) y el año en que se recupera la inversión
    const H2 = 190, T2 = 22, B2 = 30, a = f.acumulado, lo2 = Math.min(0, ...a), hi2 = Math.max(0, ...a);
    const tk2 = ticks(lo2, hi2, 4), lo = Math.min(tk2[0], lo2), hi = Math.max(tk2.at(-1), hi2), y2 = v => T2 + (hi - v) / (hi - lo || 1) * (H2 - T2 - B2), z = y2(0);
    const lin = a.map((v, t) => `${t ? 'L' : 'M'}${x(t)} ${y2(v)}`).join(''), area = `${lin}L${x(n - 1)} ${z}L${x(0)} ${z}Z`;
    const pb = f.payback, ult = a[n - 1];
    const ejeY = (tk, y) => tk.map(v => `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${esc(short(v, mon))}</text>`).join('');
    const ejeX = (H, B) => f.netos.map((_, t) => (n <= 12 || t % 2 === 0 ? `<text x="${x(t)}" y="${H - 10}" text-anchor="middle">${esc(anio(t))}</text>` : '')).join('');
    const hit = (H, T, B) => f.netos.map((_, t) => `<rect class="cf-hit" data-t="${t}" x="${L + band * t}" y="${T}" width="${band}" height="${H - T - B}"/>`).join('');
    const leg = (c, t) => `<span><i style="background:${c}"></i>${t}</span>`;
    const NOM = { nuevo: 'Ingresos de nuevo negocio', efi: 'Ahorros por eficiencia', otro: 'Ingresos sin clasificar' };
    el.innerHTML = `<div class="cf2">
      <div class="cf2-h"><b>Ingresos y salidas de cada año</b><span class="cf2-leg">${(gruposV.length ? gruposV : ['nuevo']).map(k => leg(COL[k], gruposV.length ? NOM[k] : 'Ingresos y ahorros')).join('')}${leg(COL.gasto, 'Gastos')}${f.inversion.some(v => v) ? leg(COL.inv, 'Inversión') : ''}</span></div>
      <div class="cf-box"><svg viewBox="0 0 ${W} ${H1}" width="100%" height="${H1}" role="img" aria-label="Ingresos y salidas de cada año del caso">
        <g class="cf-grid">${ejeY(tk1, y1)}</g><line class="cf-zero" x1="${L}" x2="${W - R}" y1="${base}" y2="${base}"/>${barras}<g class="cf-x">${ejeX(H1, B1)}</g><g>${hit(H1, T1, B1)}</g></svg></div>
      <div class="cf2-h"><b>Flujo de caja acumulado</b><span class="cf2-s">${pb != null && pb > 0 ? `la inversión se recupera en <b>${esc(App.num(pb, 1))} años</b>` : ult >= 0 ? 'positivo desde el primer año' : 'aún no recupera la inversión en el horizonte del caso'}</span></div>
      <div class="cf-box"><svg viewBox="0 0 ${W} ${H2}" width="100%" height="${H2}" role="img" aria-label="Flujo de caja acumulado del caso">
        <defs><clipPath id="cfPos"><rect x="0" y="0" width="${W}" height="${z}"/></clipPath><clipPath id="cfNeg"><rect x="0" y="${z}" width="${W}" height="${H2}"/></clipPath></defs>
        <g class="cf-grid">${ejeY(tk2, y2)}</g>
        <path d="${area}" class="cf2-area" clip-path="url(#cfPos)"/><path d="${area}" class="cf2-area neg" clip-path="url(#cfNeg)"/>
        <line class="cf-zero" x1="${L}" x2="${W - R}" y1="${z}" y2="${z}"/>
        ${pb != null && pb > 0 && pb < n ? `<g class="cf-pb"><line x1="${x(0) + pb * band}" x2="${x(0) + pb * band}" y1="${T2 - 8}" y2="${H2 - B2}"/><text x="${x(0) + pb * band + 6}" y="${T2 - 10}">recupera la inversión</text></g>` : ''}
        <path class="cf2-line" d="${lin}"/>
        <circle class="cf2-fin" cx="${x(n - 1)}" cy="${y2(ult)}" r="4.5"/><text class="cf2-val" x="${x(n - 1) - 8}" y="${y2(ult) - 10}" text-anchor="end">${esc(short(ult, mon))}</text>
        <g class="cf-x">${ejeX(H2, B2)}</g><g>${hit(H2, T2, B2)}</g></svg><div class="cf-tip" hidden></div></div></div>`;
    const tip = el.querySelector('.cf-tip'), cont = el.querySelector('.cf2');
    cont.onmousemove = e => {
      const h = e.target.closest('.cf-hit'); if (!h) { tip.hidden = true; cont.querySelectorAll('.cf-hit.on').forEach(r => r.classList.remove('on')); return; }
      const t = +h.dataset.t, m = v => esc(App.money(v, mon));
      tip.innerHTML = `<b>${esc(caso.anio_inicio ? `${caso.anio_inicio + t}, año ${t + 1}` : `Año ${t + 1}`)}</b>
        ${gruposV.length >= 1 ? gruposV.map(k => `<div><span><i style="background:${COL[k]}"></i>${NOM[k]}</span>${m(G[k][t])}</div>`).join('') : `<div><span><i style="background:${COL.nuevo}"></i>Ingresos y ahorros</span>${m(f.beneficios[t])}</div>`}
        <div><span><i style="background:${COL.gasto}"></i>Gastos</span>${m(f.costos[t])}</div>${f.inversion[t] ? `<div><span><i style="background:${COL.inv}"></i>Inversión</span>${m(f.inversion[t])}</div>` : ''}
        <div class="sep"><span>Flujo del año</span><b>${m(f.netos[t])}</b></div><div><span>Acumulado</span><b>${m(f.acumulado[t])}</b></div>`;
      tip.hidden = false;
      const br = tip.parentElement.getBoundingClientRect(), tw = tip.offsetWidth;
      let lx = e.clientX - br.left + 14; if (lx + tw > br.width) lx = e.clientX - br.left - tw - 14;
      tip.style.left = Math.max(0, lx) + 'px'; tip.style.top = (e.clientY - br.top - 30) + 'px';
      cont.querySelectorAll('.cf-hit').forEach(r => r.classList.toggle('on', +r.dataset.t === t));
    };
    cont.onmouseleave = () => { tip.hidden = true; cont.querySelectorAll('.cf-hit.on').forEach(r => r.classList.remove('on')); };
  }

  App.Caso.chart = chart;
})();
