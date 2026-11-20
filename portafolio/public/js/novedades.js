/* ============================================================
   NOVEDADES de cada iniciativa
   Lo que pasa (avance, bloqueo, decisión, riesgo), quién lo dijo y, si aplica, de qué actividad.
   Algunas las deja el sistema: el cambio de fase y cada actividad que llega al 100 %.
   La bitácora de texto de antes (columna Trazabilidad) se sigue viendo como «Bitácora anterior».
   ============================================================ */
'use strict';
(function () {
  const { esc } = App;
  const TIPOS = { avance: 'Avance', bloqueo: 'Bloqueo', decision: 'Decisión', riesgo: 'Riesgo', auto: 'Automática' };
  const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const fechaTxt = f => { if (!f) return ''; const [y, m, d] = f.split('-'); return `${+d} ${MES[+m - 1]}${+y !== +App.d.today().slice(0, 4) ? ' ' + y : ''}`; };
  const puede = () => App.puedeRegistrar();
  const todas = () => App.S.novedades || [];
  const orden = (a, b) => (b.fecha || '').localeCompare(a.fecha || '') || String(b.created_at || '').localeCompare(String(a.created_at || ''));
  const lista = (pid, act) => todas().filter(n => n.project_id === pid && (!act || n.activity_id === act)).sort(orden);
  const ultima = pid => lista(pid)[0] || null;
  const actNombre = id => { const a = id && App.byId('activities', id); return a ? a.name || 'actividad' : ''; };

  // Las líneas de la columna Trazabilidad de antes, para leerlas
  function bitacora(p) {
    const c = App.S.columns.find(x => x.log) || App.S.columns.find(x => x.id === 'trazabilidad');
    const t = c && p ? String((p.props || {})[c.id] || '') : '';
    return t.split('\n').map(x => x.trim()).filter(Boolean).map(x => { const m = x.match(/^(\d{1,2}\s+[A-Za-zÁÉÍÓÚáéíóú]{3})\.?\s*[:,-]\s*(.*)$/); return m ? { f: m[1].toLowerCase(), t: m[2] } : { f: '', t: x }; });
  }

  const tipoHTML = n => `<b class="nv-k nv-${esc(n.tipo || 'avance')}">${esc(TIPOS[n.tipo] || 'Avance')}</b>`;
  const meta = n => [fechaTxt(n.fecha), n.tipo === 'auto' ? 'automática' : n.autor].filter(Boolean).join(', ') + (n.activity_id && actNombre(n.activity_id) ? ` · actividad «${actNombre(n.activity_id)}»` : '');
  const propia = n => n.tipo !== 'auto' && (n.autor_id === (App.S.me || {}).id || App.esAdmin());
  function itemHTML(n) {
    return `<li data-nv="${esc(n.id)}"><div class="nv-t">${tipoHTML(n)} · ${esc(n.texto)}</div><div class="nv-m">${esc(meta(n))}${propia(n) && puede() ? `<span class="nv-acc"> · <button class="t-lnk" data-nv-ed="${esc(n.id)}">editar</button> · <button class="t-lnk" data-nv-del="${esc(n.id)}">borrar</button></span>` : ''}</div></li>`;
  }

  // Una línea para la cabecera de la ficha
  function ultimaHTML(pid) {
    const n = ultima(pid); if (!n) return '';
    return `<a class="nv-ult" href="#/proyectos/${esc(pid)}/cronograma" data-nv-ver title="Ver todas las novedades"><span class="l">Última novedad</span>${tipoHTML(n)}<span class="t">${esc(n.texto)}</span><span class="m">${esc(fechaTxt(n.fecha))}${n.tipo === 'auto' ? '' : ', ' + esc(n.autor || '')}</span></a>`;
  }

  // Panel al lado del cronograma
  const estado = { act: null, todas: false };
  function panel(el, pid) {
    if (!el) return;
    const p = App.byId('projects', pid), l = lista(pid, estado.act), viejas = estado.act ? [] : bitacora(p);
    const MAX = 12, ver = estado.todas ? l : l.slice(0, MAX);
    el.innerHTML = `<div class="nv-h"><h3>Novedades</h3>${l.length ? `<span class="nv-n">${l.length}</span>` : ''}<span class="sp"></span><button class="t-lnk nv-ocu" data-nv-ocultar title="Ocultar el panel (vuelve con el botón «Novedades» del cronograma)">Ocultar</button></div>
      ${estado.act ? `<div class="nv-fil">De la actividad <b>${esc(actNombre(estado.act))}</b> <button class="t-lnk" data-nv-fil>ver todas</button></div>` : ''}
      ${l.length ? `<ul class="nv-l">${ver.map(itemHTML).join('')}</ul>${l.length > MAX && !estado.todas ? `<button class="t-lnk nv-mas" data-nv-todas>Ver las ${l.length}</button>` : ''}`
        : `<p class="nv-vacio">${estado.act ? 'Esta actividad aún no tiene novedades.' : 'Aún no hay novedades.'}${puede() ? ' Cuente aquí qué avanzó, qué está bloqueado o qué se decidió: queda con fecha y su nombre.' : ''}</p>`}
      ${viejas.length ? `<details class="nv-old"><summary>Bitácora anterior (${viejas.length})</summary><ul>${viejas.map(v => `<li>${v.f ? `<span class="f">${esc(v.f)}</span>` : ''}${esc(v.t)}</li>`).join('')}</ul></details>` : ''}`;
    el.onclick = e => {
      if (e.target.closest('[data-nv-nueva]')) return editor(e.target.closest('[data-nv-nueva]'), pid, estado.act);
      if (e.target.closest('[data-nv-ocultar]')) { App.store.set('nv.panel', false); return App.render(); }
      if (e.target.closest('[data-nv-fil]')) { estado.act = null; return refrescar(pid); }
      if (e.target.closest('[data-nv-todas]')) { estado.todas = true; return panel(el, pid); }
      const ed = e.target.closest('[data-nv-ed]'); if (ed) { const n = todas().find(x => x.id === ed.dataset.nvEd); if (n) editor(ed, pid, n.activity_id, n); return; }
      const del = e.target.closest('[data-nv-del]'); if (del) return borrar(del.dataset.nvDel, pid);
    };
  }
  function refrescar(pid) { panel(document.getElementById('nvPanel'), pid); marcar(document.getElementById('crPlan'), pid); }

  // Ventana para escribir (o corregir) una novedad
  function editor(anchor, pid, actId, n) {
    if (!puede()) return;
    const acts = App.actsOf(pid).slice().sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    let tipo = n ? n.tipo : 'avance';
    const pop = App.openPop(anchor, `<div class="nv-ed"><div class="lbl">${n ? 'Corregir la novedad' : 'Nueva novedad'}</div>
      <div class="nv-tipos" role="radiogroup" aria-label="Tipo">${Object.keys(TIPOS).filter(k => k !== 'auto').map(k => `<button type="button" data-nt="${k}" class="${k === tipo ? 'on' : ''}" aria-pressed="${k === tipo}">${TIPOS[k]}</button>`).join('')}</div>
      <textarea class="fld" rows="3" maxlength="2000" placeholder="Qué pasó, en una o dos frases">${n ? esc(n.texto) : ''}</textarea>
      <div class="nv-ops"><label>Actividad <select class="fld" data-nv-act><option value="">Ninguna en particular</option>${acts.map(a => `<option value="${esc(a.id)}" ${a.id === actId ? 'selected' : ''}>${esc(a.name || 'Actividad')}</option>`).join('')}</select></label>
        <label>Fecha <input class="fld" type="date" data-nv-f value="${esc((n && n.fecha) || App.d.today())}" max="${App.d.today()}"></label></div>
      <div class="nv-bt"><span class="err"></span><button class="btn sm" type="button" data-nv-x>Cancelar</button><button class="btn primary sm" type="button" data-nv-ok>Guardar</button></div></div>`, { width: 420 });
    const ta = pop.querySelector('textarea'); ta.focus();
    pop.onclick = async e => {
      const t = e.target.closest('[data-nt]'); if (t) { tipo = t.dataset.nt; pop.querySelectorAll('[data-nt]').forEach(b => { b.classList.toggle('on', b === t); b.setAttribute('aria-pressed', b === t); }); return; }
      if (e.target.closest('[data-nv-x]')) return App.closePop(true);
      if (!e.target.closest('[data-nv-ok]')) return;
      const texto = ta.value.trim(); if (!texto) { pop.querySelector('.err').textContent = 'Escriba la novedad'; return ta.focus(); }
      const body = { tipo, texto, activity_id: pop.querySelector('[data-nv-act]').value || null, fecha: pop.querySelector('[data-nv-f]').value || App.d.today() };
      const b = e.target.closest('[data-nv-ok]'); b.disabled = true;
      try {
        if (n) { const r = await App.api('PATCH', '/api/novedades/' + n.id, body); Object.assign(n, r); }
        else { const r = await App.api('POST', '/api/novedades', { ...body, project_id: pid }); App.S.novedades = [...todas(), r]; }
        App.closePop(true); App.toast(n ? 'Novedad corregida' : 'Novedad registrada'); despues(pid);
      } catch (ex) { pop.querySelector('.err').textContent = ex.message; b.disabled = false; }
    };
    ta.onkeydown = e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) pop.querySelector('[data-nv-ok]').click(); };
  }
  async function borrar(id, pid) {
    if (!confirm('¿Borrar esta novedad?')) return;
    await App.guard(async () => { await App.api('DELETE', '/api/novedades/' + id); App.S.novedades = todas().filter(x => x.id !== id); App.toast('Novedad borrada'); despues(pid); });
  }
  // Tras guardar: si está el panel, solo se refresca lo de novedades (el cronograma no se vuelve a pintar)
  function despues(pid) {
    if (document.getElementById('nvPanel')) { refrescar(pid); const u = document.querySelector('.nv-ult'), h = ultimaHTML(pid); if (u) u.outerHTML = h; else { const f = document.querySelector('.p-head .facts'); if (f && h) f.insertAdjacentHTML('afterend', h); } }
    else App.render();
  }

  // En cada actividad del cronograma, cuántas novedades tiene (clic: las muestra en el panel)
  function marcar(el, pid) {
    if (!el) return;
    const c = {}; todas().forEach(n => { if (n.project_id === pid && n.activity_id) c[n.activity_id] = (c[n.activity_id] || 0) + 1; });
    el.querySelectorAll('.nv-cnt').forEach(x => x.remove());
    el.querySelectorAll('tr.pl-act[data-a]').forEach(tr => { const k = c[tr.dataset.a]; if (!k) return; const w = tr.querySelector('.pl-nmw'); if (!w) return;
      w.insertAdjacentHTML('beforeend', `<button class="nv-cnt ${estado.act === tr.dataset.a ? 'on' : ''}" data-nv-actf="${esc(tr.dataset.a)}" title="${k} novedad${k === 1 ? '' : 'es'} de esta actividad: clic para verlas">${k}</button>`); });
    if (!el._nvClick) { el._nvClick = true; el.addEventListener('click', e => { const b = e.target.closest('[data-nv-actf]'); if (!b) return; e.stopPropagation(); e.preventDefault(); estado.act = estado.act === b.dataset.nvActf ? null : b.dataset.nvActf; estado.todas = false; refrescar(pid); }, true); }
  }
  // Al cambiar de iniciativa el filtro por actividad no se arrastra
  let pidActual = null;
  function montar(el, pid) { if (pid !== pidActual) { estado.act = null; estado.todas = false; pidActual = pid; } panel(el, pid); }

  // Lo más reciente de todo el portafolio (Tablero y agenda del comité)
  const recientes = (pids, desde) => todas().filter(n => (!pids || pids.includes(n.project_id)) && (!desde || (n.fecha || '') >= desde)).sort(orden);

  App.Novedades = { TIPOS, lista, ultima, ultimaHTML, panel: montar, editor, marcar, recientes, fechaTxt, tipoHTML, bitacora };
})();
