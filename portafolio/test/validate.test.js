// Pruebas de la validación de lo que llega del navegador.
const test = require('node:test');
const assert = require('node:assert/strict');
const V = require('../lib/validate');

test('cleanDoc descarta campos desconocidos y conserva la evidencia del captado', () => {
  const d = V.cleanDoc('cases', { project_id: 'p1', hack: 1, captado: [{ mes: '2026-03', categoria: 'ahorro', valor: 10, estado: 'verificado', fuente: 'SAP', validador: 'Ana' }] }, true);
  assert.equal(d.hack, undefined);
  assert.equal(d.captado[0].estado, 'verificado');
  assert.equal(d.captado[0].fuente, 'SAP');
  const v = V.cleanDoc('cases', { validacion: { 2026: { hasta: '2026-10', por: 'Ana' } } }, true);
  assert.equal(v.validacion['2026'].hasta, '2026-10');
});
test('projects acepta frase, área y origen; sessions acepta decisiones estructuradas', () => {
  const p = V.cleanDoc('projects', { frase: 'Clasificar cotizaciones en una hora', area: 'Comercial', origen: { tipo: 'propuesta' }, __proto__: { x: 1 } }, true);
  assert.equal(p.frase, 'Clasificar cotizaciones en una hora');
  assert.equal(p.origen.tipo, 'propuesta');
  const s = V.cleanDoc('sessions', { fecha: '2026-11-12', decisiones_reg: [{ tipo: 'Acelerar', texto: 'Ampliar piloto', estado: 'Pendiente' }] }, false);
  assert.equal(s.decisiones_reg[0].tipo, 'Acelerar');
});
test('cleanPropuesta exige título y problema', () => {
  assert.throws(() => V.cleanPropuesta({ titulo: 'x', problema: 'corto' }));
  const ok = V.cleanPropuesta({ titulo: 'Portal de proveedores', problema: 'Las facturas se radican a mano y se pierden.', urgencia: 'alta' });
  assert.equal(ok.urgencia, 'alta');
});
test('cleanDireccion valida el correo', () => {
  assert.throws(() => V.cleanDireccion({ correo_propuestas: 'no-es-correo' }));
  assert.equal(V.cleanDireccion({ que_es: 'Texto', correo_propuestas: 'valor@amarilo.com' }).correo_propuestas, 'valor@amarilo.com');
});
