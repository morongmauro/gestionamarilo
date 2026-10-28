// ============================================================
// ENVÍO AL DATA LAKE DE AZURE (Azure Data Lake Storage Gen2 / Blob)
// Cada tabla se escribe como archivo plano, particionado por fecha:
//   <contenedor>/<prefijo>/<tabla>/fecha=AAAA-MM-DD/<tabla>.csv   (histórico diario)
//   <contenedor>/<prefijo>/<tabla>/actual/<tabla>.csv             (última foto)
// Así Synapse, Databricks, Fabric o Power BI leen la carpeta directamente.
//
// Autenticación:
//   LAKE_ACCOUNT=<cuenta>         → identidad administrada del App Service (sin claves)
//   LAKE_CONNECTION_STRING=...    → cadena de conexión (pruebas o emulador Azurite)
// ============================================================
const exporter = require('./export');

const cfg = () => ({
  account: process.env.LAKE_ACCOUNT || '',
  conn: process.env.LAKE_CONNECTION_STRING || '',
  container: process.env.LAKE_CONTAINER || 'portafolio',
  prefix: (process.env.LAKE_PREFIX ?? 'portafolio').replace(/^\/+|\/+$/g, ''),
  format: process.env.LAKE_FORMAT === 'jsonl' ? 'jsonl' : 'csv',
  hour: process.env.LAKE_HOUR === 'off' ? null : Math.max(0, Math.min(23, parseInt(process.env.LAKE_HOUR ?? '2', 10) || 0)),
});
const configured = () => { const c = cfg(); return !!(c.account || c.conn); };

function describe() {
  const c = cfg();
  return {
    configurado: configured(),
    destino: c.account ? `https://${c.account}.blob.core.windows.net/${c.container}/${c.prefix}` : c.conn ? `(cadena de conexión)/${c.container}/${c.prefix}` : null,
    autenticacion: c.account ? 'Identidad administrada' : c.conn ? 'Cadena de conexión' : null,
    formato: c.format,
    hora: c.hour,
    tablas: exporter.TABLAS,
  };
}

let client = null;
function containerClient() {
  if (client) return client;
  let blob;
  try { blob = require('@azure/storage-blob'); } catch { throw new Error('Falta el paquete @azure/storage-blob. Corre «npm install» en la carpeta portafolio.'); }
  const c = cfg();
  let svc;
  if (c.conn) svc = blob.BlobServiceClient.fromConnectionString(c.conn);
  else {
    let identity;
    try { identity = require('@azure/identity'); } catch { throw new Error('Falta el paquete @azure/identity. Corre «npm install» en la carpeta portafolio.'); }
    svc = new blob.BlobServiceClient(`https://${c.account}.blob.core.windows.net`, new identity.DefaultAzureCredential());
  }
  client = svc.getContainerClient(c.container);
  return client;
}

// Fecha local según TZ_OFFSET (Bogotá = -05:00)
function localNow() {
  const m = /^([+-])(\d{2}):(\d{2})$/.exec(process.env.TZ_OFFSET || '-05:00') || ['', '-', '05', '00'];
  const off = (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3]));
  const d = new Date(Date.now() + off * 60000);
  return { fecha: d.toISOString().slice(0, 10), hora: d.getUTCHours() };
}

const toJSONL = rows => rows.map(r => JSON.stringify(r)).join('\n') + (rows.length ? '\n' : '');

// datos: { columns, projects, activities, cases, sessions, committees }
async function enviar(datos) {
  if (!configured()) throw new Error('El envío al data lake no está configurado (falta LAKE_ACCOUNT o LAKE_CONNECTION_STRING)');
  const c = cfg(), cc = containerClient(), { fecha } = localNow();
  await cc.createIfNotExists();
  const ext = c.format === 'jsonl' ? 'jsonl' : 'csv';
  const type = c.format === 'jsonl' ? 'application/x-ndjson' : 'text/csv; charset=utf-8';
  const archivos = [];
  for (const tabla of exporter.TABLAS) {
    const rows = exporter.build(tabla, datos);
    const body = Buffer.from(c.format === 'jsonl' ? toJSONL(rows) : exporter.toCSV(rows, exporter.headersOf(tabla, datos)), 'utf8');
    const base = (c.prefix ? c.prefix + '/' : '') + tabla;
    for (const ruta of [`${base}/fecha=${fecha}/${tabla}.${ext}`, `${base}/actual/${tabla}.${ext}`]) {
      await cc.getBlockBlobClient(ruta).uploadData(body, { blobHTTPHeaders: { blobContentType: type } });
    }
    archivos.push({ tabla, filas: rows.length, ruta: `${base}/fecha=${fecha}/${tabla}.${ext}` });
  }
  return { at: new Date().toISOString(), fecha, archivos };
}

module.exports = { configured, describe, enviar, localNow };
