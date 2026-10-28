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

  function chart(el, caso, mon) {
    if (!el) return;
    const f = Finanzas.calc(caso);
    if (!f.netos.some(v => v !== 0)) { el.innerHTML = ''; return; }
    const W = Math.max(320, el.clientWidth || 640), H = 230, L = 70, R = 16, T = 16, B = 34;
    const n = f.netos.length, band = (W - L - R) / n, bw = Math.min(44, band * 0.56);
    const all = [...f.netos, ...f.acumulado, 0];
    const tk = ticks(Math.min(...all), Math.max(...all), 4);
    const lo = Math.min(tk[0], ...all), hi = Math.max(tk.at(-1), ...all);
    const y = v => T + (hi - v) / (hi - lo || 1) * (H - T - B);
    const x = t => L + band * t + band / 2;
    const y0 = y(0), rad = 4;
    // barra con la punta redondeada (lejos del cero) y la base recta sobre el cero
    const bar = (t, v) => {
      const x0 = x(t) - bw / 2, x1 = x(t) + bw / 2, yv = y(v), r = Math.min(rad, Math.abs(yv - y0) / 2, bw / 2);
      if (Math.abs(yv - y0) < 0.5) return '';
      return v > 0
        ? `M${x0} ${y0}V${yv + r}Q${x0} ${yv} ${x0 + r} ${yv}H${x1 - r}Q${x1} ${yv} ${x1} ${yv + r}V${y0}Z`
        : `M${x0} ${y0}V${yv - r}Q${x0} ${yv} ${x0 + r} ${yv}H${x1 - r}Q${x1} ${yv} ${x1} ${yv - r}V${y0}Z`;
    };
    const anio = t => (caso.anio_inicio ? `${caso.anio_inicio + t}` : `Año ${t}`);
    const pb = f.payback;
    const linea = f.acumulado.map((v, t) => `${t ? 'L' : 'M'}${x(t)} ${y(v)}`).join('');
    el.innerHTML = `<div class="cf-h"><b>Flujo neto y acumulado por año</b><span class="cf-leg"><i class="sw pos"></i>Flujo del año (positivo)<i class="sw neg"></i>(negativo)<i class="ln"></i>Acumulado</span></div>
      <div class="cf-box"><svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" role="img" aria-label="Flujo neto y acumulado por año del caso de negocio">
        <g class="cf-grid">${tk.map(v => `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${esc(short(v, mon))}</text>`).join('')}</g>
        <line class="cf-zero" x1="${L}" x2="${W - R}" y1="${y0}" y2="${y0}"/>
        ${pb != null && pb > 0 && pb < n - 1 ? `<g class="cf-pb"><line x1="${x(0) + pb * band}" x2="${x(0) + pb * band}" y1="${T}" y2="${H - B}"/><text x="${x(0) + pb * band + 6}" y="${T + 10}">Recupera la inversión: ${esc(App.num(pb, 1))} años</text></g>` : ''}
        <g>${f.netos.map((v, t) => `<path class="${v >= 0 ? 'pos' : 'neg'}" d="${bar(t, v)}"/>`).join('')}</g>
        <path class="cf-line" d="${linea}"/>
        <g>${f.acumulado.map((v, t) => `<circle class="cf-dot" cx="${x(t)}" cy="${y(v)}" r="4"/>`).join('')}</g>
        <g class="cf-x">${f.netos.map((_, t) => (n <= 11 || t % 2 === 0 ? `<text x="${x(t)}" y="${H - 12}" text-anchor="middle">${esc(anio(t))}</text>` : '')).join('')}</g>
        <g>${f.netos.map((_, t) => `<rect class="cf-hit" data-t="${t}" x="${L + band * t}" y="${T}" width="${band}" height="${H - T - B}"/>`).join('')}</g>
      </svg><div class="cf-tip" hidden></div></div>`;
    const tip = el.querySelector('.cf-tip'), box = el.querySelector('.cf-box');
    box.onmousemove = e => {
      const h = e.target.closest('.cf-hit'); if (!h) { tip.hidden = true; return; }
      const t = +h.dataset.t, m = v => esc(App.money(v, mon));
      tip.innerHTML = `<b>${esc(caso.anio_inicio ? `Año ${t} · ${caso.anio_inicio + t}` : `Año ${t}`)}</b>
        <div><span>Inversión</span>${m(f.inversion[t])}</div><div><span>Costos</span>${m(f.costos[t])}</div><div><span>Beneficios</span>${m(f.beneficios[t])}</div>
        <div class="sep"><span>Flujo neto</span><b>${m(f.netos[t])}</b></div><div><span>Acumulado</span><b>${m(f.acumulado[t])}</b></div>`;
      tip.hidden = false;
      const br = box.getBoundingClientRect(), tw = tip.offsetWidth;
      let lx = e.clientX - br.left + 14; if (lx + tw > br.width) lx = e.clientX - br.left - tw - 14;
      tip.style.left = Math.max(0, lx) + 'px'; tip.style.top = Math.max(0, e.clientY - br.top - 20) + 'px';
      box.querySelectorAll('.cf-hit').forEach(r => r.classList.toggle('on', r === h));
    };
    box.onmouseleave = () => { tip.hidden = true; box.querySelectorAll('.cf-hit.on').forEach(r => r.classList.remove('on')); };
  }

  App.Caso.chart = chart;
})();
