// Pruebas de los bugs corregidos en la revisión (para que no vuelvan).
// Se corren con: npm test
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const F = require('../public/js/finanzas.js');
const { cleanDoc } = require('../lib/validate');
const exporter = require('../lib/export');
const auth = require('../lib/auth');
const FileStore = require('../lib/store-file');

const flujo = (tipo, valores) => ({ concepto: tipo, tipo, valores });

test('payback: no da 0 cuando el año 0 está vacío', () => {
  assert.equal(F.calc({ anios: 3, flujos: [flujo('inversion', [0, 100])] }).payback, null, 'nunca recupera');
  const p = F.calc({ anios: 3, flujos: [flujo('inversion', [0, 100]), flujo('beneficio', [0, 0, 150])] }).payback;
  assert.ok(Math.abs(p - 1.6667) < 0.001);
  assert.equal(F.calc({ anios: 3, flujos: [flujo('beneficio', [50, -200, 0, 300])] }).payback, 2.5);
  assert.equal(F.calc({ anios: 3, flujos: [flujo('beneficio', [10, 10])] }).payback, 0, 'sin acumulado negativo');
});

test('finanzas: ignora filas de flujo dañadas', () => {
  const r = F.calc({ anios: 2, flujos: [null, 'x', { tipo: 'beneficio', valores: 'abc' }, flujo('beneficio', [0, 5])] });
  assert.equal(r.totalBeneficio, 5);
});

test('validación: listas de registros solo aceptan objetos', () => {
  const d = cleanDoc('cases', { project_id: 'p1', flujos: [null, 3, 'x', [1], flujo('costo', [1])] }, false);
  assert.deepEqual(d.flujos, [flujo('costo', [1])]);
});

test('validación: fechas y horas reales', () => {
  assert.throws(() => cleanDoc('sessions', { fecha: '2026-02-30' }, false));
  assert.throws(() => cleanDoc('sessions', { fecha: '2026-13-01' }, false));
  assert.throws(() => cleanDoc('sessions', { fecha: '2026-02-27', hora_ini: '25:00' }, false));
  assert.equal(cleanDoc('sessions', { fecha: '2028-02-29', hora_ini: '23:59' }, false).fecha, '2028-02-29');
});

test('validación: texto sin carácter nulo ni mitades de emoji', () => {
  assert.equal(cleanDoc('committees', { name: 'a\u0000b' }, false).name, 'ab');
  const largo = 'x'.repeat(499) + '😀'; // el recorte a 500 caería en medio del emoji
  const n = cleanDoc('committees', { name: largo }, false).name;
  assert.equal(n, 'x'.repeat(499));
  assert.equal(cleanDoc('committees', { name: 'a\ud83d b' }, false).name, 'a� b');
});

test('CSV: neutraliza fórmulas pero deja los números negativos', () => {
  const csv = exporter.toCSV([{ a: '=1+1', b: '-5', c: '+57 300', d: '@x', e: '-3,5', f: 'normal' }]);
  assert.equal(csv.split('\r\n')[1], "'=1+1,-5,'+57 300,'@x,\"-3,5\",normal");
});

test('ICS: escapa punto y coma, coma y saltos de línea', () => {
  const ics = exporter.toICS({ id: 's1', fecha: '2026-11-12', hora_ini: '08:00', titulo: 'Comité, valor', lugar: 'Sala; 2', temas: 'a\rb' }, '', [], '-05:00');
  assert.match(ics, /SUMMARY:Comité\\, valor/);
  assert.match(ics, /LOCATION:Sala\\; 2/);
  assert.throws(() => exporter.toICS({ id: 's2', fecha: '2026-99-99' }, '', [], '-05:00'), /fecha u hora inválida/);
});

test('cookies mal codificadas no rompen la lectura', () => {
  const c = auth.parseCookies({ headers: { cookie: 'otra=50%; pf_sesion=abc' } });
  assert.equal(c.otra, '50%');
  assert.equal(c.pf_sesion, 'abc');
  auth.setSecret('secreto-de-prueba');
  assert.equal(auth.readToken('abc.ñññ'), null, 'una firma con tildes no lanza error');
});

test('freno de ingreso: otro equipo no bloquea al dueño de la cuenta', () => {
  const email = 'freno@prueba.co';
  for (let i = 0; i < 8; i++) auth.loginFallido(email, '1.1.1.1');
  assert.equal(auth.loginBloqueado(email, '1.1.1.1'), true);
  assert.equal(auth.loginBloqueado(email, '2.2.2.2'), false);
  for (let i = 0; i < 100; i++) auth.loginFallido(email, '10.0.0.' + i);
  assert.equal(auth.loginBloqueado(email, '2.2.2.2'), true, 'tope por cuenta');
});

test('almacenamiento en archivo: una escritura fallida no traba las siguientes', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pf-'));
  const file = path.join(dir, 'd.json');
  const s = new FileStore(file); await s.init();
  fs.mkdirSync(file + '.tmp'); // fuerza la falla
  await assert.rejects(s.insert('projects', { id: 'a1' }));
  fs.rmdirSync(file + '.tmp');
  await s.insert('projects', { id: 'b2' });
  assert.equal(Object.keys(JSON.parse(fs.readFileSync(file, 'utf8')).colls.projects).length, 2);
  assert.equal(await s.get('projects', 'constructor'), null, 'un id como «constructor» no existe');
  await s.insert('projects', { id: '__proto__', x: 1 });
  assert.deepEqual(await s.get('projects', '__proto__'), { id: '__proto__', x: 1 });
  fs.rmSync(dir, { recursive: true, force: true });
});
