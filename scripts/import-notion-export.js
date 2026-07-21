// ============================================================
// IMPORTADOR: export de Notion (HTML o CSV) → seed SQL para Supabase
//
// No necesita tokens ni conexión: lee los archivos que Notion
// genera con "Export" y produce supabase/seed-notion.sql, que
// se pega tal cual en Supabase → SQL Editor → Run.
//
// Uso:
//   node scripts/import-notion-export.js <archivo-o-carpeta> [más archivos...]
//
// Acepta:
//   - El .csv del export "Markdown & CSV" (recomendado)
//   - El .html del export "HTML" (tabla de la base de datos)
//   - Una carpeta: busca adentro los .csv/.html automáticamente
//
// Es idempotente: cada tarea lleva una llave estable (el id de la
// página de Notion si está disponible, o un hash del contenido),
// así que correr el SQL dos veces no duplica nada.
// ============================================================
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DEFAULT_SECTIONS = ['Planeación', 'Ejecución piloto', 'Seguimiento', 'Implementación al negocio'];

// ------------------------------------------------------------
// Utilidades
// ------------------------------------------------------------
function normalizeKey(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

const HEADER_MAP = {
  'description': 'description', 'descripcion': 'description', 'name': 'description', 'nombre': 'description', 'tarea': 'description', 'title': 'description',
  'status': 'status', 'estado': 'status',
  'priority': 'priority', 'prioridad': 'priority',
  'topic': 'topic', 'tema': 'topic', 'proyecto': 'topic', 'project': 'topic',
  'due date': 'dueDate', 'due': 'dueDate', 'fecha limite': 'dueDate', 'fecha': 'dueDate', 'deadline': 'dueDate', 'vencimiento': 'dueDate',
  'effort level': 'effort', 'effort': 'effort', 'esfuerzo': 'effort', 'nivel de esfuerzo': 'effort',
  'tipo gestion': 'tipoGestion', 'tipo de gestion': 'tipoGestion', 'gestion': 'tipoGestion',
  'ice score': 'ice', 'ice': 'ice',
  'created time': 'createdTime', 'created': 'createdTime', 'fecha de creacion': 'createdTime',
  'last edited time': 'lastEdited', 'last edited': 'lastEdited', 'ultima edicion': 'lastEdited',
};

const MONTHS = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};

// dateOrder: 'mdy' (americano, default de Notion) o 'dmy'. Si un número es >12
// se detecta solo; si ambos son ≤12 se usa este orden.
function parseDate(raw, dateOrder = 'mdy') {
  const s = String(raw || '').trim();
  if (!s) return null;
  // Rango de Notion "julio 1, 2026 → julio 15, 2026": usamos el fin
  const range = s.split('→');
  const v = range[range.length - 1].trim();

  let m = v.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);          // 2026-07-08 · 2026/07/08 (ISO)
  if (m) return iso(+m[1], +m[2], +m[3]);

  m = v.match(/\b(\d{1,2})[-/](\d{1,2})[-/](\d{4})\b/);          // 07/31/2026 o 31/07/2026
  if (m) {
    const a = +m[1], b = +m[2], y = +m[3];
    let mo, d;
    if (a > 12) { d = a; mo = b; }        // 1er número no puede ser mes → DD/MM
    else if (b > 12) { mo = a; d = b; }   // 2do número no puede ser mes → MM/DD
    else if (dateOrder === 'dmy') { d = a; mo = b; }
    else { mo = a; d = b; }               // ambiguo → americano MM/DD
    return iso(y, mo, d);
  }

  m = v.match(/([a-záéíóúA-ZÁÉÍÓÚ]+)\s+(\d{1,2}),?\s+(\d{4})/);  // July 8, 2026
  if (m) { const mo = MONTHS[normalizeKey(m[1])]; if (mo) return iso(+m[3], mo, +m[2]); }

  m = v.match(/(\d{1,2})\s+de\s+([a-záéíóú]+)\s+(?:de\s+)?(\d{4})/i); // 8 de julio de 2026
  if (m) { const mo = MONTHS[normalizeKey(m[2])]; if (mo) return iso(+m[3], mo, +m[1]); }

  const d = new Date(v);
  if (!isNaN(d)) return d.toISOString().slice(0, 10);
  return null;
}

