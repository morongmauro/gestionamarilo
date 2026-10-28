// Elige el almacenamiento según DB=file | sql
const FileStore = require('./store-file');

function create() {
  const kind = (process.env.DB || 'file').toLowerCase();
  if (kind === 'sql') { const SqlStore = require('./store-sql'); return new SqlStore(); }
  return new FileStore(process.env.DATA_FILE || './data/portafolio.json');
}

module.exports = { create };
