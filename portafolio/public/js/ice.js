/* ============================================================
   ICE · prioridad de cada iniciativa, con el método de la Oficina de
   Generación de Valor (tabla ICE de Notion):

     ICE = Income × Confidence ÷ Effort × OS

   - Income (1 a 55, Fibonacci): dinero captado o ahorrado a dos años.
       ≤ $50 M = 1 · $51–200 M = 2 · $201–600 M = 3 (umbral: desde aquí van a la Of. Valor)
       $601 M–1.200 M = 5 · $1.201–2.200 M = 8 · $2.201–4.200 M = 13
       $4.201–8.200 M = 21 · $8.201–16.200 M = 34 · > $16.201 M = 55
   - Confidence: 100 % total · 75 % alta · 50 % media · 25 % baja.
   - Effort: 100 % = 6 meses o más · 75 % = 4 a 6 · 50 % = 2 a 4 · 25 % = menos de 2.
   - OS (objetivos del semestre): 0,75 no alineado · 1 alineado · 1,25 prioridad.
     Multiplica: la alineación sube el puntaje.

   De dónde sale cada factor (uno por uno):
     1. Lo que la Oficina registró en la tabla (columnas Income, % Confidence,
        Effort y Objetivos del semestre, importadas de Notion o escritas aquí).
     2. Si falta, se calcula: Income con los beneficios de los dos primeros años
        del caso de negocio; Confidence con el estado del caso; Effort con la
        duración del cronograma; OS = 1 (alineado) mientras nadie lo marque.
   ============================================================ */
