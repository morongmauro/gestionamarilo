#!/usr/bin/env node
// ============================================================
// MIGRAR LOS DATOS DE UNA BASE POSTGRES A OTRA (Supabase → Cloud SQL)
//
// Copia exacta de las dos tablas de la aplicación (pf_docs y pf_config): iniciativas,
// actividades, casos de negocio, comités, sesiones, usuarios con sus contraseñas,
// historial y configuración. Los datos viajan como texto, sin pasar por JavaScript:
// ni un decimal ni una fecha cambian.
//
// Cómo protege los datos:
// 1. Antes de escribir, guarda un respaldo JSON del origen (y del destino, si se reemplaza).
// 2. Copia todo dentro de UNA transacción en el destino.
// 3. Antes de confirmar, compara origen y destino colección por colección
//    (cantidad de registros y huella md5 de su contenido). Si algo no coincide,
//    deshace todo y el destino queda como estaba.
// El origen nunca se modifica.
//
// Uso (desde la carpeta portafolio, con «npm install» hecho):
//   ORIGEN_URL='postgresql://…supabase…'  DESTINO_URL='postgresql://…127.0.0.1:5433/portafolio' \
//     node scripts/migrar-postgres.js [--simular] [--reemplazar] [--verificar] [--respaldos carpeta]
//
//   --simular    hace la copia y la verificación completas y al final deshace: no cambia nada.
//   --reemplazar el destino ya tiene datos (p. ej. el administrador y los comités que crea la
//                aplicación al arrancar): se respaldan y se reemplazan por los del origen.
//   --verificar  no copia: solo compara origen y destino (útil después, para confirmar).
//
// En Google Cloud lo más fácil es scripts/gcp/migrar-desde-supabase.sh, que abre el
// Cloud SQL Auth Proxy, arma DESTINO_URL con el secreto de la base y llama a este script.
// ============================================================
'use strict';
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const { conexion, ocultar } = require('../lib/pg-conexion');

const NOMBRES = { projects: 'Iniciativas', activities: 'Actividades', sections: 'Capítulos', cases: 'Casos de negocio', sessions: 'Sesiones de comité', committees: 'Comités', users: 'Usuarios', historial: 'Historial de cambios' };
const DDL = [
  `CREATE TABLE IF NOT EXISTS pf_docs (coll text NOT NULL, id text NOT NULL, data jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (coll, id))`,
  'CREATE INDEX IF NOT EXISTS pf_docs_coll_created ON pf_docs (coll, created_at)',
  'CREATE TABLE IF NOT EXISTS pf_config (k text PRIMARY KEY, v jsonb NOT NULL)',
  'ALTER TABLE pf_docs ENABLE ROW LEVEL SECURITY',
  'ALTER TABLE pf_config ENABLE ROW LEVEL SECURITY',
];

function args() {
  const a = process.argv.slice(2), o = { simular: false, reemplazar: false, verificar: false, respaldos: path.join(__dirname, '..', 'respaldos') };
  for (let i = 0; i < a.length; i++) {
    if (a[i] === '--simular') o.simular = true;
    else if (a[i] === '--reemplazar') o.reemplazar = true;
    else if (a[i] === '--verificar') o.verificar = true;
    else if (a[i] === '--respaldos') o.respaldos = a[++i];
    else if (a[i] === '--origen') o.origen = a[++i];
    else if (a[i] === '--destino') o.destino = a[++i];
    else if (a[i] === '-h' || a[i] === '--ayuda') { console.log(fs.readFileSync(__filename, 'utf8').split('\n').filter(l => l.startsWith('//')).map(l => l.slice(3)).join('\n')); process.exit(0); }
    else throw new Error(`Opción desconocida: ${a[i]} (usa --ayuda)`);
  }
  o.origen = o.origen || process.env.ORIGEN_URL; o.destino = o.destino || process.env.DESTINO_URL;
  if (!o.origen || !o.destino) throw new Error('Faltan ORIGEN_URL y DESTINO_URL (las cadenas de conexión de las dos bases)');
  if (o.origen.trim() === o.destino.trim()) throw new Error('El origen y el destino son la misma base');
  return o;
}

async function conectar(url, nombre) {
  const c = new Client({ ...conexion(url), connectionTimeoutMillis: 20000 });
  try { await c.connect(); } catch (e) { throw new Error(`No pude conectarme al ${nombre} (${ocultar(url)}): ${e.message}`); }
  await c.query("SET TIME ZONE 'UTC'"); // las fechas se leen y escriben en UTC: no cambian al cruzar
  return c;
}
const existen = async c => (await c.query("SELECT count(*)::int n FROM information_schema.tables WHERE table_schema = current_schema() AND table_name IN ('pf_docs','pf_config')")).rows[0].n === 2;

