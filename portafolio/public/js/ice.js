/* ============================================================
   ICE · prioridad de cada iniciativa, calculada con lo que ya existe
   Misma fórmula de la tabla ICE de la Oficina (Notion):
     ICE = Income × Confianza ÷ Esfuerzo × 1,25
   - Income: puntaje Fibonacci (1, 2, 3, 5, 8, 13, 21, 34, 55) según el
     valor a crear o capturar.
   - Confianza y Esfuerzo: 25 %, 50 %, 75 % o 100 %.
   Orden de preferencia para obtener los tres factores:
     1. Del caso de negocio (valor total, estado y margen, inversión y duración).
     2. De las columnas Income / Confianza / Esfuerzo (como en Notion).
     3. De las columnas antiguas Impacto / Confianza / Facilidad (1 a 10).
   ============================================================ */
'use strict';
(function () {
  const FIB = [1, 2, 3, 5, 8, 13, 21, 34, 55];
  // Valor total a crear o capturar (COP) → Income. Cortes tomados de la tabla real de la Oficina.
  const BANDAS_INCOME = [[250e6, 1], [450e6, 2], [800e6, 3], [1200e6, 5], [2000e6, 8], [4000e6, 13], [8000e6, 21], [13000e6, 34], [Infinity, 55]];
  // Inversión del caso (COP) → Esfuerzo base
  const BANDAS_ESFUERZO = [[100e6, 25], [500e6, 50], [1500e6, 75], [Infinity, 100]];
  const banda = (v, b) => b.find(([lim]) => v <= lim)[1];
  const redondeaPct = v => { const n = Number(v); if (!(n > 0)) return null; const p = n <= 1 ? n * 100 : n; return [25, 50, 75, 100].reduce((a, x) => (Math.abs(x - p) < Math.abs(a - p) ? x : a), 25); };
  const fib = v => { const n = Number(v); if (!(n > 0)) return null; return FIB.reduce((a, x) => (Math.abs(x - n) < Math.abs(a - n) ? x : a), 1); };
  const formula = (income, conf, esf) => Math.round(income * (conf / 100) * 1.25 / (esf / 100) * 100) / 100;

  // Los tres factores a partir del caso de negocio
  function desdeCaso(p) {
    const caso = App.caseOf(p.id); if (!caso || caso.moneda === 'USD') return null;
    const f = Finanzas.calc(caso);
    const total = Number(f.totalBeneficio) || 0; if (!(total > 0)) return null;
    const income = banda(total, BANDAS_INCOME);
    // Confianza: estado del caso y margen de seguridad; sube si lo captado va en meta
    let conf = caso.estado === 'Aprobado' ? 75 : caso.estado === 'En revisión' ? 50 : 25;
    const margen = Finanzas.margen(caso);
    if (caso.estado === 'Aprobado' && margen != null && margen >= 0.25) conf = 100;
    if (caso.estado === 'Rechazado') conf = 25;
    // Esfuerzo: inversión y duración del plan
    let esf = banda(Number(f.totalInversion) || 0, BANDAS_ESFUERZO);
    const pl = App.planOf(p.id);
    if (pl.ini && pl.fin) { const meses = (new Date(pl.fin) - new Date(pl.ini)) / (30.44 * 86400e3); if (meses > 9 && esf < 100) esf += 25; }
    return { income, conf, esf, origen: 'caso', notas: [`Income ${income}: valor a crear ${App.moneyShort(total)} en el horizonte del caso`, `Confianza ${conf} %: caso ${(caso.estado || 'borrador').toLowerCase()}${margen != null ? `, margen de seguridad ${Math.round(margen * 100)} %` : ''}`, `Esfuerzo ${esf} %: inversión ${App.moneyShort(Number(f.totalInversion) || 0)}${pl.ini && pl.fin ? `, plan de ${Math.round((new Date(pl.fin) - new Date(pl.ini)) / (30.44 * 86400e3))} meses` : ''}`] };
  }
  // Los tres factores escritos a mano, como en la tabla de Notion
  function desdeColumnas(p) {
    const v = p.props || {};
    const income = fib(v.ice_income), conf = redondeaPct(v.ice_confianza), esf = redondeaPct(v.ice_esfuerzo);
    if (!income || !conf || !esf) return null;
    return { income, conf, esf, origen: 'manual', notas: ['Income, confianza y esfuerzo registrados en la tabla (sin caso de negocio con beneficios)'] };
  }
  // Columnas antiguas (1 a 10): se convierten a la misma escala
  function desdeAntiguas(p) {
    const v = p.props || {}; const lim = x => Math.min(10, Number(x)); // escala 1 a 10 (un 11 daría ICE infinito)
    const i = lim(v.impacto), c = lim(v.confianza), f = lim(v.facilidad);
    if (!(i > 0 && c > 0 && f > 0)) return null;
    return { income: FIB[Math.min(8, Math.round(i * 8 / 10))], conf: redondeaPct(c * 10), esf: redondeaPct(110 - f * 10), origen: 'antiguo', notas: ['Convertido de Impacto, Confianza y Facilidad (1 a 10)'] };
  }
  function detalle(p) {
    const d = desdeCaso(p) || desdeColumnas(p) || desdeAntiguas(p);
    if (!d) return { ice: null, origen: null, notas: ['Sin caso de negocio con beneficios ni Income/Confianza/Esfuerzo'] };
    return { ...d, ice: formula(d.income, d.conf, d.esf) };
  }
  App.ICE = { detalle, formula, FIB, BANDAS_INCOME, BANDAS_ESFUERZO, fib, redondeaPct,
    explicacion: 'ICE = Income × Confianza ÷ Esfuerzo × 1,25 (la misma fórmula de la tabla de la Oficina). Income es el puntaje Fibonacci del valor a crear o capturar (hasta $250 M = 1 … más de $13 mil M = 55); Confianza y Esfuerzo van de 25 % a 100 %. Cuando la iniciativa tiene caso de negocio con beneficios, los tres salen del caso: el valor total, el estado y el margen de seguridad, la inversión y la duración del plan. Si no, se usan los registrados en la tabla.' };
  App.iceOf = p => detalle(p).ice;
})();