'use strict';
(function () {
  const FIB = [1, 2, 3, 5, 8, 13, 21, 34, 55];
  // Dinero a dos años (COP) → Income
  const BANDAS_INCOME = [[50e6, 1], [200e6, 2], [600e6, 3], [1200e6, 5], [2200e6, 8], [4200e6, 13], [8200e6, 21], [16200e6, 34], [Infinity, 55]];
  const UMBRAL_OFICINA = 3; // Income 3 ($201 M a $600 M) en adelante va a la Oficina de Valor
  const OS_VALORES = [0.75, 1, 1.25];
  const banda = (v, b) => b.find(([lim]) => v <= lim)[1];
  const redondeaPct = v => { const n = Number(v); if (!(n > 0)) return null; const p = n <= 1 ? n * 100 : n; return [25, 50, 75, 100].reduce((a, x) => (Math.abs(x - p) < Math.abs(a - p) ? x : a), 25); };
  const fib = v => { const n = Number(v); if (!(n > 0)) return null; return FIB.reduce((a, x) => (Math.abs(x - n) < Math.abs(a - n) ? x : a), 1); };
  // OS: acepta 0,75 / 1 / 1,25 escritos como número o al inicio de un texto («1,25: Prioridad en el semestre»)
  const leeOS = v => {
    if (v == null || v === '') return null;
    const m = /^\s*([01](?:[.,]\d+)?)/.exec(String(v)); if (!m) return null;
    const n = Number(m[1].replace(',', '.'));
    return OS_VALORES.includes(n) ? n : null;
  };
  const formula = (income, conf, esf, os = 1) => Math.round(income * (conf / 100) / (esf / 100) * os * 100) / 100;
  const effortDeMeses = m => (m >= 6 ? 100 : m >= 4 ? 75 : m >= 2 ? 50 : 25);

  // Factores calculados a partir del caso de negocio y del cronograma
  function calculados(p) {
    const out = {}, notas = {};
    const caso = App.caseOf(p.id);
    if (caso && caso.moneda !== 'USD') {
      // Income: beneficios de los dos primeros años en que el caso tiene beneficios
      const f = Finanzas.calc(caso), b = f.beneficios || [];
      const t0 = b.findIndex(v => v > 0);
      if (t0 >= 0) {
        const dos = (b[t0] || 0) + (b[t0 + 1] || 0);
        out.income = banda(dos, BANDAS_INCOME);
        notas.income = `beneficios de los dos primeros años del caso: ${App.moneyShort(dos)}`;
      }
      // Confidence: estado del caso (y margen de seguridad si está aprobado)
      let conf = caso.estado === 'Aprobado' ? 75 : caso.estado === 'En revisión' ? 50 : 25;
      const margen = Finanzas.margen(caso);
      if (caso.estado === 'Aprobado' && margen != null && margen >= 0.25) conf = 100;
      out.conf = conf; notas.conf = `caso ${(caso.estado || 'borrador').toLowerCase()}${margen != null ? `, margen de seguridad ${Math.round(margen * 100)} %` : ''}`;
    }
    // Effort: duración del cronograma
    const pl = App.planOf(p.id);
    if (pl.ini && pl.fin) {
      const meses = (new Date(pl.fin) - new Date(pl.ini)) / (30.44 * 86400e3);
      out.esf = effortDeMeses(meses); notas.esf = `cronograma de ${String(Math.round(meses * 10) / 10).replace(".", ",")} meses`;
    }
    return { out, notas };
  }

  function detalle(p) {
    const v = p.props || {};
    const reg = { income: fib(v.ice_income), conf: redondeaPct(v.ice_confianza), esf: redondeaPct(v.ice_esfuerzo), os: leeOS(v.ice_os) ?? leeOS(v.objetivos_semestre) };
    const calc = calculados(p);
    const f = {}, notas = [], fuentes = new Set();
    const NOM = { income: 'Income', conf: 'Confidence', esf: 'Effort', os: 'OS' };
    const fmt = (k, x) => (k === 'conf' || k === 'esf' ? `${x} %` : k === 'os' ? String(x).replace('.', ',') : String(x));
    for (const k of ['income', 'conf', 'esf']) {
      if (reg[k] != null) { f[k] = reg[k]; fuentes.add('manual'); notas.push(`${NOM[k]} ${fmt(k, f[k])}: registrado por la Oficina`); }
      else if (calc.out[k] != null) { f[k] = calc.out[k]; fuentes.add('caso'); notas.push(`${NOM[k]} ${fmt(k, f[k])}: calculado (${calc.notas[k]})`); }
    }
    f.os = reg.os ?? 1;
    notas.push(reg.os != null ? `OS ${fmt('os', f.os)}: registrado por la Oficina` : 'OS 1: alineado (nadie lo ha marcado; 0,75 no alineado · 1,25 prioridad)');
    // Respaldo: columnas antiguas Impacto / Confianza / Facilidad (1 a 10)
    if (f.income == null || f.conf == null || f.esf == null) {
      const lim = x => Math.min(10, Number(x)), i = lim(v.impacto), c = lim(v.confianza), fa = lim(v.facilidad);
      if (i > 0 && c > 0 && fa > 0) return { income: FIB[Math.min(8, Math.round(i * 8 / 10))], conf: redondeaPct(c * 10), esf: redondeaPct(110 - fa * 10), os: f.os, origen: 'antiguo', ice: formula(FIB[Math.min(8, Math.round(i * 8 / 10))], redondeaPct(c * 10), redondeaPct(110 - fa * 10), f.os), notas: ['Convertido de Impacto, Confianza y Facilidad (1 a 10)'] };
      const falta = ['income', 'conf', 'esf'].filter(k => f[k] == null).map(k => NOM[k]);
      return { ice: null, origen: null, notas: [`Falta ${falta.join(', ')}: regístralo en la tabla o agrega el caso de negocio y el cronograma`] };
    }
    const origen = fuentes.size === 1 ? [...fuentes][0] : 'mixto';
    return { ...f, origen, ice: formula(f.income, f.conf, f.esf, f.os), oficina: f.income >= UMBRAL_OFICINA, notas };
  }

  App.ICE = { detalle, formula, FIB, BANDAS_INCOME, fib, redondeaPct, leeOS, effortDeMeses, UMBRAL_OFICINA,
    explicacion: 'ICE = Income × Confidence ÷ Effort × OS (método de la Oficina de Generación de Valor). Income: dinero a dos años en escala Fibonacci (≤ $50 M = 1 … > $16.201 M = 55; desde 3, $201–600 M, va a la Oficina). Confidence: 25 % a 100 %. Effort: 25 % menos de 2 meses · 50 % 2 a 4 · 75 % 4 a 6 · 100 % 6 o más. OS: 0,75 no alineado · 1 alineado · 1,25 prioridad del semestre. Se usa lo que la Oficina registró en la tabla; lo que falte se calcula del caso de negocio y del cronograma.' };
  App.iceOf = p => detalle(p).ice;
})();
