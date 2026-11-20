// El libro del caso: fórmulas como Excel y ajuste al insertar, borrar o mover filas y columnas
const test = require('node:test');
const assert = require('node:assert');
const Libro = require('../public/js/libro');
const sem = require('../lib/semillas/nueva-sas-libro.json');
const copia = () => JSON.parse(JSON.stringify(sem.libro));
const flujoCaja = L => { const E = Libro.crear(L), h = L.hojas.findIndex(x => /flujo/i.test(x.nombre)), r = L.hojas[h].filas.findIndex(f => /^flujo de caja del a/i.test(String(f.c[0]))); return Array.from({ length: 10 }, (_, t) => Math.round(E.val(h, r, 1 + t))); };
const BASE = [758753771, 1977552815, 2174456122, 2383968853, 2621408823, 2890860128, 3197016328, 3545271773, 3941826625, 4393807627];

test('el flujo de caja de Nueva SAS da lo mismo que el Excel', () => { assert.deepStrictEqual(flujoCaja(copia()), BASE); });
test('insertar filas y columnas no cambia los resultados', () => {
  const L = copia();
  Libro.insertarFila(L, 0, 12); Libro.insertarFila(L, 1, 3); Libro.insertarFila(L, 2, 7); Libro.insertarCol(L, 0, 1); Libro.insertarCol(L, 1, 3);
  assert.deepStrictEqual(flujoCaja(L), BASE);
});
test('mover filas no desajusta las fórmulas', () => {
  const L = copia(), h = 2;
  Libro.moverFila(L, h, 6, 8); Libro.moverFila(L, h, 13, 16); Libro.moverFila(L, 0, 10, 20);
  assert.deepStrictEqual(flujoCaja(L), BASE);
});
test('borrar una fila vacía no cambia nada; borrar una usada deja #REF!', () => {
  const L = copia(); const h = 0, vac = L.hojas[h].filas.findIndex((f, i) => i > 3 && f.t === 'vacia');
  Libro.eliminarFila(L, h, vac); assert.deepStrictEqual(flujoCaja(L), BASE);
  const r = L.hojas[0].filas.findIndex(f => /tarifa de impuesto de renta/i.test(String(f.c[1])));
  Libro.eliminarFila(L, 0, r);
  assert.ok(L.hojas[2].filas.some(f => f.c.some(v => typeof v === 'string' && v.includes('#REF!'))));
});
test('un rango crece al insertar dentro y se ajusta al copiar a la derecha', () => {
  assert.strictEqual(Libro.desplazar('=SUM($B21:B21)*Supuestos!$D$7', 0, 1), '=SUM($B21:C21)*Supuestos!$D$7');
  const L = { hojas: [{ nombre: 'A', filas: [{ t: 'dato', c: [1] }, { t: 'dato', c: [2] }, { t: 'dato', c: ['=SUM(A1:A2)'] }] }] };
  Libro.insertarFila(L, 0, 1); L.hojas[0].filas[1].c = [5];
  assert.strictEqual(L.hojas[0].filas[3].c[0], '=SUM(A1:A3)'); assert.strictEqual(Libro.crear(L).val(0, 3, 0), 8);
});
