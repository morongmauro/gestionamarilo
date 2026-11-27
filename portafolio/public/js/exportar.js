/* ============================================================
   EXPORTAR Y COMPARTIR
   - PDF: arma un documento limpio (logo, título, fecha y quién lo generó) y abre
     «Imprimir» del navegador, donde se elige «Guardar como PDF».
   - Excel (.xlsx): lo arma el servidor con formatos de pesos, % y fechas.
   - Enlaces de solo lectura para terceros (solo administradores).
   ============================================================ */
'use strict';
(function () {
  const { esc } = App;
  const ahora = () => new Date().toLocaleString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  const meta = () => `Generado el ${ahora()} por ${(App.S.me || {}).name || ''}`;
  const archivo = t => String(t || 'documento').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase().slice(0, 70);

  // Los datos de una iniciativa, con la misma forma que reciben los enlaces compartidos
  function datosDe(pid) {
    const p = App.byId('projects', pid), ec = App.estadoCol(), c = App.caseOf(pid);
    let caso = null;
    if (c) { caso = Object.assign({}, c); if (!(c.libro && (c.libro.hojas || []).length) && App.LibroUI) { try { caso.libro = App.LibroUI.desdeFlujos(c); } catch (e) {} } }
    return { hoy: App.d.today(), proyecto: { nombre: App.projectName(p), fase: ec ? (p.props || {})[ec.id] || '' : '', frase: p.frase || '' },
      secciones: (App.S.sections || []).filter(s => s.project_id === pid), actividades: App.actsOf(pid), caso, riesgos: p.riesgos || [], novedades: (App.S.novedades || []).filter(n => n.project_id === pid) };
  }
  // Imprime un documento preparado (sin la app alrededor)
  function imprimir(html, nombre) {
    let box = document.getElementById('imp'); if (!box) { box = document.createElement('div'); box.id = 'imp'; document.body.appendChild(box); }
    box.innerHTML = html;
    const titulo = document.title; document.title = nombre;
    document.body.classList.add('imprimiendo');
    const fin = () => { document.body.classList.remove('imprimiendo'); document.title = titulo; box.innerHTML = ''; window.removeEventListener('afterprint', fin); };
    window.addEventListener('afterprint', fin);
    const imgs = [...box.querySelectorAll('img')].filter(i => !i.complete);
    Promise.all(imgs.map(i => new Promise(r => { i.onload = i.onerror = r; }))).then(() => setTimeout(() => window.print(), 80));
  }
  function pdf(tipo, pid) {
    const d = datosDe(pid), html = Estatica.documento(d, { tipo, meta: meta() });
    imprimir(html, `${tipo}-${archivo(d.proyecto.nombre)}-${App.d.today()}`);
  }
  // PDF de una vista tal como se ve (Portafolio, Tablero): se copia lo de la pantalla, sin botones
  function pdfVista(titulo, sub, nodos, nombre) {
    const html = `<div class="ve">${Estatica.encabezado({ titulo, sub, meta: meta() })}<div class="imp-copia">${nodos.filter(Boolean).map(n => n.outerHTML).join('')}</div></div>`;
    imprimir(html, `${archivo(nombre || titulo)}-${App.d.today()}`);
  }

  // Excel: el servidor arma el .xlsx
  async function xlsx(nombre, hojas) {
    App.toast('Preparando el Excel…');
    const r = await fetch('/api/xlsx', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-Portafolio': '1' }, body: JSON.stringify({ nombre, hojas }) });
    if (!r.ok) { const j = await r.json().catch(() => ({})); return App.toast(j.error || 'No se pudo generar el Excel', true); }
    const a = document.createElement('a'); a.href = URL.createObjectURL(await r.blob()); a.download = archivo(nombre) + '.xlsx'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  function cronogramaXlsx(pid) {
    const secs = (App.S.sections || []).filter(s => s.project_id === pid).sort((a, b) => (a.position || 0) - (b.position || 0));
    const acts = App.actsOf(pid).slice().sort((a, b) => (secs.findIndex(s => s.id === a.section_id) - secs.findIndex(s => s.id === b.section_id)) || (a.position || 0) - (b.position || 0));
    const etapa = id => (secs.find(s => s.id === id) || {}).name || '';
    xlsx('cronograma-' + App.projectName(App.byId('projects', pid)), [{ nombre: 'Cronograma', columnas: [{ t: 'Etapa', ancho: 28 }, { t: 'Actividad', ancho: 46 }, { t: 'Responsable', ancho: 30 }, { t: 'Inicio', tipo: 'fecha', ancho: 13 }, { t: 'Fin', tipo: 'fecha', ancho: 13 }, { t: 'Avance', tipo: 'pct', ancho: 10 }, { t: 'Hito', ancho: 7 }, { t: 'Entregable', ancho: 36 }],
      filas: acts.map(a => [etapa(a.section_id), a.name || '', a.responsable || '', a.inicio || '', a.fin || '', (a.avance || 0) / 100, a.hito ? 'Sí' : '', a.entregable || '']) }]);
  }

  // Compartir: un enlace de solo lectura (solo administradores)
  function compartir(anchor, pid, tipo0) {
    if (!App.esAdmin()) return App.toast('Solo un administrador puede compartir enlaces', true);
    const pop = App.openPop(anchor, `<div class="lbl">Compartir «${esc(App.projectName(App.byId('projects', pid)))}» con un enlace</div><div class="vl-f">
      <label>Qué se ve <select class="fld" data-k="tipo"><option value="cronograma">Cronograma</option><option value="caso">Caso de negocio</option><option value="ficha">Ficha completa (cronograma, caso, riesgos y novedades)</option></select></label>
      <label class="chk-l"><input type="checkbox" data-k="resp" checked> Mostrar los responsables de las actividades</label>
      <label class="chk-l"><input type="checkbox" data-k="cifras" checked> Mostrar las cifras del caso de negocio</label>
      <label>Vence <select class="fld" data-k="dias"><option value="7">en 7 días</option><option value="30" selected>en 30 días</option><option value="90">en 90 días</option><option value="0">nunca</option></select></label>
      <p class="faint" style="margin:0">Quien tenga el enlace lo ve sin usuario, solo para mirar y siempre al día. Lo puede revocar en Administración → Enlaces compartidos.</p>
      <button class="btn primary" data-k="ok">Crear enlace</button></div>`, { width: 380 });
    pop.querySelector('[data-k=tipo]').value = tipo0 || 'cronograma';
    pop.onclick = e => {
      if (!e.target.closest('[data-k=ok]')) return;
      const v = k => pop.querySelector(`[data-k=${k}]`);
      App.guard(async () => {
        const r = await App.api('POST', '/api/enlaces', { project_id: pid, tipo: v('tipo').value, dias: +v('dias').value, opciones: { responsables: v('resp').checked, cifras: v('cifras').checked } });
        App.closePop(true); mostrarEnlace(r);
      });
    };
  }
  function mostrarEnlace(r) {
    const bg = document.createElement('div'); bg.className = 'modal-bg';
    bg.innerHTML = `<div class="login-card"><h1>Enlace listo</h1><p>${esc(r.nombre)}: ${esc({ cronograma: 'cronograma', caso: 'caso de negocio', ficha: 'ficha completa' }[r.tipo])}, solo lectura. ${r.vence ? 'Vence el <b>' + esc(App.d.fmt(r.vence.slice(0, 10))) + '</b>.' : 'No vence.'}</p>
      <div class="secret" style="word-break:break-all">${esc(r.link)}</div><button class="btn primary" data-m="copy">Copiar enlace</button><a class="btn" href="${esc(r.link)}" target="_blank" rel="noopener">Abrir para ver cómo queda</a><button class="btn" data-m="close">Cerrar</button></div>`;
    document.body.appendChild(bg);
    bg.onclick = e => {
      if (e.target.closest('[data-m=copy]')) navigator.clipboard && navigator.clipboard.writeText(r.link).then(() => App.toast('Enlace copiado'), () => App.toast('Seleccione el enlace y cópielo', true));
      if (e.target.closest('[data-m=close]') || e.target === bg) bg.remove();
    };
  }
  // Administración: los enlaces activos, con visitas, y revocar
  async function enlacesCard(box) {
    let l; try { l = await App.api('GET', '/api/enlaces'); } catch (e) { box.innerHTML = `<h3>Enlaces compartidos</h3><div class="muted">${esc(e.message)}</div>`; return; }
    const T = { cronograma: 'Cronograma', caso: 'Caso de negocio', ficha: 'Ficha completa' };
    box.innerHTML = `<h3 style="font-size:14px;font-weight:800;margin-bottom:6px">Enlaces compartidos</h3><div class="muted" style="font-size:12.5px;margin-bottom:8px">Vistas de solo lectura para personas sin usuario. Se crean desde el menú «⋯» de la iniciativa, del cronograma o del caso.</div>
      ${l.length ? `<table class="lst"><thead><tr><th>Iniciativa</th><th>Qué se ve</th><th>Creado</th><th>Vence</th><th>Visitas</th><th></th></tr></thead><tbody>${l.map(x => `<tr class="${x.vencido ? 'off' : ''}"><td><b>${esc(x.nombre)}</b></td><td>${esc(T[x.tipo] || x.tipo)}${x.opciones && x.opciones.cifras === false ? ', sin cifras' : ''}</td><td>${esc(x.creado_por)}, ${esc(App.d.ago(x.created_at))}</td><td>${x.vencido ? '<span class="tag">Vencido</span>' : x.vence ? esc(App.d.fmt(x.vence.slice(0, 10))) : 'Nunca'}</td><td>${x.vistas || 0}${x.ultima_vista ? `<span class="muted"> · última ${esc(App.d.ago(x.ultima_vista))}</span>` : ''}</td>
        <td style="white-space:nowrap;text-align:right">${x.vencido ? '' : `<button class="btn sm" data-en-copy="${esc(x.link)}">Copiar</button> `}<button class="btn sm" data-en-del="${esc(x.id)}">${x.vencido ? 'Quitar' : 'Revocar'}</button></td></tr>`).join('')}</tbody></table>` : '<div class="muted" style="font-size:12.5px">Aún no hay enlaces compartidos.</div>'}`;
    box.onclick = e => {
      const c = e.target.closest('[data-en-copy]'); if (c) return navigator.clipboard && navigator.clipboard.writeText(c.dataset.enCopy).then(() => App.toast('Enlace copiado'));
      const d = e.target.closest('[data-en-del]'); if (!d) return;
      if (!confirm('¿Revocar este enlace? Quien lo tenga dejará de ver la información.')) return;
      App.guard(async () => { await App.api('DELETE', '/api/enlaces/' + d.dataset.enDel); App.toast('Enlace revocado'); enlacesCard(box); });
    };
  }

  App.Exportar = { pdf, pdfVista, xlsx, cronogramaXlsx, compartir, enlacesCard, datosDe };
})();
