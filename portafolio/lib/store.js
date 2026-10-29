// Elige el almacenamiento según DB:
//   file     → archivo JSON (pruebas en un computador)
//   sql      → Azure SQL / SQL Server (producción en Azure)
//   postgres → PostgreSQL, por ejemplo Supabase (demostración en Vercel)
const FileStore = require('./store-file');

// Sin DB, si hay una cadena de Postgres (por ejemplo la que pone la integración
// de Neon en Vercel: DATABASE_URL o POSTGRES_URL) se usa Postgres.
const pgUrl = () => process.env.DATABASE_URL || process.env.POSTGRES_URL || '';

// Demostración sin base de datos (MODO_DEMO=true en Vercel, sin DATABASE_URL): los datos
// viven en la memoria de cada copia de la app y se pierden cuando Vercel la reinicia.
const sinBaseEnDemo = () => !process.env.DB && !pgUrl() && process.env.VERCEL && process.env.MODO_DEMO === 'true';

function create() {
  const kind = (process.env.DB || (pgUrl() ? 'postgres' : sinBaseEnDemo() ? 'memoria' : 'file')).toLowerCase();
  if (kind === 'sql') { const SqlStore = require('./store-sql'); return new SqlStore(); }
  if (kind === 'postgres') { const PgStore = require('./store-pg'); return new PgStore(); }
  if (kind === 'memoria') { const s = new FileStore('/tmp/portafolio-demo.json'); s.kind = 'memoria'; return s; }
  if (process.env.VERCEL) throw new Error('En Vercel el disco no guarda datos: conecta una base Postgres (DATABASE_URL), o usa MODO_DEMO=true para una demostración sin base de datos');
  return new FileStore(process.env.DATA_FILE || './data/portafolio.json');
}

module.exports = { create, pgUrl };
