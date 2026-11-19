/* ============================================================
   ARRANQUE, ingreso, navegación, barra lateral y sincronización
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
    h.setAttribute('data-theme', AP.tema === 'oscuro' ? 'dark' : 'light');
    h.setAttribute('data-estilo', 'marco'); // la barra siempre en el mismo lugar: solo cambia claro u oscuro
  }
  aplicarApariencia();
  App.apariencia = (k, v) => { if (k) { AP[k] = v; App.store.set('apariencia', AP); aplicarApariencia(); } return Object.assign({}, AP); };
  function panelApariencia(anchor) {
    const op = (k, lista) => `<div class="ap-op">${lista.map(([v, l]) => `<button data-ap="${k}" data-v="${v}" class="${AP[k] === v ? 'on' : ''}" aria-pressed="${AP[k] === v}">${l}</button>`).join('')}</div>`;
    const p = App.openPop(anchor, `<div class="lbl">Tema</div>${op('tema', [['claro', 'Claro'], ['oscuro', 'Oscuro']])}
      <div class="lbl">Versión del sitio</div><div class="ap-op"><button data-aud="off" class="${App.aud() ? '' : 'on'}">Actual</button><button data-aud="on" class="${App.aud() ? 'on' : ''}">Auditada (prueba)</button></div>
      <div class="hint" style="padding:0 10px 6px">Se guarda en este navegador.</div>`, { width: 300, nofocus: true });
    p.onclick = ev => { const b = ev.target.closest('[data-ap]'); if (!b) return; App.apariencia(b.dataset.ap, b.dataset.v); panelApariencia(anchor); };
  }

  // Se quita la pantalla de carga cuando ya hay algo que mostrar
  const booted = () => { const b = $('#boot'); if (b) b.remove(); };

  /* ---------- ingreso ---------- */
  function showLogin(mode, info = {}) {
    $('#app').hidden = true; $('#login').hidden = false; booted();
    // una ventana abierta (p. ej. cambiar contraseña) no queda encima del ingreso
    document.querySelectorAll('.modal-bg').forEach(m => m.parentNode.removeChild(m));
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
    } else if (mode === 'clave') {
      if (info.error) { f.innerHTML = `<h1>Este enlace ya no sirve</h1><p>${esc(info.error)}</p><button class="btn primary" type="button" data-l="ingreso">Ir al ingreso</button>`; }
      else f.innerHTML = `<div class="eyebrow">${org}</div><h1>${info.tipo === 'invitacion' ? `Hola, ${esc(info.name)}` : 'Pon una contraseña nueva'}</h1>
        <p>${info.tipo === 'invitacion' ? 'Te dieron acceso al Portafolio de Generación de Valor. Crea tu contraseña para entrar.' : 'Elige una contraseña nueva para tu cuenta.'}</p>
        <label>Correo</label><input class="fld" name="email" type="email" value="${esc(info.email || '')}" readonly autocomplete="username">
        <label>Contraseña</label><input class="fld" name="nueva" type="password" required autocomplete="new-password" placeholder="Mínimo 8 caracteres, letras y números">
        <label>Repítela</label><input class="fld" name="nueva2" type="password" required autocomplete="new-password">
        <button class="btn primary" type="submit">${info.tipo === 'invitacion' ? 'Crear contraseña y entrar' : 'Guardar y entrar'}</button><div class="err"></div>`;
    } else if (mode === 'olvide') {
      f.innerHTML = `<div class="eyebrow">${org}</div><h1>¿Olvidaste tu contraseña?</h1>
        <p>${info.correo ? 'Escribe tu correo y te enviaremos un enlace para poner una nueva.' : 'Escribe tu correo y avisaremos a los administradores para que te envíen un enlace y pongas una nueva.'}</p>
        <label>Correo</label><input class="fld" name="email" type="email" required autocomplete="username">
        <button class="btn primary" type="submit">${info.correo ? 'Enviarme el enlace' : 'Avisar a los administradores'}</button><div class="err"></div>
        <button class="btn ghost" type="button" data-l="ingreso" style="margin-top:8px">Volver al ingreso</button>`;
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
        <button class="btn primary" type="submit">Entrar</button><div class="err">${esc(info.msg || '')}</div>
        <button class="btn ghost" type="button" data-l="olvide" style="margin-top:8px">¿Olvidaste tu contraseña?</button>`;
    }
    const first = $('input:not([type=hidden]):not([readonly])', f); if (first) first.focus();
    f.onclick = e => { const l = e.target.closest('[data-l]'); if (!l) return; if (location.hash.startsWith('#/clave/')) history.replaceState(null, '', location.pathname); showLogin(l.dataset.l === 'olvide' ? 'olvide' : 'login', info); };
    f.onsubmit = async e => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(f).entries());
      const err = $('.err', f), btn = $('button[type=submit]', f);
      err.textContent = ''; btn.disabled = true;
      try {
        if (mode === 'setup') { await App.api('POST', '/api/auth/setup', d); await enter(); }
        else if (mode === 'clave') {
          if (d.nueva !== d.nueva2) throw new Error('Las dos contraseñas no coinciden');
          await App.api('POST', '/api/clave/' + encodeURIComponent(info.token), { password: d.nueva });
          history.replaceState(null, '', location.pathname + '#/tablero'); await enter();
        } else if (mode === 'olvide') {
          const r = await App.api('POST', '/api/auth/olvide', { email: d.email });
          f.innerHTML = `<h1>Listo</h1><p>${r.correo ? 'Si ese correo tiene acceso, en unos minutos te llega un enlace para poner una contraseña nueva. Revisa también la carpeta de correo no deseado.' : 'Si ese correo tiene acceso, los administradores ya lo saben y te enviarán un enlace para poner una contraseña nueva.'}</p><button class="btn primary" type="button" data-l="ingreso">Volver al ingreso</button>`;
          return;
        }
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
    App.S.almacenamiento = d.almacenamiento;
    App.S.direccion = d.direccion || null;
    Object.assign(App.S, { me: d.me, org: d.org, columns: d.columns, projects: d.projects, activities: d.activities, sections: d.sections || [], cases: d.cases, sessions: d.sessions, committees: d.committees, people: d.people, tablero: d.tablero || { income_unidad: 1e6 }, vistaPf: d.vistaPf || null, dgvCorte: d.dgvCorte || null, okrs: d.okrs || [] });
  }
  App.reload = async () => { try { await loadState(); App.render(); } catch (e) { console.error(e); } };

  async function enter() {
    await loadState();
    if (App.S.me.must_change) return showLogin('cambiar');
    $('#login').hidden = true; $('#app').hidden = false;
    $('#orgName').textContent = App.S.org;
    document.title = `${App.S.org}, Portafolio de Generación de Valor`;
    $('#meAv').textContent = App.initials(App.S.me.name);
    $('#meName').textContent = App.S.me.name;
    $('#meRole').textContent = { admin: 'Administrador', editor: 'Editor', lector: 'Solo lectura' }[App.S.me.role];
    $('#tabUsuarios').hidden = !App.isAdmin();
    $('#demoTag').hidden = !App.S.demo; live(true);
    if (App.vista) App.vista.aplicar();
    if (App.S.almacenamiento === 'memoria') {
      $('#demoTag').textContent = 'Demo sin base';
      $('#demoTag').title = 'Demostración sin base de datos: puedes ver y editar, pero los cambios se pierden cuando la app se reinicia (tras unos minutos sin uso).';
      let visto = false; try { visto = !!sessionStorage.getItem('pf.avisoMemoria'); sessionStorage.setItem('pf.avisoMemoria', '1'); } catch (e) {}
      if (!visto) { setTimeout(() => App.toast('Demostración sin base de datos: los cambios se pierden cuando la app se reinicia'), 1200); }
    }
    booted();
    if (!location.hash) location.hash = '#/tablero'; else App.render();
  }

  /* ---------- navegación ---------- */
  function route() {
    const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(x => { try { return decodeURIComponent(x); } catch { return x; } });
    return { sec: parts[0] || 'proyectos', params: parts.slice(1) };
  }
  App.render = () => {
    if ($('#app').hidden) return;
    const { sec, params } = route();
    const main = $('#main');
    main.className = App.canEdit() ? '' : 'ro';
    // Portafolio y Valor comparten tamaño de letra y de tabla
    const zPf = ((sec === 'proyectos' || sec === 'casos') && !params[0]) || sec === 'valor' ? App.zoomPf() : null;
    main.style.zoom = zPf || ''; main.style.setProperty('--z', zPf || 1);
    main.onclick = main.onchange = main.oninput = main.onmousedown = main.ondblclick = main.onmousemove = main.onmouseleave = null;
    main.ondragstart = main.ondragend = main.ondragover = main.ondrop = null;
    const keep = window.scrollY;
    if (sec === 'proyectos' && params[0]) App.Proyecto.render(main, params);
    else (App.views[sec] || App.views.proyectos).render(main, params);
    window.scrollTo(0, keep);
    const va = App.volverA && App.volverA();
    if (va) { const l = `<a class="volver" href="${App.esc(va.href)}" data-volver title="Regresar a donde estaba">‹ ${App.esc(va.nombre)}</a>`; const nav = main.querySelector('.ph-nav'); if (nav) { const bc = nav.querySelector('.ph-bc'); bc ? bc.insertAdjacentHTML('beforebegin', l + '<span class="ph-bc2">·</span>') : nav.insertAdjacentHTML('afterbegin', l); } else main.insertAdjacentHTML('afterbegin', `<div class="volver-f">${l}</div>`); }
    const LISTAS = { proyectos: ['Portafolio', null], casos: ['Casos de negocio', 'caso'], riesgos: ['Riesgos', 'riesgos'] };
    if (LISTAS[sec] && !params[0]) {
      const ids = []; main.querySelectorAll('[data-pid],[data-rk-ir]').forEach(el => { const id = el.dataset.pid || el.dataset.rkIr; if (el.offsetParent !== null && App.byId('projects', id) && !ids.includes(id) && (sec !== 'casos' || App.caseOf(id))) ids.push(id); });
      if (ids.length) App.store.set('nav.lista', { de: LISTAS[sec][0], href: '#/' + sec, tab: LISTAS[sec][1], ids });
    }
    $$('.tab[data-sec]').forEach(t => t.classList.toggle('active', t.dataset.sec === (sec === 'valor' ? 'casos' : sec)));
    sideProjects(sec === 'proyectos' ? params[0] : null);
    $('#app').classList.remove('open');
  };
  /* ---------- volver: recuerda de dónde viene cada página ---------- */
  let pila = []; try { pila = JSON.parse(sessionStorage.getItem('pf.pila') || '[]'); } catch (e) { pila = []; }
  let volviendo = false;
  const guardaPila = () => { try { sessionStorage.setItem('pf.pila', JSON.stringify(pila.slice(-40))); } catch (e) {} };
  const anota = () => {
    const h = location.hash || '#/tablero';
    if (volviendo) { const j = pila.lastIndexOf(h); pila = j >= 0 ? pila.slice(0, j + 1) : pila.concat(h); volviendo = false; }
    else if (pila[pila.length - 2] === h) pila.pop();
    else if (pila[pila.length - 1] !== h) pila.push(h);
    pila = pila.slice(-40); guardaPila();
  };
  const secDe = h => { const s = String(h || '').replace(/^#\/?/, '').split('/')[0] || 'proyectos'; return s === 'casos' ? 'valor' : s; };
  const NOMBRES = { tablero: 'Tablero', proyectos: 'Portafolio', cronograma: 'Cronogramas', casos: 'Valor', valor: 'Valor', riesgos: 'Riesgos', agenda: 'Comité de valor', historial: 'Historial', usuarios: 'Administración' };
  const nombreDe = h => { const p = String(h).replace(/^#\/?/, '').split('/'); const pr = p[0] === 'proyectos' && p[1] && App.byId('projects', decodeURIComponent(p[1])); return pr ? App.projectName(pr) : (NOMBRES[p[0]] || 'la página anterior'); };
  App.volverA = () => {
    const h = location.hash, s = secDe(h), r = h.replace(/^#\/?/, '').split('/').filter(Boolean);
    if (r.length < 2) return null; // las secciones principales ya están en la barra lateral
    for (let i = pila.length - 2; i >= 0; i--) { if (secDe(pila[i]) !== s) return { href: pila[i], nombre: nombreDe(pila[i]), pasos: pila.length - 1 - i }; if (pila[i] && r[1] && !pila[i].includes(r[1])) return null; }
    return null;
  };
  document.addEventListener('click', e => { const v = e.target.closest('[data-volver]'); if (!v) return; e.preventDefault(); const a = App.volverA(); if (!a) return; volviendo = true; history.go(-a.pasos); });
  anota();
  window.addEventListener('hashchange', () => { anota(); App.closePop(true); if (App.drawerOpen()) App.closeDrawer(); App.render(); window.scrollTo(0, 0); });

  function sideProjects(activeId) {
    const caja = $('.side-proj'), ver = /^#\/proyectos/.test(location.hash) || location.hash === '' ;
    caja.hidden = !ver; if (!ver) return;
    const q = App.store.get('side.q', ''), n = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const ec = App.estadoCol(), ps = App.projectsSorted().filter(p => (App.enAlcance(p) || p.id === activeId) && (!q || n(App.projectName(p)).includes(n(q))));
    const tabAct = (location.hash.split('/')[3] || '');
    const grupos = [[1, 'Fase 1'], [2, 'Fase 2'], [3, 'Fase 3'], ['otras', 'Otras']].map(([k, t]) => ({ t, l: ps.filter(p => { const f = window.Fases && ec ? Fases.clasificar((p.props || {})[ec.id]) : null; return k === 'otras' ? ![1, 2, 3].includes(f) : f === k; }) })).filter(g => g.l.length);
    const item = p => `<a class="sp-item ${p.id === activeId ? 'on' : ''}" href="#/proyectos/${p.id}${tabAct ? '/' + tabAct : ''}" title="${esc(App.projectName(p))}"><span class="nm">${esc(App.projectName(p))}</span></a>`;
    if (!$('#sideQ')) $('#sideProj').insertAdjacentHTML('beforebegin', '<div class="sp-q"><input id="sideQ" placeholder="Buscar iniciativa…" aria-label="Buscar iniciativa"></div>');
    const iq = $('#sideQ'); if (document.activeElement !== iq) iq.value = q;
    iq.oninput = () => { App.store.set('side.q', iq.value); sideProjects(activeId); };
    $('#sideProj').innerHTML = grupos.map(g => `<div class="sp-g">${g.t}<span>${g.l.length}</span></div>${g.l.map(item).join('')}`).join('') || '<div class="faint" style="font-size:12px;padding:4px 10px">Ninguna coincide.</div>';
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
    bg.addEventListener('keydown', e => { if (e.key === 'Escape') bg.remove(); });
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
      App.S.direccion = d.direccion || null;
      Object.assign(App.S, { columns: d.columns, projects: d.projects, activities: d.activities, sections: d.sections || [], cases: d.cases, sessions: d.sessions, committees: d.committees, people: d.people, me: d.me, tablero: d.tablero || { income_unidad: 1e6 } });
      if (!App.drawerOpen()) App.render();
    } catch (e) { if (e.status !== 401) live(false); }
  }, 20000);

  /* ---------- inicio ---------- */
  (async function init() {
    try {
      const st = await App.api('GET', '/api/auth/estado');
      App.S.org = st.org;
      // Enlace de invitación o para restablecer la contraseña: /#/clave/<código>
      const mClave = /^#\/clave\/([A-Za-z0-9_-]{20,})/.exec(location.hash);
      if (mClave) { try { const i = await App.api('GET', '/api/clave/' + mClave[1]); return showLogin('clave', Object.assign({}, st, i, { token: mClave[1] })); } catch (ex) { return showLogin('clave', Object.assign({}, st, { error: ex.message })); } }
      if (st.setup) return showLogin('setup', st);
      if (!st.user) return showLogin('login', st);
      // Con contraseña temporal el servidor no entrega datos: primero se cambia
      if (st.user.must_change) return showLogin('cambiar');
      await enter();
    } catch (e) {
      booted(); $('#login').hidden = false;
      // 503 = el servidor responde pero no arrancó (configuración); lo demás, red
      const cfg = e.status === 503;
      $('#loginForm').innerHTML = `<div class="alert critical" role="alert"><svg aria-hidden="true"><use href="#i-alerta"/></svg><div><b>${cfg ? 'La aplicación no está bien configurada' : 'No hay conexión con el servidor'}</b><span>${esc(String(e.message).replace(/^La aplicación no pudo arrancar:\s*/, ''))}. ${cfg ? 'Quien la publicó debe corregir la configuración (variables de entorno) y volver a publicar.' : 'Revisa tu conexión y recarga la página; si sigue, avísale a TI.'}</span></div></div><button class="btn primary" type="button" id="reintentar">Reintentar</button>`; $('#reintentar').onclick = () => location.reload(); }
  })();
})();
