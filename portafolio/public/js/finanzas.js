// ============================================================
// FINANZAS DEL CASO DE NEGOCIO (se usa en el navegador y en el servidor)
// flujos: [{ concepto, tipo: 'inversion'|'costo'|'beneficio', valores: [año0, año1, ...] }]
// ============================================================
(function (root) {
  const num = v => (Number.isFinite(Number(v)) ? Number(v) : 0);

  function vpn(netos, r) { return netos.reduce((a, v, t) => a + v / Math.pow(1 + r, t), 0); }

  // TIR como en Excel: busca primero la tasa positiva más baja que deja el VPN en cero;
  // si no hay, la negativa más cercana a cero. Con varios cambios de signo en el flujo
  // puede haber más de una TIR: calc() lo avisa en «tirMultiple».
  function tir(netos) {
    if (!netos.some(v => v < 0) || !netos.some(v => v > 0)) return null;
    const grid = [];
    for (let r = 0; r < 1; r += 0.01) grid.push(r);
    for (let r = 1; r < 10; r += 0.1) grid.push(r);
    for (let r = 10; r <= 1000; r += 5) grid.push(r);
    const neg = []; for (let r = -0.01; r > -0.99; r -= 0.01) neg.push(r); neg.push(-0.99);
    const bisect = (lo, hi) => { let flo = vpn(netos, lo); for (let i = 0; i < 200; i++) { const mid = (lo + hi) / 2, f = vpn(netos, mid); if (Math.abs(f) < 1e-7) return mid; if (f * flo < 0) hi = mid; else { lo = mid; flo = f; } } return (lo + hi) / 2; };
    for (const lista of [grid, [0, ...neg]]) {
      for (let i = 1; i < lista.length; i++) {
        const a = vpn(netos, lista[i - 1]), b = vpn(netos, lista[i]);
        if (a === 0) return lista[i - 1];
        if (a * b < 0) return bisect(Math.min(lista[i - 1], lista[i]), Math.max(lista[i - 1], lista[i]));
      }
    }
    return null;
  }
  const cambiosDeSigno = netos => { let n = 0, prev = 0; netos.forEach(v => { if (v !== 0) { if (prev && Math.sign(v) !== Math.sign(prev)) n++; prev = v; } }); return n; };

  function calc(caso) {
    const anios = Math.max(1, Math.min(15, Math.round(num(caso && caso.anios) || 5)));
    const n = anios + 1; // año 0 .. año N
    const z = () => Array.from({ length: n }, () => 0);
    const inversion = z(), costos = z(), beneficios = z();
    for (const f of (caso && caso.flujos) || []) {
      const dest = f.tipo === 'beneficio' ? beneficios : f.tipo === 'inversion' ? inversion : costos;
      for (let t = 0; t < n; t++) dest[t] += num((f.valores || [])[t]);
    }
    const netos = beneficios.map((b, t) => b - costos[t] - inversion[t]);
    const acumulado = []; netos.reduce((a, v, t) => (acumulado[t] = a + v), 0);
    const r = num(caso && caso.tasa) / 100;
    const sum = a => a.reduce((x, y) => x + y, 0);
    const totalInversion = sum(inversion), totalCosto = sum(costos), totalBeneficio = sum(beneficios);
    let payback = null;
    if (netos.some(v => v !== 0)) {
      if (acumulado[0] >= 0 && netos[0] >= 0) payback = 0;
      else for (let t = 1; t < n; t++) {
        if (acumulado[t] >= 0 && acumulado[t - 1] < 0) { payback = t - 1 + (-acumulado[t - 1]) / (netos[t] || 1); break; }
      }
    }
    const egresos = totalInversion + totalCosto;
    return {
      anios, inversion, costos, beneficios, netos, acumulado,
      totalInversion, totalCosto, totalBeneficio,
      vpn: netos.some(v => v !== 0) ? vpn(netos, r) : null,
      tir: tir(netos),
      tirMultiple: cambiosDeSigno(netos) > 1,
      payback,
      roi: egresos > 0 ? (totalBeneficio - egresos) / egresos : null,
    };
  }

  // Escenario: ajusta beneficios, costos e inversión en % y puede retrasar los beneficios N años
  function ajustar(caso, a) {
    a = a || {};
    const k = t => 1 + (num(t === 'beneficio' ? a.b : t === 'inversion' ? a.i : a.c)) / 100;
    const flujos = ((caso && caso.flujos) || []).map(f => {
      let v = (f.valores || []).map(x => num(x) * k(f.tipo));
      if (f.tipo === 'beneficio' && a.retraso > 0) v = Array(a.retraso).fill(0).concat(v);
      return Object.assign({}, f, { valores: v });
    });
    return Object.assign({}, caso, { flujos });
  }
  // Cuánto pueden caer los beneficios (fracción) antes de que el VPN sea negativo.
  // Negativo = cuánto tendrían que subir para que el VPN llegue a cero.
  function margen(caso) {
    const f = calc(caso), r = num(caso && caso.tasa) / 100;
    const pv = arr => arr.reduce((a, v, t) => a + v / Math.pow(1 + r, t), 0);
    const pb = pv(f.beneficios), pe = pv(f.inversion.map((v, t) => v + f.costos[t]));
    return pb > 0 ? 1 - pe / pb : null;
  }

  const api = { calc, vpn, tir, ajustar, margen };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Finanzas = api;
})(this);
