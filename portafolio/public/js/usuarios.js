/* ============================================================
   USUARIOS (solo administradores) · HISTORIAL (todos)
   ============================================================ */
'use strict';
(function () {
  const { $, esc } = App;
  const ROLES = { admin: 'Administrador', editor: 'Editor', lector: 'Lector' };
  const ROL_HELP = { admin: 'Todo, incluso administrar usuarios', editor: 'Crea y edita proyectos, cronogramas, casos y agenda', lector: 'Solo consulta' };
  const tempPass = () => { const L = 'abcdefghjkmnpqrstuvwxyz', r = n => Array.from(crypto.getRandomValues(new Uint32Array(n))); return 'Pf-' + r(4).map(x => x % 10).join('') + '-' + r(4).map(x => L[x % L.length]).join(''); };

  async function usuarios(main) {
    if (!App.isAdmin()) { main.innerHTML = '<div class="empty-box"><b>Solo los administradores ven esta sección</b></div>'; return; }
    main.innerHTML = '<div class="empty-box">Cargando…</div>';
    let users;
    try { users = await App.api('GET', '/api/usuarios'); } catch (e) { main.innerHTML = `<div class="empty-box"><b>${esc(e.message)}</b></div>`; return; }
    users.sort((a, b) => a.name.localeCompare(b.name));
    const base = location.origin;
    const tablas = ['proyectos', 'actividades', 'casos', 'flujos', 'sesiones', 'compromisos', 'comites'];
    main.innerHTML = `<div class="page-h"><button class="burger" data-act="burger">☰</button><div><h1>Usuarios</h1><div class="sub">${users.length} ${users.length === 1 ? 'persona' : 'personas'} con acceso · cada quien entra con su correo y contraseña</div></div><span class="sp"></span><button class="btn primary" data-u="new">+ Nuevo usuario</button></div>
      <div class="card-box" style="padding:0;overflow:auto;margin-bottom:16px"><table class="lst"><thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Estado</th><th>Último ingreso</th><th></th></tr></thead><tbody>
        ${users.map(u => `<tr class="${u.active ? '' : 'off'}" data-id="${u.id}"><td><span style="display:inline-flex;align-items:center;gap:8px"><span class="av">${esc(App.initials(u.name))}</span><b>${esc(u.name)}</b>${u.id === App.S.me.id ? ' <span class="tag">tú</span>' : ''}</span></td><td>${esc(u.email)}</td>
          <td><select data-u="role" title="${esc(ROL_HELP[u.role])}">${Object.entries(ROLES).map(([k, l]) => `<option value="${k}" ${k === u.role ? 'selected' : ''}>${l}</option>`).join('')}</select></td>
          <td>${u.active ? (u.must_change ? '<span class="tag warn">Debe cambiar la contraseña</span>' : '<span class="tag">Activo</span>') : '<span class="tag">Desactivado</span>'}</td>
          <td class="muted">${u.last_login ? esc(App.d.ago(u.last_login)) : 'Nunca'}</td>
          <td style="white-space:nowrap;text-align:right"><button class="btn sm" data-u="more">···</button></td></tr>`).join('')}
      </tbody></table></div>
      <div class="card-box" style="margin-bottom:16px"><h3 style="font-size:14px;font-weight:800;margin-bottom:6px">Roles</h3>
        ${Object.entries(ROLES).map(([k, l]) => `<div style="font-size:12.5px;margin:3px 0"><b>${l}:</b> <span class="muted">${ROL_HELP[k]}</span></div>`).join('')}</div>
      <div class="card-box"><h3 style="font-size:14px;font-weight:800;margin-bottom:6px">Conexión con el data lake</h3>
        <div class="muted" style="font-size:12.5px;margin-bottom:10px">Cada tabla sale plana (CSV o JSON) para que Data Factory, Fabric o Databricks la copien al lago. El servidor exige el encabezado <code class="u">Authorization: Bearer EXPORT_TOKEN</code> (variable de entorno). Como administrador también puedes descargarlas aquí.</div>
        <table class="lst"><tbody>${tablas.map(t => `<tr><td><b>${t}</b></td><td><code class="u">${esc(base)}/api/export/${t}?format=csv</code></td><td style="text-align:right;white-space:nowrap"><a class="btn sm" href="/api/export/${t}?format=csv" download>⇩ CSV</a> <a class="btn sm" href="/api/export/${t}" target="_blank" rel="noopener">JSON</a></td></tr>`).join('')}</tbody></table></div>`;

    main.onclick = e => {
      if (e.target.closest('.burger')) return App.toggleSide();
      const b = e.target.closest('[data-u]'); if (!b) return;
      if (b.dataset.u === 'new') return nuevo(b);
      const id = b.closest('[data-id]') && b.closest('[data-id]').dataset.id; const u = users.find(x => x.id === id);
      if (b.dataset.u === 'more') App.menu(b, [{ id: 'name', label: '✎ Cambiar nombre' }, { id: 'reset', label: '⚿ Restablecer contraseña' }, { id: 'active', label: u.active ? '◌ Desactivar acceso' : '● Reactivar acceso' }, '-', { id: 'del', label: '🗑 Eliminar usuario', danger: true }], m => accion(m, u, b), 240);
    };
    main.onchange = e => {
      const s = e.target.closest('[data-u=role]'); if (!s) return;
      const id = s.closest('[data-id]').dataset.id;
      App.guard(async () => { await App.api('PATCH', '/api/usuarios/' + id, { role: s.value }); App.toast('Rol actualizado'); }).then(() => App.render());
    };
  }
  function accion(m, u, anchor) {
    if (m === 'name') return App.editText(anchor, u.name, { placeholder: 'Nombre', width: 300, onSave: v => v && v !== u.name && App.guard(async () => { await App.api('PATCH', '/api/usuarios/' + u.id, { name: v }); App.render(); }) });
    if (m === 'active') return App.guard(async () => { await App.api('PATCH', '/api/usuarios/' + u.id, { active: !u.active }); App.toast(u.active ? 'Acceso desactivado: su sesión se cerró' : 'Acceso reactivado'); App.render(); });
    if (m === 'del') { if (!confirm(`¿Eliminar a ${u.name}? Su historial de cambios se conserva.`)) return; return App.guard(async () => { await App.api('DELETE', '/api/usuarios/' + u.id); App.render(); }); }
    if (m === 'reset') {
      const pw = tempPass();
      if (!confirm(`¿Restablecer la contraseña de ${u.name}? Se cerrarán sus sesiones abiertas.`)) return;
      App.guard(async () => { await App.api('PATCH', '/api/usuarios/' + u.id, { password: pw }); credenciales(u.name, u.email, pw); });
    }
  }
  function nuevo(anchor) {
    const pw = tempPass();
    const p = App.openPop(anchor, `<div class="lbl">Nuevo usuario</div>
      <input type="text" data-n="name" placeholder="Nombre y apellido" style="margin:0 4px 6px;width:calc(100% - 8px)">
      <input type="text" data-n="email" placeholder="correo@empresa.com" style="margin:0 4px 6px;width:calc(100% - 8px)">
      <select data-n="role" style="margin:0 4px 6px;width:calc(100% - 8px)">${Object.entries(ROLES).map(([k, l]) => `<option value="${k}" ${k === 'editor' ? 'selected' : ''}>${l} · ${ROL_HELP[k]}</option>`).join('')}</select>
      <div class="lbl">Contraseña temporal</div><input type="text" data-n="password" value="${pw}" style="margin:0 4px 6px;width:calc(100% - 8px)">
      <div class="hint">Al entrar por primera vez, la app le pide cambiarla.</div>
      <div class="row" style="padding:4px"><button class="btn primary" data-n="ok">Crear usuario</button></div>`, { width: 340 });
    p.onclick = e => {
      if (!e.target.closest('[data-n=ok]')) return;
      const v = k => $(`[data-n=${k}]`, p).value.trim();
      const body = { name: v('name'), email: v('email'), role: v('role'), password: v('password') };
      App.guard(async () => { await App.api('POST', '/api/usuarios', body); App.closePop(true); credenciales(body.name, body.email, body.password); App.reload(); });
    };
  }
  function credenciales(name, email, pw) {
    const bg = document.createElement('div'); bg.className = 'modal-bg';
    const msg = `Hola ${name}, ya tienes acceso al portafolio:\n${location.origin}\nCorreo: ${email}\nContraseña temporal: ${pw}\nAl entrar te pedirá cambiarla.`;
    bg.innerHTML = `<div class="login-card"><h1>Credenciales de ${esc(name)}</h1><p>Compártelas por un canal privado (Teams o correo). La contraseña no se vuelve a mostrar.</p><div class="secret" style="white-space:pre-wrap">${esc(msg)}</div><button class="btn primary" data-m="copy">Copiar mensaje</button><button class="btn" data-m="close" style="margin-top:8px">Listo</button></div>`;
    document.body.appendChild(bg);
    bg.onclick = e => {
      if (e.target.closest('[data-m=copy]')) { navigator.clipboard && navigator.clipboard.writeText(msg).then(() => App.toast('Copiado'), () => App.toast('Selecciona el texto y cópialo', true)); }
      if (e.target.closest('[data-m=close]')) bg.remove();
    };
  }

  /* ---------- historial ---------- */
  const COLL = { projects: 'el proyecto', activities: 'la actividad', cases: 'el', sessions: 'la sesión', committees: 'el comité', users: 'el usuario' };
  let quien = '';
  async function historial(main) {
    main.innerHTML = '<div class="empty-box">Cargando…</div>';
    let items;
    try { items = await App.api('GET', '/api/historial'); } catch (e) { main.innerHTML = `<div class="empty-box"><b>${esc(e.message)}</b></div>`; return; }
    const personas = [...new Set(items.map(h => h.user_name))].sort();
    const vis = items.filter(h => !quien || h.user_name === quien);
    let day = '';
    const link = h => {
      if (h.coll === 'projects' && App.byId('projects', h.record_id)) return `#/proyectos/${h.record_id}`;
      if (h.coll === 'activities') { const a = App.byId('activities', h.record_id); if (a) return `#/proyectos/${a.project_id}/cronograma`; }
      if (h.coll === 'cases') { const c = App.byId('cases', h.record_id); if (c) return `#/casos/${c.project_id}`; }
      if (h.coll === 'sessions' && App.byId('sessions', h.record_id)) return `ses:${h.record_id}`;
      return null;
    };
    main.innerHTML = `<div class="page-h"><button class="burger" data-act="burger">☰</button><div><h1>Historial</h1><div class="sub">Quién cambió qué y cuándo · últimos ${items.length} cambios</div></div><span class="sp"></span>
      <select class="fld" id="hQuien" style="width:auto"><option value="">Todas las personas</option>${personas.map(p => `<option ${p === quien ? 'selected' : ''}>${esc(p)}</option>`).join('')}</select></div>
      ${vis.length ? vis.map(h => { const d = h.created_at.slice(0, 10), hd = d !== day ? `<div class="h-day">${esc(App.d.fmtLong(new Date(h.created_at).toLocaleDateString('en-CA')))}</div>` : ''; day = d;
        const l = link(h);
        return hd + `<div class="h-item"><span class="hr">${new Date(h.created_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</span><span><b>${esc(h.user_name)}</b> ${esc(h.accion)} ${esc(COLL[h.coll] || '')} ${l ? `<a href="${l.startsWith('ses:') ? '#' : l}" ${l.startsWith('ses:') ? `data-ses="${l.slice(4)}"` : ''}>«${esc(h.nombre)}»</a>` : `«${esc(h.nombre)}»`}${(h.campos || []).length ? ` <span class="cp">· ${esc(h.campos.join(', '))}</span>` : ''}</span></div>`; }).join('') : '<div class="card-box"><div class="empty-box"><b>Aún no hay cambios registrados</b></div></div>'}`;
    $('#hQuien', main).onchange = e => { quien = e.target.value; historial(main); };
    main.onclick = e => {
      if (e.target.closest('.burger')) return App.toggleSide();
      const s = e.target.closest('[data-ses]'); if (s) { e.preventDefault(); App.Agenda.openSession(s.dataset.ses); }
    };
  }

  App.views.usuarios = { render: usuarios, async: true };
  App.views.historial = { render: historial, async: true };
})();
