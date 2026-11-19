/* ============================================================
   BUSCADOR GENERAL, Ctrl+K (o ⌘K) desde cualquier pantalla
   Salta a una iniciativa (y directo a su cronograma, caso,
   captura de valor, OKR o riesgos) o a una sección del sitio.
   ============================================================ */
'use strict';
(function () {
  const { esc } = App;
  const SECC = [['Tablero', '#/tablero'], ['Portafolio', '#/proyectos'], ['Cronogramas', '#/cronograma'], ['Valor: casos de negocio', '#/casos'], ['Valor: captura de valor', '#/valor/captura'], ['Valor: OKR', '#/valor/okr'], ['Riesgos', '#/riesgos'], ['Comité de valor', '#/agenda'], ['Ideas', '#/proponer'], ['Historial', '#/historial']];
  const PEST = [['cronograma', 'Cronograma'], ['caso', 'Caso'], ['captura', 'Captura'], ['okr', 'OKR'], ['riesgos', 'Riesgos']];
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  let bg = null, sel = 0, res = [];
  function resultados(q) {
    const n = norm(q).trim(), ec = App.estadoCol();
    const ps = App.projectsSorted().filter(p => !n || norm(App.projectName(p)).includes(n) || norm(App.okrsDe ? App.okrsDe(p).join(' ') : '').includes(n)).slice(0, 8)
      .map(p => ({ t: App.projectName(p), s: [ec ? (p.props || {})[ec.id] : '', App.enAlcance(p) ? '' : 'archivada'].filter(Boolean).join(', '), href: `#/proyectos/${p.id}`, p }));
    const ss = SECC.filter(([t]) => n && norm(t).includes(n)).map(([t, h]) => ({ t, s: 'sección del sitio', href: h }));
    return ps.concat(ss);
  }
  function pintar() {
    const q = bg.querySelector('input').value; res = resultados(q); sel = Math.min(sel, Math.max(0, res.length - 1));
    bg.querySelector('.bs-l').innerHTML = res.length ? res.map((r, i) => `<div class="bs-i ${i === sel ? 'on' : ''}" data-i="${i}"><a href="${r.href}" class="bs-t"><b>${esc(r.t)}</b>${r.s ? `<small>${esc(r.s)}</small>` : ''}</a>${r.p ? `<span class="bs-p">${PEST.map(([k, l]) => `<a href="${r.href}${k === 'cronograma' ? '' : '/' + k}">${l}</a>`).join('')}</span>` : ''}</div>`).join('') : '<p class="bs-v">No hay resultados.</p>';
  }
  function cerrar() { if (bg) { bg.remove(); bg = null; } }
  function abrir() {
    if (bg) return; sel = 0;
    bg = document.createElement('div'); bg.className = 'bs-bg';
    bg.innerHTML = `<div class="bs" role="dialog" aria-label="Buscar"><div class="bs-in"><i class="ico ico-buscar"></i><input placeholder="Buscar iniciativa, OKR o sección…" aria-label="Buscar"><kbd>Esc</kbd></div><div class="bs-l"></div><div class="bs-pie">↑ ↓ para moverse, Enter para abrir</div></div>`;
    document.body.appendChild(bg);
    const inp = bg.querySelector('input'); inp.focus();
    inp.oninput = () => { sel = 0; pintar(); };
    inp.onkeydown = e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(res.length - 1, sel + 1); pintar(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); pintar(); }
      if (e.key === 'Enter' && res[sel]) { e.preventDefault(); const h = res[sel].href; cerrar(); App.go(h); }
      if (e.key === 'Escape') cerrar();
    };
    bg.addEventListener('mousedown', e => { if (e.target === bg) cerrar(); });
    bg.addEventListener('click', e => { if (e.target.closest('a')) cerrar(); });
    pintar();
  }
  document.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) { if (document.getElementById('app').hidden) return; e.preventDefault(); abrir(); } });
  document.addEventListener('click', e => { if (e.target.closest('#btnBuscar')) { e.preventDefault(); abrir(); } });
  App.Buscar = { abrir };
})();
