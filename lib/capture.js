// ============================================================
// CAPTURA RÁPIDA: texto libre → tarea estructurada
// Usa Claude para reconocer proyecto, prioridad, esfuerzo, tipo
// de gestión y deadline. Si la API falla, cae a un parser básico.
// Todos los campos son opcionales excepto la descripción.
// ============================================================
const Anthropic = require('@anthropic-ai/sdk');

const client = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

const DAY = 86400000;

const CAPTURE_TOOL = {
  name: 'registrar_tarea',
  description: 'Registra una tarea extrayendo solo los datos explícitos del texto del usuario.',
  input_schema: {
    type: 'object',
    properties: {
      description: { type: 'string', description: 'La tarea en sí, limpia: sin el proyecto, prioridad ni fechas si fueron mencionados como metadatos. Conserva el idioma original.' },
      project: { type: ['string', 'null'], description: 'Proyecto mencionado. Si coincide con uno de la lista de proyectos existentes (aunque esté escrito distinto o abreviado), devuelve el nombre EXACTO de la lista. Si es un proyecto nuevo, devuélvelo como lo escribió el usuario. null si no menciona proyecto.' },
      priority: { type: ['string', 'null'], enum: ['High', 'Medium', 'Low', null], description: 'Solo si el usuario indica prioridad/urgencia. "urgente"/"alta" → High.' },
      effort: { type: ['string', 'null'], enum: ['Small', 'Medium', 'Large', null], description: 'Solo si indica tamaño/esfuerzo. "rápida"/"pequeña"/"quick win" → Small.' },
      tipo_gestion: { type: ['string', 'null'], enum: ['Propia', 'Compartida', 'Depende Tercero', null], description: '"compartida"/"con alguien" → Compartida; "espero respuesta"/"depende de X" → Depende Tercero. null si no lo indica.' },
      due_date: { type: ['string', 'null'], description: 'Deadline en formato YYYY-MM-DD si menciona fecha (absoluta o relativa como "mañana", "el viernes"). null si no menciona.' },
    },
    required: ['description'],
  },
};

function todayBogota() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
}

function weekdayBogota() {
  return new Date().toLocaleDateString('es-CO', { weekday: 'long', timeZone: 'America/Bogota' });
}

function normalizeText(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// ------------------------------------------------------------
// Fallback sin IA: reglas simples en español
// ------------------------------------------------------------
const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];

function heuristicDate(text) {
  const t = normalizeText(text);
  const today = new Date(todayBogota() + 'T12:00:00Z');
  const iso = d => d.toISOString().slice(0, 10);

  if (/\bpasado manana\b/.test(t)) return iso(new Date(today.getTime() + 2 * DAY));
  if (/\bmanana\b/.test(t)) return iso(new Date(today.getTime() + DAY));
  if (/\bhoy\b/.test(t)) return iso(today);

  const wd = WEEKDAYS.findIndex(w => new RegExp(`\\b(el |este |proximo )?${w}\\b`).test(t));
  if (wd >= 0) {
    let diff = (wd - today.getUTCDay() + 7) % 7;
    if (diff === 0) diff = 7;
    return iso(new Date(today.getTime() + diff * DAY));
  }

  const m = t.match(/\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/);
  if (m) {
    const year = m[3] ? (m[3].length === 2 ? '20' + m[3] : m[3]) : String(today.getUTCFullYear());
    const date = new Date(Date.UTC(+year, +m[2] - 1, +m[1], 12));
    if (!m[3] && date < today) date.setUTCFullYear(date.getUTCFullYear() + 1);
    return iso(date);
  }
  return null;
}

function heuristicParse(text, projects) {
  const t = normalizeText(text);
  const parsed = { description: String(text).trim(), project: null, priority: null, effort: null, tipo_gestion: null, due_date: heuristicDate(text) };

  if (/\b(urgente|prioridad alta|alta prioridad|high)\b/.test(t)) parsed.priority = 'High';
  else if (/\b(prioridad baja|baja prioridad|low)\b/.test(t)) parsed.priority = 'Low';
  else if (/\b(prioridad media|media prioridad)\b/.test(t)) parsed.priority = 'Medium';

  if (/\b(rapida|rapido|pequena|quick ?win|small|esfuerzo bajo)\b/.test(t)) parsed.effort = 'Small';
  else if (/\b(grande|large|esfuerzo alto)\b/.test(t)) parsed.effort = 'Large';

  if (/\b(compartida|compartido)\b/.test(t)) parsed.tipo_gestion = 'Compartida';
  else if (/\b(tercero|terceros|espero respuesta|esperando respuesta)\b/.test(t)) parsed.tipo_gestion = 'Depende Tercero';

  for (const p of projects || []) {
    if (t.includes(normalizeText(p.name))) { parsed.project = p.name; break; }
  }
  return { parsed, engine: 'reglas' };
}

// ------------------------------------------------------------
// Parser principal con Claude
// ------------------------------------------------------------
async function parseCapture(text, projects) {
  if (!client) return heuristicParse(text, projects);
  try {
    const projectList = (projects || []).map(p => `- ${p.name}`).join('\n') || '(ninguno todavía)';
    const res = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 500,
      tools: [CAPTURE_TOOL],
      tool_choice: { type: 'tool', name: 'registrar_tarea' },
      system: `Extraes datos estructurados de una tarea escrita en lenguaje natural por Mauro (español colombiano).
Hoy es ${weekdayBogota()} ${todayBogota()} en Bogotá — usa esta fecha para resolver fechas relativas.

Proyectos existentes:
${projectList}

Reglas:
- Extrae SOLO lo que el texto dice explícitamente. Nunca inventes deadline, prioridad, esfuerzo ni tipo de gestión.
- La descripción debe quedar limpia y accionable, sin los metadatos ya extraídos, pero sin perder información.
- Si el proyecto mencionado se parece a uno existente (abreviado, con typo, en minúsculas), devuelve el nombre exacto de la lista.`,
      messages: [{ role: 'user', content: String(text) }],
    });
    const toolUse = res.content.find(c => c.type === 'tool_use');
    if (!toolUse) return heuristicParse(text, projects);
    const p = toolUse.input;
    return {
      parsed: {
        description: (p.description || String(text)).trim(),
        project: p.project || null,
        priority: ['High', 'Medium', 'Low'].includes(p.priority) ? p.priority : null,
        effort: ['Small', 'Medium', 'Large'].includes(p.effort) ? p.effort : null,
        tipo_gestion: ['Propia', 'Compartida', 'Depende Tercero'].includes(p.tipo_gestion) ? p.tipo_gestion : null,
        due_date: /^\d{4}-\d{2}-\d{2}$/.test(p.due_date || '') ? p.due_date : null,
      },
      engine: 'claude',
    };
  } catch (err) {
    console.error('parseCapture con Claude falló, usando reglas:', err.message);
    return heuristicParse(text, projects);
  }
}

module.exports = { parseCapture };
