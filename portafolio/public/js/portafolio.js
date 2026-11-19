/* ============================================================
   PORTAFOLIO, vista Resumen (la que abre por defecto)
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
  const R = Object.assign({ okr: null, cat: '', etapa: '', q: '', alertas: false, modo: 'tabla', grupo: 'fase', orden: 'ice', dir: -1, cerr: {} }, App.store.get('portafolio', {}));
  const guardar = () => App.store.set('portafolio', { inact: R.inact, graf: R.graf, okr: R.okr, cat: R.cat, etapa: R.etapa, alertas: R.alertas, modo: R.modo, grupo: R.grupo, orden: R.orden, dir: R.dir, cerr: R.cerr });
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
    const d = App.Dash.datos({ anio: null, estado: '', tipo: '', alcance: 'todos', conEjemplo: true });
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
    && (R.inact === true || !inactiva(r))
    && (!R.q || App.projectName(r.p).toLowerCase().includes(R.q.toLowerCase()) || r.okrs.join(' ').toLowerCase().includes(R.q.toLowerCase()));

  /* ---------- listas para hacer zoom ---------- */
  // limpio = para el Tablero: sin los filtros del Portafolio y sin marcar nada; el clic abre el Portafolio ya filtrado
  function lentes(rows, limpio) {
    const pf = limpio ? () => true : pasaFiltros;
    // OKR: cuenta con los demás filtros puestos (menos el de OKR); el valor se reparte entre los OKR de cada iniciativa
    const base = rows.filter(r => pf(r, true, false));
    const okr = new Map();
    base.forEach(r => (r.okrs.length ? r.okrs : ['']).forEach(o => { const z = okr.get(o) || { n: 0, v: 0 }; z.n++; z.v += r.valor / Math.max(1, r.okrs.length); okr.set(o, z); }));
    const lo = [...okr.entries()].sort((a, b) => (a[0] === '') - (b[0] === '') || b[1].v - a[1].v || a[0].localeCompare(b[0]));
    const maxO = Math.max(1, ...lo.map(([, z]) => z.v));
    const baseC = rows.filter(r => pf(r, false, true));
    const lc = ORDEN_CAT.map(k => ({ k, n: baseC.filter(r => r.cats.includes(k)).length, v: baseC.reduce((a, r) => a + r.porCat[k], 0) })).filter(z => z.n);
    const maxC = Math.max(1, ...lc.map(z => z.v));
    const fila = (cls, attr, on, chip, nombre, n, v, max, color) => `<button class="pf-lr ${cls} ${on ? 'on' : ''}" ${attr} aria-pressed="${on}">${chip}<span class="nm" title="${esc(nombre)}">${esc(nombre)}</span><span class="cnt">${n} inic.</span><span class="b"><i style="width:${v / max * 100}%;${color ? `background:${color}` : ''}"></i></span><span class="v">${v ? esc(m(v)) : '—'}</span></button>`;
    return `<div class="pf-lentes">
      <section class="t-card pf-lente"><h3>Por OKR <small>${limpio ? 'clic: abre el Portafolio con esas iniciativas' : 'clic para ver solo esas iniciativas'}</small></h3>
        ${lo.length ? lo.slice(0, 8).map(([o, z]) => fila('', `data-okr="${esc(o)}"`, !limpio && R.okr === o, `<span class="pf-okr ${o ? '' : 'sin'}">${o ? 'OKR' : '—'}</span>`, o || 'Sin OKR asignado', z.n, z.v, maxO)).join('') : '<div class="t-vacio">Ninguna iniciativa tiene OKR todavía (columna «OKRs» del portafolio).</div>'}
        ${lo.length > 8 ? `<div class="pf-mas">y ${lo.length - 8} OKR más: búscalos con el buscador</div>` : ''}</section>
      <section class="t-card pf-lente"><h3>Por tipo de valor <small>cómo se captura el beneficio</small></h3>
        ${lc.length ? lc.map(z => fila('cat', `data-cat="${z.k}"`, !limpio && R.cat === z.k, `<span class="pf-dot" style="background:var(--cat-${z.k})"></span>`, App.catLabel(z.k), z.n, z.v, maxC, `var(--cat-${z.k})`)).join('') : '<div class="t-vacio">Aún no hay tipos de valor: salen de los beneficios del caso o de la columna «Tipo de valor».</div>'}
        <div class="pf-mas">Una iniciativa puede capturar de varias formas: cuenta en cada una.</div></section></div>`;
  }

  const inactiva = r => { const fa = window.Fases && Fases.de(r.x.estado); return fa && fa.fuera ? 1 : 0; };
  const sinDatos = r => !inactiva(r) && !r.pl.acts.length && !r.x.caso;
  const dosAnios = r => (r.f && App.Avance ? App.Avance.dosAnios(r.f) : 0);
  // «Laura Martínez» → «Laura M.»
  const nombreCorto = n => { const p = String(n || '').trim().split(/\s+/); return p.length > 1 ? `${p[0]} ${p[1][0].toUpperCase()}.` : p[0] || ''; };

  /* ---------- ordenar y agrupar ---------- */
  // Cada columna sabe por qué valor se ordena; lo vacío siempre queda al final
  const ORDEN = {
    nombre: { t: 'nombre', v: r => App.projectName(r.p).toLowerCase(), dir: 1 },
    okr: { t: 'OKR', v: r => (r.okrs[0] || '').toLowerCase() || null, dir: 1 },
    tipo: { t: 'tipo de valor', v: r => (r.cats[0] ? App.catLabel(r.cats[0]).toLowerCase() : null), dir: 1 },
    ice: { t: 'ICE', v: r => r.x.ice, dir: -1 },
    avance: { t: 'avance', v: r => (r.pl.acts.length ? r.pl.avance : null), dir: -1 },
    fin: { t: 'fecha de fin', v: r => r.pl.fin || null, dir: 1 },
    valor: { t: 'valor a dos años', v: r => dosAnios(r) || r.valor || null, dir: -1 },
    alertas: { t: 'alertas', v: r => (r.al.length ? r.al[0].sev * 100 + r.al.length : sinDatos(r) ? 0.5 : inactiva(r) ? null : 0), dir: -1 },
  };
  function ordenar(l) {
    const o = ORDEN[R.orden] || ORDEN.ice, dir = R.dir === 1 ? 1 : -1;
    const cmp = (a, b) => { const x = o.v(a), y = o.v(b); if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1; return (typeof x === 'string' ? x.localeCompare(y) : x - y) * dir; };
    // Sin agrupar por fase, las cerradas, en pausa o canceladas van al final
    return l.slice().sort((a, b) => (R.grupo === 'fase' ? 0 : inactiva(a) - inactiva(b)) || cmp(a, b) || App.projectName(a.p).localeCompare(App.projectName(b.p)));
  }
  const GRUPOS = {
    fase: { t: 'por fase', de: r => { const k = window.Fases ? Fases.clasificar(r.x.estado) : null; const fa = k != null && Fases.deId(k); return fa ? { k: String(k), t: fa.nombre, o: Fases.FASES.indexOf(fa) } : { k: 'sin', t: r.x.estado || 'Sin fase', o: 99 }; } },
    okr: { t: 'por OKR', de: r => (r.okrs[0] ? { k: r.okrs[0], t: r.okrs[0], o: 0 } : { k: '', t: 'Sin OKR asignado', o: 1 }) },
    tipo: { t: 'por tipo de valor', de: r => (r.cats[0] ? { k: r.cats[0], t: App.catLabel(r.cats[0]), o: ORDEN_CAT.indexOf(r.cats[0]) } : { k: '', t: 'Sin tipo de valor', o: 99 }) },
  };
  // Columnas de lista que alguien usa (Gerencia, Vicepresidencia, Palanca…): también sirven para agrupar
  const colsGrupo = () => App.S.columns.filter(c => (c.type === 'select' || c.type === 'multi') && c !== App.estadoCol() && !['tipo_valor', 'ice_os', 'revision_dgv'].includes(c.id) && !App.colVacia(c));
  const grupoDe = k => { if (GRUPOS[k]) return GRUPOS[k]; const c = k && k.startsWith('col:') ? App.S.columns.find(x => 'col:' + x.id === k) : null;
    return c ? { t: 'por ' + c.name.toLowerCase(), de: r => { let v = (r.p.props || {})[c.id]; if (Array.isArray(v)) v = v[0]; return v ? { k: String(v), t: String(v), o: 0 } : { k: '', t: 'Sin ' + c.name.toLowerCase(), o: 1 }; } } : null; };
  function cuerpo(vis) {
    const l = ordenar(vis), g = grupoDe(R.grupo);
    if (!g) return l.map(filaHTML).join('');
    const mapa = new Map();
    l.forEach(r => { const z = g.de(r); if (!mapa.has(z.k)) mapa.set(z.k, { z, rows: [] }); mapa.get(z.k).rows.push(r); });
    return [...mapa.values()].sort((a, b) => a.z.o - b.z.o || a.z.t.localeCompare(b.z.t)).map(({ z, rows }) => {
      const id = R.grupo + ':' + z.k, cerrado = !!(R.cerr || {})[id], v = rows.reduce((a, r) => a + (dosAnios(r) || 0), 0), al = rows.filter(r => r.al.length).length;
      return `<tr class="pf-grp" data-grp="${esc(id)}" role="button" aria-expanded="${!cerrado}"><td colspan="${colsVis().length + 1}"><b>${cerrado ? '▸' : '▾'} ${R.grupo === 'fase' && App.estadoCol() ? `<span class="pill cl-${App.optColor(App.estadoCol(), rows[0].x.estado) || 'gris'}">${esc(z.t)}</span>` : esc(z.t)}</b><small>${rows.length} ${rows.length === 1 ? 'iniciativa' : 'iniciativas'}${v ? `, ${esc(m(v))} a dos años` : ''}${al ? `, <span class="r">${al} con alertas</span>` : ''}</small></td></tr>${cerrado ? '' : rows.map(filaHTML).join('')}`;
    }).join('');
  }

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
    const okr = r.okrs.length ? `<button class="pf-okrs" data-okrs="${r.p.id}" title="Ver los OKR de esta iniciativa"><span class="t">${esc(r.okrs[0])}</span>${r.okrs.length > 1 ? `<em>+${r.okrs.length - 1}</em>` : ''}</button>` : '<span class="faint">—</span>';
    const todos = esc(r.cats.map(App.catLabel).join(', '));
    const tipos = r.cats.length ? `<span class="pf-tv" style="--c:var(--cat-${r.cats[0]})" title="${todos}">${esc(App.catLabel(r.cats[0]))}</span>${r.cats.length > 1 ? `<span class="pf-mas2" title="${todos}">+${r.cats.length - 1}</span>` : ''}` : '<span class="faint">—</span>';
    const av = r.pl.acts.length ? `<span class="pf-av"><span class="t"><i style="width:${r.pl.avance}%"></i>${r.esp != null ? `<u style="left:${r.esp}%" title="Esperado a hoy: ${r.esp} %"></u>` : ''}</span><b>${r.pl.avance} %</b></span>` : '<span class="faint">—</span>';
    const v2 = dosAnios(r);
    const caso = r.x.caso ? `<a class="pf-caso" href="#/proyectos/${r.p.id}/caso" title="Valor a dos años: beneficios de los dos primeros años del caso${r.valor ? `, total del caso ${esc(m(r.valor))}` : ''}${r.f && r.f.vpn != null && r.f.totalInversion ? `, VPN ${esc(m(r.f.vpn))}` : ''}"><b>${v2 ? esc(m(v2)) : r.valor ? esc(m(r.valor)) : '—'}</b><span class="pill pf-est cl-${App.Caso.estadoColor(r.x.caso.estado)}">${esc(r.x.caso.estado || 'Borrador')}</span> <span class="pf-go">↗</span></a>`
      : r.valor ? `<span class="pf-caso"><b>${esc(m(r.valor))}</b><small class="pf-inc" title="Sin caso de negocio: valor del Income"> Income</small></span>` : (App.canEdit() && !inactiva(r) ? `<a class="pf-crear" href="#/proyectos/${r.p.id}/caso" title="Crear el caso de negocio"><span class="a">Sin caso</span><span class="b">+ Crear caso</span></a>` : '<span class="faint">Sin caso</span>');
    const al = r.al[0];
    const C = {
      nombre: `<td class="pf-nm"><a href="#/proyectos/${r.p.id}"><b>${esc(App.projectName(r.p))}</b></a>${App.tagEjemplo(r.p)}</td>`,
      fase: `<td class="pf-fase-c">${ec ? `<button class="pf-fase" data-fase-ed="${r.p.id}" ${App.canEdit() ? '' : 'disabled'} title="${esc(est || 'Sin fase')}${App.canEdit() ? ', clic para cambiarla' : ''}"><span class="pill cl-${App.optColor(ec, est) || 'gris'}">${esc(est ? est.replace(/\s*·.*$/, '') : 'Sin fase')}</span></button>` : ''}</td>`,
      habilitadores: `${['habilitadores'].map(k => { const c = App.S.columns.find(x => x.id === k); const v = (r.p.props || {})[k]; return `<td class="pf-per-c">${c && v && (!Array.isArray(v) || v.length) ? App.Tabla.renderValue(c, v) : '<span class="faint">—</span>'}</td>`; }).join('')}`,
      realizadores: `${['realizadores'].map(k => { const c = App.S.columns.find(x => x.id === k); const v = (r.p.props || {})[k]; return `<td class="pf-per-c">${c && v && (!Array.isArray(v) || v.length) ? App.Tabla.renderValue(c, v) : '<span class="faint">—</span>'}</td>`; }).join('')}`,
      okr: `<td>${okr}</td>`, tipo: `<td><div class="pf-tvs">${tipos}</div></td>`,
      ice: `<td class="n">${ice == null ? '<span class="faint">—</span>' : `<b>${esc(App.num(ice, 1))}</b>`}</td>`,
      avance: `<td>${av}</td>`,
      fin: `<td><a class="pf-crono" href="#/cronograma/${r.p.id}" title="Abrir el cronograma">${mini(r)}</a></td>`,
      valor: `<td>${caso}</td>`,
      alertas: `<td>${al ? `<a class="pf-al ${al.sev >= 3 ? 'crit' : 'warn'}" href="${al.href}" title="${esc(r.al.map(o => '• ' + o.txt).join('\n'))}">${al.sev >= 3 ? '●' : '▲'} ${esc(cortoAlerta(al.txt))}${r.al.length > 1 ? ` <em>+${r.al.length - 1}</em>` : ''}</a>` : (() => { const av = App.Avance && App.Avance.de(r.p); return av && av.listo ? `<a class="pf-listo" href="#/proyectos/${r.p.id}" title="Cumple los criterios: confirma el cambio en su ficha">↗ Lista para ${esc(av.sig.corto)}</a>` : inactiva(r) ? '<span class="faint">—</span>' : sinDatos(r) ? '<span class="pf-sd" title="No tiene cronograma ni caso de negocio: no hay con qué medir si va bien">Sin datos</span>' : `<span class="pf-ok" title="Sin alertas en lo que tiene cargado">✓ Al día</span>${!r.x.caso ? '<small class="pf-falta">falta el caso</small>' : !r.pl.acts.length ? '<small class="pf-falta">falta el cronograma</small>' : ''}`; })()}</td>`,
    };
    return `<tr data-pid="${r.p.id}" class="${inactiva(r) ? 'pf-inact' : ''}">${colsVis().map(k => C[k] != null ? C[k] : celdaProp(k, r)).join('')}<td class="go" aria-hidden="true">›</td></tr>`;
  }
  const corto = e => { const f = window.Fases && Fases.de(e); if (f) return f.corto; const mm = /^(L\d)\b/i.exec(e); return mm ? mm[1].toUpperCase() : e; };
  const cortoAlerta = t => t.replace(/ en el cronograma$/, '').replace(/^(\d+) actividad(?:es)? atrasadas?$/, (_, n) => n + (n === '1' ? ' atrasada' : ' atrasadas')).replace(/^1 compromiso de comité vencido$/, 'Compromiso vencido').replace(/^Captura (rezagada|por debajo): (\d+)%.*/, 'Captura al $2 %').replace(/^Termina (\d+) días? hábil(es)? después de la fecha meta$/, 'Meta +$1 días').replace(/ de comité vencidos?$/, ' vencido').replace(/^(\d+) actividad(es)? de la ruta crítica en riesgo$/, 'Ruta crítica en riesgo');
  const COLS_PER = ['habilitadores', 'realizadores'];
  // Columnas del Resumen. Las «p:<id>» son columnas del portafolio (atributos de la iniciativa): se editan en la celda.
  const BASE = [['nombre', 'Iniciativa'], ['fase', 'Fase'], ['habilitadores', 'Habilitadores'], ['realizadores', 'Realizadores'], ['okr', 'OKR'], ['tipo', 'Tipo de valor'], ['ice', 'ICE'], ['avance', 'Avance'], ['fin', 'Cronograma'], ['valor', 'Valor a 2 años'], ['alertas', 'Alertas']];
  const POR_DEFECTO = BASE.map(b => b[0]);
  const colsVis = () => { const v = App.S.vistaPf && Array.isArray(App.S.vistaPf.cols) ? App.S.vistaPf.cols : POR_DEFECTO;
    const ok = v.filter(k => BASE.some(b => b[0] === k) || (k.startsWith('p:') && App.S.columns.some(c => c.id === k.slice(2))));
    return ok.includes('nombre') ? ok : ['nombre'].concat(ok); };
  const nombreCol = k => { const b = BASE.find(x => x[0] === k); if (b) return b[1]; const c = App.S.columns.find(x => 'p:' + x.id === k); return c ? c.name : k; };
  function celdaProp(k, r) {
    const c = App.S.columns.find(x => 'p:' + x.id === k); if (!c) return '<td></td>';
    const v = (r.p.props || {})[c.id], vacio = v == null || v === '' || (Array.isArray(v) && !v.length);
    return `<td class="pf-prop ${App.canEdit() ? 'ed' : ''}" data-pedit="${r.p.id}" data-col="${c.id}" title="${App.canEdit() ? 'Clic para editar' : ''}">${vacio ? '<span class="faint">—</span>' : App.Tabla.renderValue(c, v)}</td>`;
  }
  const guardarVista = cols => { App.S.vistaPf = { cols }; App.api('PUT', '/api/config/vista-portafolio', { cols }).then(v => { App.S.vistaPf = v; }).catch(e => App.toast(e.message || 'No se pudo guardar', true)); };
  function panelColumnas(anchor, main) {
    const vis = colsVis(), props = App.S.columns.filter(c => c.type !== 'title' && !COLS_PER.includes(c.id) && c !== App.estadoCol());
    const fila = (k, t, fija) => `<label class="pc-f"><input type="checkbox" data-pc="${esc(k)}" ${vis.includes(k) ? 'checked' : ''} ${fija ? 'disabled' : ''}><span>${esc(t)}</span>${vis.includes(k) && !fija ? `<span class="pc-ord"><button data-pc-m="${esc(k)}:-1" title="Mover a la izquierda">‹</button><button data-pc-m="${esc(k)}:1" title="Mover a la derecha">›</button></span>` : ''}</label>`;
    const p = App.openPop(anchor, `<div class="lbl">Columnas del Resumen</div><div class="pc-l">${BASE.map(([k, t]) => fila(k, t, k === 'nombre')).join('')}</div>
      <div class="lbl">Atributos de la iniciativa</div><div class="pc-l">${props.map(c => fila('p:' + c.id, c.name)).join('') || '<div class="hint">No hay más columnas.</div>'}</div>
      ${App.canEdit() ? '<div class="pc-pie"><button class="t-lnk" data-pc-nueva>+ Agregar una columna</button><span class="faint">Se ve igual para todos</span></div>' : ''}`, { width: 300, nofocus: true });
    const aplicar = cols => { guardarVista(cols); render(main); panelColumnas($('[data-pf=cols]', main) || anchor, main); };
    p.onchange = e => { const k = e.target.dataset.pc; if (!k || !App.canEdit()) return; const v = colsVis().filter(x => x !== k); aplicar(e.target.checked ? v.concat(k) : v); };
    p.onclick = e => {
      const mv = e.target.closest('[data-pc-m]'); if (mv && App.canEdit()) { e.preventDefault(); const [k, d] = [mv.dataset.pcM.slice(0, mv.dataset.pcM.lastIndexOf(':')), +mv.dataset.pcM.split(':').pop()]; const v = colsVis().slice(), i = v.indexOf(k), j = i + d; if (j < 1 || j >= v.length) return; v.splice(i, 1); v.splice(j, 0, k); return aplicar(v); }
      if (e.target.closest('[data-pc-nueva]')) { App.closePop(true); const antes = App.S.columns.map(c => c.id); App.Tabla.openAddColumn(anchor);
        const espera = setInterval(() => { const nueva = App.S.columns.find(c => !antes.includes(c.id)); if (nueva) { clearInterval(espera); guardarVista(colsVis().concat('p:' + nueva.id)); render(main); } }, 300); setTimeout(() => clearInterval(espera), 60000); }
    };
  }
  // Desde el Tablero: abrir el Portafolio con una fase
  function filtrarFase(k) { const ec = App.estadoCol(); const o = ec && (ec.options || []).find(x => String(Fases.clasificar(x.name)) === String(k)); R.etapa = o ? o.name : ''; if (['pausa', 'cerrada', 'cancelada'].includes(String(k))) R.inact = true; guardar(); App.go('#/proyectos'); }
  function responsables(p) {
    const v = p.props || {}; const n = [].concat(v.habilitadores || [], v.realizadores || []).filter(Boolean);
    return n.slice(0, 2);
  }

  function render(main) {
    const { d, rows: conEj } = filas();
    const todas = conEj.filter(r => !App.esEjemplo(r.p)), ejs = conEj.filter(r => App.esEjemplo(r.p));
    // Iniciativas activas: las que tienen «¿Revisión DGV?» en SI. Las demás se ocultan mientras el filtro esté puesto.
    const rows = todas.filter(r => App.enAlcance(r.p)), fuera = todas.length - rows.length;
    const vis = ordenar(rows.filter(r => pasaFiltros(r)));
    const oAct = ORDEN[R.orden] ? R.orden : 'ice';
    const th = (k, lbl, sm, cls) => `<th class="pf-ord ${cls || ''} ${oAct === k ? 'on' : ''}" data-ord="${k}" title="Clic para ordenar por ${ORDEN[k].t}" aria-sort="${oAct === k ? (R.dir === 1 ? 'ascending' : 'descending') : 'none'}">${lbl}<i>${oAct === k ? (R.dir === 1 ? '▴' : '▾') : ''}</i>${sm ? `<small>${sm}</small>` : ''}</th>`;
    const ec = App.estadoCol();
    const nAl = rows.filter(r => r.al.length).length, total = rows.reduce((a, r) => a + r.valor, 0);
    const chips = [
      R.okr != null ? `<button class="pf-chip" data-quitar="okr">OKR, ${esc(R.okr || 'Sin OKR asignado')} ✕</button>` : '',
      R.cat ? `<button class="pf-chip" data-quitar="cat">${esc(App.catLabel(R.cat))} ✕</button>` : '',
    ].join('');
    const actPf = R.modo === 'mapa' ? 'mapa' : R.modo === 'riesgos' ? 'riesgos' : R.modo === 'cargar' ? 'cargar' : 'resumen';
    main.innerHTML = `${App.pfHead(actPf, `${App.zoomCtl()}${App.canEdit() ? '<a class="btn ghost sm" href="#/papelera" title="Lo eliminado en los últimos 30 días">Papelera</a>' : ''}<button class="btn ghost sm" data-pf="csv">Exportar a Excel</button>${App.canEdit() ? '<button class="btn primary sm" data-pf="nuevo">+ Nueva iniciativa</button>' : ''}`)}
      <div class="kl pf-kl"><span><b>${rows.length}</b>iniciativas</span><span title="Iniciativas en Fase 1, Fase 2 y Fase 3">${[1, 2, 3].map(k => `<b>${rows.filter(r => window.Fases && Fases.clasificar(r.x.estado) === k).length}</b>F${k}`).join(', ')}</span><span><b class="${nAl ? 'r' : ''}">${nAl}</b>con alertas</span><span><b>${rows.filter(sinDatos).length}</b>sin datos</span><span><b>${esc(m(total))}</b>valor proyectado, ${rows.filter(r => r.valor > 0).length} de ${rows.length} con cifras</span></div>
      <div class="pf-bar"><label class="search"><span>⌕</span><input id="pfq" placeholder="Buscar iniciativa u OKR…" value="${esc(R.q)}"></label>${chips}
        ${ec ? `<select class="pf-sel" data-pf-okr aria-label="OKR"><option value="">OKR: todos</option>${[...new Set(rows.flatMap(r => r.okrs))].sort((a, b) => a.localeCompare(b)).map(o => `<option value="${esc(o)}" ${R.okr === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}<option value="__sin" ${R.okr === '' ? 'selected' : ''}>Sin OKR asignado</option></select>
        <select class="pf-sel" data-pf-cat aria-label="Tipo de valor"><option value="">Tipo de valor: todos</option>${ORDEN_CAT.filter(k => rows.some(r => r.cats.includes(k))).map(k => `<option value="${k}" ${R.cat === k ? 'selected' : ''}>${esc(App.catLabel(k))}</option>`).join('')}</select>
        <select class="pf-sel" data-pf-etapa aria-label="Fase"><option value="">Fase: todas</option>${(ec.options || []).map(o => `<option ${R.etapa === o.name ? 'selected' : ''}>${esc(o.name)}</option>`).join('')}</select>` : ''}
        ${App.dgvHay() ? `<button class="pf-tg ${App.soloDgv() ? 'on' : ''}" data-pf="dgv" aria-pressed="${App.soloDgv()}" title="${App.soloDgv() ? `Se muestran solo las del foco DGV (las nuevas entran solas). ${fuera} archivadas están ocultas. Clic para verlas.` : 'Se muestran también las archivadas. Clic para ver solo el foco DGV.'}">${App.soloDgv() ? `Ver archivadas${fuera ? ` (${fuera})` : ''}` : 'Ocultar archivadas'}</button>` : ''}
        <button class="pf-tg ${R.alertas ? 'on' : ''}" data-pf="alertas" aria-pressed="${R.alertas}">Solo con alertas</button>
        <button class="pf-tg ${R.inact === true ? 'on' : ''}" data-pf="inact" aria-pressed="${R.inact === true}" title="${R.inact === true ? 'Ocultar' : 'Mostrar'} las pausadas, cerradas y canceladas (van al final)">${R.inact === true ? 'Con inactivas' : 'Sin inactivas'}</button>
        <button class="pf-tg" data-pf="cols" title="Mostrar, ocultar, ordenar o agregar columnas">Columnas</button>
        <button class="pf-tg ${R.graf ? 'on' : ''}" data-pf="graf" aria-pressed="${!!R.graf}" title="Minigráficas por OKR y por tipo de valor de lo que está filtrado">Gráficas</button>
        <select class="pf-sel" data-pf-grupo aria-label="Agrupar">${[['fase', 'Agrupar: por fase'], ...colsGrupo().map(c => ['col:' + c.id, 'Agrupar: por ' + c.name.toLowerCase()]), ['okr', 'Agrupar: por OKR'], ['tipo', 'Agrupar: por tipo de valor'], ['', 'Sin agrupar']].map(([k, l]) => `<option value="${k}" ${(R.grupo || '') === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
        <select class="pf-sel" data-pf-orden aria-label="Ordenar">${Object.entries(ORDEN).map(([k, o]) => `<option value="${k}" ${oAct === k ? 'selected' : ''}>Ordenar: ${o.t}${oAct === k ? (R.dir === 1 ? ' ▴' : ' ▾') : ''}</option>`).join('')}</select>
      </div>
      ${R.graf && R.modo !== 'riesgos' && R.modo !== 'cargar' ? lentes(rows) : ''}
      ${R.modo === 'cargar' ? cargaHTML(vis) : R.modo === 'riesgos' && App.Riesgos ? App.Riesgos.portafolioHTML(vis.map(r => r.p)) : R.modo === 'mapa' ? mapaHTML(vis) : `<section class="t-card pf-tbl-card"><div class="pf-wrap"><table class="pf-tbl">
        <thead><tr>${colsVis().map(k => ({ nombre: th('nombre', 'Iniciativa'), fase: '<th>Fase</th>', habilitadores: '<th>Habilitadores</th>', realizadores: '<th>Realizadores</th>', okr: th('okr', 'OKR'), tipo: th('tipo', 'Tipo de valor'), ice: th('ice', 'ICE', '', 'n'), avance: th('avance', 'Avance', 'real, ┃ esperado'), fin: th('fin', 'Cronograma', `${+d.hoy.slice(0, 4)} – ${+d.hoy.slice(0, 4) + 1}`), valor: th('valor', 'Valor a 2 años', 'caso de negocio'), alertas: th('alertas', 'Alertas') })[k] || `<th>${esc(nombreCol(k))}</th>`).join('')}<th aria-hidden="true"></th></tr></thead>
        <tbody>${cuerpo(vis)}${(ejV => ejV.length ? `<tr class="pf-grp pf-grp-ej"><td colspan="${colsVis().length + 1}"><b>Ejemplo</b><small>no suma en los totales ni en el tablero</small></td></tr>${ejV.map(filaHTML).join('')}` : '')(ejs.filter(r => pasaFiltros(r)))}${cuerpo(vis) ? '' : `<tr><td colspan="${colsVis().length + 1}"><div class="t-vacio">${rows.length ? 'Ninguna iniciativa cumple estos filtros.' : fuera ? `Ninguna iniciativa está en el foco DGV. <button class="t-lnk" data-pf="dgv">Ver las ${fuera} iniciativas</button>` : 'Aún no hay iniciativas.'}</div></td></tr>`}</tbody></table></div>
        <div class="t-pie t-pie-row"><span class="t-tag">${vis.length} de ${rows.length} iniciativas, ordenadas por ${ORDEN[oAct].t}${R.okr != null ? `, OKR «${esc(R.okr || 'sin asignar')}»` : ''}${fuera ? `, <button class="t-lnk" data-pf="dgv">${fuera} archivadas ocultas (fuera del foco DGV)</button>` : ''}</span><span class="t-tag">Clic en un encabezado ordena, clic en un grupo lo pliega</span></div></section>`}`;
    const svg = $('#pfMapa', main); if (svg) dibujarMapa(svg, vis);
    const q = $('#pfq', main);
    q.oninput = () => { R.q = q.value; const pos = q.selectionStart; render(main); const n = $('#pfq', main); n.focus(); n.setSelectionRange(pos, pos); };
    // Arrastrar el encabezado de una columna la cambia de lugar, para todos
    const ths = [...main.querySelectorAll('.pf-tbl:not(.dc-t) thead th')];
    colsVis().forEach((k, i) => { const t = ths[i]; if (!t) return; t.dataset.pfcol = k; if (App.canEdit() && k !== 'nombre') { t.draggable = true; t.title = (t.title ? t.title + '. ' : '') + 'Arrastre para cambiar la columna de lugar'; } });
    let arr = null; const limpia = () => main.querySelectorAll('th.col-ant,th.col-des,th.col-drag').forEach(x => x.classList.remove('col-ant', 'col-des', 'col-drag'));
    main.ondragstart = e => { const t = e.target.closest && e.target.closest('th[data-pfcol]'); if (!t || !t.draggable) return; arr = t.dataset.pfcol; t.classList.add('col-drag'); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', arr); } catch (x) { /* */ } };
    main.ondragend = () => { arr = null; limpia(); };
    main.ondragover = e => { if (!arr) return; const t = e.target.closest('th[data-pfcol]'); if (!t || t.dataset.pfcol === 'nombre') return; e.preventDefault(); const r = t.getBoundingClientRect(); main.querySelectorAll('th.col-ant,th.col-des').forEach(x => x.classList.remove('col-ant', 'col-des')); if (t.dataset.pfcol !== arr) t.classList.add(e.clientX < r.left + r.width / 2 ? 'col-ant' : 'col-des'); };
    main.ondrop = e => { if (!arr) return; const t = e.target.closest('th[data-pfcol]'); const de = arr; arr = null; limpia(); if (!t || t.dataset.pfcol === de || t.dataset.pfcol === 'nombre') return; e.preventDefault();
      const v = colsVis().filter(k => k !== de), r = t.getBoundingClientRect(), j = v.indexOf(t.dataset.pfcol); v.splice(e.clientX < r.left + r.width / 2 ? j : j + 1, 0, de); guardarVista(v); App.toast('Orden de columnas guardado para todos'); render(main); };
    main.onclick = e => {
      const pe = e.target.closest('[data-pedit]'); if (pe) { e.stopPropagation(); if (App.canEdit()) App.Tabla.openEditor(pe, pe.dataset.pedit, pe.dataset.col); return; }
      const fe = e.target.closest('[data-fase-ed]'); if (fe) { e.stopPropagation(); if (App.canEdit() && App.estadoCol()) App.Tabla.openEditor(fe, fe.dataset.faseEd, App.estadoCol().id); return; }
      if (e.target.closest('.burger')) return App.toggleSide();
      const ok = e.target.closest('[data-okrs]');
      if (ok) { const p = App.byId('projects', ok.dataset.okrs), l = App.okrsDe(p);
        const pp = App.openPop(ok, `<div class="lbl">OKR de ${esc(App.projectName(p))}</div><ul class="okr-lista">${l.map(o => `<li><span>${esc(o)}</span><button class="t-lnk" data-okr-ver="${esc(o)}">Ver las iniciativas con este OKR</button></li>`).join('')}</ul>`, { width: 300, nofocus: true });
        pp.onclick = ev => { const b = ev.target.closest('[data-okr-ver]'); if (!b) return; App.closePop(true); R.okr = b.dataset.okrVer; guardar(); render(main); };
        return; }
      const o = e.target.closest('[data-okr]'); if (o) { R.okr = R.okr === o.dataset.okr ? null : o.dataset.okr; guardar(); return render(main); }
      const c = e.target.closest('[data-cat]'); if (c) { R.cat = R.cat === c.dataset.cat ? '' : c.dataset.cat; guardar(); return render(main); }
      const qq = e.target.closest('[data-quitar]'); if (qq) { if (qq.dataset.quitar === 'okr') R.okr = null; else R[qq.dataset.quitar] = ''; guardar(); return render(main); }
      const md = e.target.closest('[data-modo]'); if (md) { R.modo = md.dataset.modo; guardar(); return render(main); }
      const v = e.target.closest('[data-vista-pf]'); if (v) return App.Tabla.setView(v.dataset.vistaPf);
      const or = e.target.closest('[data-ord]'); if (or) { const k = or.dataset.ord; if (R.orden === k) R.dir = R.dir === 1 ? -1 : 1; else { R.orden = k; R.dir = ORDEN[k].dir; } guardar(); return render(main); }
      const ir = e.target.closest('[data-rk-ir]'); if (ir) return App.go('#/proyectos/' + ir.dataset.rkIr + '/riesgos');
      const fila = e.target.closest('.pf-tbl tbody tr[data-pid]'); if (fila && !e.target.closest('a,button,select,input')) return App.go('#/proyectos/' + fila.dataset.pid);
      const gr = e.target.closest('[data-grp]'); if (gr && !e.target.closest('a,button')) { R.cerr = Object.assign({}, R.cerr); if (R.cerr[gr.dataset.grp]) delete R.cerr[gr.dataset.grp]; else R.cerr[gr.dataset.grp] = true; guardar(); return render(main); }
      const b = e.target.closest('[data-pf]'); if (!b) return;
      if (b.dataset.pf === 'inact') { R.inact = R.inact !== true; guardar(); return render(main); }
      if (b.dataset.pf === 'cols') return panelColumnas(b, main);
      if (b.dataset.pf === 'graf') { R.graf = !R.graf; guardar(); return render(main); }
      if (b.dataset.pf === 'dgv') { App.store.set('alcance.dgv', App.soloDgv() ? 'todas' : 'si'); return render(main); }
      if (b.dataset.pf === 'dir') { R.dir = R.dir === 1 ? -1 : 1; guardar(); return render(main); }
      if (b.dataset.pf === 'alertas') { R.alertas = !R.alertas; guardar(); return render(main); }
      if (b.dataset.pf === 'csv') return csv(vis);
      if (b.dataset.pf === 'nuevo') App.guard(async () => { const c = App.dgvCol(), si = c && App.soloDgv() ? ((c.options || []).find(o => /^s[ií]$/i.test(o.name)) || { name: 'SI' }).name : null; const p = await App.create('projects', { props: si ? { [c.id]: si } : {} }); App.go('#/proyectos/' + p.id); });
    };
    main.onchange = e => {
      if (e.target.hasAttribute('data-pf-etapa')) { R.etapa = e.target.value; guardar(); render(main); }
      if (e.target.hasAttribute('data-pf-okr')) { const v = e.target.value; R.okr = v === '' ? null : v === '__sin' ? '' : v; guardar(); render(main); }
      if (e.target.hasAttribute('data-pf-cat')) { R.cat = e.target.value; guardar(); render(main); }
      if (e.target.hasAttribute('data-pf-grupo')) { R.grupo = e.target.value; guardar(); render(main); }
      if (e.target.hasAttribute('data-pf-orden')) { R.orden = e.target.value; R.dir = ORDEN[R.orden].dir; guardar(); render(main); }
    };
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
      <div class="t-pie"><span class="t-tag">${con} iniciativa${con === 1 ? '' : 's'} en el mapa${sin ? `, ${sin} sin ICE no aparecen (complétalo en su ficha)` : ''}</span><span class="t-tag">Clic en un punto abre la iniciativa, pasa el mouse para ver su ICE</span></div></section>`;
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
    h += `<text x="${(L + W - R2) / 2}" y="${H - 6}" text-anchor="middle" class="t-ax on">Income, valor a dos años (escala 1 a 55)</text><text transform="translate(14 ${(T + H - B) / 2}) rotate(-90)" text-anchor="middle" class="t-ax on">ICE</text>`;
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
    const lines = [head.map(cell).join(';'), ...vis.map(r => [App.projectName(r.p), r.x.estado, r.okrs.join(', '), r.cats.map(App.catLabel).join(', '), r.x.ice ?? '', r.pl.acts.length ? r.pl.avance : '', r.esp ?? '', r.pl.ini || '', r.pl.fin || '', Math.round(dosAnios(r)) || '', Math.round(r.valor) || '', r.x.caso ? r.x.caso.estado || 'Borrador' : '', r.f && r.f.vpn != null ? Math.round(r.f.vpn) : '', r.f && r.f.tir != null ? Math.round(r.f.tir * 1000) / 10 : '', r.al.length ? r.al.map(o => o.txt).join(', ') : sinDatos(r) ? 'Sin datos' : ''].map(cell).join(';'))];
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `portafolio-${App.d.today()}.csv`; a.click(); URL.revokeObjectURL(a.href);
  }

  // Para el Tablero: el mismo resumen por OKR y por tipo de valor; el clic lleva al Portafolio con ese filtro
  const lentesTablero = () => { const { rows } = filas(); return lentes(rows.filter(r => App.enAlcance(r.p) && !App.esEjemplo(r.p)), true); };
  const filtrar = f => { R.okr = f.okr != null ? f.okr : null; R.cat = f.cat || ''; R.etapa = ''; R.q = ''; R.alertas = false; R.modo = 'tabla'; R.graf = true; guardar(); App.go('#/proyectos'); };
  // Qué información real tiene y qué le falta a cada iniciativa, por fase (lo que se exige crece con la fase)
  const lleno = v => !(v == null || v === '' || (Array.isArray(v) && !v.length));
  const CHECKS = [
    ['resp', 'Responsables', 1, p => lleno((p.props || {}).habilitadores) || lleno((p.props || {}).realizadores), 'info'],
    ['frase', 'Qué es', 1, p => lleno(p.frase), 'info'],
    ['okr', 'OKR', 1, p => App.okrsDe(p).length > 0, 'valor'],
    ['ice', 'ICE', 1, p => ['ice_income', 'ice_confianza', 'ice_esfuerzo'].every(k => lleno((p.props || {})[k])), 'info'],
    ['caso', 'Caso de negocio', 1, p => { const c = App.caseOf(p.id); return !!(c && c.origen !== 'ice' && (c.flujos || []).some(f => f.tipo === 'beneficio' && (f.valores || []).some(Number))); }, 'caso'],
    ['crono', 'Cronograma', 1, p => App.planOf(p.id).acts.length > 0, 'cronograma'],
    ['riesgos', 'Riesgos', 2, p => (App.Riesgos ? App.Riesgos.lista(p) : []).length > 0, 'riesgos'],
    ['captura', 'Captura de valor', 2, p => { const c = App.caseOf(p.id); return !!(c && (c.captado || []).length); }, 'valor'],
    ['verif', 'Verificado', 3, p => { const c = App.caseOf(p.id); return !!(c && Object.keys(c.validacion || {}).length); }, 'valor'],
  ];
  function cargaHTML(vis) {
    const faseDe = r => (window.Fases ? Fases.clasificar(r.x.estado) : null);
    const grupos = [1, 2, 3].map(k => ({ k, rows: vis.filter(r => faseDe(r) === k && !App.esEjemplo(r.p)) })).filter(g => g.rows.length);
    const sinF = vis.filter(r => ![1, 2, 3].includes(faseDe(r)) && !inactiva(r) && !App.esEjemplo(r.p));
    if (sinF.length) grupos.push({ k: 0, rows: sinF });
    const aplica = (c, k) => c[2] <= Math.max(1, k);
    const fila = (r, k) => { const cs = CHECKS.filter(c => aplica(c, k)), ok = cs.filter(c => c[3](r.p)).length, pc = Math.round(ok / cs.length * 100);
      return { r, pc, html: `<tr><td class="pf-nm"><a href="#/proyectos/${r.p.id}"><b>${esc(App.projectName(r.p))}</b></a></td><td class="n"><b>${pc} %</b></td>${CHECKS.map(c => !aplica(c, k) ? '<td class="dc-na" title="No se exige en esta fase">·</td>' : c[3](r.p) ? `<td class="dc-ok" title="${esc(c[1])}: cargado"><i class="ico ico-ok"></i></td>` : `<td class="dc-no"><a href="#/proyectos/${r.p.id}/${c[4]}" title="Falta: ${esc(c[1])}. Clic para cargarlo">falta</a></td>`).join('')}</tr>` }; };
    const total = grupos.reduce((a, g) => a + g.rows.reduce((q, r) => q + CHECKS.filter(c => aplica(c, g.k) && !c[3](r.p)).length, 0), 0);
    return `<section class="dc"><p class="dc-int">Lo que se exige crece con la fase: en Fase 1 lo básico (responsables, qué es, OKR, ICE, caso y cronograma); en Fase 2 además riesgos y captura de valor; en Fase 3 además lo verificado por Finanzas. Faltan <b>${total}</b> datos en total. Clic en «falta» para ir directo a cargarlo.</p>
      ${grupos.map(g => { const fs = g.rows.map(r => fila(r, g.k)).sort((a, b) => a.pc - b.pc); const prom = Math.round(fs.reduce((a, x) => a + x.pc, 0) / fs.length);
        return `<h3 class="dc-h">${g.k ? `<span class="pill cl-${['', 'azul', 'naranja', 'verde'][g.k]}">Fase ${g.k}</span> ${esc((Fases.deId(g.k) || {}).nombre ? Fases.deId(g.k).nombre.split(' · ')[1] : '')}` : 'Sin fase asignada'}<small>${fs.length} ${fs.length === 1 ? 'iniciativa' : 'iniciativas'}, ${prom} % de la información cargada</small></h3>
          <div class="pf-wrap"><table class="pf-tbl dc-t"><thead><tr><th>Iniciativa</th><th class="n">Completo</th>${CHECKS.map(c => `<th>${esc(c[1])}</th>`).join('')}</tr></thead><tbody>${fs.map(x => x.html).join('')}</tbody></table></div>`; }).join('')}</section>`;
  }
  const setModo = v => { R.modo = v; guardar(); };
  App.Portafolio = { render, lentesTablero, filtrar, filtrarFase, setModo };
})();
