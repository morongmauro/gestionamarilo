// Conexión a Postgres: misma regla de TLS para Supabase y Cloud SQL (npm test)
const test = require('node:test');
const assert = require('node:assert/strict');
const { conexion, ocultar } = require('../lib/pg-conexion');

test('Supabase: con TLS y sin sslmode en la cadena', () => {
  const c = conexion('postgresql://postgres.abc:clave@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?sslmode=require');
  assert.equal(c.connectionString, 'postgresql://postgres.abc:clave@aws-0-sa-east-1.pooler.supabase.com:6543/postgres');
  assert.deepEqual(c.ssl, { rejectUnauthorized: false });
});
test('Cloud SQL por socket o por el proxy local: sin TLS', () => {
  assert.equal(conexion('postgresql://u:p@/portafolio?host=/cloudsql/p:r:i').ssl, false);
  assert.equal(conexion('postgresql://u:p@127.0.0.1:5433/portafolio').ssl, false);
});
test('sslmode=disable se respeta y los demás parámetros quedan', () => {
  const c = conexion('postgresql://u:p@10.0.0.5/db?a=1&sslmode=disable&b=2');
  assert.equal(c.ssl, false);
  assert.equal(c.connectionString, 'postgresql://u:p@10.0.0.5/db?a=1&b=2');
});
test('la contraseña no se muestra', () => {
  assert.equal(ocultar('postgresql://u:secreta@h:5432/db'), 'postgresql://u:•••@h:5432/db');
});
