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

  // Buscar: cualquier dato de la iniciativa (nombre, personas, fase, OKR, tipo de valor, descripción…), sin tildes ni mayúsculas;
  // con varias palabras, deben estar todas
  const sinT = x => String(x == null ? '' : x).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  function coincide(r) {
    const q = sinT(R.q).trim(); if (!q) return true;
    const p = r.p, txt = sinT([App.projectName(p), p.frase, p.area, ...(r.okrs || []), ...Object.values(p.props || {}).map(v => (Array.isArray(v) ? v.join(' ') : typeof v === 'object' ? '' : v)), ...(p.miembros || []).map(m => m.nombre)].join(' '));
    // con números o palabras muy cortas («fase 2») se busca la frase tal cual; si no, todas las palabras en cualquier orden
    const ws = q.split(/\s+/);
    return txt.includes(q) || (!ws.some(w => w.length < 3 || /^\d+$/.test(w)) && ws.every(w => txt.includes(w)));
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
    && coincide(r);

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
    valor10: { t: 'valor a 10 años', v: r => r.valor || null, dir: -1 },
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
  const diasSinCambio = p => { const c = App.caseOf(p.id), u = [p.updated_at || p.created_at || '', c ? c.updated_at || '' : '', ...App.actsOf(p.id).map(x => x.updated_at || '')].sort().pop(); return u ? Math.round((Date.now() - new Date(u)) / 864e5) : 0; };
  function filaHTML(r) {
    const ec = App.estadoCol(), est = r.x.estado, ice = r.x.ice;
    const okr = r.okrs.length ? `<span class="pf-okrs" title="${esc(r.okrs.join('\n'))}"><span class="t">${esc(r.okrs[0])}</span>${r.okrs.length > 1 ? `<em>+${r.okrs.length - 1}</em>` : ''}</span>` : '<span class="faint">—</span>';
    // Las columnas que son datos se editan aquí mismo; las calculadas solo se muestran
    const edA = id => { const c = id === 'estado' ? App.estadoCol() : App.S.columns.find(x => x.id === id); return c && App.canEdit() ? ` class="pf-ed" data-pedit="${r.p.id}" data-col="${c.id}" title="Clic para editar"` : ''; };
    const todos = esc(r.cats.map(App.catLabel).join(', '));
    const tipos = r.cats.length ? `<span class="pf-tv" style="--c:var(--cat-${r.cats[0]})" title="${todos}">${esc(App.catLabel(r.cats[0]))}</span>${r.cats.length > 1 ? `<span class="pf-mas2" title="${todos}">+${r.cats.length - 1}</span>` : ''}` : '<span class="faint">—</span>';
    const av = r.pl.acts.length ? `<span class="pf-av"><span class="t"><i style="width:${r.pl.avance}%"></i>${r.esp != null ? `<u style="left:${r.esp}%" title="Esperado a hoy: ${r.esp} %"></u>` : ''}</span><b>${r.pl.avance} %</b></span>` : '<span class="faint">—</span>';
    const v2 = dosAnios(r);
    const caso = r.x.caso ? `<span class="pf-caso" title="Valor a dos años: beneficios de los dos primeros años del caso${r.valor ? `, total del caso ${esc(m(r.valor))}` : ''}${r.f && r.f.vpn != null && r.f.totalInversion ? `, VPN ${esc(m(r.f.vpn))}` : ''}"><b>${v2 ? esc(m(v2)) : r.valor ? esc(m(r.valor)) : '—'}</b><span class="pill pf-est cl-${App.Caso.estadoColor(r.x.caso.estado)}">${esc(r.x.caso.estado || 'Borrador')}</span> <span class="pf-go">↗</span></span>`
      : r.valor ? `<span class="pf-caso"><b>${esc(m(r.valor))}</b><small class="pf-inc" title="Sin caso de negocio: valor del Income"> Income</small></span>` : '<span class="faint">Sin caso</span>';
    const al = r.al[0];
    const C = {
      nombre: `<td class="pf-nm"><a href="#/proyectos/${r.p.id}"><b>${esc(App.projectName(r.p))}</b></a>${App.tagEjemplo(r.p)}${(() => { const dd = diasSinCambio(r.p); return dd > 30 && !inactiva(r) ? `<small class="pf-viejo" title="Última edición del avance, el caso o la captura">sin cambios hace ${dd} días</small>` : ''; })()}</td>`,
      fase: `<td class="pf-fase-c">${ec ? `<button class="pf-fase" data-fase-ed="${r.p.id}" ${App.canEdit() ? '' : 'disabled'} title="${esc(est || 'Sin fase')}${App.canEdit() ? ', clic para cambiarla' : ''}"><span class="pill cl-${App.optColor(ec, est) || 'gris'}">${esc(est ? est.replace(/\s*·.*$/, '') : 'Sin fase')}</span></button>` : ''}</td>`,
      habilitadores: `${['habilitadores'].map(k => { const c = App.S.columns.find(x => x.id === k); const v = (r.p.props || {})[k]; return `<td class="pf-per-c ${c && App.canEdit() ? 'pf-ed' : ''}" ${c && App.canEdit() ? `data-pedit="${r.p.id}" data-col="${c.id}" title="Clic para editar"` : ''}>${c && v && (!Array.isArray(v) || v.length) ? App.Tabla.renderValue(c, v) : '<span class="faint">—</span>'}</td>`; }).join('')}`,
      realizadores: `${['realizadores'].map(k => { const c = App.S.columns.find(x => x.id === k); const v = (r.p.props || {})[k]; return `<td class="pf-per-c ${c && App.canEdit() ? 'pf-ed' : ''}" ${c && App.canEdit() ? `data-pedit="${r.p.id}" data-col="${c.id}" title="Clic para editar"` : ''}>${c && v && (!Array.isArray(v) || v.length) ? App.Tabla.renderValue(c, v) : '<span class="faint">—</span>'}</td>`; }).join('')}`,
      okr: `<td${edA('okrs')}>${okr}</td>`, tipo: `<td${edA('tipo_valor')}><div class="pf-tvs">${tipos}</div></td>`,
      ice: `<td class="n ${App.canEdit() ? 'pf-ed' : ''}" ${App.canEdit() ? `data-ice-ed="${r.p.id}" title="Clic para editar el ICE (Income, confianza, esfuerzo)"` : ''}>${ice == null ? '<span class="faint">—</span>' : `<b>${esc(App.num(ice, 1))}</b>`}</td>`,
      avance: `<td class="pf-calc" title="Se calcula del cronograma">${av}</td>`,
      fin: `<td class="pf-calc" title="Se calcula del cronograma"><span class="pf-crono">${mini(r)}</span></td>`,
      valor: `<td class="pf-calc" title="Se calcula del caso de negocio (o del Income si no hay caso)">${caso}</td>`,
      valor10: `<td class="n">${r.x.caso && r.valor ? `<span class="pf-v10" title="Total de beneficios del caso, todos sus años">${esc(m(r.valor))}</span>` : '<span class="faint">—</span>'}</td>`,
      alertas: `<td class="pf-calc">${al ? `<span class="pf-al ${al.sev >= 3 ? 'crit' : 'warn'}" title="${esc(r.al.map(o => '• ' + o.txt).join('\n'))}">${al.sev >= 3 ? '●' : '▲'} ${esc(cortoAlerta(al.txt))}${r.al.length > 1 ? ` <em>+${r.al.length - 1}</em>` : ''}</span>` : (() => { const av = App.Avance && App.Avance.de(r.p); return av && av.listo ? `<span class="pf-listo" title="Cumple los criterios: confirme el cambio de fase en su ficha">Lista para ${esc(av.sig.corto)}</span>` : inactiva(r) ? '<span class="faint">—</span>' : sinDatos(r) ? '<span class="pf-sd" title="No tiene cronograma ni caso de negocio: no hay con qué medir si va bien">Sin datos</span>' : `<span class="pf-ok" title="Sin alertas en lo que tiene cargado">✓ Al día</span>${!r.x.caso ? '<small class="pf-falta">falta el caso</small>' : !r.pl.acts.length ? '<small class="pf-falta">falta el cronograma</small>' : ''}`; })()}</td>`,
    };
    return `<tr data-pid="${r.p.id}" class="${inactiva(r) ? 'pf-inact' : ''}">${colsVis().map(k => C[k] != null ? C[k] : celdaProp(k, r)).join('')}</tr>`;
  }
  const corto = e => { const f = window.Fases && Fases.de(e); if (f) return f.corto; const mm = /^(L\d)\b/i.exec(e); return mm ? mm[1].toUpperCase() : e; };
  const cortoAlerta = t => t.replace(/ en el cronograma$/, '').replace(/^(\d+) actividad(?:es)? atrasadas?$/, (_, n) => n + (n === '1' ? ' atrasada' : ' atrasadas')).replace(/^1 compromiso de comité vencido$/, 'Compromiso vencido').replace(/^Captura (rezagada|por debajo): (\d+)%.*/, 'Captura al $2 %').replace(/^Termina (\d+) días? hábil(es)? después de la fecha meta$/, 'Meta +$1 días').replace(/ de comité vencidos?$/, ' vencido').replace(/^(\d+) actividad(es)? de la ruta crítica en riesgo$/, 'Ruta crítica en riesgo');
  const COLS_PER = ['habilitadores', 'realizadores'];
  // Columnas del Resumen. Las «p:<id>» son columnas del portafolio (atributos de la iniciativa): se editan en la celda.
  const BASE = [['nombre', 'Iniciativa'], ['fase', 'Fase'], ['habilitadores', 'Habilitadores'], ['realizadores', 'Realizadores'], ['okr', 'OKR'], ['tipo', 'Tipo de valor'], ['ice', 'ICE'], ['avance', 'Avance'], ['fin', 'Cronograma'], ['valor', 'Valor a 2 años'], ['valor10', 'Valor a 10 años'], ['alertas', 'Alertas']];
  const POR_DEFECTO = BASE.map(b => b[0]);
  const colsVis = () => { const v = App.S.vistaPf && Array.isArray(App.S.vistaPf.cols) ? App.S.vistaPf.cols : POR_DEFECTO;
    // Una columna nueva del sitio entra sola después de su vecina, salvo que la vista guardada ya la conociera
    const conoc = App.S.vistaPf && Array.isArray(App.S.vistaPf.conocidas) ? App.S.vistaPf.conocidas : ['nombre', 'fase', 'habilitadores', 'realizadores', 'okr', 'tipo', 'ice', 'avance', 'fin', 'valor', 'alertas'];
    let v2 = v.slice(); BASE.forEach((b, i) => { if (!conoc.includes(b[0]) && !v2.includes(b[0])) { const ant = BASE[i - 1] && v2.indexOf(BASE[i - 1][0]); v2.splice(ant >= 0 ? ant + 1 : v2.length, 0, b[0]); } });
    const ok = v2.filter(k => BASE.some(b => b[0] === k) || (k.startsWith('p:') && App.S.columns.some(c => c.id === k.slice(2))));
    return ok.includes('nombre') ? ok : ['nombre'].concat(ok); };
  const nombreCol = k => { const b = BASE.find(x => x[0] === k); if (b) return b[1]; const c = App.S.columns.find(x => 'p:' + x.id === k); return c ? c.name : k; };
  function celdaProp(k, r) {
    const c = App.S.columns.find(x => 'p:' + x.id === k); if (!c) return '<td></td>';
    const v = (r.p.props || {})[c.id], vacio = v == null || v === '' || (Array.isArray(v) && !v.length);
    return `<td class="pf-prop ${App.canEdit() ? 'ed' : ''}" data-pedit="${r.p.id}" data-col="${c.id}" title="${App.canEdit() ? 'Clic para editar' : ''}">${vacio ? '<span class="faint">—</span>' : App.Tabla.renderValue(c, v)}</td>`;
  }
  const guardarVista = cols => { const conocidas = BASE.map(b => b[0]); App.S.vistaPf = { cols, conocidas }; App.api('PUT', '/api/config/vista-portafolio', { cols, conocidas }).then(v => { App.S.vistaPf = v; }).catch(e => App.toast(e.message || 'No se pudo guardar', true)); };
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
    main.innerHTML = `${App.pfHead(actPf, `${App.zoomCtl()}${App.canEdit() ? '<a class="btn ghost sm" href="#/papelera" title="Lo eliminado en los últimos 30 días">Papelera</a>' : ''}<button class="btn ghost sm" data-pf="pdf" title="La tabla tal como se ve, en PDF">PDF</button><button class="btn ghost sm" data-pf="csv">Exportar a Excel</button>${App.canEdit() ? '<button class="btn primary sm" data-pf="nuevo">+ Nueva iniciativa</button>' : ''}`)}
      <div class="kl pf-kl"><span><b>${rows.length}</b>iniciativas</span><span title="Iniciativas en Fase 1, Fase 2 y Fase 3">${[1, 2, 3].map(k => `<b>${rows.filter(r => window.Fases && Fases.clasificar(r.x.estado) === k).length}</b>F${k}`).join(', ')}</span><span><b class="${nAl ? 'r' : ''}">${nAl}</b>con alertas</span><span><b>${rows.filter(sinDatos).length}</b>sin datos</span><span><b>${esc(m(total))}</b>valor proyectado, ${rows.filter(r => r.valor > 0).length} de ${rows.length} con cifras</span></div>
      <div class="pf-bar ${R.masf ? 'abierta' : ''}"><label class="search"><span>⌕</span><input id="pfq" type="search" placeholder="Buscar por nombre, persona, fase, OKR o cualquier dato…" aria-label="Buscar en el portafolio" value="${esc(R.q)}"></label>${chips}<button class="pf-tg pf-masf ${[R.okr, R.cat, R.alertas, R.inact === true].filter(Boolean).length ? 'on' : ''}" data-pf="masf" aria-expanded="${!!R.masf}">Filtros${[R.okr, R.cat, R.alertas, R.inact === true].filter(Boolean).length ? ` (${[R.okr, R.cat, R.alertas, R.inact === true].filter(Boolean).length})` : ''} ▾</button>
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
      ${R.modo === 'cargar' ? viejasHTML() + cargaHTML(vis) : R.modo === 'riesgos' && App.Riesgos ? App.Riesgos.portafolioHTML(vis.map(r => r.p)) : R.modo === 'mapa' ? mapaHTML(visMapa(vis)) : `<section class="t-card pf-tbl-card"><div class="pf-wrap"><table class="pf-tbl">
        <thead><tr>${colsVis().map(k => ({ nombre: th('nombre', 'Iniciativa'), fase: '<th>Fase</th>', habilitadores: '<th>Habilitadores</th>', realizadores: '<th>Realizadores</th>', okr: th('okr', 'OKR'), tipo: th('tipo', 'Tipo de valor'), ice: th('ice', 'ICE', '', 'n'), avance: th('avance', 'Avance', 'real, ┃ esperado'), fin: th('fin', 'Cronograma', `${+d.hoy.slice(0, 4)} – ${+d.hoy.slice(0, 4) + 1}`), valor: th('valor', 'Valor a 2 años', 'caso de negocio'), valor10: th('valor10', 'Valor a 10 años', '', 'n'), alertas: th('alertas', 'Alertas') })[k] || `<th>${esc(nombreCol(k))}</th>`).join('')}</tr></thead>
        <tbody>${cuerpo(vis)}${(ejV => ejV.length ? `<tr class="pf-grp pf-grp-ej"><td colspan="${colsVis().length + 1}"><b>Ejemplo</b><small>no suma en los totales ni en el tablero</small></td></tr>${ejV.map(filaHTML).join('')}` : '')(ejs.filter(r => pasaFiltros(r)))}${cuerpo(vis) ? '' : `<tr><td colspan="${colsVis().length + 1}"><div class="t-vacio">${rows.length ? 'Ninguna iniciativa cumple estos filtros.' : fuera ? `Ninguna iniciativa está en el foco DGV. <button class="t-lnk" data-pf="dgv">Ver las ${fuera} iniciativas</button>` : 'Aún no hay iniciativas.'}</div></td></tr>`}${App.canEdit() ? `<tr class="pf-add"><td colspan="${colsVis().length + 1}"><input data-pf-nueva placeholder="+ Nueva iniciativa: escriba el nombre y presione Enter" aria-label="Nueva iniciativa"></td></tr>` : ''}</tbody></table></div>
        <div class="t-pie t-pie-row"><span class="t-tag">${vis.length} de ${rows.length} iniciativas, ordenadas por ${ORDEN[oAct].t}${R.okr != null ? `, OKR «${esc(R.okr || 'sin asignar')}»` : ''}${fuera ? `, <button class="t-lnk" data-pf="dgv">${fuera} archivadas ocultas (fuera del foco DGV)</button>` : ''}</span><span class="t-tag">Clic en un encabezado ordena, clic en un grupo lo pliega</span></div></section>`}`;
    const svg = $('#pfMapa', main); if (svg) dibujarMapa(svg, visMapa(vis), main);
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
      const ic = e.target.closest('[data-ice-ed]'); if (ic) { e.stopPropagation(); const pp = App.byId('projects', ic.dataset.iceEd); if (pp && App.canEdit() && App.Proyecto.iceEditor) App.Proyecto.iceEditor(ic, pp); return; }
      // la fila ya no abre la iniciativa: solo el nombre (es un enlace); lo demás se edita en la celda
      const gr = e.target.closest('[data-grp]'); if (gr && !e.target.closest('a,button')) { R.cerr = Object.assign({}, R.cerr); if (R.cerr[gr.dataset.grp]) delete R.cerr[gr.dataset.grp]; else R.cerr[gr.dataset.grp] = true; guardar(); return render(main); }
      const mf = e.target.closest('[data-mf]'); if (mf) { R.mapaF = mf.dataset.mf; guardar(); return render(main); }
      const b = e.target.closest('[data-pf]'); if (!b) return;
      if (b.dataset.pf === 'masf') { R.masf = !R.masf; guardar(); return render(main); }
      if (b.dataset.pf === 'inact') { R.inact = R.inact !== true; guardar(); return render(main); }
      if (b.dataset.pf === 'cols') return panelColumnas(b, main);
      if (b.dataset.pf === 'graf') { R.graf = !R.graf; guardar(); return render(main); }
      if (b.dataset.pf === 'dgv') { App.store.set('alcance.dgv', App.soloDgv() ? 'todas' : 'si'); return render(main); }
      if (b.dataset.pf === 'dir') { R.dir = R.dir === 1 ? -1 : 1; guardar(); return render(main); }
      if (b.dataset.pf === 'alertas') { R.alertas = !R.alertas; guardar(); return render(main); }
      if (b.dataset.pf === 'csv') return csv(vis);
      if (b.dataset.pf === 'pdf') return App.Exportar.pdfVista('Portafolio', `${vis.length} iniciativas${R.q ? ', búsqueda «' + R.q + '»' : ''}`, [main.querySelector('.pf-kl'), main.querySelector('.pf-tbl') || main.querySelector('.pf-mapa') || main.querySelector('.pf-rank')], 'portafolio');
      if (b.dataset.pf === 'nuevo') App.guard(async () => { const c = App.dgvCol(), si = c && App.soloDgv() ? ((c.options || []).find(o => /^s[ií]$/i.test(o.name)) || { name: 'SI' }).name : null; const p = await App.create('projects', { props: si ? { [c.id]: si } : {} }); App.go('#/proyectos/' + p.id); });
    };
    main.onkeydown = e => { const inp = e.target.closest && e.target.closest('[data-pf-nueva]'); if (!inp || e.key !== 'Enter') return; const nombre = inp.value.trim(); if (!nombre) return; inp.disabled = true;
      App.guard(async () => { const tc = App.titleCol(), c = App.dgvCol(), si = c && App.soloDgv() ? ((c.options || []).find(o => /^s[ií]$/i.test(o.name)) || { name: 'SI' }).name : null; await App.create('projects', { props: Object.assign({ [tc.id]: nombre }, si ? { [c.id]: si } : {}) }); App.toast(`«${nombre}» creada`); render(main); setTimeout(() => { const n = main.querySelector('[data-pf-nueva]'); if (n) n.focus(); }, 50); }); };
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
  // El mapa tiene su propio filtro por fase (además de los filtros del Portafolio)
  const visMapa = vis => (R.mapaF ? vis.filter(r => window.Fases && String(Fases.clasificar(r.x.estado)) === R.mapaF) : vis);
  const cortaTxt = (t, n) => (t.length > n ? t.slice(0, n - 1) + '…' : t);
  function mapaHTML(vis) {
    const pts = vis.map(r => ({ r, d: App.ICE.detalle(r.p) })).filter(z => z.d.ice != null && z.d.income != null).sort((a, b) => b.d.ice - a.d.ice);
    const sin = vis.length - pts.length, ec = App.estadoCol();
    const chip = (k, t) => `<button class="pf-tg ${(R.mapaF || '') === k ? 'on' : ''}" data-mf="${k}">${t}</button>`;
    return `<section class="t-card t-pad pf-mapa">
      <div class="pf-mh"><div class="pf-mf">${chip('', 'Todas')}${chip('1', 'Fase 1')}${chip('2', 'Fase 2')}${chip('3', 'Fase 3')}</div>
        <div class="t-lgd"><span><i style="background:#5B9BEA"></i>Fase 1</span><span><i style="background:#F08A5D"></i>Fase 2</span><span><i style="background:#3FC293"></i>Fase 3</span><span><i style="background:#B9B5C6"></i>Fuera del flujo</span><span>Un número dentro del punto: varias iniciativas en el mismo lugar</span></div></div>
      <div class="pf-mg"><svg id="pfMapa" class="t-viz" height="480" role="img" aria-label="Iniciativas por ICE e Income"></svg>
        <ol class="pf-rank" aria-label="Iniciativas por ICE, de mayor a menor"><li class="h"><span>Por ICE, de mayor a menor</span><b>ICE</b></li>${pts.map((z, k) => `<li data-pid="${z.r.p.id}"><a href="#/proyectos/${z.r.p.id}/valor/ice"><em>${k + 1}</em><span class="nm" title="${esc(App.projectName(z.r.p))}">${esc(App.projectName(z.r.p))}</span><i style="background:${colorFase(z.r.x.estado)}"></i><b>${esc(App.num(z.d.ice, 1))}</b></a></li>`).join('') || '<li class="faint">Ninguna con ICE en esta fase.</li>'}</ol></div>
      <div class="t-pie"><span class="t-tag">${pts.length} en el mapa${sin ? `, ${sin} sin ICE no aparecen` : ''}. Pase el mouse por un nombre de la lista para ubicarla en el mapa.</span></div></section>`;
  }
  function dibujarMapa(svg, vis, main) {
    const W = svg.clientWidth || 900, H = 480, L = 56, R2 = 16, T = 30, B = 46;
    const FIB = App.ICE.FIB, pts = vis.map(r => ({ r, d: App.ICE.detalle(r.p) })).filter(z => z.d.ice != null && z.d.income != null);
    const band = (W - L - R2) / FIB.length;
    const tk = (hi => { const raw = hi / 4, mag = Math.pow(10, Math.floor(Math.log10(raw || 1))), st = [1, 2, 2.5, 5, 10].map(k => k * mag).find(k => raw <= k) || 10 * mag; const o = []; for (let v = 0; v <= hi + st * 0.999; v += st) o.push(Math.round(v / st) * st); return o; })(Math.max(10, ...pts.map(z => z.d.ice)));
    const top = tk.at(-1), y = v => T + (1 - v / top) * (H - T - B);
    const xs = FIB.map((_, i) => L + band * i + band / 2);
    const ices = pts.map(z => z.d.ice).sort((a, b) => a - b), med = ices.length ? ices[Math.floor(ices.length / 2)] : top / 2;
    const xU = L + band * 2, yM = y(med);
    let h = '';
    // cuadrantes, con su nombre en minúscula y una frase de qué hacer
    const q = (x0, y0, x1, y1, fill, t1, t2, anchor, tx, ty) => `<rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" fill="${fill}"/><text x="${tx}" y="${ty}" text-anchor="${anchor}" class="pf-q">${t1}</text><text x="${tx}" y="${ty + 14}" text-anchor="${anchor}" class="pf-q2">${t2}</text>`;
    h += q(xU, T, W - R2, yM, 'rgba(63,194,147,.08)', 'Priorizar', 'mucho valor y alto ICE', 'end', W - R2 - 8, T + 16);
    h += q(L, T, xU, yM, 'rgba(91,155,234,.07)', 'Ganancia rápida', 'poco valor, fácil y seguro', 'start', L + 8, T + 16);
    h += q(xU, yM, W - R2, H - B, 'rgba(240,138,93,.07)', 'Replantear cómo', 'mucho valor, ICE bajo', 'end', W - R2 - 8, yM + 30);
    h += q(L, yM, xU, H - B, 'rgba(22,11,41,.035)', 'Cuestionar', 'poco valor y bajo ICE', 'start', L + 8, yM + 30);
    h += tk.map(v => `<line x1="${L}" x2="${W - R2}" y1="${y(v)}" y2="${y(v)}" class="t-grid"/><text x="${L - 8}" y="${y(v) + 4}" text-anchor="end" class="t-ax">${v}</text>`).join('');
    h += xs.map((x, i) => `<text x="${x}" y="${H - B + 16}" text-anchor="middle" class="t-ax">${FIB[i]}</text>`).join('');
    h += `<text x="${(L + W - R2) / 2}" y="${H - 6}" text-anchor="middle" class="t-ax on">Income, valor a dos años (escala 1 a 55)</text><text transform="translate(14 ${(T + H - B) / 2}) rotate(-90)" text-anchor="middle" class="t-ax on">ICE</text>`;
    h += `<line x1="${xU}" x2="${xU}" y1="${T}" y2="${H - B}" class="pf-umbral"/><text x="${xU + 6}" y="${T - 8}" class="pf-q2">umbral de la Oficina (Income 3)</text>`;
    h += `<line x1="${L}" x2="${W - R2}" y1="${yM}" y2="${yM}" class="pf-umbral"/><text x="${W - R2 - 4}" y="${yM - 5}" text-anchor="end" class="pf-q2">ICE mediano ${App.num(med, 1)}</text>`;
    // Las que caen en el mismo punto (igual Income e ICE) se juntan en una burbuja con su número
    const grupos = new Map(); pts.forEach(z => { const k = z.d.income + '|' + Math.round(z.d.ice * 10); if (!grupos.has(k)) grupos.set(k, []); grupos.get(k).push(z); });
    const gs = [...grupos.values()].map(l => ({ l, d: l[0].d, r: Math.min(18, 7 + (l.length - 1) * 2.5) }));
    // en la misma franja de Income se reparten a lo ancho para no taparse
    const porI = {}; gs.forEach(g => { (porI[g.d.income] = porI[g.d.income] || []).push(g); });
    Object.entries(porI).forEach(([inc, l]) => { const i = FIB.indexOf(+inc); l.sort((a, b) => a.d.ice - b.d.ice).forEach((g, k) => { const off = l.length > 1 ? (k / (l.length - 1) - 0.5) * Math.min(band * 0.7, l.length * 16) : 0; g.x = xs[i] + off; g.y = y(g.d.ice); }); });
    const fase = l => { const f = l.map(z => colorFase(z.r.x.estado)); return f.every(c => c === f[0]) ? f[0] : '#8E83A8'; };
    gs.forEach(g => { const nm = g.l.map(z => App.projectName(z.r.p)), tip = `${nm.map(esc).join('\n')}\nICE ${App.num(g.d.ice, 1)}, Income ${g.d.income}`;
      const pids = g.l.map(z => z.r.p.id).join(',');
      h += g.l.length === 1
        ? `<a href="#/proyectos/${g.l[0].r.p.id}/valor/ice"><circle data-pids="${pids}" cx="${g.x}" cy="${g.y}" r="${g.r}" fill="${fase(g.l)}" stroke="var(--card)" stroke-width="2"><title>${tip}</title></circle></a>`
        : `<g class="pf-bur" data-grupo="${pids}"><circle data-pids="${pids}" cx="${g.x}" cy="${g.y}" r="${g.r}" fill="${fase(g.l)}" stroke="var(--card)" stroke-width="2"><title>${tip}\nClic para ver cuáles</title></circle><text x="${g.x}" y="${g.y + 4}" text-anchor="middle" class="pf-n">${g.l.length}</text></g>`; });
    // Nombres: se ponen donde caben, sin taparse entre sí ni tapar puntos; el resto aparece al pasar el mouse
    // los rótulos de los cuadrantes y de las líneas también ocupan su lugar
    const rot = (tx, ty, an, t1, t2) => { const w = Math.max(t1.length * 7, t2.length * 5.8); const x0 = an === 'start' ? tx : an === 'end' ? tx - w : tx - w / 2; return [x0 - 2, ty - 13, x0 + w + 2, ty + 18]; };
    const fijos = [rot(W - R2 - 8, T + 16, 'end', 'Priorizar', 'mucho valor y alto ICE'), rot(L + 8, T + 16, 'start', 'Ganancia rápida', 'poco valor, fácil y seguro'), rot(W - R2 - 8, yM + 30, 'end', 'Replantear cómo', 'mucho valor, ICE bajo'), rot(L + 8, yM + 30, 'start', 'Cuestionar', 'poco valor y bajo ICE'),
      [W - R2 - 120, yM - 17, W - R2, yM - 1]];
    const cajas = gs.map(g => [g.x - g.r, g.y - g.r, g.x + g.r, g.y + g.r]).concat(fijos), cruza = b => cajas.some(c => b[0] < c[2] && b[2] > c[0] && b[1] < c[3] && b[3] > c[1]);
    gs.slice().sort((a, b) => b.d.ice - a.d.ice).forEach(g => {
      const t = g.l.length === 1 ? cortaTxt(App.projectName(g.l[0].r.p), 24) : `${g.l.length} iniciativas`, w = t.length * 6.3, hh = 13;
      const op = [[g.x + g.r + 4, g.y + 4, 'start'], [g.x - g.r - 4, g.y + 4, 'end'], [g.x, g.y - g.r - 5, 'middle'], [g.x, g.y + g.r + 13, 'middle']];
      for (const [tx, ty, an] of op) { const x0 = an === 'start' ? tx : an === 'end' ? tx - w : tx - w / 2, b = [x0, ty - hh + 2, x0 + w, ty + 2];
        if (b[0] < L || b[2] > W - R2 || b[1] < T || b[3] > H - B) continue;
        if (!cruza(b)) { cajas.push(b); h += `<text x="${tx}" y="${ty}" text-anchor="${an}" class="pf-lbl">${esc(t)}</text>`; break; } } });
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.innerHTML = h;
    if (!main) return;
    // la lista y el mapa se señalan entre sí
    const lista = main.querySelector('.pf-rank');
    if (lista) { lista.onmouseover = e => { const li = e.target.closest('li[data-pid]'); svg.querySelectorAll('circle.hl').forEach(c => c.classList.remove('hl')); svg.classList.toggle('foco', !!li); if (li) svg.querySelectorAll('circle[data-pids]').forEach(c => { if (c.dataset.pids.split(',').includes(li.dataset.pid)) c.classList.add('hl'); }); };
      lista.onmouseleave = () => { svg.classList.remove('foco'); svg.querySelectorAll('circle.hl').forEach(c => c.classList.remove('hl')); }; }
    svg.onclick = e => { const g = e.target.closest('[data-grupo]'); if (!g) return; const l = g.dataset.grupo.split(',').map(id => App.byId('projects', id)).filter(Boolean);
      App.openPop(g, `<div class="lbl">${l.length} iniciativas en el mismo punto</div><div class="tv-dl">${l.map(p => `<a class="tv-di" href="#/proyectos/${p.id}/valor/ice"><span class="t">${esc(App.projectName(p))}</span><i class="ico ico-flecha"></i></a>`).join('')}</div>`, { width: 300, nofocus: true }); };
  }

  // Exportar a Excel (.xlsx) lo que se ve en la tabla (con sus filtros)
  function csv(vis) {
    const C = [['Iniciativa', '', 44], ['Fase', '', 26], ['OKR', '', 30], ['Tipo de valor', '', 22], ['ICE', 'num', 8], ['Avance', 'pct', 10], ['Avance esperado', 'pct', 12], ['Inicio', 'fecha', 13], ['Fin', 'fecha', 13], ['Valor a dos años', 'cop', 18], ['Valor proyectado total', 'cop', 20], ['Estado del caso', '', 16], ['VPN', 'cop', 18], ['TIR', 'pct', 9], ['Alertas', '', 40]];
    const filas = vis.map(r => [App.projectName(r.p), r.x.estado, r.okrs.join(', '), r.cats.map(App.catLabel).join(', '), r.x.ice ?? '', r.pl.acts.length ? r.pl.avance / 100 : '', r.esp != null ? r.esp / 100 : '', r.pl.ini || '', r.pl.fin || '', Math.round(dosAnios(r)) || '', Math.round(r.valor) || '', r.x.caso ? r.x.caso.estado || 'Borrador' : '', r.f && r.f.vpn != null ? Math.round(r.f.vpn) : '', r.f && r.f.tir != null ? r.f.tir : '', r.al.length ? r.al.map(o => o.txt).join(', ') : sinDatos(r) ? 'Sin datos' : '']);
    App.Exportar.xlsx('portafolio-' + App.d.today(), [{ nombre: 'Portafolio', columnas: C.map(([t, tipo, ancho]) => ({ t, tipo, ancho })), filas }]);
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
  function viejasHTML() {
    if (!App.aud() || !App.Mejoras || !App.Mejoras.desactualizadosItems) return '';
    const it = App.Mejoras.desactualizadosItems(), Y = new Date().getFullYear();
    const sin = App.Dash ? App.projectsSorted().filter(p => !App.esEjemplo(p) && App.enAlcance(p)).map(p => ({ p, c: App.caseOf(p.id) })).filter(z => z.c && App.Valor && !App.Dash.registra(z.c, Y) && z.c.flujos && (z.c.flujos || []).some(f => f.tipo === 'beneficio' && Number((f.valores || [])[Y - (z.c.anio_inicio || Y)]) > 0))
      .map(z => ({ href: `#/proyectos/${z.p.id}/valor/captura`, t: App.projectName(z.p), s: `falta registrar la captura de ${Y}` })) : [];
    const todo = sin.concat(it);
    return `<section class="pf-viejas"><h3>Para poner al día <small>${todo.length ? `${todo.length} ${todo.length === 1 ? 'cosa' : 'cosas'}` : 'todo al día'}</small></h3>${todo.length ? `<div class="pf-vl">${todo.slice(0, 12).map(x => `<a href="${x.href}"><b>${esc(x.t)}</b><span>${esc(x.s)}</span></a>`).join('')}</div>${todo.length > 12 ? `<p class="faint">y ${todo.length - 12} más</p>` : ''}` : ''}</section>`;
  }
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
