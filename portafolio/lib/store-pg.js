// ============================================================
// ALMACENAMIENTO EN POSTGRESQL · Supabase, Neon, Azure Database for PostgreSQL
// Pensado para la demostración en Vercel con datos de prueba.
// Los datos reales van en Azure SQL (store-sql.js).
// Dos tablas: pf_docs (una fila por registro, con su colección) y pf_config.
// Las tablas se crean solas al arrancar.
// ============================================================
let Pool;
try { ({ Pool } = require('pg')); } catch {
  throw new Error('Falta el paquete pg. Corre «npm install» en la carpeta portafolio.');
}

class PgStore {
  constructor(opts = {}) {
    this.kind = 'postgres';
    this.client = opts.client || null; // para pruebas se puede inyectar un cliente
  }
  async init() {
    if (!this.client) {
      const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
      if (!url) throw new Error('Falta DATABASE_URL o POSTGRES_URL (la cadena de conexión de Postgres)');
      const local = /localhost|127\.0\.0\.1/.test(url);
      this.client = new Pool({
        connectionString: url,
        ssl: local || process.env.PG_SSL === 'false' ? false : { rejectUnauthorized: false },
        max: Number(process.env.PG_POOL_MAX) || 3, // en Vercel cada instancia abre pocas conexiones
      });
    }
    await this.q(`
      CREATE TABLE IF NOT EXISTS pf_docs (
        coll       text        NOT NULL,
        id         text        NOT NULL,
        data       jsonb       NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (coll, id)
      )`);
    await this.q('CREATE INDEX IF NOT EXISTS pf_docs_coll_created ON pf_docs (coll, created_at)');
    await this.q('CREATE TABLE IF NOT EXISTS pf_config (k text PRIMARY KEY, v jsonb NOT NULL)');
    // Sin políticas: solo el servidor (dueño de las tablas) puede leerlas; en Supabase
    // esto deja las tablas cerradas para la API pública.
    await this.q('ALTER TABLE pf_docs ENABLE ROW LEVEL SECURITY');
    await this.q('ALTER TABLE pf_config ENABLE ROW LEVEL SECURITY');
  }
  q(text, params) { return this.client.query(text, params); }
  _doc(r) { return { ...r.data, id: r.id }; }

  async list(coll) {
    const r = await this.q('SELECT id, data FROM pf_docs WHERE coll = $1 ORDER BY created_at', [coll]);
    return r.rows.map(x => this._doc(x));
  }
  async get(coll, id) {
    const r = await this.q('SELECT id, data FROM pf_docs WHERE coll = $1 AND id = $2', [coll, id]);
    return r.rows.length ? this._doc(r.rows[0]) : null;
  }
  async insert(coll, doc) {
    await this.q('INSERT INTO pf_docs (coll, id, data, created_at) VALUES ($1, $2, $3, COALESCE($4::timestamptz, now()))',
      [coll, doc.id, JSON.stringify(doc), doc.created_at || null]);
    return doc;
  }
  // Lee y escribe en una transacción con la fila bloqueada: dos personas
  // editando el mismo registro no se pisan campos distintos.
  async update(coll, id, fn) {
    const pooled = this.client instanceof Pool;
    const c = pooled ? await this.client.connect() : this.client;
    try {
      await c.query('BEGIN');
      const r = await c.query('SELECT id, data FROM pf_docs WHERE coll = $1 AND id = $2 FOR UPDATE', [coll, id]);
      if (!r.rows.length) { await c.query('ROLLBACK'); return null; }
      const next = fn(this._doc(r.rows[0]));
      await c.query('UPDATE pf_docs SET data = $3, updated_at = now() WHERE coll = $1 AND id = $2', [coll, id, JSON.stringify(next)]);
      await c.query('COMMIT');
      return next;
    } catch (e) { try { await c.query('ROLLBACK'); } catch {} throw e; }
    finally { if (pooled) c.release(); }
  }
  async remove(coll, id) { await this.q('DELETE FROM pf_docs WHERE coll = $1 AND id = $2', [coll, id]); }
  async recent(coll, n) {
    const r = await this.q('SELECT id, data FROM pf_docs WHERE coll = $1 ORDER BY created_at DESC LIMIT $2', [coll, n]);
    return r.rows.map(x => this._doc(x));
  }
  async getConfig(key) {
    const r = await this.q('SELECT v FROM pf_config WHERE k = $1', [key]);
    return r.rows.length ? r.rows[0].v : null;
  }
  async setConfig(key, value) {
    await this.q('INSERT INTO pf_config (k, v) VALUES ($1, $2) ON CONFLICT (k) DO UPDATE SET v = EXCLUDED.v', [key, JSON.stringify(value)]);
  }
}

module.exports = PgStore;
