/* ============================================================
   VISTAS ESTÁTICAS: el cronograma, el caso de negocio y la ficha de una
   iniciativa como documento (para PDF y para los enlaces de solo lectura).
   No depende del resto de la app: la usan la app (Exportar) y ver.html.
   ============================================================ */
(function (root) {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const NF = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }), NF2 = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 });
  const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const fecha = f => { if (!f) return '—'; const [y, m, d] = String(f).slice(0, 10).split('-'); return `${+d} ${MES[+m - 1]} ${y}`; };
  const dinero = v => (v == null || !isFinite(v) ? '—' : (v < 0 ? '-$' : '$') + NF.format(Math.round(Math.abs(v))));
  const corto = v => { if (v == null || !isFinite(v)) return '—'; const a = Math.abs(v), s = v < 0 ? '-' : ''; return a >= 1e9 ? `${s}$${NF2.format(Math.round(a / 1e8) / 10)} mil M` : a >= 1e6 ? `${s}$${NF.format(Math.round(a / 1e6))} M` : `${s}$${NF.format(Math.round(a))}`; };
  const ms = f => Date.parse(String(f).slice(0, 10) + 'T00:00:00Z');

  /* ---------- Cronograma: tabla y barras de tiempo ---------- */
  function cronogramaHTML(d, o = {}) {
    const secs = (d.secciones || []).slice().sort((a, b) => (a.position || 0) - (b.position || 0));
    const acts = (d.actividades || []).slice().sort((a, b) => (a.position || 0) - (b.position || 0));
    if (!acts.length) return '<p class="ve-vacio">Esta iniciativa aún no tiene cronograma.</p>';
    const fechas = acts.flatMap(a => [a.inicio, a.fin]).filter(Boolean).map(ms);
    let t0 = Math.min(...fechas), t1 = Math.max(...fechas);
    const i0 = new Date(t0); t0 = Date.UTC(i0.getUTCFullYear(), i0.getUTCMonth(), 1);
    const i1 = new Date(t1); t1 = Date.UTC(i1.getUTCFullYear(), i1.getUTCMonth() + 1, 1);
    const pos = f => ((ms(f) - t0) / (t1 - t0)) * 100, hoy = d.hoy ? pos(d.hoy) : null;
    const meses = []; for (let x = new Date(t0); x.getTime() < t1; x = new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth() + 1, 1))) meses.push(x);
    const reg = meses.map(m => `<i style="left:${pos(m.toISOString())}%"></i>`).join('');
    const total = acts.length, listas = acts.filter(a => (a.avance || 0) >= 100).length;
    const prom = Math.round(acts.reduce((s, a) => s + (a.avance || 0), 0) / total);
    const atras = acts.filter(a => (a.avance || 0) < 100 && a.fin && d.hoy && a.fin < d.hoy).length;
    const fin = acts.map(a => a.fin).filter(Boolean).sort().pop();
    const fila = (a, k) => {
      const x = a.inicio ? pos(a.inicio) : null, w = a.inicio && a.fin ? Math.max(0.6, pos(a.fin) - pos(a.inicio) + 100 / ((t1 - t0) / 864e5)) : null;
      const tarde = (a.avance || 0) < 100 && a.fin && d.hoy && a.fin < d.hoy;
      const barra = x == null ? '' : a.hito || a.inicio === a.fin ? `<b class="ve-hito ${tarde ? 'tarde' : ''}" style="left:${x}%"></b>` : `<b class="ve-bar ${tarde ? 'tarde' : (a.avance || 0) >= 100 ? 'lista' : ''}" style="left:${x}%;width:${w}%"><u style="width:${Math.min(100, a.avance || 0)}%"></u></b>`;
      return `<tr><td class="n">${k}</td><td class="nm" title="${esc(a.name || '')}">${esc(a.name || '')}</td>${o.responsables !== false ? `<td title="${esc(a.responsable || '')}">${esc(a.responsable || '')}</td>` : ''}<td class="f">${fecha(a.inicio)}</td><td class="f">${fecha(a.fin)}</td><td class="n">${Math.round(a.avance || 0)} %</td><td class="tl">${reg}${hoy != null && hoy >= 0 && hoy <= 100 ? `<s style="left:${hoy}%"></s>` : ''}${barra}</td></tr>`;
    };
    let n = 0;
    const grupos = secs.map(s => ({ s, l: acts.filter(a => a.section_id === s.id) })).filter(g => g.l.length);
    const sueltas = acts.filter(a => !secs.some(s => s.id === a.section_id));
    if (sueltas.length) grupos.push({ s: { name: 'Otras actividades' }, l: sueltas });
    const cols = o.responsables !== false ? 7 : 6;
    return `<div class="ve-kpi"><span><b>${prom} %</b> de avance</span><span><b>${listas}/${total}</b> actividades listas</span>${atras ? `<span class="r"><b>${atras}</b> atrasadas</span>` : ''}<span>termina el <b>${fecha(fin)}</b></span></div>
      <table class="ve-crono"><thead><tr><th class="n">#</th><th>Actividad</th>${o.responsables !== false ? '<th>Responsable</th>' : ''}<th class="f">Inicio</th><th class="f">Fin</th><th class="n ve-av">Avance</th><th class="tl">${meses.map(m => `<em style="left:${pos(m.toISOString())}%">${MES[m.getUTCMonth()]}${m.getUTCMonth() === 0 || m === meses[0] ? ' ' + String(m.getUTCFullYear()).slice(2) : ''}</em>`).join('')}</th></tr></thead>
      <tbody>${grupos.map((g, gi) => `<tr class="ve-et"><td colspan="${cols}">${gi + 1}. ${esc(g.s.name || 'Etapa')}</td></tr>${g.l.map((a, k) => fila(a, `${gi + 1}.${k + 1}`)).join('')}`).join('')}</tbody></table>
      <p class="ve-nota">Barra: duración de la actividad; el tono oscuro es el avance. Rojo: atrasada. Línea vertical: hoy.</p>`;
  }

  /* ---------- Caso de negocio: cada hoja del libro con sus valores calculados ---------- */
  function valCelda(v, n) {
    if (v == null || v === '') return '';
    if (typeof v === 'boolean') return v ? 'Sí' : 'No';
    if (typeof v !== 'number') return esc(v);
    if (n === 'pct') return NF2.format(Math.round(v * 10000) / 100) + ' %';
    if (n === 'cop') return dinero(v);
    return NF2.format(v);
  }
  function casoHTML(c, o = {}) {
    if (!c) return '<p class="ve-vacio">Esta iniciativa aún no tiene caso de negocio.</p>';
    const L = root.Libro || (root.App && root.App.Libro), out = [];
    const F = root.Finanzas;
    if (F && (c.flujos || []).length) {
      const f = F.calc(c), b = f.beneficios || [], t = b.findIndex(v => v > 0), dos = t < 0 ? 0 : (b[t] || 0) + (b[t + 1] || 0);
      out.push(`<div class="ve-kpi"><span>Estado <b>${esc(c.estado || 'Borrador')}</b></span><span><b>${corto(dos)}</b> valor a dos años</span>${f.vpn != null ? `<span>VPN <b>${corto(f.vpn)}</b> (tasa ${NF2.format(c.tasa || 0)} %)</span>` : ''}${f.tir != null ? `<span>TIR <b>${NF2.format(Math.round(f.tir * 1000) / 10)} %</b></span>` : ''}</div>`);
      if (o.grafica !== false) out.push(grafica(c, f));
    }
    if (o.cifras === false) out.push('<p class="ve-nota">Las cifras detalladas del caso no se incluyen en esta vista.</p>');
    else if (L && c.libro && Array.isArray(c.libro.hojas) && c.libro.hojas.length) {
      const E = L.crear(c.libro);
      c.libro.hojas.forEach((h, hi) => {
        const nc = Math.max(1, ...h.filas.map(f => (f.c || []).length));
        const filas = h.filas.map((f, r) => {
          if (f.t === 'vacia') return `<tr class="ve-v"><td colspan="${nc}"></td></tr>`;
          const celdas = []; for (let k = 0; k < nc; k++) { const v = (f.c || [])[k], x = typeof v === 'string' && v[0] === '=' ? E.val(hi, r, k) : v; celdas.push(`<td class="${typeof x === 'number' ? 'n' : ''}">${valCelda(x, f.n)}</td>`); }
          if (f.t === 'titulo' || f.t === 'seccion') return `<tr class="ve-${f.t}"><td colspan="${nc}">${esc((f.c || []).find(v => v !== '' && v != null) || '')}</td></tr>`;
          return `<tr class="ve-${f.t}">${celdas.join('')}</tr>`;
        }).join('');
        out.push(`<section class="ve-hoja"><h3>${esc(h.nombre)}</h3><table class="ve-libro">${filas}</table></section>`);
      });
    } else if ((c.flujos || []).length) {
      const n = Math.max(...c.flujos.map(f => (f.valores || []).length)), y0 = c.anio_inicio;
      const TIT = { supuesto: 'Supuestos', beneficio: 'Ingresos y ahorros', costo: 'Gastos', inversion: 'Inversión', calculo: 'Resultados' };
      out.push(`<section class="ve-hoja"><h3>Flujo del caso</h3><table class="ve-libro"><tr class="ve-encab"><td>Concepto</td>${Array.from({ length: n }, (_, t) => `<td class="n">${y0 ? y0 + t : 'Año ' + (t + 1)}</td>`).join('')}</tr>${Object.keys(TIT).map(k => { const l = c.flujos.filter(f => f.tipo === k); return l.length ? `<tr class="ve-seccion"><td colspan="${n + 1}">${TIT[k]}</td></tr>` + l.map(f => `<tr><td>${esc(f.concepto)}</td>${Array.from({ length: n }, (_, t) => `<td class="n">${valCelda(Number((f.valores || [])[t]) || 0, k === 'supuesto' ? (f.pct ? 'pct' : 'num') : 'cop')}</td>`).join('')}</tr>`).join('') : ''; }).join('')}</table></section>`);
    }
    if (String(c.consideraciones || '').trim()) out.push(`<section class="ve-hoja"><h3>Consideraciones</h3><div class="ve-texto">${esc(c.consideraciones).replace(/\n/g, '<br>')}</div></section>`);
    return out.join('');
  }
  // Gráfica del flujo: ingresos frente a salidas por año, y el acumulado
  function grafica(c, f) {
    const n = f.netos.length; if (!n) return '';
    const W = 900, H = 230, L = 70, R = 14, T = 16, B = 30, band = (W - L - R) / n, bw = Math.min(22, band * 0.3);
    const ac = f.acumulado, max = Math.max(1, ...f.beneficios, ...f.costos.map((v, t) => v + f.inversion[t]), ...ac.map(Math.abs)), min = Math.min(0, ...ac);
    const y = v => T + (max - v) / (max - min || 1) * (H - T - B), x = t => L + band * t + band / 2;
    const anio = t => (c.anio_inicio ? c.anio_inicio + t : 'Año ' + (t + 1));
    const barras = f.netos.map((_, t) => `<rect x="${x(t) - bw - 1}" y="${y(f.beneficios[t])}" width="${bw}" height="${Math.max(0, y(0) - y(f.beneficios[t]))}" rx="3" fill="#F08A5D"/><rect x="${x(t) + 1}" y="${y(f.costos[t] + f.inversion[t])}" width="${bw}" height="${Math.max(0, y(0) - y(f.costos[t] + f.inversion[t]))}" rx="3" fill="#5A4E78"/>`).join('');
    const lin = ac.map((v, t) => `${t ? 'L' : 'M'}${x(t)} ${y(v)}`).join('');
    const ejes = [min, 0, max / 2, max].filter((v, i, a) => a.indexOf(v) === i).map(v => `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="#E6E4EA"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${corto(v)}</text>`).join('');
    return `<figure class="ve-graf"><svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Flujo del caso por año">${ejes}${barras}<path d="${lin}" fill="none" stroke="#160B29" stroke-width="2"/>${f.netos.map((_, t) => `<text x="${x(t)}" y="${H - 8}" text-anchor="middle">${anio(t)}</text>`).join('')}</svg>
      <figcaption><i style="background:#F08A5D"></i>Ingresos y ahorros <i style="background:#5A4E78"></i>Gastos e inversión <i class="l"></i>Flujo de caja acumulado</figcaption></figure>`;
  }

  /* ---------- Riesgos y novedades ---------- */
  function riesgosHTML(lista) {
    const l = (lista || []).filter(r => r.estado !== 'Cerrado'); if (!l.length) return '<p class="ve-vacio">Sin riesgos abiertos.</p>';
    const val = r => (r.rp > 0 && r.ri > 0 ? r.rp * r.ri : (r.p || 0) * (r.i || 0)), niv = v => (v >= 15 ? 'Crítico' : v >= 10 ? 'Alto' : v >= 5 ? 'Medio' : v ? 'Bajo' : 'Sin evaluar');
    return `<table class="ve-lista"><thead><tr><th>Riesgo</th><th>Nivel</th><th>Estado</th><th>Respuesta</th></tr></thead><tbody>${l.sort((a, b) => val(b) - val(a)).map(r => `<tr><td>${esc(r.titulo || '')}</td><td>${niv(val(r))}${val(r) ? ' (' + val(r) + ')' : ''}</td><td>${esc(r.estado || 'Abierto')}</td><td>${esc(r.respuesta || '')}</td></tr>`).join('')}</tbody></table>`;
  }
  function novedadesHTML(lista) {
    const T = { avance: 'Avance', bloqueo: 'Bloqueo', decision: 'Decisión', riesgo: 'Riesgo', auto: 'Automática' };
    const l = (lista || []).slice().sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || ''))).slice(0, 15);
    if (!l.length) return '<p class="ve-vacio">Sin novedades registradas.</p>';
    return `<ul class="ve-nov">${l.map(n => `<li><b>${T[n.tipo] || ''}</b> · ${esc(n.texto)} <span>${fecha(n.fecha)}</span></li>`).join('')}</ul>`;
  }

  /* ---------- Documento completo ---------- */
  function encabezado(o) {
    return `<header class="ve-h"><img src="/marca/amarilo-negro.svg" alt="Amarilo" width="56" height="51"><div><small>Portafolio de Generación de Valor</small><h1>${esc(o.titulo)}</h1>${o.sub ? `<p>${esc(o.sub)}</p>` : ''}</div><div class="ve-meta">${esc(o.meta || '')}</div></header>`;
  }
  function documento(d, o = {}) {
    const p = d.proyecto || {}, partes = [];
    if (o.tipo === 'cronograma' || o.tipo === 'ficha') partes.push(`<section class="ve-sec"><h2>Cronograma</h2>${cronogramaHTML(d, o)}</section>`);
    if (o.tipo === 'caso' || o.tipo === 'ficha') partes.push(`<section class="ve-sec ${o.tipo === 'ficha' ? 've-salto' : ''}"><h2>Caso de negocio</h2>${casoHTML(d.caso, o)}</section>`);
    if (o.tipo === 'ficha') { partes.push(`<section class="ve-sec"><h2>Riesgos</h2>${riesgosHTML(d.riesgos)}</section>`); partes.push(`<section class="ve-sec"><h2>Novedades</h2>${novedadesHTML(d.novedades)}</section>`); }
    const titulo = { cronograma: 'Cronograma', caso: 'Caso de negocio', ficha: 'Ficha de la iniciativa' }[o.tipo] || '';
    return `<div class="ve">${encabezado({ titulo: p.nombre || 'Iniciativa', sub: [titulo, p.fase, p.frase].filter(Boolean).join(' · '), meta: o.meta })}${partes.join('')}</div>`;
  }

  const api = { documento, cronogramaHTML, casoHTML, riesgosHTML, novedadesHTML, encabezado, esc, fecha, corto };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Estatica = api;
})(typeof self !== 'undefined' ? self : this);
