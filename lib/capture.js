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

const TASK_PROPS = {
  description: { type: 'string', description: 'La acción concreta, redactada limpia y accionable (empieza por un verbo). Quita del texto los metadatos ya extraídos (proyecto, fecha, "urgente"), pero conserva el detalle necesario para entenderla. Mismo idioma del usuario.' },
  project: { type: ['string', 'null'], description: 'Proyecto/frente al que pertenece. Si se parece a uno de la lista de proyectos existentes (aunque esté abreviado, con typo o en minúsculas), devuelve el nombre EXACTO de la lista. Si es claramente uno nuevo, devuélvelo como lo escribió. null si no hay señal de proyecto.' },
  priority: { type: ['string', 'null'], enum: ['High', 'Medium', 'Low', null], description: 'INFIERE la prioridad con criterio de asistente: High si hay urgencia explícita ("urgente", "ya", "hoy", "cuanto antes") o si la fecha límite es en ≤2 días o algo bloquea a otros; Low si es claramente menor o "cuando haya tiempo"; Medium para lo demás. null solo si de verdad no hay ninguna señal.' },
  effort: { type: ['string', 'null'], enum: ['Small', 'Medium', 'Large', null], description: 'INFIERE el esfuerzo por el tipo de acción: Small para acciones rápidas de minutos (llamar, enviar correo, confirmar, agendar); Large para entregables grandes (preparar propuesta, construir, documentar a fondo); Medium para lo intermedio. null si no hay pista.' },
  tipo_gestion: { type: ['string', 'null'], enum: ['Propia', 'Compartida', 'Depende Tercero', null], description: 'INFIERE quién mueve la tarea: Compartida si implica coordinar/reunir/decidir CON alguien ("coordinar con", "reunión con", "alinear con", "revisar juntos"); Depende Tercero si Mauro queda esperando a otro ("esperar respuesta de", "seguimiento a", "pendiente de que X"); Propia si Mauro la ejecuta él mismo (redactar, preparar, revisar, subir). Default Propia si no hay señal clara de terceros.' },
  due_date: { type: ['string', 'null'], description: 'SOLO si el texto menciona una fecha real, absoluta o relativa ("mañana", "el viernes", "fin de mes"). Formato YYYY-MM-DD. NUNCA inventes una fecha que el usuario no dio: null si no hay ninguna.' },
};

const CAPTURE_TOOL = {
  name: 'registrar_tarea',
  description: 'Convierte una nota en lenguaje natural en una tarea estructurada y priorizada, como lo haría un buen asistente ejecutivo.',
  input_schema: {
    type: 'object',
    properties: TASK_PROPS,
    required: ['description'],
  },
};

