// Fases de las iniciativas: estados antiguos (L0…L4, Standby…) → 3 fases (npm test)
const test = require('node:test');
const assert = require('node:assert/strict');
const F = require('../public/js/fases.js');

test('cada estado antiguo cae en su fase', () => {
  const casos = {
    'L0 - Idea': 'Fase 1 · Planeación', 'L1 - Planeación': 'Fase 1 · Planeación',
    'L2 - Ejecución': 'Fase 2 · Ejecución, piloto y seguimiento', 'L3 - Seguimiento': 'Fase 2 · Ejecución, piloto y seguimiento',
    'L3 - Escalamiento': 'Fase 3 · Escalamiento y captura de valor', 'L4 - Realización': 'Fase 3 · Escalamiento y captura de valor',
    'L4 - Cerrada': 'Cerrada', 'L4 - Cerrado': 'Cerrada', Standby: 'En pausa', Pausado: 'En pausa', Pausada: 'En pausa',
    Cancelada: 'Cancelada', Cancelado: 'Cancelada', Descartado: 'Cancelada', Descartada: 'Cancelada',
    '  L2 - Ejecución   ': 'Fase 2 · Ejecución, piloto y seguimiento',
  };
  for (const [a, b] of Object.entries(casos)) assert.equal(F.mapear(a), b, a);
});
test('los nombres nuevos no cambian y lo desconocido queda igual', () => {
  for (const f of F.FASES) assert.equal(F.mapear(f.nombre), f.nombre);
  assert.equal(F.mapear('Otro estado'), 'Otro estado');
  assert.equal(F.clasificar(''), null);
});
