/* ============================================================
   PAPELERA · lo eliminado en los últimos 30 días
   Una iniciativa vuelve con su cronograma, su caso y sus comités.
   ============================================================ */
'use strict';
(function () {
  const { esc } = App;
  const fecha = iso => new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
  const dias = iso => Math.max(0, Math.ceil((Date.parse(iso) - Date.now()) / 864e5));
  async function render(main) {
    main.innerHTML = `<div class="pg-top"><button class="burger" data-act="burger" aria-label="Menú">☰</button><h1>Papelera</h1></div><div class="empty-box">Cargando…</div>`;
    const ruta = location.hash;
    let items;
    try { items = await App.api('GET', '/api/papelera'); } catch (e) { if (location.hash === ruta) main.innerHTML = `<div class="empty-box"><b>${esc(e.message)}</b></div>`; return; }
    if (location.hash !== ruta) return;
    const admin = App.S.me && App.S.me.role === 'admin';
    main.innerHTML = `<div class="pg-top"><button class="burger" data-act="burger" aria-label="Menú">☰</button><h1>Papelera</h1></div>
      <p class="pp-sub">Lo que se elimina queda aquí 30 días y se puede restaurar completo. Después se borra solo.</p>
      ${items.length ? `<section class="t-card pf-tbl-card"><div class="pf-wrap"><table class="pf-tbl pp-tbl"><thead><tr><th>Qué</th><th>Eliminado</th><th>Se borra en</th><th></th></tr></thead><tbody>
      ${items.map(x => `<tr><td><b>${x.tipo === 'caso' ? 'Caso de negocio de ' : ''}${esc(x.nombre)}</b><small>${x.tipo === 'proyecto' ? `Iniciativa${x.actividades ? `, ${x.actividades} actividades` : ''}${x.con_caso ? ', con caso de negocio' : ''}` : 'Caso de negocio'}</small></td>
        <td>${esc(fecha(x.borrado_at))}<small>por ${esc(x.por || '—')}</small></td><td>${dias(x.vence)} días</td>
        <td class="pp-acc"><button class="btn primary sm" data-pp-rest="${esc(x.id)}">Restaurar</button>${admin ? `<button class="btn ghost sm" data-pp-del="${esc(x.id)}">Eliminar ya</button>` : ''}</td></tr>`).join('')}
      </tbody></table></div></section>` : '<div class="empty-box">La papelera está vacía.</div>'}`;
    main.onclick = e => {
      const r = e.target.closest('[data-pp-rest]');
      if (r) return App.guard(async () => { await App.api('POST', `/api/papelera/${r.dataset.ppRest}/restaurar`); await App.reload(); App.toast('Restaurado'); });
      const d = e.target.closest('[data-pp-del]');
      if (d && confirm('¿Eliminar definitivamente? Esto ya no se puede deshacer.')) return App.guard(async () => { await App.api('DELETE', `/api/papelera/${d.dataset.ppDel}`); render(main); App.toast('Eliminado definitivamente'); });
    };
  }
  App.views.papelera = { render, async: true };
})();