const CAPTURE_MULTI_TOOL = {
  name: 'registrar_tareas',
  description: 'Convierte una nota con varias tareas en viñetas en una lista de tareas estructuradas y priorizadas.',
  input_schema: {
    type: 'object',
    properties: {
      tareas: {
        type: 'array',
        minItems: 1,
        description: 'Una entrada por cada viñeta de la nota, en el mismo orden.',
        items: { type: 'object', properties: TASK_PROPS, required: ['description'] },
      },
    },
    required: ['tareas'],
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

  // Prioridad: explícita, o inferida por urgencia / fecha muy cercana
  if (/\b(urgente|prioridad alta|alta prioridad|high|cuanto antes|ya mismo|hoy mismo|asap)\b/.test(t)) parsed.priority = 'High';
  else if (/\b(prioridad baja|baja prioridad|low|cuando (haya|tenga) tiempo|sin afan|no urge)\b/.test(t)) parsed.priority = 'Low';
  else if (/\b(prioridad media|media prioridad)\b/.test(t)) parsed.priority = 'Medium';
  if (!parsed.priority && parsed.due_date) {
    const days = Math.round((new Date(parsed.due_date + 'T12:00:00Z') - new Date(todayBogota() + 'T12:00:00Z')) / DAY);
    if (days <= 2) parsed.priority = 'High';
  }

  // Esfuerzo: explícito o inferido por el verbo/acción
  if (/\b(rapida|rapido|pequena|quick ?win|small|esfuerzo bajo)\b/.test(t)) parsed.effort = 'Small';
  else if (/\b(grande|large|esfuerzo alto)\b/.test(t)) parsed.effort = 'Large';
  else if (/\b(llamar|llama|enviar correo|mandar correo|escribir a|confirmar|agendar|avisar|recordar|responder|contestar)\b/.test(t)) parsed.effort = 'Small';
  else if (/\b(preparar|construir|desarrollar|documentar|propuesta|presentacion|informe completo|disenar)\b/.test(t)) parsed.effort = 'Large';

  // Tipo de gestión: explícito o inferido por los verbos
  if (/\b(compartida|compartido)\b/.test(t)) parsed.tipo_gestion = 'Compartida';
  else if (/\b(tercero|terceros|espero respuesta|esperar respuesta|esperando respuesta|esperando a|seguimiento a|pendiente de que|pendiente de respuesta|depende de|a la espera|respuesta de)\b/.test(t)) parsed.tipo_gestion = 'Depende Tercero';
  else if (/\b(coordinar con|reunion con|reunirse con|reunirme con|alinear con|revisar con|validar con|decidir con|hablar con|acordar con)\b/.test(t)) parsed.tipo_gestion = 'Compartida';

  for (const p of projects || []) {
    const full = normalizeText(p.name);
    const firstWord = full.split(/\s+/)[0];
    if (t.includes(full) || (firstWord.length >= 4 && t.includes(firstWord))) { parsed.project = p.name; break; }
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
      system: `Eres el asistente ejecutivo de Mauro, líder corporativo en Amarilo (constructora colombiana). Él te lanza notas sueltas en español colombiano y tú las conviertes en tareas bien organizadas y priorizadas, como lo haría un jefe de gabinete experto.
Hoy es ${weekdayBogota()} ${todayBogota()} en Bogotá — usa esta fecha para resolver fechas relativas.

Proyectos existentes:
${projectList}

Cómo trabajar:
- Entiende la INTENCIÓN, no solo las palabras. Redacta la descripción como una acción clara que empieza por un verbo.
- INFIERE con criterio prioridad, esfuerzo y tipo de gestión a partir del contenido y del contexto de Mauro (ver descripciones de cada campo). Es tu trabajo como asistente organizarlo bien, no dejar todo en null.
- La ÚNICA cosa que nunca inventas es la fecha límite: si el texto no menciona una fecha, deja due_date en null.
- Vincula al proyecto correcto de la lista cuando haya cualquier señal razonable; si claramente es un frente nuevo, proponlo.
- Si la nota trae varias ideas, quédate con la acción principal y no pierdas el detalle importante en la descripción.`,
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

// ------------------------------------------------------------
// CAPTURA MÚLTIPLE: viñetas "-" → varias tareas de una vez.
// El texto fuera de las viñetas es contexto compartido (proyecto,
// fecha, prioridad…) que aplica a todas salvo que la viñeta diga otra cosa.
// ------------------------------------------------------------
const BULLET_RE = /^\s*[-*•]\s+/;

function splitBullets(text) {
  const lines = String(text).split(/\r?\n/);
  const header = [];
  const items = [];
  for (const line of lines) {
    if (BULLET_RE.test(line)) items.push(line.replace(BULLET_RE, '').trim());
    else if (items.length && line.trim()) items[items.length - 1] += ' ' + line.trim(); // continuación de la viñeta anterior
    else if (line.trim()) header.push(line.trim());
  }
  return { header: header.join(' ').replace(/[:：]\s*$/, ''), items: items.filter(Boolean) };
}

function isMultiCapture(text) {
  return splitBullets(text).items.length >= 2;
}

function cleanParsed(p, fallbackText) {
  return {
    description: (p.description || String(fallbackText || '')).trim(),
    project: p.project || null,
    priority: ['High', 'Medium', 'Low'].includes(p.priority) ? p.priority : null,
    effort: ['Small', 'Medium', 'Large'].includes(p.effort) ? p.effort : null,
    tipo_gestion: ['Propia', 'Compartida', 'Depende Tercero'].includes(p.tipo_gestion) ? p.tipo_gestion : null,
    due_date: /^\d{4}-\d{2}-\d{2}$/.test(p.due_date || '') ? p.due_date : null,
  };
}

function heuristicParseMulti(text, projects) {
  const { header, items } = splitBullets(text);
  const ctx = header ? heuristicParse(header, projects).parsed : null;
  const tareas = items.map(item => {
    const p = heuristicParse(item, projects).parsed;
    if (ctx) {
      p.project = p.project || ctx.project;
      p.priority = p.priority || ctx.priority;
      p.effort = p.effort || ctx.effort;
      p.tipo_gestion = p.tipo_gestion || ctx.tipo_gestion;
      p.due_date = p.due_date || ctx.due_date;
    }
    return p;
  });
  return { tareas, engine: 'reglas' };
}

async function parseCaptureMulti(text, projects) {
  if (!client) return heuristicParseMulti(text, projects);
  try {
    const projectList = (projects || []).map(p => `- ${p.name}`).join('\n') || '(ninguno todavía)';
    const res = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 2000,
      tools: [CAPTURE_MULTI_TOOL],
      tool_choice: { type: 'tool', name: 'registrar_tareas' },
      system: `Eres el asistente ejecutivo de Mauro, líder corporativo en Amarilo (constructora colombiana). Él te lanza notas en español colombiano con VARIAS tareas en viñetas y tú las conviertes en tareas bien organizadas y priorizadas.
Hoy es ${weekdayBogota()} ${todayBogota()} en Bogotá — usa esta fecha para resolver fechas relativas.

Proyectos existentes:
${projectList}

Cómo trabajar:
- CADA VIÑETA es una tarea independiente. Devuélvelas todas, en el mismo orden.
- El texto FUERA de las viñetas (encabezado) es contexto compartido: si menciona proyecto, fecha, urgencia o responsables, aplícalo a TODAS las viñetas, salvo que una viñeta indique otra cosa (lo dicho en la viñeta manda).
- Redacta cada descripción como una acción clara que empieza por un verbo, sin los metadatos ya extraídos.
- INFIERE con criterio prioridad, esfuerzo y tipo de gestión de cada tarea (ver descripciones de cada campo).
- La ÚNICA cosa que nunca inventas es la fecha límite: si ni la viñeta ni el encabezado mencionan fecha, deja due_date en null.
- Vincula cada tarea al proyecto correcto de la lista cuando haya cualquier señal razonable; si claramente es un frente nuevo, proponlo (varias viñetas pueden compartirlo o tener proyectos distintos).`,
      messages: [{ role: 'user', content: String(text) }],
    });
    const toolUse = res.content.find(c => c.type === 'tool_use');
    if (!toolUse || !Array.isArray(toolUse.input.tareas) || !toolUse.input.tareas.length) {
      return heuristicParseMulti(text, projects);
    }
    const { items } = splitBullets(text);
    return {
      tareas: toolUse.input.tareas.map((p, i) => cleanParsed(p, items[i] || '')).filter(t => t.description),
      engine: 'claude',
    };
  } catch (err) {
    console.error('parseCaptureMulti con Claude falló, usando reglas:', err.message);
    return heuristicParseMulti(text, projects);
  }
}

module.exports = { parseCapture, parseCaptureMulti, isMultiCapture };