// Huella de cada colección: cantidad y md5 del contenido en orden fijo (independiente del idioma de la base)
async function huellas(c) {
  const d = await c.query(`SELECT coll, count(*)::int n, md5(string_agg(id || '|' || data::text || '|' || created_at::text || '|' || updated_at::text, E'\\n' ORDER BY id COLLATE "C")) h FROM pf_docs GROUP BY coll`);
  const k = await c.query(`SELECT count(*)::int n, coalesce(md5(string_agg(k || '|' || v::text, E'\\n' ORDER BY k COLLATE "C")), '') h FROM pf_config`);
  const out = {}; d.rows.forEach(r => { out[r.coll] = { n: r.n, h: r.h }; });
  out['(configuración)'] = { n: k.rows[0].n, h: k.rows[0].h };
  return out;
}
async function leerTodo(c) {
  const docs = (await c.query('SELECT coll, id, data::text AS data, created_at::text AS created_at, updated_at::text AS updated_at FROM pf_docs ORDER BY coll, id')).rows;
  const config = (await c.query('SELECT k, v::text AS v FROM pf_config ORDER BY k')).rows;
  return { docs, config };
}
function respaldar(dir, nombre, datos, url) {
  fs.mkdirSync(dir, { recursive: true });
  const f = path.join(dir, `${nombre}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(f, JSON.stringify({ base: ocultar(url), fecha: new Date().toISOString(), pf_docs: datos.docs, pf_config: datos.config }), { mode: 0o600 });
  return f;
}
function tabla(a, b) {
  const colls = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort((x, y) => (x[0] === '(') - (y[0] === '(') || x.localeCompare(y));
  let ok = true;
  console.log('\n  Colección                 Origen   Destino   ¿Igual?');
  for (const k of colls) {
    const x = a[k] || { n: 0, h: '' }, y = b[k] || { n: 0, h: '' }, igual = x.n === y.n && x.h === y.h;
    if (!igual) ok = false;
    console.log(`  ${(NOMBRES[k] || k).padEnd(24)} ${String(x.n).padStart(7)} ${String(y.n).padStart(9)}   ${igual ? '✓' : '✗ DISTINTO'}`);
  }
  return ok;
}

async function main() {
  const o = args();
  console.log(`Origen:  ${ocultar(o.origen)}\nDestino: ${ocultar(o.destino)}`);
  const ori = await conectar(o.origen, 'origen'), des = await conectar(o.destino, 'destino');
  try {
    if (!(await existen(ori))) throw new Error('El origen no tiene las tablas de la aplicación (pf_docs y pf_config). ¿Es la base correcta?');
    if (o.verificar) {
      if (!(await existen(des))) throw new Error('El destino aún no tiene las tablas de la aplicación: no hay nada que comparar');
      const ok = tabla(await huellas(ori), await huellas(des));
      console.log(ok ? '\n✅ Origen y destino tienen exactamente los mismos datos.' : '\n⚠️  Hay diferencias (puede ser normal si alguien siguió trabajando en una de las dos después de migrar).');
      process.exitCode = ok ? 0 : 2; return;
    }
    // 1 · leer y respaldar el origen
    await ori.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY'); // una foto coherente del origen
    const datos = await leerTodo(ori), hOri = await huellas(ori);
    await ori.query('COMMIT');
    console.log(`\nOrigen: ${datos.docs.length} registros y ${datos.config.length} ajustes.`);
    console.log(`Respaldo del origen: ${respaldar(o.respaldos, 'origen', datos, o.origen)}`);
    // 2 · preparar el destino
    for (const q of DDL) await des.query(q);
    const nDes = (await des.query('SELECT (SELECT count(*) FROM pf_docs)::int + (SELECT count(*) FROM pf_config)::int n')).rows[0].n;
    if (nDes && !o.reemplazar) {
      tabla(hOri, await huellas(des));
      throw new Error(`El destino ya tiene ${nDes} filas. Si son solo las que crea la aplicación al arrancar (administrador, comités, columnas), vuelve a correr con --reemplazar: se respaldan y se reemplazan por las del origen.`);
    }
    if (nDes) console.log(`Respaldo del destino (antes de reemplazar): ${respaldar(o.respaldos, 'destino', await leerTodo(des), o.destino)}`);
    // 3 · copiar todo en una transacción
    await des.query('BEGIN');
    try {
      await des.query('LOCK TABLE pf_docs, pf_config IN EXCLUSIVE MODE'); // nadie escribe en el destino mientras tanto
      if (nDes) { await des.query('DELETE FROM pf_docs'); await des.query('DELETE FROM pf_config'); }
      for (let i = 0; i < datos.docs.length; i += 500) {
        const l = datos.docs.slice(i, i + 500);
        await des.query(`INSERT INTO pf_docs (coll, id, data, created_at, updated_at)
          SELECT c, i, d::jsonb, ca::timestamptz, ua::timestamptz FROM unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::text[]) AS t(c, i, d, ca, ua)`,
        [l.map(r => r.coll), l.map(r => r.id), l.map(r => r.data), l.map(r => r.created_at), l.map(r => r.updated_at)]);
        process.stdout.write(`\rCopiando… ${Math.min(i + 500, datos.docs.length)} de ${datos.docs.length}`);
      }
      if (datos.config.length) await des.query('INSERT INTO pf_config (k, v) SELECT k, v::jsonb FROM unnest($1::text[], $2::text[]) AS t(k, v)', [datos.config.map(r => r.k), datos.config.map(r => r.v)]);
      // 4 · verificar antes de confirmar
      const ok = tabla(hOri, await huellas(des));
      if (!ok) throw new Error('La verificación no coincide: no se guardó nada en el destino');
      if (o.simular) { await des.query('ROLLBACK'); console.log('\n✅ Simulación correcta: la copia completa coincide. No se cambió nada (corre sin --simular para hacerla de verdad).'); return; }
      await des.query('COMMIT');
    } catch (e) { try { await des.query('ROLLBACK'); } catch { /* ya cerrada */ } throw e; }
    console.log(`\n✅ Migración completa y verificada: ${datos.docs.length} registros y ${datos.config.length} ajustes.`);
    console.log('   Los respaldos JSON tienen las contraseñas cifradas y la clave de sesión: guárdalos en un lugar privado y bórralos cuando ya no los necesites.');
  } finally { await ori.end().catch(() => {}); await des.end().catch(() => {}); }
}

main().catch(e => { console.error(`\n❌ ${e.message}`); process.exitCode = 1; });
