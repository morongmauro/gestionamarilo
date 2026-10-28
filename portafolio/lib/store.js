// Elige el almacenamiento según DB:
//   file     → archivo JSON (pruebas en un computador)
//   sql      → Azure SQL / SQL Server (producción en Azure)
//   postgres → PostgreSQL, por ejemplo Supabase (demostración en Vercel)
const FileStore = require('./store-file');

function create() {
  const kind = (process.env.DB || 'file').toLowerCase();
  if (kind === 'sql') { const SqlStore = require('./store-sql'); return new SqlStore(); }
  if (kind === 'postgres') { const PgStore = require('./store-pg'); return new PgStore(); }
  if (process.env.VERCEL) throw new Error('En Vercel el disco no guarda datos: configura DB=postgres y DATABASE_URL');
  return new FileStore(process.env.DATA_FILE || './data/portafolio.json');
}

module.exports = { create };
