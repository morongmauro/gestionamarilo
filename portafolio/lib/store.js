// Elige el almacenamiento según DB:
//   file     → archivo JSON (pruebas en un computador)
//   sql      → Azure SQL / SQL Server (producción en Azure)
//   postgres → PostgreSQL, por ejemplo Supabase (demostración en Vercel)
const FileStore = require('./store-file');

// Sin DB, si hay una cadena de Postgres (por ejemplo la que pone la integración
// de Neon en Vercel: DATABASE_URL o POSTGRES_URL) se usa Postgres.
const pgUrl = () => process.env.DATABASE_URL || process.env.POSTGRES_URL || '';

function create() {
  const kind = (process.env.DB || (pgUrl() ? 'postgres' : 'file')).toLowerCase();
  if (kind === 'sql') { const SqlStore = require('./store-sql'); return new SqlStore(); }
  if (kind === 'postgres') { const PgStore = require('./store-pg'); return new PgStore(); }
  if (process.env.VERCEL) throw new Error('En Vercel el disco no guarda datos: conecta una base Postgres (Storage → Neon, que pone DATABASE_URL sola)');
  return new FileStore(process.env.DATA_FILE || './data/portafolio.json');
}

module.exports = { create, pgUrl };
