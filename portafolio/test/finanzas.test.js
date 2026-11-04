// Pruebas de los cálculos del caso de negocio (VPN, TIR, payback, ROI).
// Se corren con: npm test
const test = require('node:test');
const assert = require('node:assert/strict');
const F = require('../public/js/finanzas.js');

const caso = (inv, ben, tasa = 10, anios = 3) => ({
  tasa, anios, flujos: [
    { concepto: 'Inversión', tipo: 'inversion', valores: [inv, 0, 0, 0] },
    { concepto: 'Beneficio', tipo: 'beneficio', valores: [0, ben, ben, ben] }],
});

test('VPN descuenta cada año a la tasa', () => {
  assert.equal(Math.round(F.vpn([-100, 60, 60], 0.1)), Math.round(-100 + 60 / 1.1 + 60 / 1.21));
});
test('calc: VPN, TIR y payback de un caso simple', () => {
  const r = F.calc(caso(100, 50));
  assert.equal(Math.round(r.vpn), Math.round(-100 + 50 / 1.1 + 50 / 1.21 + 50 / 1.331));
  assert.ok(r.tir > 0.2 && r.tir < 0.25, 'TIR cerca del 23%');
  assert.equal(r.payback, 2, 'recupera la inversión al cierre del año 2');
  assert.equal(r.totalInversion, 100);
  assert.equal(r.totalBeneficio, 150);
});
test('un caso sin beneficios no tiene TIR ni payback', () => {
  const r = F.calc(caso(100, 0));
  assert.equal(r.tir, null);
  assert.equal(r.payback, null);
  assert.ok(r.vpn < 0);
});
test('margen de seguridad: cuánto pueden caer los beneficios antes de VPN negativo', () => {
  const m = F.margen(caso(100, 50));
  assert.ok(m > 0 && m < 1);
});
