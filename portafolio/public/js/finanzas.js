// ============================================================
// FINANZAS DEL CASO DE NEGOCIO (se usa en el navegador y en el servidor)
// flujos: [{ concepto, tipo: 'inversion'|'costo'|'beneficio', valores: [año0, año1, ...] }]
// ============================================================
(function (root) {
  const num = v => (Number.isFinite(Number(v)) ? Number(v) : 0);

  function vpn(netos, r) { return netos.reduce((a, v, t) => a + v / Math.pow(1 + r, t), 0); }

  function tir(netos) {
    if (!netos.some(v => v < 0) || !netos.some(v => v > 0)) return null;
    let lo = -0.99, hi = 10, flo = vpn(netos, lo), fhi = vpn(netos, hi);
    if (flo * fhi > 0) return null;
    for (let i = 0; i < 200; i++) {
      const mid = (lo + hi) / 2, f = vpn(netos, mid);
      if (Math.abs(f) < 1e-6) return mid;
      if (f * flo < 0) { hi = mid; fhi = f; } else { lo = mid; flo = f; }
    }
    return (lo + hi) / 2;
  }

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
      payback,
      roi: egresos > 0 ? (totalBeneficio - egresos) / egresos : null,
    };
  }

  const api = { calc, vpn, tir };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Finanzas = api;
})(this);
