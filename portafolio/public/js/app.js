/* ============================================================
   ARRANQUE · ingreso, navegación, barra lateral y sincronización
   Cada 20 segundos la app trae los cambios de los demás usuarios.
   ============================================================ */
'use strict';
(function () {
  const { $, $$, esc } = App;
  let snapshot = '';

  // Apariencia de cada persona: siempre arranca en claro; el oscuro solo si se elige
  const AP = Object.assign({ tema: 'claro', estilo: 'marco' }, App.store.get('apariencia', {}));
  function aplicarApariencia() {
    const h = document.documentElement;
    if (AP.tema === 'auto') h.removeAttribute('data-theme'); else h.setAttribute('data-theme', AP.tema === 'oscuro' ? 'dark' : 'light');
    h.setAttribute('data-estilo', ['claro', 'superior', 'marco'].includes(AP.estilo) ? AP.estilo : 'marco');
  }
  aplicarApariencia();
  App.apariencia = (k, v) => { if (k) { AP[k] = v; App.store.set('apariencia', AP); aplicarApariencia(); } return Object.assign({}, AP); };
  function panelApariencia(anchor) {
    const op = (k, lista) => `<div class="ap-op">${lista.map(([v, l]) => `<button data-ap="${k}" data-v="${v}" class="${AP[k] === v ? 'on' : ''}" aria-pressed="${AP[k] === v}">${l}</button>`).join('')}</div>`;
    const p = App.openPop(anchor, `<div class="lbl">Tema</div>${op('tema', [['claro', 'Claro'], ['oscuro', 'Oscuro'], ['auto', 'Como el equipo']])}
      <div class="lbl">Estilo</div>${op('estilo', [['claro', 'Barra blanca'], ['superior', 'Menú arriba'], ['marco', 'Barra morada']])}
      <div class="hint" style="padding:0 10px 6px">Se guarda en este navegador.</div>`, { width: 300, nofocus: true });
    p.onclick = ev => { const b = ev.target.closest('[data-ap]'); if (!b) return; App.apariencia(b.dataset.ap, b.dataset.v); panelApariencia(anchor); };
  }

  // Se quita la pantalla de carga cuando ya hay algo que mostrar
  const booted = () => { const b = $('#boot'); if (b) b.remove(); };

  /* ---------- ingreso ---------- */
  function showLogin(mode, info = {}) {
    $('#app').hidden = true; $('#login').hidden = false; booted();
    App.closeDrawer(); App.closePop(true);
    const f = $('#loginForm');
    const org = esc(info.org || App.S.org || 'Amarilo');
    $('#loginOrg').textContent = info.org || App.S.org || 'Amarilo';
    if (mode === 'setup') {
      f.innerHTML = `<h1>Primer ingreso</h1><p>Crea el usuario administrador de ${org}. Después podrás invitar al resto del equipo desde «Usuarios».</p>
        <label>Nombre</label><input class="fld" name="name" required autocomplete="name">
        <label>Correo</label><input class="fld" name="email" type="email" required autocomplete="email">
        <label>Contraseña</label><input class="fld" name="password" type="password" required autocomplete="new-password" placeholder="Mínimo 8 caracteres, letras y números">
        ${info.needCode ? '<label>Código de instalación</label><input class="fld" name="code" required autocomplete="off">' : ''}
        <button class="btn primary" type="submit">Crear administrador</button><div class="err"></div>`;
    } else if (mode === 'cambiar') {
      f.innerHTML = `<h1>Cambia tu contraseña</h1><p>Entraste con una contraseña temporal. Elige una propia para continuar.</p>
        <input type="hidden" name="actual" value="${esc(info.actual || '')}">
        ${info.actual ? '' : '<label>Contraseña actual</label><input class="fld" name="actual" type="password" required autocomplete="current-password">'}
        <label>Nueva contraseña</label><input class="fld" name="nueva" type="password" required autocomplete="new-password" placeholder="Mínimo 8 caracteres, letras y números">
        <label>Repítela</label><input class="fld" name="nueva2" type="password" required autocomplete="new-password">
        <button class="btn primary" type="submit">Guardar y entrar</button><div class="err"></div>`;
    } else {
      f.innerHTML = `<div class="eyebrow">${org}</div><h1>Inicia sesión</h1><p>Usa tu correo corporativo y tu contraseña.</p>${info.demo ? '<div class="demo-note">Versión de demostración: usa solo datos de prueba.</div>' : ''}
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
    App.S.demo = !!d.demo;
    Object.assign(App.S, { me: d.me, org: d.org, columns: d.columns, projects: d.projects, activities: d.activities, sections: d.sections || [], cases: d.cases, sessions: d.sessions, committees: d.committees, people: d.people, tablero: d.tablero || { income_unidad: 1e6 } });
  }
  App.reload = async () => { try { await loadState(); App.render(); } catch (e) { console.error(e); } };

  async function enter() {
    await loadState();
    if (App.S.me.must_change) return showLogin('cambiar');
    $('#login').hidden = true; $('#app').hidden = false;
    $('#orgName').textContent = App.S.org;
    document.title = `${App.S.org} · Portafolio de Generación de Valor`;
    $('#meAv').textContent = App.initials(App.S.me.name);
    $('#meName').textContent = App.S.me.name;
    $('#meRole').textContent = { admin: 'Administrador', editor: 'Editor', lector: 'Solo lectura' }[App.S.me.role];
    $('#tabUsuarios').hidden = !App.isAdmin();
    $('#demoTag').hidden = !App.S.demo; live(true);
    booted();
    if (!location.hash) location.hash = '#/tablero'; else App.render();
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
  $('#meBtn').addEventListener('click', e => App.menu(e.currentTarget, [{ id: 'ap', label: '◐ Apariencia' }, { id: 'clave', label: '⚿ Cambiar contraseña' }, '-', { id: 'salir', label: '⎋ Cerrar sesión' }], async m => {
    if (m === 'ap') return setTimeout(() => panelApariencia($('#meBtn')), 0);
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
    return App.popOpen() || App.$('.modal-bg') || (App.PlanHost && App.PlanHost.ocupado()) || (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && a.id !== 'tq');
  };
  // Confianza: siempre se ve si la información está al día
  function live(ok) {
    $('#live').classList.toggle('off', !ok);
    $('#liveTxt').textContent = ok ? 'Sincronizado ' + new Date().toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' }) : 'Sin conexión: revisa tu red';
  }
  App.live = live;
  setInterval(async () => {
    if ($('#app').hidden || document.visibilityState !== 'visible') return;
    try {
      const d = await App.api('GET', '/api/estado'); live(true);
      const s = JSON.stringify(d);
      if (s === snapshot || editing()) return;
      snapshot = s;
      Object.assign(App.S, { columns: d.columns, projects: d.projects, activities: d.activities, sections: d.sections || [], cases: d.cases, sessions: d.sessions, committees: d.committees, people: d.people, me: d.me, tablero: d.tablero || { income_unidad: 1e6 } });
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
    } catch (e) { booted(); $('#login').hidden = false; $('#loginForm').innerHTML = `<div class="alert critical" role="alert"><svg aria-hidden="true"><use href="#i-alerta"/></svg><div><b>No hay conexión con el servidor</b><span>${esc(e.message)}. Revisa tu conexión y recarga la página; si sigue, avísale a TI.</span></div></div><button class="btn primary" type="button" id="reintentar">Reintentar</button>`; $('#reintentar').onclick = () => location.reload(); }
  })();
})();
