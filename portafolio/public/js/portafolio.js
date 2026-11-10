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
  const R = Object.assign({ okr: null, cat: '', etapa: '', q: '', alertas: false }, App.store.get('portafolio', {}));
  const guardar = () => App.store.set('portafolio', { okr: R.okr, cat: R.cat, etapa: R.etapa, alertas: R.alertas });
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

  /* ---------- tabla ---------- */
  function mini(r) {
    const pl = r.pl; if (!pl.ini) return `<span class="faint" title="${esc(App.sinPlan(r.p).largo)}">${esc(App.sinPlan(r.p).corto)}</span>`;
    const y0 = +App.d.today().slice(0, 4), a = `${y0}-01-01`, b = `${y0 + 1}-12-31`, tot = App.d.diff(a, b);
    const pos = iso => Math.max(0, Math.min(1, App.d.diff(a, iso < a ? a : iso > b ? b : iso) / tot));
    const x0 = pos(pl.ini) * 100, x1 = pos(pl.fin) * 100, hoy = pos(App.d.today()) * 100;
    const tarde = pl.atrasadas > 0;
    return `<span class="pf-gantt ${tarde ? 'tarde' : ''}" title="${esc(App.d.fmt(pl.ini))} – ${esc(App.d.fmt(pl.fin))}"><i style="left:${x0}%;width:${Math.max(1.5, x1 - x0)}%"><b style="width:${pl.avance}%"></b></i><u style="left:${hoy}%"></u><em style="left:50%"></em></span><span class="pf-fin ${tarde ? 'tarde' : ''}">${esc(App.d.MES3[+pl.fin.slice(5, 7) - 1])} ${pl.fin.slice(2, 4)}</span>`;
  }
  function filaHTML(r) {
    const ec = App.estadoCol(), est = r.x.estado, ice = r.x.ice;
    const okr = r.okrs.length ? `<span class="pf-okrs" title="${esc(r.okrs.join('\n'))}">${esc(r.okrs[0])}${r.okrs.length > 1 ? ` <em>+${r.okrs.length - 1}</em>` : ''}</span>` : '<span class="faint">—</span>';
    const todos = esc(r.cats.map(App.catLabel).join(', '));
    const tipos = r.cats.length ? `<span class="pf-tv" style="--c:var(--cat-${r.cats[0]})" title="${todos}">${esc(App.catLabel(r.cats[0]))}</span>${r.cats.length > 1 ? `<span class="pf-mas2" title="${todos}">+${r.cats.length - 1}</span>` : ''}` : '<span class="faint">—</span>';
    const av = r.pl.acts.length ? `<span class="pf-av"><span class="t"><i style="width:${r.pl.avance}%"></i>${r.esp != null ? `<u style="left:${r.esp}%" title="Esperado a hoy: ${r.esp} %"></u>` : ''}</span><b>${r.pl.avance} %</b></span>` : '<span class="faint">—</span>';
    const caso = r.x.caso ? `<a class="pf-caso" href="#/proyectos/${r.p.id}/caso" title="Abrir el caso de negocio"><b>${r.valor ? esc(m(r.valor)) : '—'}</b><span class="pill pf-est cl-${App.Caso.estadoColor(r.x.caso.estado)}">${esc(r.x.caso.estado || 'Borrador')}</span> <span class="pf-go">↗</span></a>`
      : r.valor ? `<span class="pf-caso"><b>${esc(m(r.valor))}</b><small class="pf-inc" title="Sin caso de negocio: valor del Income"> Income</small></span>` : (App.canEdit() ? `<a class="t-lnk" href="#/proyectos/${r.p.id}/caso">+ Crear caso</a>` : '<span class="faint">Sin caso</span>');
    const al = r.al[0];
    return `<tr data-pid="${r.p.id}">
      <td class="pf-nm"><a href="#/proyectos/${r.p.id}"><b>${esc(App.projectName(r.p))}</b></a><small>${est ? `<span class="pill pf-etapa cl-${App.optColor(ec, est)}" title="${esc(est)}">${esc(corto(est))}</span>` : ''}${esc(responsables(r.p))}</small></td>
      <td>${okr}</td><td><div class="pf-tvs">${tipos}</div></td>
      <td class="n">${ice == null ? '<span class="faint">—</span>' : `<b>${esc(App.num(ice, 1))}</b>`}</td>
      <td>${av}</td>
      <td><a class="pf-crono" href="#/cronograma/${r.p.id}" title="Abrir el cronograma">${mini(r)}</a></td>
      <td>${caso}</td>
      <td>${al ? `<a class="pf-al ${al.sev >= 3 ? 'crit' : 'warn'}" href="${al.href}" title="${esc(r.al.map(o => '• ' + o.txt).join('\n'))}">${al.sev >= 3 ? '●' : '▲'} ${esc(cortoAlerta(al.txt))}${r.al.length > 1 ? ` <em>+${r.al.length - 1}</em>` : ''}</a>` : '<span class="pf-ok">✓ Al día</span>'}</td></tr>`;
  }
  const corto = e => { const mm = /^(L\d)\b/i.exec(e); return mm ? mm[1].toUpperCase() : e; };
  const cortoAlerta = t => t.replace(/ en el cronograma$/, '').replace(/^(\d+) actividad(?:es)? atrasadas?$/, (_, n) => n + (n === '1' ? ' atrasada' : ' atrasadas')).replace(/^1 compromiso de comité vencido$/, 'Compromiso vencido').replace(/^Captura (rezagada|por debajo): (\d+)%.*/, 'Captura al $2 %').replace(/^Termina (\d+) días? hábil(es)? después de la fecha meta$/, 'Meta +$1 días').replace(/ de comité vencidos?$/, ' vencido').replace(/^(\d+) actividad(es)? de la ruta crítica en riesgo$/, 'Ruta crítica en riesgo');
  function responsables(p) {
    const v = p.props || {}; const n = [].concat(v.habilitadores || [], v.realizadores || []).filter(Boolean);
    return n.length ? n.slice(0, 2).join(' · ') : '';
  }

  function render(main) {
    const { d, rows } = filas();
    const vis = rows.filter(r => pasaFiltros(r));
    vis.sort((a, b) => (b.x.ice ?? -1) - (a.x.ice ?? -1) || App.projectName(a.p).localeCompare(App.projectName(b.p)));
    const ec = App.estadoCol();
    const nAl = rows.filter(r => r.al.length).length, total = rows.reduce((a, r) => a + r.valor, 0);
    const chips = [
      R.okr != null ? `<button class="pf-chip" data-quitar="okr">OKR · ${esc(R.okr || 'Sin OKR asignado')} ✕</button>` : '',
      R.cat ? `<button class="pf-chip" data-quitar="cat">${esc(App.catLabel(R.cat))} ✕</button>` : '',
    ].join('');
    main.innerHTML = `<div class="pg-top"><button class="burger" data-act="burger" aria-label="Menú">☰</button><h1>Portafolio</h1>
        <div class="kl"><span><b>${rows.length}</b>iniciativas</span><span><b>${rows.filter(r => r.x.real).length}</b>en realización</span><span><b class="${nAl ? 'r' : ''}">${nAl}</b>con alertas</span><span><b>${esc(m(total))}</b>valor proyectado ${d.anios.length ? `${d.anios[0]}–${d.anios.at(-1)}` : ''}</span></div>
        <span class="sp"></span><button class="btn ghost sm" data-pf="csv">Exportar a Excel</button>${App.canEdit() ? '<button class="btn primary sm" data-pf="nuevo">+ Nueva iniciativa</button>' : ''}</div>
      ${lentes(rows)}
      <div class="pf-bar"><label class="search"><span>⌕</span><input id="pfq" placeholder="Buscar iniciativa u OKR…" value="${esc(R.q)}"></label>${chips}
        ${ec ? `<select class="pf-sel" data-pf-etapa aria-label="Etapa"><option value="">Etapa: todas</option>${(ec.options || []).map(o => `<option ${R.etapa === o.name ? 'selected' : ''}>${esc(o.name)}</option>`).join('')}</select>` : ''}
        <button class="pf-tg ${R.alertas ? 'on' : ''}" data-pf="alertas" aria-pressed="${R.alertas}">Solo con alertas</button>
        <span class="sp"></span><div class="seg"><button class="on" aria-pressed="true">Resumen</button><button data-vista-pf="tabla" title="Tabla tipo Notion: aquí se editan las columnas">Tabla completa</button><button data-vista-pf="tablero">Tablero</button></div></div>
      <section class="t-card pf-tbl-card"><div class="pf-wrap"><table class="pf-tbl">
        <thead><tr><th>Iniciativa <small>etapa · responsables</small></th><th>OKR</th><th>Tipo de valor</th><th class="n" title="Prioridad relativa">ICE ▾</th><th>Avance <small>real · ┃ esperado</small></th><th>Cronograma <small>${+d.hoy.slice(0, 4)} – ${+d.hoy.slice(0, 4) + 1}</small></th><th>Caso de negocio <small>valor proyectado</small></th><th>Alertas</th></tr></thead>
        <tbody>${vis.map(filaHTML).join('') || `<tr><td colspan="8"><div class="t-vacio">${rows.length ? 'Ninguna iniciativa cumple estos filtros.' : 'Aún no hay iniciativas.'}</div></td></tr>`}</tbody></table></div>
        <div class="t-pie t-pie-row"><span class="t-tag">${vis.length} de ${rows.length} iniciativas · ordenadas por ICE${R.okr != null ? ` · OKR «${esc(R.okr || 'sin asignar')}»` : ''}</span><span class="t-tag">Clic en el cronograma o en el caso abre esa pestaña de la iniciativa</span></div></section>`;
    const q = $('#pfq', main);
    q.oninput = () => { R.q = q.value; const pos = q.selectionStart; render(main); const n = $('#pfq', main); n.focus(); n.setSelectionRange(pos, pos); };
    main.onclick = e => {
      if (e.target.closest('.burger')) return App.toggleSide();
      const o = e.target.closest('[data-okr]'); if (o) { R.okr = R.okr === o.dataset.okr ? null : o.dataset.okr; guardar(); return render(main); }
      const c = e.target.closest('[data-cat]'); if (c) { R.cat = R.cat === c.dataset.cat ? '' : c.dataset.cat; guardar(); return render(main); }
      const qq = e.target.closest('[data-quitar]'); if (qq) { if (qq.dataset.quitar === 'okr') R.okr = null; else R[qq.dataset.quitar] = ''; guardar(); return render(main); }
      const v = e.target.closest('[data-vista-pf]'); if (v) return App.Tabla.setView(v.dataset.vistaPf);
      const b = e.target.closest('[data-pf]'); if (!b) return;
      if (b.dataset.pf === 'alertas') { R.alertas = !R.alertas; guardar(); return render(main); }
      if (b.dataset.pf === 'csv') return csv(vis);
      if (b.dataset.pf === 'nuevo') App.guard(async () => { const p = await App.create('projects', { props: {} }); App.go('#/proyectos/' + p.id); });
    };
    main.onchange = e => { if (e.target.hasAttribute('data-pf-etapa')) { R.etapa = e.target.value; guardar(); render(main); } };
  }

  function csv(vis) {
    const cell = s => { s = String(s == null ? '' : s); if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+([.,]\d+)?$/.test(s)) s = "'" + s; return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const head = ['Iniciativa', 'Etapa', 'OKR', 'Tipo de valor', 'ICE', 'Avance %', 'Avance esperado %', 'Inicio', 'Fin', 'Valor proyectado', 'Estado del caso', 'VPN', 'TIR %', 'Alertas'];
    const lines = [head.map(cell).join(';'), ...vis.map(r => [App.projectName(r.p), r.x.estado, r.okrs.join(', '), r.cats.map(App.catLabel).join(', '), r.x.ice ?? '', r.pl.acts.length ? r.pl.avance : '', r.esp ?? '', r.pl.ini || '', r.pl.fin || '', Math.round(r.valor) || '', r.x.caso ? r.x.caso.estado || 'Borrador' : '', r.f && r.f.vpn != null ? Math.round(r.f.vpn) : '', r.f && r.f.tir != null ? Math.round(r.f.tir * 1000) / 10 : '', r.al.map(o => o.txt).join(' · ')].map(cell).join(';'))];
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `portafolio-${App.d.today()}.csv`; a.click(); URL.revokeObjectURL(a.href);
  }

  App.Portafolio = { render };
})();
