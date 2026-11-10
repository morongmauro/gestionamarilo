/* ============================================================
   VISTA ÚNICA
   Antes había un interruptor entre la vista actual y la mejorada.
   Ahora hay una sola vista: menú por secciones (Tablero · Portafolio ·
   Cronogramas · Casos de negocio · Comité de valor · Ideas · Historial ·
   Administración) con las piezas de la vista mejorada siempre activas.
   Se conserva App.vista para los módulos que preguntan por ella.
   ============================================================ */
'use strict';
(function () {
  const { $ } = App;
  function aplicar() {
    document.documentElement.setAttribute('data-vista', 'nueva');
    if (App.S.demo !== undefined) marcaDemo();
  }
  // Marca de agua en la copia de demostración
  function marcaDemo() {
    let w = $('#demoWater');
    if (!App.S.demo) { if (w) w.remove(); return; }
    if (!w) { w = document.createElement('div'); w.id = 'demoWater'; w.setAttribute('aria-hidden', 'true'); w.textContent = 'DEMOSTRACIÓN · datos inventados'; document.body.appendChild(w); }
  }
  App.vista = { nueva: true, modo: 'nueva', cambiar() {}, aplicar, marcaDemo };
  try { App.store.set('vista', 'nueva'); } catch (e) { /* sin almacenamiento local */ }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', aplicar); else aplicar();
})();
