/* ============================================================
   FORMATO DEL CASO DE NEGOCIO (se usa en el navegador y en el servidor)
   Una sola tabla, como en Excel, con estas secciones:
     Supuestos     valen hasta que se cambien; no suman (tarifas, crecimientos, IPC…)
     Ingresos      ingresos y ahorros de cada año
     Gastos        gastos de operación e implementación, impuestos
     Inversión     lo que sale de caja para arrancar
     Resultados    cálculos intermedios (utilidad antes de renta…); no suman
   Debajo: flujo de caja del año y acumulado, a 10 años. Al final, las consideraciones (texto libre).
   ============================================================ */
'use strict';
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PlantillaCaso = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const ANIOS = 9; // horizonte: 10 columnas (año 1 a año 10)
  const SECCIONES = [
    ['supuesto', 'Supuestos · valen para los años siguientes hasta que se cambien; no suman'],
    ['beneficio', 'Ingresos y ahorros'],
    ['costo', 'Gastos'],
    ['inversion', 'Inversión'],
    ['calculo', 'Resultados · utilidad, impuestos y otros cálculos; no suman'],
  ];
  const CONSIDERACIONES = '1. Alcance y base del modelo\n• \n\n2. Ingresos\n• \n\n3. Gastos\n• \n\n4. Supuestos e inflación\n• \n\n5. Riesgos\n• \n\n6. Decisión que se pide al comité\n• ';
  // Los campos del formato anterior pasan a las consideraciones, sin perder nada
  const ANTERIORES = [
    ['problema', 'Problema u oportunidad'], ['objetivo', 'Objetivo'], ['alcance', 'Alcance'], ['fuera_alcance', 'Fuera de alcance'],
    ['beneficios_cual', 'Beneficios cualitativos'], ['riesgos', 'Riesgos'], ['supuestos', 'Supuestos'], ['recomendacion', 'Recomendación y decisión solicitada'],
  ];
  function consideracionesDe(caso) {
    const c = caso || {}, partes = [];
    let n = 0;
    ANTERIORES.forEach(([k, t]) => { const v = String(c[k] || '').trim(); if (v) partes.push(`${++n}. ${t}\n${v.split(/\n+/).map(l => (/^\s*[•\-*]/.test(l) ? l.trim() : '• ' + l.trim())).join('\n')}`); });
    const datos = [c.sponsor ? 'Sponsor: ' + c.sponsor : '', c.fecha_comite ? 'Fecha de comité: ' + c.fecha_comite : ''].filter(Boolean);
    if (datos.length) partes.push(`${++n}. Datos del comité\n${datos.map(x => '• ' + x).join('\n')}`);
    return partes.join('\n\n');
  }
  function nuevo(pid, anioInicio, uid) {
    const id = uid || (() => Math.random().toString(36).slice(2, 10));
    const fila = (tipo, concepto, extra) => Object.assign({ id: id(), concepto, tipo, valores: [] }, extra || {});
    return { project_id: pid, estado: 'Borrador', tasa: 12, anios: ANIOS, moneda: 'COP', anio_inicio: anioInicio, consideraciones: CONSIDERACIONES, flujos: [
      fila('supuesto', 'IPC (inflación)', { pct: true, nota: 'Reajuste anual de precios y gastos. Si un año queda vacío, vale el del año anterior.' }),
      fila('supuesto', 'Crecimiento anual de los ingresos', { pct: true }),
      fila('beneficio', 'Ingreso o ahorro esperado'),
      fila('costo', 'Gastos de operación'),
      fila('costo', 'Gastos de implementación'),
      fila('inversion', 'Inversión inicial'),
    ] };
  }
  // Aplica el formato a un caso que ya existe, sin tocar sus cifras
  function aplicar(caso) {
    const cambios = {};
    if (!(Number(caso.anios) >= ANIOS)) cambios.anios = ANIOS;
    if (!String(caso.consideraciones || '').trim()) { const t = consideracionesDe(caso); if (t) cambios.consideraciones = t; }
    return cambios;
  }
  return { ANIOS, SECCIONES, CONSIDERACIONES, ANTERIORES, consideracionesDe, nuevo, aplicar };
});
