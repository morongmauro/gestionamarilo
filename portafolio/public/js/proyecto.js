/* ============================================================
   PÁGINA DEL PROYECTO · todo lo del proyecto en un solo lugar
   Pestañas: Información · Cronograma · Caso de negocio · Comités
   ============================================================ */
'use strict';
(function () {
  const { $, esc } = App;
  const TABS = [['info', 'Información'], ['cronograma', 'Cronograma'], ['caso', 'Caso de negocio'], ['comites', 'Comités']];

  function render(main, params) {
    const [id, tab0] = params;
    const tab = TABS.some(t => t[0] === tab0) ? tab0 : 'info';
    const p = App.byId('projects', id);
    if (!p) { main.innerHTML = `<div class="page-h"><a class="back" href="#/proyectos">← Portafolio</a></div><div class="card-box"><div class="empty-box"><b>Esta iniciativa no existe o fue eliminada</b></div></div>`; return; }
    const ro = !App.canEdit(), tc = App.titleCol(), ec = App.estadoCol();
    const pl = App.planOf(id), caso = App.caseOf(id), f = caso ? Finanzas.calc(caso) : null;
    const ses = App.S.sessions.filter(s => (s.proyectos || []).includes(id)).sort((a, b) => (a.fecha + (a.hora_ini || '')).localeCompare(b.fecha + (b.hora_ini || '')));
    const prox = ses.find(s => s.fecha >= App.d.today() && s.estado !== 'Cancelada');
    const estado = ec ? (p.props || {})[ec.id] : null;

    main.innerHTML = `<div class="page-h"><button class="burger" data-act="burger">☰</button><a class="back" href="#/proyectos">← Portafolio</a><span class="sp"></span>${ro ? '' : '<button class="btn" data-p="menu">··· Opciones</button>'}</div>
      <div class="card-box p-head">
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">${ec ? `<span class="pill cl-${App.optColor(ec, estado)}" data-p="estado" style="cursor:${ro ? 'default' : 'pointer'}">${esc(estado || 'Sin ' + ec.name.toLowerCase())}</span>` : ''}</div>
        <div class="p-title" data-p="titulo">${esc(App.projectName(p))}</div>
        <div class="facts">
          <span>Cronograma: <b>${pl.ini ? `${esc(App.d.fmt(pl.ini))} – ${esc(App.d.fmt(pl.fin))}` : esc(App.sinPlan(p).corto)}</b></span>
          ${pl.acts.length ? `<span><span class="bar-mini"><i style="width:${pl.avance}%"></i></span><b>${pl.avance}%</b> de avance${pl.atrasadas ? ` · <b style="color:var(--crit-ink)">${pl.atrasadas} atrasada${pl.atrasadas > 1 ? 's' : ''}</b>` : ''}</span>` : ''}
          <span>Caso: ${caso ? `<span class="pill cl-${App.Caso.estadoColor(caso.estado)}">${esc(caso.estado || 'Borrador')}</span>${f.vpn != null && f.totalInversion > 0 ? ` <b>VPN ${esc(App.moneyShort(f.vpn, caso.moneda))}</b>` : caso.origen === 'ice' ? ' <span class="faint">preliminar</span>' : ''}` : '<b>sin caso</b>'}</span>
          <span title="${esc((App.ICE.detalle(p).notas || []).join('\n'))}">ICE: <b>${App.iceOf(p) == null ? '—' : esc(App.num(App.iceOf(p), 1))}</b>${ro ? '' : ' <button class="t-lnk" data-p="ice">calcular / editar</button>'}</span>
          <span>Próximo comité: <b>${prox ? `${esc(App.d.fmtShort(prox.fecha))} · ${esc(App.Agenda.tituloOf(prox))}` : 'ninguno'}</b></span>
        </div>
      </div>
      ${App.Avance ? App.Avance.html(p, ro) : ''}
      <nav class="ptabs">${TABS.map(([k, l]) => `<a href="#/proyectos/${id}/${k}" class="${k === tab ? 'on' : ''}">${l}${k === 'cronograma' && pl.acts.length ? `<span class="n">${pl.acts.length}</span>` : ''}${k === 'comites' && ses.length ? `<span class="n">${ses.length}</span>` : ''}</a>`).join('')}</nav>
      <div id="pTab"></div>`;
    const box = $('#pTab', main);

    if (tab === 'info') {
      // B5 · Los campos del método anterior (Impacto, Confianza y Facilidad de 1 a 10, e Income antiguo) no se muestran
      // junto a los del ICE de la Oficina: quedan guardados y se ven al abrir «campos anteriores».
      const hayIce = App.S.columns.some(c => c.id === 'ice_income');
      const VIEJOS = ['impacto', 'confianza', 'facilidad', 'income'];
      const todas = App.S.columns.filter(c => c.id !== tc.id);
      const cols = todas.filter(c => !(hayIce && VIEJOS.includes(c.id)));
      const viejas = todas.filter(c => hayIce && VIEJOS.includes(c.id) && (p.props || {})[c.id] != null && (p.props || {})[c.id] !== '');
      const fila = c => { const v = (p.props || {})[c.id]; const vacio = v == null || v === '' || (Array.isArray(v) && !v.length);
        return `<div class="k"><span class="ic">${App.Tabla.TYPES[c.type].icon}</span>${esc(c.name)}</div><div class="v ${vacio && c.type !== 'check' ? 'empty' : ''}" data-col="${c.id}">${vacio && c.type !== 'check' ? `<div class="c-in">${ro ? '—' : 'Vacío'}</div>` : App.Tabla.renderValue(c, v)}</div>`; };
      const historia = App.vista && App.vista.nueva ? App.Mejoras.historia(p, { pl, caso, f, prox, ro, d: filaDe(id) }) : '';
      box.innerHTML = historia + `<div class="card-box"><div class="props">${cols.map(fila).join('')}</div>${viejas.length ? `<details class="props-viejas"><summary>${viejas.length} campo${viejas.length === 1 ? '' : 's'} del método anterior (guardado${viejas.length === 1 ? '' : 's'}, ya no se usa${viejas.length === 1 ? '' : 'n'} para el ICE)</summary><div class="props">${viejas.map(fila).join('')}</div></details>` : ''}
        <div class="meta-line">Creado ${esc(App.d.ago(p.created_at))}${p.updated_by_name ? ` · Última edición: ${esc(p.updated_by_name)}, ${esc(App.d.ago(p.updated_at))}` : ''}${ro ? '' : ' · Las columnas se administran en Portafolio → Tabla completa'}</div></div>`;
    } else if (tab === 'cronograma') {
      App.PlanHost.render(box, id);
    } else if (tab === 'caso') {
      App.Caso.editor(box, id);
    } else {
      box.innerHTML = `<div class="card-box">${ro ? '' : '<div style="margin-bottom:10px"><button class="btn primary" data-p="agendar">+ Agendar en un comité</button></div>'}
        ${ses.length ? `<table class="lst"><thead><tr><th>Fecha</th><th>Comité</th><th>Estado</th><th>Temas</th><th>Decisiones</th></tr></thead><tbody>${ses.map(s => `<tr class="clic" data-ses="${s.id}"><td style="white-space:nowrap"><b>${esc(App.d.fmt(s.fecha))}</b><div class="faint" style="font-size:11px">${esc(s.hora_ini || '')}</div></td><td><span class="pill cl-${App.Agenda.colorOf(s)}">${esc(App.Agenda.tituloOf(s))}</span></td><td>${esc(s.estado || 'Programada')}</td><td class="muted" style="max-width:260px">${esc((s.temas || '').slice(0, 140))}</td><td style="max-width:300px">${esc((s.decisiones || '').slice(0, 180))}</td></tr>`).join('')}</tbody></table>`
          : '<div class="empty-box"><b>Esta iniciativa aún no ha pasado por comité</b>Agenda una sesión para presentarlo.</div>'}</div>`;
    }

    main.onclick = e => {
      if (e.target.closest('.burger')) return App.toggleSide();
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
      if (a === 'agendar') App.Agenda.openNewSession(App.d.add(App.d.today(), 7), { proyectos: [id] });
      if (a === 'menu') App.menu(b, [{ id: 'tabla', label: '▤ Ver en la tabla' }, { id: 'agenda', label: '▦ Agendar en comité' }, '-', { id: 'del', label: '🗑 Eliminar iniciativa', danger: true }], m => {
        if (m === 'tabla') App.go('#/proyectos');
        if (m === 'agenda') App.Agenda.openNewSession(App.d.add(App.d.today(), 7), { proyectos: [id] });
        if (m === 'del') confirmDelete(id);
      });
    };
  }

  // Proyectado y captado del año para la ficha (misma regla que el tablero)
  function filaDe(id) {
    try { const d = App.Dash && App.Dash.datos ? App.Dash.datos({ anio: null, estado: '', tipo: '', alcance: 'todos' }) : null; return d ? d.filas.find(x => x.p.id === id) || null : null; } catch (e) { return null; }
  }

  // ICE con el método de la Oficina: Income × Confidence ÷ Effort × OS.
  // Cada factor se elige con su escala; «Automático» deja que se calcule del caso y del cronograma.
  function iceEditor(anchor, p) {
    const I = App.ICE, v = p.props || {};
    const auto = I.detalle({ ...p, props: { ...v, ice_income: null, ice_confianza: null, ice_esfuerzo: null, ice_os: null } });
    const RANGO = ['≤ $50 M', '$51–200 M', '$201–600 M · umbral Oficina', '$601 M–1.200 M', '$1.201–2.200 M', '$2.201–4.200 M', '$4.201–8.200 M', '$8.201–16.200 M', '> $16.201 M'];
    const sel = (k, actual, autoV, ops) => `<select class="fld" data-ice="${k}" style="margin:2px 0 8px"><option value="">Automático${autoV != null ? ' · ' + autoV : ' · sin datos'}</option>${ops.map(([val, l]) => `<option value="${val}" ${actual != null && String(actual) === String(val) ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
    const osAct = I.leeOS(v.ice_os);
    const pop = App.openPop(anchor, `<div class="lbl">ICE = Income × Confidence ÷ Effort × OS</div>
      <div style="padding:0 10px"><label class="hint" style="margin:0">Income · dinero captado o ahorrado a dos años</label>${sel('ice_income', I.fib(v.ice_income), auto.income, I.FIB.map((n, i) => [n, `${n} · ${RANGO[i]}`]))}
      <label class="hint" style="margin:0">Confidence · confianza en que el impacto se materialice</label>${sel('ice_confianza', I.redondeaPct(v.ice_confianza), auto.conf != null ? auto.conf + ' %' : null, [[100, '100 % · total'], [75, '75 % · alta'], [50, '50 % · media'], [25, '25 % · baja']])}
      <label class="hint" style="margin:0">Effort · tiempo y esfuerzo de implementación</label>${sel('ice_esfuerzo', I.redondeaPct(v.ice_esfuerzo), auto.esf != null ? auto.esf + ' %' : null, [[100, '100 % · 6 meses o más'], [75, '75 % · 4 a 6 meses'], [50, '50 % · 2 a 4 meses'], [25, '25 % · menos de 2 meses']])}
      <label class="hint" style="margin:0">OS · alineación con los objetivos del semestre</label>${sel('ice_os', osAct, 1, [[0.75, '0,75 · no alineado'], [1, '1 · alineado'], [1.25, '1,25 · prioridad del semestre']])}
      <div data-ice-res style="font-size:13px;margin:4px 0 8px"></div></div>
      <div class="row" style="justify-content:flex-end;padding:0 10px 8px"><button class="btn primary sm" data-ice-ok>Guardar</button></div>`, { width: 360, nofocus: true });
    const leer = () => { const o = {}; pop.querySelectorAll('[data-ice]').forEach(x => { o[x.dataset.ice] = x.value === '' ? null : Number(x.value); }); return o; };
    const OSN = { 0.75: '0,75 · No alineado', 1: '1 · Alineado', 1.25: '1,25 · Prioridad del semestre' };
    const props = o => ({ ice_income: o.ice_income, ice_confianza: o.ice_confianza, ice_esfuerzo: o.ice_esfuerzo, ice_os: o.ice_os == null ? null : OSN[o.ice_os] });
    const pintar = () => { const d = I.detalle({ ...p, props: { ...v, ...props(leer()) } });
      pop.querySelector('[data-ice-res]').innerHTML = d.ice == null ? `<span class="faint">${App.esc(d.notas[0])}</span>` : `ICE = <b>${App.esc(App.num(d.ice, 1))}</b> <span class="faint">(${d.income} × ${d.conf} % ÷ ${d.esf} % × ${String(d.os).replace('.', ',')})${d.oficina === false ? ' · bajo el umbral de la Oficina (Income < 3)' : ''}</span>`; };
    pintar();
    pop.onchange = pintar;
    pop.onclick = e => { if (!e.target.closest('[data-ice-ok]')) return; const ps = props(leer()); App.closePop(true);
      App.guard(async () => { await App.patch('projects', p.id, { props: ps }); App.toast('ICE actualizado'); App.render(); }); };
  }

  function confirmDelete(id) {
    const p = App.byId('projects', id); if (!p) return;
    const n = App.actsOf(id).length, c = App.caseOf(id);
    if (!confirm(`¿Eliminar «${App.projectName(p)}»?\n\nSe borran también ${n} actividades del cronograma${c ? ' y su caso de negocio' : ''}. Las sesiones de comité se conservan.`)) return;
    App.guard(async () => { await App.remove('projects', id); App.toast('Iniciativa eliminada'); App.go('#/proyectos'); });
  }

  App.Proyecto = { render, confirmDelete };
})();
