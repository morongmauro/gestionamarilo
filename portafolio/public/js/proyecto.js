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
    if (!p) { main.innerHTML = `<div class="page-h"><a class="back" href="#/proyectos">← Proyectos</a></div><div class="card-box"><div class="empty-box"><b>Este proyecto no existe o fue eliminado</b></div></div>`; return; }
    const ro = !App.canEdit(), tc = App.titleCol(), ec = App.estadoCol();
    const pl = App.planOf(id), caso = App.caseOf(id), f = caso ? Finanzas.calc(caso) : null;
    const ses = App.S.sessions.filter(s => (s.proyectos || []).includes(id)).sort((a, b) => (a.fecha + (a.hora_ini || '')).localeCompare(b.fecha + (b.hora_ini || '')));
    const prox = ses.find(s => s.fecha >= App.d.today() && s.estado !== 'Cancelada');
    const estado = ec ? (p.props || {})[ec.id] : null;

    main.innerHTML = `<div class="page-h"><button class="burger" data-act="burger">☰</button><a class="back" href="#/proyectos">← Proyectos</a><span class="sp"></span>${ro ? '' : '<button class="btn" data-p="menu">··· Opciones</button>'}</div>
      <div class="card-box p-head">
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">${ec ? `<span class="pill cl-${App.optColor(ec, estado)}" data-p="estado" style="cursor:${ro ? 'default' : 'pointer'}">${esc(estado || 'Sin ' + ec.name.toLowerCase())}</span>` : ''}</div>
        <div class="p-title" data-p="titulo">${esc(App.projectName(p))}</div>
        <div class="facts">
          <span>Cronograma: <b>${pl.ini ? `${esc(App.d.fmt(pl.ini))} – ${esc(App.d.fmt(pl.fin))}` : 'sin fechas'}</b></span>
          ${pl.acts.length ? `<span><span class="bar-mini"><i style="width:${pl.avance}%"></i></span><b>${pl.avance}%</b> de avance${pl.atrasadas ? ` · <b style="color:var(--crit-ink)">${pl.atrasadas} atrasada${pl.atrasadas > 1 ? 's' : ''}</b>` : ''}</span>` : ''}
          <span>Caso: ${caso ? `<span class="pill cl-${App.Caso.estadoColor(caso.estado)}">${esc(caso.estado || 'Borrador')}</span>${f.vpn != null ? ` <b>VPN ${esc(App.moneyShort(f.vpn, caso.moneda))}</b>` : ''}` : '<b>sin caso</b>'}</span>
          <span>ICE: <b>${App.iceOf(p) ?? '—'}</b></span>
          <span>Próximo comité: <b>${prox ? `${esc(App.d.fmtShort(prox.fecha))} · ${esc(App.Agenda.tituloOf(prox))}` : 'ninguno'}</b></span>
        </div>
      </div>
      <nav class="ptabs">${TABS.map(([k, l]) => `<a href="#/proyectos/${id}/${k}" class="${k === tab ? 'on' : ''}">${l}${k === 'cronograma' && pl.acts.length ? `<span class="n">${pl.acts.length}</span>` : ''}${k === 'comites' && ses.length ? `<span class="n">${ses.length}</span>` : ''}</a>`).join('')}</nav>
      <div id="pTab"></div>`;
    const box = $('#pTab', main);

    if (tab === 'info') {
      const cols = App.S.columns.filter(c => c.id !== tc.id);
      box.innerHTML = `<div class="card-box"><div class="props">${cols.map(c => { const v = (p.props || {})[c.id]; const vacio = v == null || v === '' || (Array.isArray(v) && !v.length);
        return `<div class="k"><span class="ic">${App.Tabla.TYPES[c.type].icon}</span>${esc(c.name)}</div><div class="v ${vacio && c.type !== 'check' ? 'empty' : ''}" data-col="${c.id}">${vacio && c.type !== 'check' ? `<div class="c-in">${ro ? '—' : 'Vacío'}</div>` : App.Tabla.renderValue(c, v)}</div>`; }).join('')}</div>
        <div class="meta-line">Creado ${esc(App.d.ago(p.created_at))}${p.updated_by_name ? ` · Última edición: ${esc(p.updated_by_name)}, ${esc(App.d.ago(p.updated_at))}` : ''}${ro ? '' : ' · Las columnas se administran desde la tabla de Proyectos'}</div></div>`;
    } else if (tab === 'cronograma') {
      App.PlanHost.render(box, id);
    } else if (tab === 'caso') {
      App.Caso.editor(box, id);
    } else {
      box.innerHTML = `<div class="card-box">${ro ? '' : '<div style="margin-bottom:10px"><button class="btn primary" data-p="agendar">+ Agendar en un comité</button></div>'}
        ${ses.length ? `<table class="lst"><thead><tr><th>Fecha</th><th>Comité</th><th>Estado</th><th>Temas</th><th>Decisiones</th></tr></thead><tbody>${ses.map(s => `<tr class="clic" data-ses="${s.id}"><td style="white-space:nowrap"><b>${esc(App.d.fmt(s.fecha))}</b><div class="faint" style="font-size:11px">${esc(s.hora_ini || '')}</div></td><td><span class="pill cl-${App.Agenda.colorOf(s)}">${esc(App.Agenda.tituloOf(s))}</span></td><td>${esc(s.estado || 'Programada')}</td><td class="muted" style="max-width:260px">${esc((s.temas || '').slice(0, 140))}</td><td style="max-width:300px">${esc((s.decisiones || '').slice(0, 180))}</td></tr>`).join('')}</tbody></table>`
          : '<div class="empty-box"><b>Este proyecto aún no ha pasado por comité</b>Agenda una sesión para presentarlo.</div>'}</div>`;
    }

    main.onclick = e => {
      if (e.target.closest('.burger')) return App.toggleSide();
      const s = e.target.closest('[data-ses]'); if (s) return App.Agenda.openSession(s.dataset.ses);
      if (tab === 'info' && !ro) { const v = e.target.closest('.props .v'); if (v && !e.target.closest('a')) return App.Tabla.openEditor(v, id, v.dataset.col); }
      const b = e.target.closest('[data-p]'); if (!b || ro) return;
      const a = b.dataset.p;
      if (a === 'titulo') App.Tabla.openEditor(b, id, tc.id);
      if (a === 'estado' && ec) App.Tabla.openEditor(b, id, ec.id);
      if (a === 'agendar') App.Agenda.openNewSession(App.d.add(App.d.today(), 7), { proyectos: [id] });
      if (a === 'menu') App.menu(b, [{ id: 'tabla', label: '▤ Ver en la tabla' }, { id: 'agenda', label: '▦ Agendar en comité' }, '-', { id: 'del', label: '🗑 Eliminar proyecto', danger: true }], m => {
        if (m === 'tabla') App.go('#/proyectos');
        if (m === 'agenda') App.Agenda.openNewSession(App.d.add(App.d.today(), 7), { proyectos: [id] });
        if (m === 'del') confirmDelete(id);
      });
    };
  }

  function confirmDelete(id) {
    const p = App.byId('projects', id); if (!p) return;
    const n = App.actsOf(id).length, c = App.caseOf(id);
    if (!confirm(`¿Eliminar «${App.projectName(p)}»?\n\nSe borran también ${n} actividades del cronograma${c ? ' y su caso de negocio' : ''}. Las sesiones de comité se conservan.`)) return;
    App.guard(async () => { await App.remove('projects', id); App.toast('Proyecto eliminado'); App.go('#/proyectos'); });
  }

  App.Proyecto = { render, confirmDelete };
})();
