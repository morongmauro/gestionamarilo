/* ============================================================
   ARRANQUE · ingreso, navegación, barra lateral y sincronización
   Cada 20 segundos la app trae los cambios de los demás usuarios.
   ============================================================ */
'use strict';
(function () {
  const { $, $$, esc } = App;
  let snapshot = '';

  /* ---------- ingreso ---------- */
  function showLogin(mode, info = {}) {
    $('#app').hidden = true; $('#login').hidden = false;
    App.closeDrawer(); App.closePop(true);
    const f = $('#loginForm');
    const org = esc(info.org || App.S.org || 'Portafolio');
    if (mode === 'setup') {
      f.innerHTML = `<div class="logo">P</div><h1>Primer ingreso</h1><p>Crea el usuario administrador de ${org}. Después podrás invitar al resto del equipo desde «Usuarios».</p>
        <label>Nombre</label><input class="fld" name="name" required autocomplete="name">
        <label>Correo</label><input class="fld" name="email" type="email" required autocomplete="email">
        <label>Contraseña</label><input class="fld" name="password" type="password" required autocomplete="new-password" placeholder="Mínimo 8 caracteres, letras y números">
        ${info.needCode ? '<label>Código de instalación</label><input class="fld" name="code" required autocomplete="off">' : ''}
        <button class="btn primary" type="submit">Crear administrador</button><div class="err"></div>`;
    } else if (mode === 'cambiar') {
      f.innerHTML = `<div class="logo">P</div><h1>Cambia tu contraseña</h1><p>Entraste con una contraseña temporal. Elige una propia para continuar.</p>
        <input type="hidden" name="actual" value="${esc(info.actual || '')}">
        ${info.actual ? '' : '<label>Contraseña actual</label><input class="fld" name="actual" type="password" required autocomplete="current-password">'}
        <label>Nueva contraseña</label><input class="fld" name="nueva" type="password" required autocomplete="new-password" placeholder="Mínimo 8 caracteres, letras y números">
        <label>Repítela</label><input class="fld" name="nueva2" type="password" required autocomplete="new-password">
        <button class="btn primary" type="submit">Guardar y entrar</button><div class="err"></div>`;
    } else {
      f.innerHTML = `<div class="logo">P</div><h1>${org}</h1><p>Portafolio de proyectos · inicia sesión con tu correo</p>
        <label>Correo</label><input class="fld" name="email" type="email" required autocomplete="username">
        <label>Contraseña</label><input class="fld" name="password" type="password" required autocomplete="current-password">
        <button class="btn primary" type="submit">Entrar</button><div class="err">${esc(info.msg || '')}</div>`;
    }
    const first = $('input:not([type=hidden])', f); if (first) first.focus();
    f.onsubmit = async e => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(f).entries());
      const err = $('.err', f), btn = $('button[type=submit]', f);
      err.textContent = ''; btn.disabled = true;
      try {
        if (mode === 'setup') { await App.api('POST', '/api/auth/setup', d); await enter(); }
        else if (mode === 'cambiar') {
          if (d.nueva !== d.nueva2) throw new Error('Las dos contraseñas no coinciden');
          await App.api('POST', '/api/auth/clave', { actual: d.actual, nueva: d.nueva }); await enter();
        } else {
          const r = await App.api('POST', '/api/auth/login', d);
          if (r.user.must_change) return showLogin('cambiar', { actual: d.password });
          await enter();
        }
      } catch (ex) { err.textContent = ex.message; btn.disabled = false; }
    };
  }
  App.onLoggedOut = () => { if (!$('#app').hidden) showLogin('login', { msg: 'Tu sesión terminó. Vuelve a entrar.' }); };

  async function loadState() {
    const d = await App.api('GET', '/api/estado');
    snapshot = JSON.stringify(d);
    Object.assign(App.S, { me: d.me, org: d.org, columns: d.columns, projects: d.projects, activities: d.activities, cases: d.cases, sessions: d.sessions, committees: d.committees, people: d.people });
  }
  App.reload = async () => { try { await loadState(); App.render(); } catch (e) { console.error(e); } };

  async function enter() {
    await loadState();
    if (App.S.me.must_change) return showLogin('cambiar');
    $('#login').hidden = true; $('#app').hidden = false;
    $('#orgName').textContent = App.S.org;
    document.title = `${App.S.org} · Portafolio`;
    $('#meAv').textContent = App.initials(App.S.me.name);
    $('#meName').textContent = App.S.me.name;
    $('#meRole').textContent = { admin: 'Administrador', editor: 'Editor', lector: 'Solo lectura' }[App.S.me.role];
    $('#tabUsuarios').hidden = !App.isAdmin();
    if (!location.hash) location.hash = '#/proyectos'; else App.render();
  }

  /* ---------- navegación ---------- */
  function route() {
    const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
    return { sec: parts[0] || 'proyectos', params: parts.slice(1) };
  }
  App.render = () => {
    if ($('#app').hidden) return;
    const { sec, params } = route();
    const main = $('#main');
    main.className = App.canEdit() ? '' : 'ro';
    main.onclick = main.onchange = main.oninput = main.onmousedown = main.ondblclick = null;
    main.ondragstart = main.ondragend = main.ondragover = main.ondrop = null;
    const keep = window.scrollY;
    if (sec === 'proyectos' && params[0]) App.Proyecto.render(main, params);
    else (App.views[sec] || App.views.proyectos).render(main, params);
    window.scrollTo(0, keep);
    $$('.tab[data-sec]').forEach(t => t.classList.toggle('active', t.dataset.sec === sec));
    sideProjects(sec === 'proyectos' ? params[0] : sec === 'casos' ? params[0] : null);
    $('#app').classList.remove('open');
  };
  window.addEventListener('hashchange', () => { App.closePop(true); if (App.drawerOpen()) App.closeDrawer(); App.render(); window.scrollTo(0, 0); });

  function sideProjects(activeId) {
    const ps = App.projectsSorted();
    $('#sideProj').innerHTML = ps.map(p => { const pl = App.planOf(p.id);
      return `<a class="sp-item ${p.id === activeId ? 'on' : ''}" href="#/proyectos/${p.id}" title="${esc(App.projectName(p))}"><i style="background:var(--c-${App.projectColor(p)}-i)"></i><span class="nm">${esc(App.projectName(p))}</span>${pl.acts.length ? `<span class="pc">${pl.avance}%</span>` : ''}</a>`; }).join('') || '<div class="faint" style="font-size:12px;padding:4px 10px">Sin proyectos</div>';
  }

  /* ---------- barra lateral ---------- */
  App.toggleSide = () => $('#app').classList.toggle('open');
  $('#scrim').addEventListener('click', () => $('#app').classList.remove('open'));
  if (App.store.get('side.col', false)) $('#app').classList.add('col');
  $('#sideCol').addEventListener('click', () => { const c = $('#app').classList.toggle('col'); App.store.set('side.col', c); });
  $('#meBtn').addEventListener('click', e => App.menu(e.currentTarget, [{ id: 'clave', label: '⚿ Cambiar contraseña' }, '-', { id: 'salir', label: '⎋ Cerrar sesión' }], async m => {
    if (m === 'salir') { await App.api('POST', '/api/auth/logout').catch(() => {}); showLogin('login'); }
    if (m === 'clave') cambiarClave();
  }, 220));
  function cambiarClave() {
    const bg = document.createElement('div'); bg.className = 'modal-bg';
    bg.innerHTML = `<form class="login-card"><h1>Cambiar contraseña</h1><p>Se cerrarán tus sesiones en otros equipos.</p>
      <label>Contraseña actual</label><input class="fld" name="actual" type="password" required autocomplete="current-password">
      <label>Nueva contraseña</label><input class="fld" name="nueva" type="password" required autocomplete="new-password" placeholder="Mínimo 8 caracteres, letras y números">
      <label>Repítela</label><input class="fld" name="nueva2" type="password" required autocomplete="new-password">
      <button class="btn primary" type="submit">Guardar</button><button class="btn" type="button" data-x="1" style="margin-top:8px">Cancelar</button><div class="err"></div></form>`;
    document.body.appendChild(bg);
    const f = $('form', bg); $('input', f).focus();
    bg.addEventListener('click', e => { if (e.target === bg || e.target.closest('[data-x]')) bg.remove(); });
    f.onsubmit = async e => {
      e.preventDefault(); const d = Object.fromEntries(new FormData(f).entries());
      try { if (d.nueva !== d.nueva2) throw new Error('Las dos contraseñas no coinciden'); await App.api('POST', '/api/auth/clave', { actual: d.actual, nueva: d.nueva }); bg.remove(); App.toast('Contraseña actualizada'); }
      catch (ex) { $('.err', f).textContent = ex.message; }
    };
  }

  /* ---------- sincronización con los demás usuarios ---------- */
  const editing = () => {
    const a = document.activeElement;
    return App.popOpen() || App.$('.modal-bg') || (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && a.id !== 'tq');
  };
  function live(ok) { $('#live').classList.toggle('off', !ok); $('#liveTxt').textContent = ok ? 'En línea' : 'Sin conexión'; }
  setInterval(async () => {
    if ($('#app').hidden || document.visibilityState !== 'visible') return;
    try {
      const d = await App.api('GET', '/api/estado'); live(true);
      const s = JSON.stringify(d);
      if (s === snapshot || editing()) return;
      snapshot = s;
      Object.assign(App.S, { columns: d.columns, projects: d.projects, activities: d.activities, cases: d.cases, sessions: d.sessions, committees: d.committees, people: d.people, me: d.me });
      if (!App.drawerOpen()) App.render();
    } catch (e) { if (e.status !== 401) live(false); }
  }, 20000);

  /* ---------- inicio ---------- */
  (async function init() {
    try {
      const st = await App.api('GET', '/api/auth/estado');
      App.S.org = st.org;
      if (st.setup) return showLogin('setup', st);
      if (!st.user) return showLogin('login', st);
      await enter();
    } catch (e) { $('#login').hidden = false; $('#loginForm').innerHTML = `<div class="logo">P</div><h1>No hay conexión con el servidor</h1><p>${esc(e.message)}</p>`; }
  })();
})();