// Detecta el orden de fecha dominante mirando todos los valores: si algún
// valor tiene el 1er número >12 es DD/MM; si alguno tiene el 2do >12 es MM/DD.
function detectDateOrder(values) {
  let dmy = 0, mdy = 0;
  for (const raw of values) {
    const m = String(raw || '').match(/\b(\d{1,2})[-/](\d{1,2})[-/]\d{4}\b/);
    if (!m) continue;
    if (+m[1] > 12) dmy++;
    else if (+m[2] > 12) mdy++;
  }
  if (dmy && !mdy) return 'dmy';
  return 'mdy'; // default e igualdad → americano (formato de Notion)
}

function iso(y, mo, d) {
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function mapStatus(raw) {
  const s = normalizeKey(raw);
  if (/done|hech|complet|cerrad|finaliz/.test(s)) return 'done';
  if (/progress|curso|doing|proceso/.test(s)) return 'doing';
  return 'todo';
}

function mapPriority(raw) {
  const s = normalizeKey(raw);
  if (/high|alta/.test(s)) return 'High';
  if (/low|baja/.test(s)) return 'Low';
  if (/med|regular|normal/.test(s)) return 'Medium';
  return null;
}

function mapEffort(raw) {
  const s = normalizeKey(raw);
  if (/small|pequen|bajo/.test(s)) return 'Small';
  if (/large|grande|alto/.test(s)) return 'Large';
  if (/med/.test(s)) return 'Medium';
  return null;
}

function mapTipo(raw) {
  const s = normalizeKey(raw);
  if (/tercero/.test(s)) return 'Depende Tercero';
  if (/compartid/.test(s)) return 'Compartida';
  if (/propia/.test(s)) return 'Propia';
  return null;
}

// ------------------------------------------------------------
// Parser CSV (maneja comillas, comas y saltos de línea internos)
// ------------------------------------------------------------
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  const src = text.replace(/^﻿/, ''); // BOM
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some(f => f.trim() !== '')) rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field !== '' || row.length) { row.push(field); if (row.some(f => f.trim() !== '')) rows.push(row); }
  return rows;
}

// ------------------------------------------------------------
// Parser HTML (tabla de colección del export de Notion)
// ------------------------------------------------------------
const NAMED_ENTITIES = {
  nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'",
  aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', ntilde: 'ñ', uuml: 'ü',
  Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú', Ntilde: 'Ñ', Uuml: 'Ü',
  iquest: '¿', iexcl: '¡', deg: '°', middot: '·', ndash: '–', mdash: '—', hellip: '…',
};

function decodeEntities(s) {
  return String(s)
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&([a-zA-Z]+);/g, (m, name) => NAMED_ENTITIES[name] !== undefined ? NAMED_ENTITIES[name] : m);
}

function stripTags(s) {
  return decodeEntities(String(s).replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function parseHtmlTables(html) {
  const tables = [];
  const tableRe = /<table[\s\S]*?<\/table>/gi;
  let tm;
  while ((tm = tableRe.exec(html))) {
    const t = tm[0];
    const headers = [];
    const headRe = /<th[^>]*>([\s\S]*?)<\/th>/gi;
    let hm;
    while ((hm = headRe.exec(t))) headers.push(stripTags(hm[1]));
    const rows = [];
    const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let rm;
    while ((rm = rowRe.exec(t))) {
      const cells = [];
      let href = null;
      const cellRe = /<td[^>]*>([\s\S]*?)<\/td>/gi;
      let cm;
      while ((cm = cellRe.exec(rm[1]))) {
        const inner = cm[1];
        if (!href) {
          const a = inner.match(/href="([^"]+)"/);
          if (a) href = decodeEntities(a[1]);
        }
        cells.push(stripTags(inner));
      }
      if (cells.length) rows.push({ cells, href });
    }
    if (headers.length && rows.length) tables.push({ headers, rows });
  }
  return tables;
}

function notionIdFromHref(href) {
  if (!href) return null;
  const m = decodeURIComponent(href).match(/([0-9a-f]{32})/i);
  return m ? m[1].toLowerCase() : null;
}

// ------------------------------------------------------------
// De filas crudas → tareas
// ------------------------------------------------------------
function rowsToTasks(headers, rows, getHref) {
  const idx = {};
  headers.forEach((h, i) => {
    const key = HEADER_MAP[normalizeKey(h)];
    if (key && idx[key] === undefined) idx[key] = i;
  });
  if (idx.description === undefined) return null; // no es la tabla de tareas

  // Detecta el orden de fecha una vez por tabla
  const rawDates = [];
  if (idx.dueDate !== undefined) {
    rows.forEach(r => { const c = Array.isArray(r) ? r : r.cells; rawDates.push(c[idx.dueDate]); });
  }
  const dateOrder = detectDateOrder(rawDates);

  const tasks = [];
  rows.forEach((r, n) => {
    const cells = Array.isArray(r) ? r : r.cells;
    const val = k => (idx[k] !== undefined ? String(cells[idx[k]] || '').trim() : '');
    const description = val('description');
    if (!description) return;
    const iceRaw = val('ice');
    const ice = iceRaw && !isNaN(parseFloat(iceRaw)) ? parseFloat(iceRaw) : null;
    const href = getHref ? getHref(r) : null;
    const notionId = notionIdFromHref(href)
      || crypto.createHash('md5').update(description + '|' + val('topic') + '|' + val('dueDate')).digest('hex');
    tasks.push({
      notionId,
      description,
      topic: val('topic') || null,
      status: mapStatus(val('status')),
      priority: mapPriority(val('priority')),
      effort: mapEffort(val('effort')),
      tipoGestion: mapTipo(val('tipoGestion')) || 'Propia',
      dueDate: parseDate(val('dueDate'), dateOrder),
      ice,
      createdTime: parseDate(val('createdTime'), dateOrder),
      lastEdited: parseDate(val('lastEdited'), dateOrder),
      _row: n + 1,
    });
  });
  return tasks;
}

// ------------------------------------------------------------
// Recolectar archivos
// ------------------------------------------------------------
function collectFiles(inputs) {
  const files = [];
  const walk = p => {
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      fs.readdirSync(p).forEach(f => walk(path.join(p, f)));
    } else if (/\.(csv|html?)$/i.test(p)) {
      files.push(p);
    }
  };
  inputs.forEach(walk);
  return files;
}

