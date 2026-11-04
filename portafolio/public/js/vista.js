/* ============================================================
   VISTA MEJORADA · interruptor entre la vista actual y la mejorada
   - La elección se guarda en este navegador (pf.vista) y arranca en la
     vista actual: nada cambia para quien no toque el botón.
   - En la vista mejorada el menú se reduce a cinco entradas por pregunta
     (Inicio · Portafolio · Comités y decisiones · Proponer · Administración)
     y las secciones de operación siguen disponibles dentro de cada ficha.
   ============================================================ */
'use strict';
(function () {
  const { $, $$ } = App;
  let modo = App.store.get('vista', 'clasica') === 'nueva' ? 'nueva' : 'clasica';
  const ETIQUETAS = { tablero: 'Inicio', proyectos: 'Portafolio', agenda: 'Comités y decisiones', usuarios: 'Administración' };
  const originales = {};

  function aplicar() {
    document.documentElement.setAttribute('data-vista', modo);
    $$('.tab[data-sec]').forEach(t => {
      const sec = t.dataset.sec, lb = $('.lb', t); if (!lb) return;
      if (!(sec in originales)) originales[sec] = { lb: lb.textContent, title: t.title };
      if (modo === 'nueva' && ETIQUETAS[sec]) { lb.textContent = ETIQUETAS[sec]; t.title = ETIQUETAS[sec]; }
      else { lb.textContent = originales[sec].lb; t.title = originales[sec].title; }
    });
    const prop = $('#tabProponer'); if (prop) prop.hidden = modo !== 'nueva';
    const b = $('#vistaBtn');
    if (b) {
      b.innerHTML = modo === 'nueva'
        ? '<svg aria-hidden="true"><use href="#i-historial"/></svg><span>Volver a la vista actual</span>'
        : '<svg aria-hidden="true"><use href="#i-sistema"/></svg><span>Probar la vista mejorada</span>';
      b.setAttribute('aria-pressed', modo === 'nueva');
      b.title = modo === 'nueva' ? 'Vuelve al tablero y al menú de siempre. No se pierde nada.' : 'Inicio con evidencia, decisiones y «Qué es la Dirección». Puedes volver cuando quieras.';
    }
    if (App.S.demo !== undefined) marcaDemo();
  }
  // Marca de agua en la copia de demostración (solo en la vista mejorada)
  function marcaDemo() {
    let w = $('#demoWater');
    if (modo !== 'nueva' || !App.S.demo) { if (w) w.remove(); return; }
    if (!w) { w = document.createElement('div'); w.id = 'demoWater'; w.setAttribute('aria-hidden', 'true'); w.textContent = 'DEMOSTRACIÓN · datos inventados'; document.body.appendChild(w); }
  }
  function cambiar(a) {
    modo = a === 'nueva' ? 'nueva' : 'clasica';
    App.store.set('vista', modo);
    aplicar();
    App.toast(modo === 'nueva' ? 'Vista mejorada activada. «Volver a la vista actual» la desactiva.' : 'Volviste a la vista actual.');
    if (!$('#app').hidden) App.render();
  }
  function montar() {
    const nav = $('nav.tabs'); if (!nav || $('#vistaBtn')) return;
    // Pestaña «Proponer» (solo en la vista mejorada)
    const a = document.createElement('a');
    a.className = 'tab'; a.href = '#/proponer'; a.dataset.sec = 'proponer'; a.id = 'tabProponer'; a.title = 'Proponer una necesidad'; a.hidden = true;
    a.innerHTML = '<svg class="ic" aria-hidden="true"><use href="#i-casos"/></svg><span class="lb">Proponer</span>';
    const sep = $('.side-sep', nav); if (sep) nav.insertBefore(a, sep); else nav.appendChild(a);
    // Botón del interruptor, visible siempre
    const b = document.createElement('button');
    b.type = 'button'; b.id = 'vistaBtn'; b.className = 'vista-btn';
    b.addEventListener('click', () => cambiar(modo === 'nueva' ? 'clasica' : 'nueva'));
    nav.insertAdjacentElement('afterend', b);
    aplicar();
  }
  App.vista = { get nueva() { return modo === 'nueva'; }, get modo() { return modo; }, cambiar, aplicar, marcaDemo };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montar); else montar();
})();
