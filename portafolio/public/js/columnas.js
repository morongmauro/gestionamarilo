/* ============================================================
   COLUMNAS DEL PORTAFOLIO · revisar y quitar las que no se usan
   Tarjeta de Administración: para cada columna muestra cuántas
   iniciativas la tienen llena y si la app la usa en algún cálculo.
   Propone quitar las vacías que nada usa. Quitar una columna no borra
   los valores: quedan guardados en cada iniciativa y se pueden recuperar.
   ============================================================ */
'use strict';
(function () {
  const { $, esc } = App;
  // Lo que la app usa y para qué (las esenciales no se proponen nunca)
  const USO = {
    proyecto: ['Nombre de la iniciativa', true], estado: ['Fase de la iniciativa', true], trazabilidad: ['Bitácora de cambios', true],
    habilitadores: ['Responsables', true], realizadores: ['Responsables', true], okrs: ['Zoom por OKR', true], tipo_valor: ['Zoom por tipo de valor', true],
    ice_income: ['ICE · Income', true], ice_confianza: ['ICE · Confidence', true], ice_esfuerzo: ['ICE · Effort', true], ice_os: ['ICE · OS', true],
    income: ['Valor anual sin caso (antiguo)', false], valor_crear: ['Valor a crear sin caso', false], objetivos_semestre: ['ICE · OS (respaldo)', false],
    impacto: ['ICE antiguo 1-10', false], confianza: ['ICE antiguo 1-10', false], facilidad: ['ICE antiguo 1-10', false],
  };
  const lleno = v => !(v == null || v === '' || (Array.isArray(v) && !v.length));

  function analisis() {
    const ps = App.S.projects, n = ps.length;
    return App.S.columns.map(c => {
      const k = ps.filter(p => lleno((p.props || {})[c.id])).length;
      const uso = USO[c.id], esencial = c.type === 'title' || (uso && uso[1]) || c.log;
      // Se propone quitar: vacía (o casi) y sin uso esencial
      const propuesta = !esencial && (k === 0 || (n >= 10 && k / n < 0.05));
      return { c, k, n, pct: n ? Math.round(k / n * 100) : 0, uso: uso ? uso[0] : c.log ? 'Bitácora de cambios' : '', esencial, propuesta };
    });
  }

  function tarjeta() {
    const box = document.createElement('div'); box.className = 'card-box'; box.style.marginBottom = '16px';
    const pintar = () => {
      const a = analisis(), nProp = a.filter(x => x.propuesta).length;
      box.innerHTML = `<h3 style="font-size:14px;font-weight:800;margin-bottom:4px">Columnas del portafolio</h3>
        <div class="muted" style="font-size:12.5px;margin-bottom:10px">Cuántas iniciativas tienen llena cada columna y si la app la usa. ${nProp ? `Hay <b>${nProp}</b> vacías o casi vacías que nada usa: quedan marcadas para quitar.` : 'Ninguna columna está vacía y sin uso.'} Quitar una columna no borra sus valores: quedan guardados en cada iniciativa.</div>
        <div style="overflow:auto;max-height:420px"><table class="lst" style="font-size:12.5px"><thead><tr><th></th><th>Columna</th><th class="n">Llena en</th><th>La usa la app para</th><th>En la tabla</th></tr></thead><tbody>
        ${a.map(x => `<tr${x.propuesta ? ' style="background:var(--warn-bg)"' : ''}><td><input type="checkbox" data-col="${esc(x.c.id)}" ${x.propuesta ? 'checked' : ''} ${x.esencial ? 'disabled title="La app la necesita"' : ''} style="width:auto"></td>
          <td><b>${esc(x.c.name)}</b></td><td class="n">${x.k} de ${x.n} <span class="faint">(${x.pct} %)</span></td>
          <td>${x.uso ? esc(x.uso) + (x.esencial ? ' <span class="faint">· necesaria</span>' : '') : '<span class="faint">nada (solo informativa)</span>'}</td><td>${x.c.hidden ? '<span class="faint">oculta</span>' : 'visible'}</td></tr>`).join('')}
        </tbody></table></div>
        <div class="row" style="margin-top:10px;gap:8px;align-items:center"><button class="btn" data-cq="quitar">Quitar las marcadas</button><span data-cq-msg class="faint" style="font-size:12.5px"></span></div>`;
    };
    pintar();
    box.addEventListener('change', () => { const n = box.querySelectorAll('[data-col]:checked').length; $('[data-cq-msg]', box).textContent = n ? `${n} marcada${n === 1 ? '' : 's'}` : ''; });
    box.addEventListener('click', e => {
      if (!e.target.closest('[data-cq=quitar]')) return;
      const ids = [...box.querySelectorAll('[data-col]:checked')].map(x => x.dataset.col);
      if (!ids.length) return App.toast('Marca las columnas que quieres quitar', true);
      const nombres = ids.map(id => App.S.columns.find(c => c.id === id).name);
      if (!confirm(`¿Quitar ${ids.length} columna${ids.length === 1 ? '' : 's'} de la tabla?\n\n${nombres.join('\n')}\n\nLos valores quedan guardados en cada iniciativa y se pueden recuperar.`)) return;
      App.guard(async () => {
        const r = await App.api('PUT', '/api/config/columnas', { columns: App.S.columns.filter(c => !ids.includes(c.id)) });
        App.S.columns = r.columns; App.toast(`Listo: se quitaron ${ids.length} columna${ids.length === 1 ? '' : 's'}`); pintar();
      });
    });
    return box;
  }

  App.Columnas = { analisis, tarjeta };
})();
