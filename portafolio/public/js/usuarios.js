/* ============================================================
   USUARIOS (solo administradores), HISTORIAL (todos)
   ============================================================ */
'use strict';
(function () {
  const { $, esc } = App;
  const ROLES = { admin: 'Administrador', editor: 'Editor', lector: 'Lector', invitado: 'Invitado por iniciativa' };
  const ROL_HELP = { admin: 'Todo, incluso administrar usuarios', editor: 'Crea y edita iniciativas, cronogramas, casos y agenda', lector: 'Solo consulta', invitado: 'Solo las iniciativas que usted le comparta, para ver o registrar' };
  const PUEDE = { ver: 'Solo ver', registrar: 'Ver y registrar' };
  // Para el invitado: qué puede hacer y en cuáles iniciativas
  function accesoHTML(u) {
    const sel = new Set(u.proyectos || []), ps = App.projectsSorted().filter(p => !App.esEjemplo(p));
    return `<div class="inv-acc"><label>Puede <select class="fld" data-n="puede">${Object.entries(PUEDE).map(([k, l]) => `<option value="${k}" ${k === (u.puede || 'ver') ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <p class="faint" style="margin:0">«Ver y registrar» le deja escribir novedades, actualizar el cronograma y los riesgos. Nunca borra iniciativas ni cambia la fase.</p>
      <label>Iniciativas <input class="fld" data-n="q" placeholder="Buscar iniciativa…"></label>
      <div class="inv-ps">${ps.map(p => `<label data-nm="${esc(App.projectName(p).toLowerCase())}"><input type="checkbox" data-pid="${p.id}" ${sel.has(p.id) ? 'checked' : ''}> ${esc(App.projectName(p))}</label>`).join('')}</div>
      <div class="faint" data-n="cuenta" style="font-size:12px"></div></div>`;
  }
  function accesoVivo(p) {
    const cuenta = () => { const n = p.querySelectorAll('.inv-ps input:checked').length; const c = p.querySelector('[data-n=cuenta]'); if (c) c.textContent = n ? `${n} iniciativa${n === 1 ? '' : 's'} elegida${n === 1 ? '' : 's'}` : 'Elija al menos una iniciativa'; };
    const q = p.querySelector('[data-n=q]'); if (q) q.oninput = () => { const t = q.value.trim().toLowerCase(); p.querySelectorAll('.inv-ps label').forEach(l => { l.hidden = !!t && !l.dataset.nm.includes(t); }); };
    p.addEventListener('change', e => { if (e.target.closest('.inv-ps')) cuenta(); }); cuenta();
  }
  const leerAcceso = p => ({ puede: (p.querySelector('[data-n=puede]') || {}).value || 'ver', proyectos: [...p.querySelectorAll('.inv-ps input:checked')].map(x => x.dataset.pid) });
  function editarAcceso(anchor, u) {
    const p = App.openPop(anchor, `<div class="lbl">Acceso de ${esc(u.name)}</div><div class="vl-f">${accesoHTML(u)}<button class="btn primary" data-n="guardar">Guardar</button></div>`, { width: 380 });
    accesoVivo(p);
    p.onclick = e => { if (!e.target.closest('[data-n=guardar]')) return; const a = leerAcceso(p); if (!a.proyectos.length) return App.toast('Elija al menos una iniciativa', true);
      App.guard(async () => { await App.api('PATCH', '/api/usuarios/' + u.id, a); App.closePop(true); App.toast('Acceso actualizado: se aplica en su próxima recarga'); App.render(); }); };
  }
  const accesoTxt = u => u.role !== 'invitado' ? '<span class="muted">Todo el portafolio</span>' : `<button class="t-lnk" data-u="acceso" title="${esc((u.proyectos || []).map(id => App.projectName(App.byId('projects', id))).join('\n'))}">${PUEDE[u.puede] || 'Solo ver'}, ${(u.proyectos || []).length} iniciativa${(u.proyectos || []).length === 1 ? '' : 's'}</button>`;
  const tempPass = () => { const L = 'abcdefghjkmnpqrstuvwxyz', r = n => Array.from(crypto.getRandomValues(new Uint32Array(n))); return 'Pf-' + r(4).map(x => x % 10).join('') + '-' + r(4).map(x => L[x % L.length]).join(''); };

  async function usuarios(main) {
    if (!App.isAdmin()) { main.innerHTML = '<div class="empty-box"><b>Solo los administradores ven esta sección</b></div>'; return; }
    main.innerHTML = '<div class="empty-box">Cargando…</div>';
    const ruta = location.hash; // si mientras carga se cambia de página, no se pinta encima
    let users;
    try { users = await App.api('GET', '/api/usuarios'); } catch (e) { if (location.hash === ruta) main.innerHTML = `<div class="empty-box"><b>${esc(e.message)}</b></div>`; return; }
    if (location.hash !== ruta) return;
    users.sort((a, b) => a.name.localeCompare(b.name));
    const base = location.origin;
    const tablas = ['proyectos', 'actividades', 'casos', 'flujos', 'sesiones', 'compromisos', 'comites'];
    main.innerHTML = `<div class="page-h"><button class="burger" data-act="burger">☰</button><div><h1>Administración</h1>${App.aud() ? '<a class="t-lnk ad-hist" href="#/historial">Historial de cambios</a>' : ''}<div class="sub">${users.length} ${users.length === 1 ? 'persona' : 'personas'} con acceso, cada quien entra con su correo y su propia contraseña</div></div><span class="sp"></span><button class="btn primary" data-u="new">+ Agregar persona</button></div>
      <div class="ad-como"><b>Cómo funciona.</b> Agregue a la persona con una contraseña temporal y compártale el mensaje por Teams o correo. Al entrar, el sitio le pide crear la suya. Si la olvida, use «Nueva contraseña temporal» en su fila y repita. No necesita correo automático.</div>
      <div class="card-box" style="padding:0;overflow:auto;margin-bottom:16px"><table class="lst"><thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Acceso</th><th>Estado</th><th>Último ingreso</th><th></th></tr></thead><tbody>
        ${users.map(u => `<tr class="${u.active ? '' : 'off'}" data-id="${u.id}"><td><span style="display:inline-flex;align-items:center;gap:8px"><span class="av">${esc(App.initials(u.name))}</span><b>${esc(u.name)}</b>${u.id === App.S.me.id ? ' <span class="tag">tú</span>' : ''}</span></td><td>${esc(u.email)}</td>
          <td><select data-u="role" title="${esc(ROL_HELP[u.role])}">${Object.entries(ROLES).map(([k, l]) => `<option value="${k}" ${k === u.role ? 'selected' : ''}>${l}</option>`).join('')}</select></td>
          <td>${accesoTxt(u)}</td>
          <td>${!u.active ? '<span class="tag">Desactivado</span>' : u.pide_clave ? `<button class="tag warn" data-u="enlace" title="Pidió restablecer su contraseña ${esc(App.d.ago(u.pide_clave))}. Clic para generar el enlace">Pidió restablecer su contraseña, enviar enlace</button>` : u.invitado ? `<span class="tag warn" title="${u.enlace_vence ? 'El enlace vence ' + esc(App.d.fmt(u.enlace_vence.slice(0, 10))) : ''}">Invitación pendiente</span>` : u.must_change ? '<span class="tag warn">Debe cambiar la contraseña</span>' : '<span class="tag">Activo</span>'}</td>
          <td class="muted">${u.last_login ? esc(App.d.ago(u.last_login)) : 'Nunca'}</td>
          <td style="white-space:nowrap;text-align:right">${u.active ? '<button class="btn sm" data-u="reset" title="Le da una contraseña temporal para entrar; al entrar la cambia">Nueva contraseña temporal</button> ' : ''}<button class="btn sm" data-u="more" aria-label="Más opciones">⋯</button></td></tr>`).join('')}
      </tbody></table></div>
      <div class="card-box" style="margin-bottom:16px"><h3 style="font-size:14px;font-weight:800;margin-bottom:6px">Roles</h3>
        ${Object.entries(ROLES).map(([k, l]) => `<div style="font-size:12.5px;margin:3px 0"><b>${l}:</b> <span class="muted">${ROL_HELP[k]}</span></div>`).join('')}</div>
      ${App.S.demo ? `<div class="card-box" style="margin-bottom:16px"><h3 style="font-size:14px;font-weight:800;margin-bottom:6px">Datos de ejemplo</h3><div class="muted" style="font-size:12.5px;margin-bottom:10px">Esta es la copia de demostración. Puedes volver a los datos inventados cuando quieras (por ejemplo, antes de mostrarla): se borra lo que haya y se cargan de nuevo, con fechas desde hoy.</div><button class="btn" data-demo="1">↺ Restablecer datos de ejemplo</button></div>` : ''}
      <div class="card-box" style="margin-bottom:16px" id="lakeBox"><h3 style="font-size:14px;font-weight:800;margin-bottom:6px">Data lake de Azure</h3><div class="muted" style="font-size:12.5px">Consultando…</div></div>
      <div class="card-box"><h3 style="font-size:14px;font-weight:800;margin-bottom:6px">Exportación por API</h3>
        <div class="muted" style="font-size:12.5px;margin-bottom:10px">Otra forma de llevar los datos al lago: Data Factory o Databricks leen estas direcciones con el encabezado <code class="u">Authorization: Bearer EXPORT_TOKEN</code> (variable de entorno). Como administrador también puedes descargarlas aquí.</div>
        <table class="lst"><tbody>${tablas.map(t => `<tr><td><b>${t}</b></td><td><code class="u">${esc(base)}/api/export/${t}?format=csv</code></td><td style="text-align:right;white-space:nowrap"><a class="btn sm" href="/api/export/${t}?format=csv" download>CSV</a> <a class="btn sm" href="/api/export/${t}" target="_blank" rel="noopener">JSON</a></td></tr>`).join('')}</tbody></table></div>`;

    lakeCard($('#lakeBox', main));
    if (App.vista && App.vista.nueva) App.Mejoras.adminExtras(main);
    main.onclick = e => {
      if (e.target.closest('.burger')) return App.toggleSide();
      if (e.target.closest('[data-lake=enviar]')) return enviarLago(e.target.closest('[data-lake=enviar]'));
      if (e.target.closest('[data-demo]')) {
        if (!confirm('¿Borrar todo lo de esta copia de demostración y volver a cargar los datos de ejemplo?')) return;
        return App.guard(async () => { await App.api('POST', '/api/demo/cargar'); await App.reload(); App.toast('Datos de ejemplo cargados'); });
      }
      const b = e.target.closest('[data-u]'); if (!b) return;
      if (b.dataset.u === 'new') return nuevo(b);
      if (b.dataset.u === 'enlace') { const u0 = users.find(x => x.id === (b.closest('[data-id]') || {}).dataset.id); if (u0) return accion('enlace', u0, b); }
      const id = b.closest('[data-id]') && b.closest('[data-id]').dataset.id; const u = users.find(x => x.id === id);
      if (b.dataset.u === 'reset') return accion('reset', u, b);
      if (b.dataset.u === 'acceso') return editarAcceso(b, u);
      if (b.dataset.u === 'more') App.menu(b, [{ id: 'name', label: '✎ Cambiar nombre' }, { id: 'enlace', label: u.invitado ? '✉ Enviar de nuevo la invitación' : '✉ Enviar enlace para restablecer la contraseña' }, { id: 'reset', label: '⚿ Poner una contraseña temporal' }, { id: 'active', label: u.active ? '◌ Desactivar acceso' : '● Reactivar acceso' }, '-', { id: 'del', label: 'Eliminar usuario', danger: true }], m => accion(m, u, b), 240);
    };
    main.onchange = e => {
      const s = e.target.closest('[data-u=role]'); if (!s) return;
      const id = s.closest('[data-id]').dataset.id;
      App.guard(async () => { await App.api('PATCH', '/api/usuarios/' + id, { role: s.value }); App.toast(s.value === 'invitado' ? 'Ahora elija las iniciativas que puede ver (columna Acceso)' : 'Rol actualizado'); }).then(() => App.render());
    };
  }
  async function lakeCard(box) {
    let st;
    try { st = await App.api('GET', '/api/lake'); } catch (e) { box.innerHTML = `<h3 style="font-size:14px;font-weight:800">Data lake de Azure</h3><div class="muted">${esc(e.message)}</div>`; return; }
    const u = st.ultimo;
    const ult = !u ? 'Aún no se ha enviado' : u.ok ? `Último envío: ${esc(App.d.ago(u.at))} (${esc(u.origen)}${u.por && u.origen === 'manual' ? ', ' + esc(u.por) : ''}), ${u.archivos.reduce((a, x) => a + x.filas, 0)} filas en ${u.archivos.length} tablas` : `<span style="color:var(--crit-ink);font-weight:700">Falló el último envío (${esc(App.d.ago(u.at))}): ${esc(u.error)}</span>`;
    box.innerHTML = `<h3 style="font-size:14px;font-weight:800;margin-bottom:6px">Data lake de Azure ${st.configurado ? '<span class="tag" style="background:var(--c-verde);color:var(--c-verde-i)">Conectado</span>' : '<span class="tag">Sin configurar</span>'}</h3>
      ${st.configurado ? `<div style="font-size:12.5px;line-height:1.7"><div><span class="muted">Destino:</span> <code class="u">${esc(st.destino)}</code></div>
        <div><span class="muted">Acceso:</span> ${esc(st.autenticacion)}, <span class="muted">Formato:</span> ${esc(st.formato.toUpperCase())}, <span class="muted">Envío automático:</span> ${st.hora == null ? 'apagado' : `todos los días a las ${st.hora}:00`}</div>
        <div><span class="muted">Archivos:</span> <code class="u">&lt;tabla&gt;/fecha=AAAA-MM-DD/</code> (histórico) y <code class="u">&lt;tabla&gt;/actual/</code> (última foto)</div>
        <div style="margin-top:6px">${ult}</div></div>
        <div style="margin-top:10px"><button class="btn primary" data-lake="enviar">Enviar ahora</button></div>`
      : `<div class="muted" style="font-size:12.5px">Para que la app escriba sola en el lago, agrega en la configuración del App Service <code class="u">LAKE_ACCOUNT</code> (la cuenta de almacenamiento del lago) y dale a la identidad de la app el rol <b>Storage Blob Data Contributor</b> sobre ese contenedor. Los pasos están en LEEME.md.</div>`}`;
  }
  function enviarLago(btn) {
    btn.disabled = true; btn.textContent = 'Enviando…';
    App.guard(async () => { const r = await App.api('POST', '/api/lake/enviar'); App.toast(`Enviadas ${r.archivos.length} tablas al data lake`); })
      .finally(() => lakeCard(App.$('#lakeBox')));
  }
  function accion(m, u, anchor) {
    if (m === 'name') return App.editText(anchor, u.name, { placeholder: 'Nombre', width: 300, onSave: v => v && v !== u.name && App.guard(async () => { await App.api('PATCH', '/api/usuarios/' + u.id, { name: v }); App.render(); }) });
    if (m === 'active') return App.guard(async () => { await App.api('PATCH', '/api/usuarios/' + u.id, { active: !u.active }); App.toast(u.active ? 'Acceso desactivado: su sesión se cerró' : 'Acceso reactivado'); App.render(); });
    if (m === 'del') { if (!confirm(`¿Eliminar a ${u.name}? Su historial de cambios se conserva.`)) return; return App.guard(async () => { await App.api('DELETE', '/api/usuarios/' + u.id); App.render(); }); }
    if (m === 'enlace') return App.guard(async () => { const r = await App.api('POST', `/api/usuarios/${u.id}/enlace`); mostrarEnlace(u.name, u.email, r); App.render(); });
    if (m === 'reset') {
      const pw = tempPass();
      if (!confirm(`¿Darle a ${u.name} una contraseña temporal nueva? Se cerrarán sus sesiones abiertas y al entrar deberá crear la suya.`)) return;
      App.guard(async () => { await App.api('PATCH', '/api/usuarios/' + u.id, { password: pw }); credenciales(u.name, u.email, pw); });
    }
  }
  // Invitar: la persona recibe (o se le comparte) un enlace para crear su propia contraseña
  function nuevo(anchor) {
    const pw = tempPass();
    const p = App.openPop(anchor, `<div class="lbl">Agregar una persona</div><div class="vl-f">
      <label>Nombre y apellido <input class="fld" data-n="name"></label>
      <label>Correo <input class="fld" type="email" data-n="email" placeholder="nombre@amarilo.com.co"></label>
      <label>Rol <select class="fld" data-n="role">${Object.entries(ROLES).map(([k, l]) => `<option value="${k}" ${k === 'editor' ? 'selected' : ''}>${l}: ${ROL_HELP[k].toLowerCase()}</option>`).join('')}</select></label>
      <div data-n="invbox" hidden>${accesoHTML({})}</div>
      <label>Contraseña temporal <input class="fld" data-n="pw" value="${pw}"></label>
      <p class="faint" style="margin:0">Al entrar por primera vez, el sitio le pide crear su propia contraseña.</p>
      <button class="btn primary" data-n="ok">Agregar y ver el mensaje para compartir</button>
      <button class="t-lnk" data-n="enlace" style="justify-self:start">Prefiero enviarle un enlace para que cree la contraseña</button></div>`, { width: 380 });
    accesoVivo(p);
    $('[data-n=role]', p).onchange = e => { $('[data-n=invbox]', p).hidden = e.target.value !== 'invitado'; };
    p.onclick = e => {
      const v = k => $(`[data-n=${k}]`, p).value.trim();
      const extra = () => { if (v('role') !== 'invitado') return {}; const a = leerAcceso(p); if (!a.proyectos.length) throw new Error('Elija al menos una iniciativa para el invitado'); return a; };
      if (e.target.closest('[data-n=enlace]')) { let body; try { body = { name: v('name'), email: v('email'), role: v('role'), ...extra() }; } catch (ex) { return App.toast(ex.message, true); }
        return App.guard(async () => { const r = await App.api('POST', '/api/usuarios/invitar', body); App.closePop(true); mostrarEnlace(r.user.name, r.user.email, Object.assign({ tipo: 'invitacion' }, r)); App.reload(); }); }
      const ok = e.target.closest('[data-n=ok]'); if (!ok || ok.disabled) return;
      let body; try { body = { name: v('name'), email: v('email'), role: v('role'), password: v('pw'), ...extra() }; } catch (ex) { return App.toast(ex.message, true); }
      ok.disabled = true;
      App.guard(async () => { const r = await App.api('POST', '/api/usuarios', body); App.closePop(true); credenciales(r.user.name, r.user.email, body.password); App.render(); }).finally(() => { ok.disabled = false; });
    };
  }
  function mostrarEnlace(name, email, r) {
    const inv = r.tipo === 'invitacion';
    const msg = inv ? `Hola ${name}, te di acceso al Portafolio de Generación de Valor.\nCrea tu contraseña aquí (el enlace vence en 7 días y sirve una sola vez):\n${r.link}` : `Hola ${name}, para poner una contraseña nueva en el Portafolio de Generación de Valor usa este enlace (vence en 48 horas y sirve una sola vez):\n${r.link}`;
    const bg = document.createElement('div'); bg.className = 'modal-bg';
    bg.innerHTML = `<div class="login-card"><h1>${inv ? 'Invitación lista' : 'Enlace listo'}</h1>
      <p>${r.enviado ? `Se envió a <b>${esc(email)}</b>. Si no le llega, compártele este mensaje por Teams o correo.` : `El correo automático no está configurado: compártele este mensaje a <b>${esc(email)}</b> por Teams o correo.`}</p>
      <div class="secret" style="white-space:pre-wrap;word-break:break-all">${esc(msg)}</div><button class="btn primary" data-m="copy">Copiar mensaje</button><button class="btn" data-m="close">Cerrar</button></div>`;
    document.body.appendChild(bg);
    bg.onclick = e => {
      if (e.target.closest('[data-m=copy]')) { navigator.clipboard && navigator.clipboard.writeText(msg).then(() => App.toast('Copiado'), () => App.toast('Selecciona el texto y cópialo', true)); }
      if (e.target.closest('[data-m=close]')) bg.remove();
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
  const COLL = { projects: 'la iniciativa', activities: 'la actividad', sections: 'el capítulo', cases: 'el', sessions: 'la sesión', committees: 'el comité', users: 'el usuario' };
  let quien = '';
  // Nombres que entiende cualquiera, en vez de los internos
  const CAMPO = { section_id: 'capítulo', name: 'nombre', responsable: 'responsable', inicio: 'fechas', fin: 'fechas', duracion: 'fechas', avance: 'avance', hito: 'hito', position: 'orden', notas: 'notas', deps: 'precedencias', dep_tipos: 'precedencias',
    real_ini: 'fechas reales', real_fin: 'fechas reales', base_ini: 'línea base', base_fin: 'línea base', entregable: 'entregable', area: 'área', flujos: 'tabla del caso', captado: 'valor captado', escenarios: 'escenarios', estado: 'estado',
    miembros: 'involucrados', fecha_meta: 'fecha meta', linea_base_at: 'línea base', compromisos: 'compromisos', proyectos: 'iniciativas en agenda', decisiones_reg: 'decisiones', decisiones: 'decisiones', temas: 'orden del día', asistentes: 'asistentes',
    tasa: 'tasa de descuento', anios: 'horizonte', anio_inicio: 'año 0', moneda: 'moneda', sponsor: 'sponsor', problema: 'problema', objetivo: 'objetivo', alcance: 'alcance', riesgos: 'riesgos', supuestos: 'supuestos', recomendacion: 'recomendación',
    titulo: 'título', fecha: 'fecha', hora_ini: 'hora', hora_fin: 'hora', lugar: 'lugar', enlace: 'enlace', comite_id: 'comité', frase: 'frase', color: 'color', role: 'rol', active: 'acceso', origen: 'origen', validacion: 'verificación' };
  const campos = l => { const col = id => (App.S.columns.find(c => c.id === id) || {}).name; const u = [...new Set((l || []).map(k => CAMPO[k] || col(k) || String(k).replace(/_/g, ' ')))]; return u.slice(0, 4).join(', ') + (u.length > 4 ? ` y ${u.length - 4} más` : ''); };
  // Varias actividades cambiadas de una vez (traer o pegar un cronograma) se cuentan en una sola línea
  function agrupar(items) {
    const out = [], pid = h => (h.coll === 'activities' || h.coll === 'sections') ? ((App.byId(h.coll, h.record_id) || {}).project_id || '') : null;
    for (let i = 0; i < items.length;) {
      const h = items[i], p = pid(h); let j = i + 1;
      if (p != null) while (j < items.length && items[j].user_name === h.user_name && pid(items[j]) === p && Math.abs(new Date(items[j].created_at) - new Date(h.created_at)) < 120000) j++;
      if (j - i >= 4) { const pr = App.byId('projects', p); out.push({ grupo: true, created_at: h.created_at, user_name: h.user_name, n: j - i, pid: p, nombre: pr ? App.projectName(pr) : '', creadas: items.slice(i, j).filter(x => /cre/.test(x.accion)).length }); i = j; }
      else { out.push(h); i++; }
    }
    return out;
  }
  async function historial(main) {
    main.innerHTML = '<div class="empty-box">Cargando…</div>';
    const ruta = location.hash;
    let items;
    try { items = await App.api('GET', '/api/historial'); } catch (e) { if (location.hash === ruta) main.innerHTML = `<div class="empty-box"><b>${esc(e.message)}</b></div>`; return; }
    if (location.hash !== ruta) return;
    const personas = [...new Set(items.map(h => h.user_name))].sort();
    const vis = items.filter(h => !quien || h.user_name === quien);
    let day = '';
    const link = h => {
      if (h.coll === 'projects' && App.byId('projects', h.record_id)) return `#/proyectos/${h.record_id}`;
      if (h.coll === 'activities' || h.coll === 'sections') { const a = App.byId(h.coll, h.record_id); if (a) return `#/proyectos/${a.project_id}/cronograma`; }
      if (h.coll === 'cases') { const c = App.byId('cases', h.record_id); if (c) return `#/casos/${c.project_id}`; }
      if (h.coll === 'sessions' && App.byId('sessions', h.record_id)) return `ses:${h.record_id}`;
      return null;
    };
    main.innerHTML = `<div class="page-h"><button class="burger" data-act="burger">☰</button><div><h1>Historial</h1><div class="sub">Quién cambió qué y cuándo, últimos ${items.length} cambios</div></div><span class="sp"></span>
      <select class="fld" id="hQuien" style="width:auto"><option value="">Todas las personas</option>${personas.map(p => `<option ${p === quien ? 'selected' : ''}>${esc(p)}</option>`).join('')}</select></div>
      ${vis.length ? agrupar(vis).map(h => { const d = h.created_at.slice(0, 10), hd = d !== day ? `<div class="h-day">${esc(App.d.fmtLong(new Date(h.created_at).toLocaleDateString('en-CA')))}</div>` : ''; day = d;
        const hora = new Date(h.created_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
        if (h.grupo) return hd + `<div class="h-item"><span class="hr">${hora}</span><span><b>${esc(h.user_name)}</b> ${h.creadas === h.n ? 'cargó' : 'actualizó'} ${h.n} actividades del cronograma${h.nombre ? ` de <a href="#/proyectos/${h.pid}/cronograma">«${esc(h.nombre)}»</a>` : ''}</span></div>`;
        const l = link(h);
        return hd + `<div class="h-item"><span class="hr">${new Date(h.created_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</span><span><b>${esc(h.user_name)}</b> ${esc(h.accion)} ${esc(COLL[h.coll] || '')} ${l ? `<a href="${l.startsWith('ses:') ? '#' : l}" ${l.startsWith('ses:') ? `data-ses="${l.slice(4)}"` : ''}>«${esc(h.nombre)}»</a>` : `«${esc(h.nombre)}»`}${(h.campos || []).length ? ` <span class="cp">· ${esc(campos(h.campos))}</span>` : ''}</span></div>`; }).join('') : '<div class="card-box"><div class="empty-box"><b>Aún no hay cambios registrados</b></div></div>'}`;
    $('#hQuien', main).onchange = e => { quien = e.target.value; historial(main); };
    main.onclick = e => {
      if (e.target.closest('.burger')) return App.toggleSide();
      const s = e.target.closest('[data-ses]'); if (s) { e.preventDefault(); App.Agenda.openSession(s.dataset.ses); }
    };
  }

  App.views.usuarios = { render: usuarios, async: true };
  App.views.historial = { render: historial, async: true };
})();
