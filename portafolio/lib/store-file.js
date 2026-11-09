// ============================================================
// ALMACENAMIENTO EN ARCHIVO (JSON) · para probar en un computador
// Todo vive en memoria y se escribe al disco en cada cambio
// (escritura atómica: archivo temporal + renombrar).
// ============================================================
const fs = require('fs');
const path = require('path');

const clone = o => (o == null ? o : JSON.parse(JSON.stringify(o)));
// Diccionario sin prototipo: un id como «constructor» o «__proto__» es una llave más, no un método de Object
const dict = (o = {}) => Object.assign(Object.create(null), o);

class FileStore {
  constructor(file) {
    this.file = path.resolve(file);
    this.db = { colls: dict(), config: dict() };
    this.queue = Promise.resolve();
    this.kind = 'archivo';
  }
  async init() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    if (fs.existsSync(this.file)) {
      const raw = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      const colls = dict();
      for (const [k, v] of Object.entries(raw.colls || {})) colls[k] = dict(v);
      this.db = { colls, config: dict(raw.config) };
    }
  }
  _persist() {
    const snapshot = JSON.stringify(this.db);
    // Si una escritura falla, la siguiente igual se intenta (la cola no queda trabada)
    const p = this.queue.catch(() => {}).then(() => {
      const tmp = this.file + '.tmp';
      fs.writeFileSync(tmp, snapshot);
      fs.renameSync(tmp, this.file);
    });
    this.queue = p;
    return p;
  }
  _c(coll) { return (this.db.colls[coll] = this.db.colls[coll] || dict()); }
  async list(coll) { return Object.values(this._c(coll)).map(clone); }
  async get(coll, id) { return clone(this._c(coll)[id] || null); }
  async insert(coll, doc) { this._c(coll)[doc.id] = clone(doc); await this._persist(); return clone(doc); }
  // fn recibe una copia del documento actual y devuelve el nuevo
  async update(coll, id, fn) {
    const cur = this._c(coll)[id];
    if (!cur) return null;
    const next = fn(clone(cur));
    this._c(coll)[id] = clone(next);
    await this._persist();
    return clone(next);
  }
  async remove(coll, id) { delete this._c(coll)[id]; await this._persist(); }
  async recent(coll, n) {
    return Object.values(this._c(coll)).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).slice(0, n).map(clone);
  }
  async getConfig(key) { return clone(this.db.config[key] ?? null); }
  async setConfig(key, value) { this.db.config[key] = clone(value); await this._persist(); }
}

module.exports = FileStore;
