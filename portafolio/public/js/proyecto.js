/* ============================================================
   PÁGINA DEL PROYECTO, todo lo del proyecto en un solo lugar
   Pestañas: Información, Cronograma, Caso de negocio, Comités
   ============================================================ */
'use strict';
(function () {
  const { $, esc } = App;
  // Orden pedido por la Oficina: lo primero al abrir un proyecto es su cronograma; la información general va al final
  // La hoja de cada iniciativa: Valor reúne la captura de valor, los OKR y el ICE
  const TABS = [['cronograma', 'Cronograma'], ['caso', 'Caso de negocio'], ['riesgos', 'Riesgos'], ['valor', 'Valor'], ['info', 'Información general'], ['comites', 'Comités']];
  const SUBV = [['captura', 'Captura de valor'], ['okr', 'OKR'], ['ice', 'ICE']];

  document.addEventListener('keydown', ev => { if (App.Proyecto && App.Proyecto._teclas) App.Proyecto._teclas(ev); });
  function render(main, params) {
    const [id, tab1, sub1] = params;
    const tab0 = tab1 === 'captura' || tab1 === 'okr' || tab1 === 'ice' ? 'valor' : tab1;
    const sub = SUBV.some(x => x[0] === (tab1 === 'valor' ? sub1 : tab1)) ? (tab1 === 'valor' ? sub1 : tab1) : App.store.get('ficha.valor', 'captura');
    if (tab0 === 'valor') App.store.set('ficha.valor', sub);
    const tab = TABS.some(t => t[0] === tab0) ? tab0 : 'cronograma';
    const p = App.byId('projects', id);
    if (!p) { main.innerHTML = `<div class="page-h"><a class="back" href="#/proyectos">← Portafolio</a></div><div class="card-box"><div class="empty-box"><b>Esta iniciativa no existe o fue eliminada</b></div></div>`; return; }
    const ro = !App.canEdit(), tc = App.titleCol(), ec = App.estadoCol();
    const pl = App.planOf(id), caso = App.caseOf(id), f = caso ? Finanzas.calc(caso) : null;
    const ses = App.S.sessions.filter(s => (s.proyectos || []).includes(id)).sort((a, b) => (a.fecha + (a.hora_ini || '')).localeCompare(b.fecha + (b.hora_ini || '')));
    const prox = ses.find(s => s.fecha >= App.d.today() && s.estado !== 'Cancelada');
    const estado = ec ? (p.props || {})[ec.id] : null;

    // Recorrer iniciativas sin salir de la pestaña: el orden es el de la última lista vista (Portafolio, Casos o Riesgos)
    const L = App.store.get('nav.lista', null);
    const enL = L && Array.isArray(L.ids) && L.ids.includes(id);
    const ids = enL ? L.ids.filter(x => App.byId('projects', x)) : App.projectsSorted().filter(x => (App.enAlcance(x) && !App.esEjemplo(x)) || x.id === id).map(x => x.id);
    const pos = ids.indexOf(id), ant = pos > 0 ? ids[pos - 1] : null, sig = pos >= 0 && pos < ids.length - 1 ? ids[pos + 1] : null;
    const de = enL ? L : { de: 'Portafolio', href: '#/proyectos' };
    const ir = x => `#/proyectos/${x}${tab === 'cronograma' ? '' : '/' + tab}`;
    const nomb = x => App.projectName(App.byId('projects', x));
    const faseCorta = estado && window.Fases && Fases.de(estado) ? Fases.de(estado).corto.replace(/^F(\d)$/, 'Fase $1') : '';
    const pendCap = caso && App.Valor ? App.Valor.pendientes(caso).length : 0, nOkr = App.okrsDe ? App.okrsDe(p).length : 0;
    const cuenta = k => { if (k === 'cronograma' && pl.acts.length) return `<span class="n">${pl.acts.length}</span>`; if (k === 'comites' && ses.length) return `<span class="n">${ses.length}</span>`;
      if (k === 'valor' && pendCap) return `<span class="n a" title="Capturas recurrentes por confirmar">${pendCap} por confirmar</span>`;
      if (k === 'riesgos' && App.Riesgos) { const q = App.Riesgos.resumen(p); return q.criticos ? `<span class="n r">${q.criticos} crítico${q.criticos === 1 ? '' : 's'}</span>` : q.n ? `<span class="n">${q.n}</span>` : ''; } return ''; };
    main.innerHTML = `<div class="ph-nav"><button class="burger" data-act="burger">☰</button><a class="ph-bc" href="${de.href}">${esc(de.de)}</a>${faseCorta ? `<span class="ph-bc2">› ${esc(faseCorta)}</span>` : ''}<span class="sp"></span>
        ${ant ? `<a class="ph-ar" href="${ir(ant)}" title="Anterior: ${esc(nomb(ant))} (Alt + ←)" aria-label="Iniciativa anterior">‹</a>` : '<span class="ph-ar off">‹</span>'}<span class="ph-pos">${pos + 1} de ${ids.length}</span>${sig ? `<a class="ph-ar" href="${ir(sig)}" title="Siguiente: ${esc(nomb(sig))} (Alt + →)" aria-label="Iniciativa siguiente">›</a>` : '<span class="ph-ar off">›</span>'}
        <button class="ph-ir" data-nav="elegir" title="Ir a otra iniciativa sin cambiar de pestaña"><i class="ico ico-flecha"></i>Ir a otra iniciativa ▾</button>${ro ? '' : '<button class="ph-mas" data-p="menu" title="Opciones de la iniciativa" aria-label="Opciones de la iniciativa">⋯</button>'}</div>
      <div class="p-head">
        <div class="ph-tit"><h1 class="p-title" data-p="titulo">${esc(App.projectName(p))}</h1>
          ${ec ? `<button class="f-fase" data-p="estado" ${ro ? 'disabled' : ''} title="${ro ? '' : 'Cambiar la fase'}"><span class="pill cl-${App.optColor(ec, estado) || 'gris'}">${esc(estado || 'Sin ' + ec.name.toLowerCase())}</span></button>` : ''}
          ${App.esEjemplo(p) ? '<span class="ej-txt" title="Iniciativa de ejemplo: muestra cómo se ve una iniciativa completa. No suma en los totales ni en el tablero.">ejemplo, no suma en los totales</span>' : ''}</div>
        <div class="facts">
          <span>${pl.acts.length ? `<b>${pl.avance} %</b> de avance${pl.atrasadas ? `, <b class="r">${pl.atrasadas} atrasada${pl.atrasadas > 1 ? 's' : ''}</b>` : ''}${pl.fin ? `, termina el <b>${esc(App.d.fmt(pl.fin))}</b>` : ''}` : esc(App.sinPlan(p).corto)}</span>
          <span>${caso ? `Caso <b>${esc((caso.estado || 'Borrador').toLowerCase())}</b>${f.vpn != null && f.totalInversion > 0 ? `, VPN <b>${esc(App.moneyShort(f.vpn, caso.moneda))}</b>` : caso.origen === 'ice' ? ', preliminar' : ''}` : 'Sin caso de negocio'}</span>
          <span title="${esc((App.ICE.detalle(p).notas || []).join('\n'))}">ICE <b>${App.iceOf(p) == null ? '—' : esc(App.num(App.iceOf(p), 1))}</b>${ro ? '' : ' <button class="t-lnk" data-p="ice">editar</button>'}</span>
          <span>${prox ? `Comité el <b>${esc(App.d.fmtShort(prox.fecha))}</b>` : 'Sin comité programado'}</span>
          ${App.aud() ? (() => { const u = [p.updated_at || p.created_at || '', caso ? caso.updated_at || '' : '', ...pl.acts.map(x => x.updated_at || '')].sort().pop(), dd = u ? Math.round((Date.now() - new Date(u)) / 864e5) : null; return dd == null ? '' : `<span class="${dd > 30 ? 'viejo' : ''}">${dd < 1 ? 'Actualizada hoy' : `Actualizada hace <b>${dd}</b> ${dd === 1 ? 'día' : 'días'}`}</span>`; })() : ''}
        </div>
        ${App.Avance ? App.Avance.html(p, ro) : ''}
      </div>
      <nav class="ptabs">${TABS.map(([k, l]) => `<a href="#/proyectos/${id}/${k}" class="${k === tab ? 'on' : ''}">${k === 'valor' && App.aud() ? 'Captura y OKR' : l}${cuenta(k)}</a>`).join('')}</nav>
      <div id="pTab"></div>`;
    const box = $('#pTab', main);

    if (tab === 'info') {
      // B5, Los campos del método anterior (Impacto, Confianza y Facilidad de 1 a 10, e Income antiguo) no se muestran
      // junto a los del ICE de la Oficina: quedan guardados y se ven al abrir «campos anteriores».
      const hayIce = App.S.columns.some(c => c.id === 'ice_income');
      const VIEJOS = ['impacto', 'confianza', 'facilidad', 'income'];
      const todas = App.S.columns.filter(c => c.id !== tc.id);
      const utiles = todas.filter(c => !(hayIce && VIEJOS.includes(c.id)));
      const cols = utiles.filter(c => !App.colVacia(c) || c === App.estadoCol() || c.id === 'revision_dgv');
      const vacias = utiles.filter(c => !cols.includes(c));
      const viejas = todas.filter(c => hayIce && VIEJOS.includes(c.id) && (p.props || {})[c.id] != null && (p.props || {})[c.id] !== '');
      const fila = c => { const v = (p.props || {})[c.id]; const vacio = v == null || v === '' || (Array.isArray(v) && !v.length);
        return `<div class="k"><span class="ic">${App.Tabla.TYPES[c.type].icon}</span>${esc(c.name)}</div><div class="v ${vacio && c.type !== 'check' ? 'empty' : ''}" data-col="${c.id}">${vacio && c.type !== 'check' ? `<div class="c-in">${ro ? '—' : 'Vacío'}</div>` : App.Tabla.renderValue(c, v)}</div>`; };
      const okrs = App.okrsDe ? App.okrsDe(p) : [];
      const gente = (p.miembros || []).length ? p.miembros : [].concat((p.props || {}).habilitadores || [], (p.props || {}).realizadores || []).filter(Boolean).map(n => ({ nombre: n, area: '', rol: '' }));
      const Y = +App.d.today().slice(0, 4), capY = caso ? (caso.captado || []).filter(x => String(x.mes || '').startsWith(Y + '-')).reduce((a, x) => a + (Number(x.valor) || 0), 0) : 0;
      const dos = caso && App.Avance ? App.Avance.dosAnios(f) : 0;
      const fi = `<div class="fi"><div class="fi-a">
          <h2>Qué es</h2>
          <p class="fi-frase ${p.frase ? '' : 'vacia'}" data-h="frase" title="${ro ? '' : 'Clic para editar'}">${p.frase ? esc(p.frase) : (ro ? 'Sin descripción.' : 'Escriba en una frase qué cambia con esta iniciativa.')}</p>
          ${gente.length ? `<h3>Quiénes participan</h3><div class="fi-gente">${gente.map(m => `<div>${esc(m.nombre)}${m.area || m.rol ? `<span>${esc([m.area, (m.rol || '').toLowerCase()].filter(Boolean).join(', '))}</span>` : ''}</div>`).join('')}</div>` : ''}
          ${okrs.length ? `<h3>A qué objetivos aporta</h3><ul class="fi-okr">${okrs.map(o => `<li>${esc(o)}</li>`).join('')}</ul>` : ''}
        </div><div class="fi-b">
          <div><b>${dos ? esc(App.moneyShort(dos, caso.moneda)) : '—'}</b><span>${caso ? 'valor en los dos primeros años del caso' : 'sin caso de negocio todavía'}</span></div>
          <div><b>${esc(App.moneyShort(capY))}</b><span>capturados en ${Y}</span></div>
          <div><b>${App.iceOf(p) == null ? '—' : esc(App.num(App.iceOf(p), 1))}</b><span>prioridad (ICE)${ro ? '' : ', <button class="t-lnk" data-p="ice">ver y editar sus datos</button>'}</span></div>
        </div></div>`;
      const barra = `<div class="vl-bar"><div class="vl-res"><span>Creada <b>${esc(App.d.ago(p.created_at))}</b></span>${p.updated_by_name ? `<span>última edición <b>${esc(p.updated_by_name)}</b>, ${esc(App.d.ago(p.updated_at))}</span>` : ''}</div><span class="sp"></span>${ro ? '' : '<button class="btn primary sm" data-p="editar">Editar datos</button><button class="btn sm" data-p="menu">⋯ Más</button>'}</div>`;
      box.innerHTML = barra + fi + `<details class="fi-campos"><summary>Todos los campos de la iniciativa</summary><div class="props ${ro ? '' : 'editable'}">${cols.map(fila).join('')}</div>${viejas.length ? `<details class="props-viejas"><summary>${viejas.length} campo${viejas.length === 1 ? '' : 's'} del método anterior (guardado${viejas.length === 1 ? '' : 's'}, ya no se usa${viejas.length === 1 ? '' : 'n'} para el ICE)</summary><div class="props">${viejas.map(fila).join('')}</div></details>` : ''}${vacias.length && !ro ? `<details class="props-viejas"><summary>${vacias.length} campo${vacias.length === 1 ? '' : 's'} que ninguna iniciativa tiene diligenciado${vacias.length === 1 ? '' : 's'}</summary><div class="props">${vacias.map(fila).join('')}</div></details>` : ''}
        <div class="meta-line">Creado ${esc(App.d.ago(p.created_at))}${p.updated_by_name ? `, Última edición: ${esc(p.updated_by_name)}, ${esc(App.d.ago(p.updated_at))}` : ''}${ro ? '' : ', Las columnas se administran en Portafolio → Tabla completa'}</div></details>`;
    } else if (tab === 'cronograma') {
      App.PlanHost.render(box, id);
    } else if (tab === 'caso') {
      const at = App.TableroVisual && App.TableroVisual.atipicoDe ? App.TableroVisual.atipicoDe(id) : [];
      if (at.length) setTimeout(() => { const bx = $('#pTab', main); if (bx && !bx.querySelector('.tv-atip')) bx.insertAdjacentHTML('afterbegin', `<div class="tv-atip"><i class="ico ico-alerta"></i><span><b>Revisar las cifras:</b> en ${at.map(z => z.y).join(' y ')} este caso aporta ${at.map(z => App.moneyShort(z.top.v)).join(' y ')}, más de 4 veces lo que suma todo el portafolio en un año normal (${App.moneyShort(at[0].med)}). Confirme que las cifras están en la unidad correcta (pesos o millones).</span></div>`); }, 0);
      App.Caso.editor(box, id);
    } else if (tab === 'valor') {
      box.innerHTML = `<nav class="vl-sub ps-sub">${SUBV.map(([k, t]) => `<a href="#/proyectos/${id}/valor/${k}" class="${k === sub ? 'on' : ''}">${t}${k === 'okr' && nOkr ? ` <span class="n">${nOkr}</span>` : ''}${k === 'captura' && pendCap ? ` <span class="n a">${pendCap}</span>` : ''}</a>`).join('')}</nav><div id="pSub"></div>`;
      const sb = $('#pSub', box);
      if (sub === 'okr') App.Valor.okrProyecto(sb, id); else if (sub === 'ice') iceVista(sb, p, ro); else App.Valor.captura(sb, id);
    } else if (tab === 'riesgos') {
      App.Riesgos.render(box, id);
    } else {
      const abiertos = ses.flatMap(s => (s.compromisos || []).filter(k => !k.hecho && (k.texto || '').trim())).length;
      box.innerHTML = `<div class="vl-bar"><div class="vl-res"><span><b>${ses.length}</b>${ses.length === 1 ? 'sesión' : 'sesiones'}</span><span>${prox ? `próximo <b>${esc(App.d.fmtShort(prox.fecha))}</b>` : 'sin comité programado'}</span><span><b>${abiertos}</b>${abiertos === 1 ? 'compromiso abierto' : 'compromisos abiertos'}</span></div><span class="sp"></span>${ro ? '' : '<button class="btn primary sm" data-p="agendar">Agendar en comité</button>'}<a class="btn sm" href="#/agenda">Ver el comité</a></div><div class="card-box">
        ${ses.length ? `<table class="lst"><thead><tr><th>Fecha</th><th>Comité</th><th>Estado</th><th>Temas</th><th>Decisiones</th></tr></thead><tbody>${ses.map(s => `<tr class="clic" data-ses="${s.id}"><td style="white-space:nowrap"><b>${esc(App.d.fmt(s.fecha))}</b><div class="faint" style="font-size:11px">${esc(s.hora_ini || '')}</div></td><td><span class="pill cl-${App.Agenda.colorOf(s)}">${esc(App.Agenda.tituloOf(s))}</span></td><td>${esc(s.estado || 'Programada')}</td><td class="muted" style="max-width:260px">${esc((s.temas || '').slice(0, 140))}</td><td style="max-width:300px">${esc((s.decisiones || '').slice(0, 180))}</td></tr>`).join('')}</tbody></table>`
          : '<div class="empty-box"><b>Esta iniciativa aún no ha pasado por comité</b>Agenda una sesión para presentarlo.</div>'}</div>`;
    }

    App.Proyecto._teclas = ev => { if (!ev.altKey || !/^#\/proyectos\/[^/]+/.test(location.hash) || /input|textarea|select/i.test((document.activeElement || {}).tagName || '')) return; if (ev.key === 'ArrowLeft' && ant) { ev.preventDefault(); App.go(ir(ant)); } if (ev.key === 'ArrowRight' && sig) { ev.preventDefault(); App.go(ir(sig)); } };
    main.onclick = e => {
      if (e.target.closest('.burger')) return App.toggleSide();
      const ne = e.target.closest('[data-nav=elegir]');
      if (ne) return App.pickList(ne, { multi: false, placeholder: 'Buscar iniciativa…', empty: 'No hay iniciativas', selected: [id],
        items: ids.map(x => ({ id: x, label: nomb(x), color: App.projectColor(App.byId('projects', x)) })), onSave: x => { if (x && x !== id) App.go(ir(x)); } });
      const s = e.target.closest('[data-ses]'); if (s) return App.Agenda.openSession(s.dataset.ses);
      const fr = e.target.closest('[data-h=frase]'); if (fr && !ro) return App.editText(fr, p.frase || '', { placeholder: 'En una frase: qué cambia con esta iniciativa', width: 420, onSave: v => App.guard(async () => { await App.patch('projects', id, { frase: String(v || '').slice(0, 500) }); App.render(); }) });
      if (tab === 'info' && !ro) { const v = e.target.closest('.props .v'); if (v && !e.target.closest('a')) return App.Tabla.openEditor(v, id, v.dataset.col); }
      const b = e.target.closest('[data-p]'); if (!b || ro) return;
      const a = b.dataset.p;
      if (a === 'titulo') App.Tabla.openEditor(b, id, tc.id);
      if (a === 'estado' && ec) App.Tabla.openEditor(b, id, ec.id);
      if (a === 'ice') return iceEditor(b, p);
      if (a === 'avanzar' && ec) { const nueva = b.dataset.fase; if (!confirm(`¿Pasar «${App.projectName(p)}» a ${nueva}?\n\nQueda en la trazabilidad. Si lo decidió el comité, regístralo también en la sesión.`)) return;
        return App.guard(async () => { await App.patch('projects', id, { props: { [ec.id]: nueva } }); App.toast('Cambió de fase'); App.render(); }); }
      if (a === 'editar') { const d = $('.fi-campos', main); if (d) { d.open = true; d.scrollIntoView({ behavior: 'smooth', block: 'start' }); } return; }
      if (a === 'agendar') App.Agenda.openNewSession(App.d.add(App.d.today(), 7), { proyectos: [id] });
      if (a === 'menu') App.menu(b, [{ id: 'tabla', label: 'Ver en la tabla completa' }, { id: 'agenda', label: 'Agendar en comité' }, '-', { id: 'del', label: 'Eliminar iniciativa', danger: true }], m => {
        if (m === 'tabla') App.go('#/proyectos');
        if (m === 'agenda') App.Agenda.openNewSession(App.d.add(App.d.today(), 7), { proyectos: [id] });
        if (m === 'del') confirmDelete(id);
      });
    };
  }

  // Proyectado y captado del año para la ficha (misma regla que el tablero)
  function filaDe(id) {
    try { const d = App.Dash && App.Dash.datos ? App.Dash.datos({ anio: null, estado: '', tipo: '', alcance: 'todos', conEjemplo: true }) : null; return d ? d.filas.find(x => x.p.id === id) || null : null; } catch (e) { return null; }
  }

  // ICE con el método de la Oficina: Income × Confidence ÷ Effort × OS.
  // Cada factor se elige con su escala; «Automático» deja que se calcule del caso y del cronograma.
  function iceVista(box, p, ro) {
    const d = App.ICE.detalle(p) || {}, n = d.notas || {};
    const F = [['Income', d.income, 'dinero captado o ahorrado a dos años, en escala de 1 a 55', n.income], ['Confianza', d.conf != null ? d.conf + ' %' : null, 'qué tan seguros estamos de lograrlo', n.conf], ['Esfuerzo', d.esf != null ? d.esf + ' %' : null, 'tiempo y recursos que pide (más alto, más esfuerzo)', n.esf], ['OS', d.os, 'alineación con los objetivos del semestre', n.os]];
    box.innerHTML = `<div class="vl-bar"><div class="vl-res"><span><b>${d.ice == null ? '—' : esc(App.num(d.ice, 1))}</b>ICE</span><span>${d.oficina ? 'va a la Oficina de Valor (Income 3 o más)' : d.income != null ? 'por debajo del umbral de la Oficina' : ''}</span></div><span class="sp"></span>${ro ? '' : '<button class="btn primary sm" data-p="ice">Editar ICE</button>'}</div>
      <p class="faint vl-nota">ICE = Income × Confianza ÷ Esfuerzo × OS. Lo que no registre la Oficina se calcula con el caso de negocio y el cronograma.</p>
      <div class="ice-f">${F.map(([t, v, s, nota]) => `<div><b>${v == null ? '—' : esc(String(v))}</b><span class="t">${t}</span><small>${esc(s)}</small>${nota ? `<small class="nota">${esc(nota)}</small>` : ''}</div>`).join('')}</div>`;
  }
  function iceEditor(anchor, p) {
    const I = App.ICE, v = p.props || {};
    const auto = I.detalle({ ...p, props: { ...v, ice_income: null, ice_confianza: null, ice_esfuerzo: null, ice_os: null } });
    const RANGO = ['≤ $50 M', '$51–200 M', '$201–600 M, umbral Oficina', '$601 M–1.200 M', '$1.201–2.200 M', '$2.201–4.200 M', '$4.201–8.200 M', '$8.201–16.200 M', '> $16.201 M'];
    const sel = (k, actual, autoV, ops) => `<select class="fld" data-ice="${k}" style="margin:2px 0 8px"><option value="">Automático${autoV != null ? ', ' + autoV : ', sin datos'}</option>${ops.map(([val, l]) => `<option value="${val}" ${actual != null && String(actual) === String(val) ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
    const osAct = I.leeOS(v.ice_os);
    const pop = App.openPop(anchor, `<div class="lbl">ICE = Income × Confidence ÷ Effort × OS</div>
      <div style="padding:0 10px"><label class="hint" style="margin:0">Income, dinero captado o ahorrado a dos años</label>${sel('ice_income', I.fib(v.ice_income), auto.income, I.FIB.map((n, i) => [n, `${n}, ${RANGO[i]}`]))}
      <label class="hint" style="margin:0">Confidence, confianza en que el impacto se materialice</label>${sel('ice_confianza', I.redondeaPct(v.ice_confianza), auto.conf != null ? auto.conf + ' %' : null, [[100, '100 %, total'], [75, '75 %, alta'], [50, '50 %, media'], [25, '25 %, baja']])}
      <label class="hint" style="margin:0">Effort, tiempo y esfuerzo de implementación</label>${sel('ice_esfuerzo', I.redondeaPct(v.ice_esfuerzo), auto.esf != null ? auto.esf + ' %' : null, [[100, '100 %, 6 meses o más'], [75, '75 %, 4 a 6 meses'], [50, '50 %, 2 a 4 meses'], [25, '25 %, menos de 2 meses']])}
      <label class="hint" style="margin:0">OS, alineación con los objetivos del semestre</label>${sel('ice_os', osAct, 1, [[0.75, '0,75, no alineado'], [1, '1, alineado'], [1.25, '1,25, prioridad del semestre']])}
      <div data-ice-res style="font-size:13px;margin:4px 0 8px"></div></div>
      <div class="row" style="justify-content:flex-end;padding:0 10px 8px"><button class="btn primary sm" data-ice-ok>Guardar</button></div>`, { width: 360, nofocus: true });
    const leer = () => { const o = {}; pop.querySelectorAll('[data-ice]').forEach(x => { o[x.dataset.ice] = x.value === '' ? null : Number(x.value); }); return o; };
    const OSN = { 0.75: '0,75, No alineado', 1: '1, Alineado', 1.25: '1,25, Prioridad del semestre' };
    const props = o => ({ ice_income: o.ice_income, ice_confianza: o.ice_confianza, ice_esfuerzo: o.ice_esfuerzo, ice_os: o.ice_os == null ? null : OSN[o.ice_os] });
    const pintar = () => { const d = I.detalle({ ...p, props: { ...v, ...props(leer()) } });
      pop.querySelector('[data-ice-res]').innerHTML = d.ice == null ? `<span class="faint">${App.esc(d.notas[0])}</span>` : `ICE = <b>${App.esc(App.num(d.ice, 1))}</b> <span class="faint">(${d.income} × ${d.conf} % ÷ ${d.esf} % × ${String(d.os).replace('.', ',')})${d.oficina === false ? ', bajo el umbral de la Oficina (Income < 3)' : ''}</span>`; };
    pintar();
    pop.onchange = pintar;
    pop.onclick = e => { if (!e.target.closest('[data-ice-ok]')) return; const ps = props(leer()); App.closePop(true);
      App.guard(async () => { await App.patch('projects', p.id, { props: ps }); App.toast('ICE actualizado'); App.render(); }); };
  }

  function confirmDelete(id) {
    const p = App.byId('projects', id); if (!p) return;
    const n = App.actsOf(id).length, c = App.caseOf(id);
    if (!confirm(`¿Enviar «${App.projectName(p)}» a la papelera?\n\nSe va con sus ${n} actividades${c ? ' y su caso de negocio' : ''}. Se puede restaurar completa durante 30 días desde Portafolio → Papelera.`)) return;
    App.guard(async () => { await App.remove('projects', id); App.toast('Enviada a la papelera. Se puede restaurar durante 30 días.'); App.go('#/proyectos'); });
  }

  App.Proyecto = { render, confirmDelete };
})();