// ------------------------------------------------------------
// Generar SQL
// ------------------------------------------------------------
function q(s) {
  return s === null || s === undefined ? 'null' : `'${String(s).replace(/'/g, "''")}'`;
}

function buildSql(tasks) {
  const lines = [];
  lines.push('-- ============================================================');
  lines.push('-- Seed generado desde el export de Notion');
  lines.push(`-- ${tasks.length} tareas · pega este archivo completo en Supabase → SQL Editor → Run`);
  lines.push('-- Es idempotente: puedes ejecutarlo más de una vez sin duplicar.');
  lines.push('-- ============================================================');
  lines.push('');

  const topics = [...new Set(tasks.map(t => t.topic).filter(Boolean))];
  lines.push('-- 1. Proyectos (desde los Topics de Notion), con sus 4 fases de Gantt');
  topics.forEach(topic => {
    const ices = tasks.filter(t => t.topic === topic && t.ice != null).map(t => t.ice);
    const ice = ices.length ? Math.max(...ices) : null;
    lines.push(`insert into projects (name, ice) values (${q(topic)}, ${ice ?? 'null'}) on conflict (name) do nothing;`);
    if (ice != null) lines.push(`update projects set ice = ${ice} where name = ${q(topic)} and (ice is null or ice < ${ice});`);
    lines.push(`insert into project_sections (project_id, name, position)`);
    lines.push(`select p.id, s.name, s.position from projects p,`);
    lines.push(`  (values ${DEFAULT_SECTIONS.map((s, i) => `(${q(s)}, ${i})`).join(', ')}) as s(name, position)`);
    lines.push(`where p.name = ${q(topic)} and not exists (select 1 from project_sections ps where ps.project_id = p.id);`);
    lines.push('');
  });

  // Historial: las tareas "Done" del export no traen fecha real de cierre.
  // Para no inflar la vista semanal (que sí lo hubieras cerrado hoy), se
  // "estacionan" en el pasado. Si tienen due_date pasada, se usa esa como
  // proxy de cierre; si no, un baseline claramente antiguo.
  const BASELINE = '2025-12-31T12:00:00Z';
  const today = new Date().toISOString().slice(0, 10);

  lines.push('-- 2. Tareas');
  tasks.forEach(t => {
    const projectSel = t.topic ? `(select id from projects where name = ${q(t.topic)} limit 1)` : 'null';
    let created, updated, completed;
    if (t.status === 'done') {
      const proxy = (t.dueDate && t.dueDate <= today) ? `${t.dueDate}T12:00:00Z` : BASELINE;
      completed = q(proxy); created = q(proxy); updated = q(proxy);
    } else {
      created = 'now()'; updated = 'now()'; completed = 'null';
    }
    lines.push(
      `insert into tasks (import_key, description, project_id, priority, effort_level, tipo_gestion, due_date, status, ice, created_at, updated_at, completed_at)\n` +
      `values (${q(t.notionId)}, ${q(t.description)}, ${projectSel}, ${q(t.priority)}, ${q(t.effort)}, ${q(t.tipoGestion)}, ${q(t.dueDate)}, ${q(t.status)}, ${t.ice ?? 'null'}, ${created}, ${updated}, ${completed})\n` +
      `on conflict (import_key) do update set description = excluded.description, project_id = excluded.project_id, priority = excluded.priority, effort_level = excluded.effort_level, tipo_gestion = excluded.tipo_gestion, due_date = excluded.due_date, status = excluded.status, ice = excluded.ice, completed_at = excluded.completed_at;`
    );
  });
  lines.push('');
  return lines.join('\n');
}

