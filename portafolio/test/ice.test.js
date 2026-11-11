// ICE con el método de la Oficina: Income × Confidence ÷ Effort × OS (npm test)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const vm = require('vm');
const path = require('path');

// public/js/ice.js corre en el navegador sobre App: se carga con un App mínimo
function cargar({ casos = {}, planes = {} } = {}) {
  const App = { caseOf: id => casos[id] || null, planOf: id => planes[id] || { ini: null, fin: null }, moneyShort: v => String(v) };
  const ctx = { App, Finanzas: require('../public/js/finanzas.js'), console };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../public/js/ice.js'), 'utf8'), ctx);
  return App;
}
const p = (props, id = 'p1') => ({ id, props });

test('fórmula: Income × Confidence ÷ Effort × OS', () => {
  const App = cargar();
  assert.equal(App.iceOf(p({ ice_income: 8, ice_confianza: 75, ice_esfuerzo: 50, ice_os: '1,25 · Prioridad del semestre' })), 15);
  assert.equal(App.iceOf(p({ ice_income: 8, ice_confianza: 75, ice_esfuerzo: 50, ice_os: '0,75 · No alineado' })), 9);
  assert.equal(App.iceOf(p({ ice_income: 8, ice_confianza: 75, ice_esfuerzo: 50 })), 12, 'sin OS cuenta como alineado (1)');
  assert.equal(App.iceOf(p({ ice_income: 3, ice_confianza: 0.5, ice_esfuerzo: 1 })), 1.5, 'acepta porcentajes como 0,5 y 1');
});

test('bandas de Income a dos años', () => {
  const App = cargar();
  const casos = v => cargar({ casos: { p1: { estado: 'Aprobado', anios: 3, flujos: [{ tipo: 'beneficio', valores: [0, v, 0, 0] }] } }, planes: { p1: { ini: '2026-01-01', fin: '2026-02-15' } } });
  const inc = v => casos(v).ICE.detalle(p({})).income;
  assert.deepEqual([50e6, 50e6 + 1, 200e6, 200e6 + 1, 600e6, 601e6, 1200e6, 2200e6, 4200e6, 8200e6, 16200e6, 16201e6].map(inc), [1, 2, 2, 3, 3, 5, 5, 8, 13, 21, 34, 55]);
  assert.equal(App.ICE.UMBRAL_OFICINA, 3);
});

test('factores calculados del caso y del cronograma cuando la tabla no los tiene', () => {
  const App = cargar({
    casos: { p1: { estado: 'En revisión', anios: 4, flujos: [{ tipo: 'inversion', valores: [100e6] }, { tipo: 'beneficio', valores: [0, 150e6, 200e6, 900e6] }] } },
    planes: { p1: { ini: '2026-01-01', fin: '2026-04-01' } },
  });
  const d = App.ICE.detalle(p({}));
  assert.equal(d.income, 3, '150 + 200 = $350 M en los dos primeros años con beneficios');
  assert.equal(d.conf, 50, 'caso en revisión');
  assert.equal(d.esf, 50, 'cronograma de ~3 meses');
  assert.equal(d.ice, 3);
  const m = App.ICE.detalle(p({ ice_confianza: 100 }));
  assert.equal(m.conf, 100, 'lo registrado por la Oficina manda');
  assert.equal(m.origen, 'mixto');
});

test('Effort por duración', () => {
  const App = cargar();
  assert.deepEqual([1, 2, 3.9, 4, 5.9, 6, 12].map(App.ICE.effortDeMeses), [25, 50, 50, 75, 75, 100, 100]);
});

test('sin datos suficientes no inventa el ICE', () => {
  const App = cargar();
  assert.equal(App.iceOf(p({ ice_income: 5 })), null);
});
