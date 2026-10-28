// ============================================================
// ALMACENAMIENTO EN SQL SERVER · Azure SQL · SQL database en Fabric
// Una tabla por colección: (id, data JSON, created_at, updated_at).
// Las tablas se crean solas al arrancar. Para Power BI y el data lake
// hay vistas planas en sql/vistas.sql.
// ============================================================
let sql;
try { sql = require('mssql'); } catch {
  throw new Error('Falta el paquete mssql. Corre «npm install» en la carpeta portafolio.');
}

const COLLS = ['users', 'projects', 'activities', 'sections', 'cases', 'sessions', 'committees', 'historial'];
const ident = s => { if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(s)) throw new Error(`Nombre SQL inválido: ${s}`); return s; };

function buildConfig() {
  const e = process.env;
  if (!e.SQL_SERVER || !e.SQL_DATABASE) throw new Error('Faltan SQL_SERVER y SQL_DATABASE');
  const cfg = {
    server: e.SQL_SERVER,
    database: e.SQL_DATABASE,
    port: Number(e.SQL_PORT) || 1433,
    options: { encrypt: e.SQL_ENCRYPT !== 'false', trustServerCertificate: e.SQL_TRUST_CERT === 'true' },
    pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
  };
  const auth = (e.SQL_AUTH || 'sql').toLowerCase();
  if (auth === 'sql') { cfg.user = e.SQL_USER; cfg.password = e.SQL_PASSWORD; }
  else if (auth === 'service-principal') {
    cfg.authentication = { type: 'azure-active-directory-service-principal-secret',
      options: { clientId: e.SQL_CLIENT_ID, clientSecret: e.SQL_CLIENT_SECRET, tenantId: e.SQL_TENANT_ID } };
  } else if (auth === 'managed-identity' || auth === 'default') {
    cfg.authentication = { type: 'azure-active-directory-default', options: e.SQL_CLIENT_ID ? { clientId: e.SQL_CLIENT_ID } : {} };
  } else throw new Error(`SQL_AUTH desconocido: ${auth}`);
  return cfg;
}

class SqlStore {
  constructor() {
    this.schema = ident(process.env.SQL_SCHEMA || 'dbo');
    this.prefix = ident(process.env.SQL_TABLE_PREFIX || 'pf_');
    this.kind = 'sql';
  }
  t(coll) {
    if (!COLLS.includes(coll)) throw new Error(`Colección desconocida: ${coll}`);
    return `[${this.schema}].[${this.prefix}${coll}]`;
  }
  async init() {
    this.pool = await new sql.ConnectionPool(buildConfig()).connect();
    for (const c of COLLS) {
      const name = `${this.schema}.${this.prefix}${c}`;
      await this.pool.request().query(`
        IF OBJECT_ID(N'${name}', 'U') IS NULL
        CREATE TABLE ${this.t(c)} (
          id         NVARCHAR(64)  NOT NULL PRIMARY KEY,
          data       NVARCHAR(MAX) NOT NULL CHECK (ISJSON(data) = 1),
          created_at DATETIME2(3)  NOT NULL DEFAULT SYSUTCDATETIME(),
          updated_at DATETIME2(3)  NOT NULL DEFAULT SYSUTCDATETIME()
        );`);
    }
    await this.pool.request().query(`
      IF OBJECT_ID(N'${this.schema}.${this.prefix}config', 'U') IS NULL
      CREATE TABLE [${this.schema}].[${this.prefix}config] (
        k NVARCHAR(100) NOT NULL PRIMARY KEY,
        v NVARCHAR(MAX) NOT NULL
      );`);
  }
  _parse(rows) { return rows.map(r => ({ ...JSON.parse(r.data), id: r.id })); }
  async list(coll) {
    const r = await this.pool.request().query(`SELECT id, data FROM ${this.t(coll)} ORDER BY created_at`);
    return this._parse(r.recordset);
  }
  async get(coll, id) {
    const r = await this.pool.request().input('id', sql.NVarChar(64), id).query(`SELECT id, data FROM ${this.t(coll)} WHERE id = @id`);
    return r.recordset.length ? this._parse(r.recordset)[0] : null;
  }
  async insert(coll, doc) {
    await this.pool.request()
      .input('id', sql.NVarChar(64), doc.id)
      .input('data', sql.NVarChar(sql.MAX), JSON.stringify(doc))
      .query(`INSERT INTO ${this.t(coll)} (id, data) VALUES (@id, @data)`);
    return doc;
  }
  // Lee y escribe dentro de una transacción con bloqueo de fila: dos personas
  // editando la misma fila al tiempo no se pisan campos distintos.
  async update(coll, id, fn) {
    const tx = new sql.Transaction(this.pool);
    await tx.begin();
    try {
      const r = await new sql.Request(tx).input('id', sql.NVarChar(64), id)
        .query(`SELECT id, data FROM ${this.t(coll)} WITH (UPDLOCK, ROWLOCK) WHERE id = @id`);
      if (!r.recordset.length) { await tx.rollback(); return null; }
      const next = fn(this._parse(r.recordset)[0]);
      await new sql.Request(tx).input('id', sql.NVarChar(64), id).input('data', sql.NVarChar(sql.MAX), JSON.stringify(next))
        .query(`UPDATE ${this.t(coll)} SET data = @data, updated_at = SYSUTCDATETIME() WHERE id = @id`);
      await tx.commit();
      return next;
    } catch (e) { try { await tx.rollback(); } catch {} throw e; }
  }
  async remove(coll, id) {
    await this.pool.request().input('id', sql.NVarChar(64), id).query(`DELETE FROM ${this.t(coll)} WHERE id = @id`);
  }
  async recent(coll, n) {
    const r = await this.pool.request().input('n', sql.Int, n)
      .query(`SELECT TOP (@n) id, data FROM ${this.t(coll)} ORDER BY created_at DESC`);
    return this._parse(r.recordset);
  }
  async getConfig(key) {
    const r = await this.pool.request().input('k', sql.NVarChar(100), key)
      .query(`SELECT v FROM [${this.schema}].[${this.prefix}config] WHERE k = @k`);
    return r.recordset.length ? JSON.parse(r.recordset[0].v) : null;
  }
  async setConfig(key, value) {
    await this.pool.request().input('k', sql.NVarChar(100), key).input('v', sql.NVarChar(sql.MAX), JSON.stringify(value))
      .query(`MERGE [${this.schema}].[${this.prefix}config] AS t USING (SELECT @k AS k) AS s ON t.k = s.k
              WHEN MATCHED THEN UPDATE SET v = @v
              WHEN NOT MATCHED THEN INSERT (k, v) VALUES (@k, @v);`);
  }
}

module.exports = SqlStore;