// ------------------------------------------------------------
// Main
// ------------------------------------------------------------
function main() {
  const inputs = process.argv.slice(2);
  if (!inputs.length) {
    console.error('Uso: node scripts/import-notion-export.js <archivo.csv | archivo.html | carpeta>');
    console.error('Tip: si Notion te dio un .zip, descomprímelo primero y pasa la carpeta.');
    process.exit(1);
  }

  const files = collectFiles(inputs);
  if (!files.length) {
    console.error('No encontré archivos .csv ni .html en lo que me pasaste.');
    process.exit(1);
  }

  // Cada fila de Notion tiene un id de página único → esa es la llave real.
  // Solo las filas sin href (CSV) usan un hash de contenido como id.
  const isRealId = id => /^[0-9a-f]{32}$/.test(id);
  const contentKey = t => [normalizeKey(t.description), normalizeKey(t.topic || ''), t.dueDate || ''].join('|');

  const byId = new Map();          // dedup exacto por id (filas idénticas del mismo export)
  const sources = [];
  for (const f of files) {
    const text = fs.readFileSync(f, 'utf8');
    let tasks = null;
    if (/\.csv$/i.test(f)) {
      const rows = parseCsv(text);
      if (rows.length > 1) tasks = rowsToTasks(rows[0], rows.slice(1), null);
    } else {
      for (const table of parseHtmlTables(text)) {
        const t = rowsToTasks(table.headers, table.rows, r => r.href);
        if (t && t.length) { tasks = (tasks || []).concat(t); }
      }
    }
    if (tasks && tasks.length) {
      sources.push(`  · ${path.basename(f)}: ${tasks.length} tareas`);
      tasks.forEach(t => { if (!byId.has(t.notionId)) byId.set(t.notionId, t); });
    }
  }

  // Solo si la MISMA tarea aparece con id real (HTML) y con hash (CSV),
  // se descarta la copia con hash. NUNCA se colapsan dos filas con id real,
  // aunque tengan la misma descripción (tareas recurrentes).
  const realContent = new Set();
  for (const t of byId.values()) if (isRealId(t.notionId)) realContent.add(contentKey(t));
  const all = [...byId.values()].filter(t => isRealId(t.notionId) || !realContent.has(contentKey(t)));
  if (!all.length) {
    console.error('Leí los archivos pero no encontré ninguna tabla con la columna Description/Nombre.');
    console.error('Verifica que exportaste la base de datos de tareas (no una página suelta).');
    process.exit(1);
  }

  const outPath = path.join(__dirname, '..', 'supabase', 'seed-notion.sql');
  fs.writeFileSync(outPath, buildSql(all));

  const done = all.filter(t => t.status === 'done').length;
  const doing = all.filter(t => t.status === 'doing').length;
  const todo = all.length - done - doing;
  const topics = new Set(all.map(t => t.topic).filter(Boolean));
  const sinFecha = all.filter(t => !t.dueDate).length;

  console.log('Archivos leídos:');
  console.log(sources.join('\n'));
  console.log('');
  console.log(`✓ ${all.length} tareas únicas → ${outPath}`);
  console.log(`  Por hacer: ${todo} · En curso: ${doing} · Hechas: ${done}`);
  console.log(`  Proyectos detectados (${topics.size}): ${[...topics].join(' · ')}`);
  console.log(`  Sin fecha límite: ${sinFecha}`);
  console.log('');
  console.log('Siguiente paso: abre Supabase → SQL Editor → pega el contenido de');
  console.log('supabase/seed-notion.sql → Run. (Antes debe estar ejecutado schema.sql).');
}

main();
