// ============================================================
// CAPA DE DATOS · SUPABASE
// Fuente única de datos: tareas (micromanagement) +
// proyectos con secciones y actividades (Gantt, management general)
// ============================================================
const crypto = require('crypto');
const { getClient } = require('./supabase');
const { enrich, buildDashboardPayload } = require('./scoring');

const DAY = 86400000;
const DEFAULT_SECTIONS = ['Estructuración y planeación', 'Ejecución y seguimiento a piloto', 'Implementación al negocio'];
const TASK_SELECT = '*, project:projects(id,name,ice), activity:activities(id,name)';

function fail(error) {
  const msg = error.message || String(error);
  // Aviso claro si la base todavía no tiene las columnas nuevas
  if (/column .* does not exist/i.test(msg)) {
    throw new Error(`${msg} · Falta ejecutar supabase/migracion-2026-08-gantt-plus.sql en Supabase → SQL Editor`);
  }
  throw new Error(msg);
}

function todayBogota() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
}

function daysBetween(fromISO, toISO) {
  return Math.round((new Date(toISO + 'T12:00:00Z') - new Date(fromISO + 'T12:00:00Z')) / DAY);
}

// Normaliza "Diana, Camilo" o ['Diana','Camilo'] a una lista limpia de nombres
function parseNameList(value) {
  if (value == null) return [];
  const raw = Array.isArray(value) ? value : String(value).split(',');
  const out = [];
  raw.forEach(v => {
    const clean = String(v == null ? '' : v).trim();
    if (clean && !out.some(x => x.toLowerCase() === clean.toLowerCase())) out.push(clean);
  });
  return out;
}

// Normaliza una lista de ids (dependencias) quitando vacíos y repetidos
function parseIdList(value) {
  if (value == null) return [];
  const raw = Array.isArray(value) ? value : [value];
  const out = [];
  raw.forEach(v => {
    const clean = String(v == null ? '' : v).trim();
    if (clean && !out.includes(clean)) out.push(clean);
  });
  return out;
}

// ------------------------------------------------------------
// TAREAS
// ------------------------------------------------------------
function formatTask(row) {
  const project = row.project || null;
  const taskIce = row.ice != null ? Number(row.ice) : null;
  const projectIce = project && project.ice != null ? Number(project.ice) : null;
  return {
    id: row.id,
    title: row.description,
    description: row.description,
    status: row.status === 'done' ? 'Done' : 'To-do',
    kanbanStatus: row.status,
    priority: row.priority,
    topic: project ? project.name : null,
    projectId: row.project_id,
    activityId: row.activity_id,
    activityName: row.activity ? row.activity.name : null,
    dueDate: row.due_date,
    effortLevel: row.effort_level,
    tipoGestion: row.tipo_gestion,
    // El ICE manual del proyecto manda sobre el arrastrado de Notion en la tarea
    ice: projectIce ?? taskIce,
    createdTime: row.created_at,
    lastEdited: (row.status === 'done' && row.completed_at) ? row.completed_at : row.updated_at,
    completedAt: row.completed_at,
  };
}

async function fetchAllTasks() {
  const sb = getClient();
  const { data, error } = await sb.from('tasks').select(TASK_SELECT).order('created_at', { ascending: false });
  if (error) fail(error);
  return data.map(formatTask);
}

async function getDashboard() {
  const all = await fetchAllTasks();
  const todo = all.filter(t => t.kanbanStatus !== 'done');
  const done = all.filter(t => t.kanbanStatus === 'done');
  return buildDashboardPayload(todo, done);
}

function taskFieldsFromInput(input) {
  const fields = {};
  if (input.description !== undefined) fields.description = String(input.description).trim();
  if (input.projectId !== undefined) fields.project_id = input.projectId || null;
  if (input.activityId !== undefined) fields.activity_id = input.activityId || null;
  if (input.priority !== undefined) fields.priority = input.priority || null;
  if (input.effortLevel !== undefined) fields.effort_level = input.effortLevel || null;
  if (input.tipoGestion !== undefined) fields.tipo_gestion = input.tipoGestion || null;
  if (input.dueDate !== undefined) fields.due_date = input.dueDate || null;
  if (input.ice !== undefined) fields.ice = input.ice ?? null;
  if (input.status !== undefined) {
    fields.status = input.status;
    fields.completed_at = input.status === 'done' ? new Date().toISOString() : null;
  }
  return fields;
}

async function createTask(input) {
  const sb = getClient();
  let projectId = input.projectId || null;
  if (!projectId && input.projectName) {
    const project = await resolveProject(input.projectName);
    projectId = project.id;
  }
  const fields = taskFieldsFromInput({ tipoGestion: 'Propia', ...input, projectId, status: input.status || 'todo' });
  if (!fields.description) throw new Error('La descripción de la tarea es obligatoria');
  const { data, error } = await sb.from('tasks').insert(fields).select(TASK_SELECT).single();
  if (error) fail(error);
  return enrich(formatTask(data));
}

async function updateTask(id, input) {
  const sb = getClient();
  let patch = { ...input };
  if (patch.projectName !== undefined && patch.projectId === undefined) {
    if (patch.projectName) {
      const project = await resolveProject(patch.projectName);
      patch.projectId = project.id;
    } else {
      patch.projectId = null;
    }
  }
  const fields = taskFieldsFromInput(patch);
  if (fields.description !== undefined && !fields.description) throw new Error('La descripción no puede quedar vacía');
  const { data, error } = await sb.from('tasks').update(fields).eq('id', id).select(TASK_SELECT).single();
  if (error) fail(error);
  return enrich(formatTask(data));
}

async function deleteTask(id) {
  const sb = getClient();
  const { error } = await sb.from('tasks').delete().eq('id', id);
  if (error) fail(error);
}

async function markDone(id) {
  return updateTask(id, { status: 'done' });
}

// ------------------------------------------------------------
// PROYECTOS
// ------------------------------------------------------------
async function resolveProject(name) {
  const sb = getClient();
  const clean = String(name).trim();
  if (!clean) throw new Error('Nombre de proyecto vacío');
  const { data: found, error: findErr } = await sb.from('projects').select('*').ilike('name', clean).limit(1);
  if (findErr) fail(findErr);
  if (found && found.length) return found[0];
  return createProject({ name: clean });
}

async function createProject(input) {
  const sb = getClient();
  const name = String(input.name || '').trim();
  if (!name) throw new Error('El nombre del proyecto es obligatorio');
  const { data: project, error } = await sb.from('projects').insert({
    name,
    descripcion: input.descripcion || null,
    responsable: input.responsable || null,
    ice: input.ice ?? null,
  }).select('*').single();
  if (error) {
    if (String(error.message).includes('duplicate')) throw new Error(`Ya existe un proyecto llamado "${name}"`);
    fail(error);
  }
  const sections = DEFAULT_SECTIONS.map((s, i) => ({ project_id: project.id, name: s, position: i }));
  const { error: secErr } = await sb.from('project_sections').insert(sections);
  if (secErr) fail(secErr);
  return project;
}

async function updateProject(id, input) {
  const sb = getClient();
  const fields = {};
  if (input.name !== undefined) fields.name = String(input.name).trim();
  if (input.descripcion !== undefined) fields.descripcion = input.descripcion || null;
  if (input.responsable !== undefined) fields.responsable = input.responsable || null;
  if (input.ice !== undefined) fields.ice = input.ice ?? null;
  if (input.archivado !== undefined) fields.archivado = !!input.archivado;
  const { data, error } = await sb.from('projects').update(fields).eq('id', id).select('*').single();
  if (error) fail(error);
  return data;
}

async function deleteProject(id) {
  const sb = getClient();
  const { error } = await sb.from('projects').delete().eq('id', id);
  if (error) fail(error);
}

async function listProjectNames() {
  const sb = getClient();
  const { data, error } = await sb.from('projects').select('id,name').eq('archivado', false).order('name');
  if (error) fail(error);
  return data;
}

// ------------------------------------------------------------
// ACTIVIDADES DEL GANTT + estado derivado
// ------------------------------------------------------------
function deriveActivity(a, today) {
  const done = a.status === 'completada';
  let diasRestantes = null;
  let alerta = null; // 'retraso' | 'proximidad' | null
  if (a.deadline) {
    diasRestantes = daysBetween(today, a.deadline);
    if (!done) {
      if (diasRestantes < 0) alerta = 'retraso';
      else if (diasRestantes <= 7) alerta = 'proximidad';
    }
  }
  const avance = done ? 100 : (a.pct_complete || 0);
  const estadoEfectivo = done ? 'completada' : alerta === 'retraso' ? 'retrasada' : a.status;
  // Los arrays mandan; las columnas viejas (responsable / depends_on) son el respaldo
  const responsables = (a.responsables && a.responsables.length)
    ? parseNameList(a.responsables)
    : parseNameList(a.responsable);
  const dependsOnIds = (a.depends_on_ids && a.depends_on_ids.length)
    ? parseIdList(a.depends_on_ids)
    : parseIdList(a.depends_on);
  return {
    id: a.id,
    projectId: a.project_id,
    sectionId: a.section_id,
    name: a.name,
    responsable: responsables.join(', ') || null,
    responsables,
    startDate: a.start_date,
    deadline: a.deadline,
    status: a.status,
    estadoEfectivo,
    pctComplete: avance,
    dependsOn: dependsOnIds[0] || null,
    dependsOnIds,
    notes: a.notes,
    position: a.position,
    diasRestantes,
    alerta,
    pctEsperado: expectedPct({ startDate: a.start_date, deadline: a.deadline }, today),
  };
}

// ------------------------------------------------------------
// RUTA CRÍTICA
// Método clásico CPM sobre índices de día: pasada hacia adelante
// (inicio/fin más tempranos) y hacia atrás (más tardíos). Las
// actividades con holgura 0 son las que, si se atrasan, atrasan
// todo el proyecto.
// ------------------------------------------------------------
function annotateCriticalPath(list) {
  const activities = list || [];
  activities.forEach(a => { a.critical = false; a.slack = null; });
  const fechas = [];
  activities.forEach(a => { if (a.startDate) fechas.push(a.startDate); if (a.deadline) fechas.push(a.deadline); });
  if (!fechas.length) return activities;
  fechas.sort();
  const origen = fechas[0];

  const byId = new Map(activities.map(a => [a.id, a]));
  const preds = new Map(activities.map(a => [a.id, (a.dependsOnIds || []).filter(id => byId.has(id) && id !== a.id)]));
  const succs = new Map(activities.map(a => [a.id, []]));
  preds.forEach((ids, id) => ids.forEach(pid => succs.get(pid).push(id)));

  const dur = a => (a.startDate && a.deadline && a.deadline >= a.startDate)
    ? daysBetween(a.startDate, a.deadline) + 1
    : 1;
  const anclaje = a => {
    if (a.startDate) return daysBetween(origen, a.startDate);
    if (a.deadline) return daysBetween(origen, a.deadline) - dur(a) + 1;
    return null;
  };

  // Pasada hacia adelante (memoizada, tolerante a ciclos)
  const es = {}, ef = {}, estado = {};
  function forward(a) {
    if (estado[a.id] === 'listo') return;
    if (estado[a.id] === 'visitando') { es[a.id] = es[a.id] || 0; ef[a.id] = es[a.id] + dur(a) - 1; return; }
    estado[a.id] = 'visitando';
    let inicio = anclaje(a);
    if (inicio == null) inicio = 0;
    preds.get(a.id).forEach(pid => {
      const p = byId.get(pid);
      forward(p);
      inicio = Math.max(inicio, ef[pid] + 1);
    });
    es[a.id] = inicio;
    ef[a.id] = inicio + dur(a) - 1;
    estado[a.id] = 'listo';
  }
  activities.forEach(forward);

  const finProyecto = Math.max(...activities.map(a => ef[a.id]));

  // Pasada hacia atrás
  const lf = {}, ls = {}, estado2 = {};
  function backward(a) {
    if (estado2[a.id] === 'listo') return;
    if (estado2[a.id] === 'visitando') { lf[a.id] = lf[a.id] != null ? lf[a.id] : finProyecto; ls[a.id] = lf[a.id] - dur(a) + 1; return; }
    estado2[a.id] = 'visitando';
    const hijos = succs.get(a.id);
    let fin = hijos.length ? Infinity : finProyecto;
    hijos.forEach(sid => {
      backward(byId.get(sid));
      fin = Math.min(fin, ls[sid] - 1);
    });
    if (!isFinite(fin)) fin = finProyecto;
    lf[a.id] = fin;
    ls[a.id] = fin - dur(a) + 1;
    estado2[a.id] = 'listo';
  }
  activities.forEach(backward);

  activities.forEach(a => {
    // Sin fechas ni dependencias no participa de la ruta
    const suelta = !a.startDate && !a.deadline && !preds.get(a.id).length && !succs.get(a.id).length;
    const holgura = ls[a.id] - es[a.id];
    a.slack = suelta ? null : holgura;
    a.critical = !suelta && holgura <= 0;
    // Crítica y en riesgo → se pinta rojo suave; crítica y sana → morada
    a.criticaEnRiesgo = a.critical && a.estadoEfectivo !== 'completada' &&
      (a.alerta === 'retraso' || (a.pctEsperado != null && a.pctComplete < a.pctEsperado - 15));
  });
  return activities;
}

// % que la actividad debería llevar hoy según sus fechas planeadas
function expectedPct(a, today) {
  if (!a.startDate || !a.deadline || a.deadline < a.startDate) return null;
  const total = daysBetween(a.startDate, a.deadline) + 1;
  const elapsed = daysBetween(a.startDate, today) + 1;
  return Math.max(0, Math.min(100, Math.round(elapsed / total * 100)));
}

function buildProjectSummary(activities, tasks, today) {
  const conDeadline = activities.filter(a => a.deadline);
  const retrasos = activities.filter(a => a.alerta === 'retraso');
  const proximas = activities.filter(a => a.alerta === 'proximidad');
  const completadas = activities.filter(a => a.status === 'completada');
  const avance = activities.length
    ? Math.round(activities.reduce((s, a) => s + a.pctComplete, 0) / activities.length)
    : 0;
  const fechaFinal = conDeadline.length
    ? conDeadline.map(a => a.deadline).sort().slice(-1)[0]
    : null;
  const fechasCriticas = [...retrasos, ...proximas]
    .sort((x, y) => (x.deadline || '').localeCompare(y.deadline || ''))
    .slice(0, 6)
    .map(a => ({ id: a.id, name: a.name, deadline: a.deadline, alerta: a.alerta, responsable: a.responsable, diasRestantes: a.diasRestantes }));

  const activeTasks = (tasks || []).filter(t => t.kanbanStatus !== 'done');
  const status = retrasos.length ? 'red' : proximas.length ? 'yellow' : 'green';

  // Plan vs ejecutado: promedio del % esperado a hoy en actividades con fechas
  const conPlan = activities.map(a => expectedPct(a, today)).filter(v => v !== null);
  const avanceEsperado = conPlan.length ? Math.round(conPlan.reduce((s, v) => s + v, 0) / conPlan.length) : null;

  const criticas = activities.filter(a => a.critical);
  const criticasEnRiesgo = criticas.filter(a => a.criticaEnRiesgo);

  return {
    today,
    totalActividades: activities.length,
    completadas: completadas.length,
    avance,
    avanceEsperado,
    rutaCritica: criticas.length,
    rutaCriticaEnRiesgo: criticasEnRiesgo.length,
    fechaFinal,
    retrasos: retrasos.length,
    proximas: proximas.length,
    fechasCriticas,
    tareasActivas: activeTasks.length,
    tareasTotal: (tasks || []).length,
    status,
  };
}

async function listProjects() {
  const sb = getClient();
  const today = todayBogota();
  const [projRes, actRes, taskRes] = await Promise.all([
    sb.from('projects').select('*').eq('archivado', false).order('created_at'),
    sb.from('activities').select('*'),
    sb.from('tasks').select('id, project_id, status'),
  ]);
  if (projRes.error) fail(projRes.error);
  if (actRes.error) fail(actRes.error);
  if (taskRes.error) fail(taskRes.error);

  return projRes.data.map(p => {
    const acts = annotateCriticalPath(actRes.data.filter(a => a.project_id === p.id).map(a => deriveActivity(a, today)));
    const tasks = taskRes.data
      .filter(t => t.project_id === p.id)
      .map(t => ({ kanbanStatus: t.status }));
    return {
      id: p.id,
      name: p.name,
      descripcion: p.descripcion,
      responsable: p.responsable,
      ice: p.ice != null ? Number(p.ice) : null,
      summary: buildProjectSummary(acts, tasks, today),
    };
  });
}

async function getProjectDetail(id) {
  const sb = getClient();
  const today = todayBogota();
  const [projRes, secRes, actRes, taskRes] = await Promise.all([
    sb.from('projects').select('*').eq('id', id).single(),
    sb.from('project_sections').select('*').eq('project_id', id).order('position'),
    sb.from('activities').select('*').eq('project_id', id).order('position').order('created_at'),
    sb.from('tasks').select(TASK_SELECT).eq('project_id', id).order('created_at', { ascending: false }),
  ]);
  if (projRes.error) fail(projRes.error);
  if (secRes.error) fail(secRes.error);
  if (actRes.error) fail(actRes.error);
  if (taskRes.error) fail(taskRes.error);

  const activities = annotateCriticalPath(actRes.data.map(a => deriveActivity(a, today)));
  const tasks = taskRes.data.map(r => enrich(formatTask(r)));
  const p = projRes.data;

  return {
    id: p.id,
    name: p.name,
    descripcion: p.descripcion,
    responsable: p.responsable,
    ice: p.ice != null ? Number(p.ice) : null,
    sections: secRes.data.map(s => ({ id: s.id, name: s.name, position: s.position, enabled: s.enabled !== false })),
    activities,
    tasks,
    summary: buildProjectSummary(activities, tasks, today),
  };
}

async function createActivity(input) {
  const sb = getClient();
  const name = String(input.name || '').trim();
  if (!name) throw new Error('El nombre de la actividad es obligatorio');
  if (!input.projectId) throw new Error('projectId es obligatorio');
  const { data: maxRows, error: maxErr } = await sb.from('activities')
    .select('position').eq('project_id', input.projectId)
    .order('position', { ascending: false }).limit(1);
  if (maxErr) fail(maxErr);
  const position = maxRows && maxRows.length ? (maxRows[0].position + 1) : 0;
  const responsables = parseNameList(input.responsables !== undefined ? input.responsables : input.responsable);
  const dependsOnIds = parseIdList(input.dependsOnIds !== undefined ? input.dependsOnIds : input.dependsOn);
  const { data, error } = await sb.from('activities').insert({
    project_id: input.projectId,
    section_id: input.sectionId || null,
    name,
    responsable: responsables.join(', ') || null,
    responsables,
    start_date: input.startDate || null,
    deadline: input.deadline || null,
    status: input.status || 'pendiente',
    pct_complete: input.pctComplete ?? 0,
    depends_on: dependsOnIds[0] || null,
    depends_on_ids: dependsOnIds,
    notes: input.notes || null,
    position,
  }).select('*').single();
  if (error) fail(error);
  return deriveActivity(data, todayBogota());
}

async function updateActivity(id, input) {
  const sb = getClient();
  const fields = {};
  if (input.name !== undefined) fields.name = String(input.name).trim();
  if (input.sectionId !== undefined) fields.section_id = input.sectionId || null;
  if (input.responsables !== undefined || input.responsable !== undefined) {
    const responsables = parseNameList(input.responsables !== undefined ? input.responsables : input.responsable);
    fields.responsables = responsables;
    fields.responsable = responsables.join(', ') || null;
  }
  if (input.startDate !== undefined) fields.start_date = input.startDate || null;
  if (input.deadline !== undefined) fields.deadline = input.deadline || null;
  if (input.status !== undefined) fields.status = input.status;
  if (input.pctComplete !== undefined) fields.pct_complete = Math.max(0, Math.min(100, Number(input.pctComplete) || 0));
  if (input.dependsOnIds !== undefined || input.dependsOn !== undefined) {
    const ids = parseIdList(input.dependsOnIds !== undefined ? input.dependsOnIds : input.dependsOn)
      .filter(x => x !== id);
    await assertSinCiclos(id, ids);
    fields.depends_on_ids = ids;
    fields.depends_on = ids[0] || null;
  }
  if (input.notes !== undefined) fields.notes = input.notes || null;
  if (input.position !== undefined) fields.position = input.position;
  if (fields.status === 'completada' && input.pctComplete === undefined) fields.pct_complete = 100;
  const { data, error } = await sb.from('activities').update(fields).eq('id', id).select('*').single();
  if (error) fail(error);
  return deriveActivity(data, todayBogota());
}

// Evita que A dependa de B si B ya depende (directa o indirectamente) de A
async function assertSinCiclos(activityId, dependsOnIds) {
  if (!dependsOnIds.length) return;
  const sb = getClient();
  const { data: actual, error: actErr } = await sb.from('activities')
    .select('project_id').eq('id', activityId).maybeSingle();
  if (actErr) fail(actErr);
  if (!actual) throw new Error('Actividad no encontrada');
  const { data: todas, error } = await sb.from('activities')
    .select('id, depends_on, depends_on_ids').eq('project_id', actual.project_id);
  if (error) fail(error);
  const grafo = new Map(todas.map(a => [
    a.id,
    (a.depends_on_ids && a.depends_on_ids.length) ? parseIdList(a.depends_on_ids) : parseIdList(a.depends_on),
  ]));
  grafo.set(activityId, dependsOnIds);
  const visitados = new Set();
  const alcanza = (desde) => {
    if (desde === activityId) return true;
    if (visitados.has(desde)) return false;
    visitados.add(desde);
    return (grafo.get(desde) || []).some(alcanza);
  };
  if (dependsOnIds.some(alcanza)) {
    throw new Error('Esa dependencia crearía un ciclo entre actividades');
  }
}

// Reordenar actividades: recibe [{id, position}, ...] y las guarda de una
async function reorderActivities(input) {
  const items = Array.isArray(input) ? input : (input && input.reorder) || [];
  if (!items.length) throw new Error('No hay actividades para reordenar');
  const sb = getClient();
  await Promise.all(items.map(({ id, position }) => {
    if (!id) throw new Error('Cada actividad necesita id');
    return sb.from('activities').update({ position: Number(position) || 0 }).eq('id', id)
      .then(({ error }) => { if (error) fail(error); });
  }));
  return items.length;
}

async function deleteActivity(id) {
  const sb = getClient();
  const { error } = await sb.from('activities').delete().eq('id', id);
  if (error) fail(error);
}

// ------------------------------------------------------------
// FASES (secciones del Gantt): renombrar, activar/desactivar, agregar
// ------------------------------------------------------------
async function createSection(input) {
  const sb = getClient();
  const name = String(input.name || '').trim();
  if (!name) throw new Error('El nombre de la fase es obligatorio');
  if (!input.projectId) throw new Error('projectId es obligatorio');
  const { data: maxRows, error: maxErr } = await sb.from('project_sections')
    .select('position').eq('project_id', input.projectId)
    .order('position', { ascending: false }).limit(1);
  if (maxErr) fail(maxErr);
  const position = maxRows && maxRows.length ? (maxRows[0].position + 1) : 0;
  const { data, error } = await sb.from('project_sections')
    .insert({ project_id: input.projectId, name, position })
    .select('*').single();
  if (error) fail(error);
  return { id: data.id, name: data.name, position: data.position, enabled: data.enabled !== false };
}

async function updateSection(id, input) {
  const sb = getClient();
  const fields = {};
  if (input.name !== undefined) {
    fields.name = String(input.name).trim();
    if (!fields.name) throw new Error('El nombre de la fase no puede quedar vacío');
  }
  if (input.enabled !== undefined) fields.enabled = !!input.enabled;
  if (input.position !== undefined) fields.position = input.position;
  const { data, error } = await sb.from('project_sections').update(fields).eq('id', id).select('*').single();
  if (error) fail(error);
  return { id: data.id, name: data.name, position: data.position, enabled: data.enabled !== false };
}

async function deleteSection(id) {
  const sb = getClient();
  const { error } = await sb.from('project_sections').delete().eq('id', id);
  if (error) fail(error);
}

// ------------------------------------------------------------
// GANTT COMPARTIDO POR ENLACE
// Cada enlace tiene rol 'view' o 'edit'. Solo expone el Gantt y sus
// actividades — nunca las tareas (micromanagement) del proyecto.
// ------------------------------------------------------------
async function listShares(projectId) {
  const sb = getClient();
  const { data, error } = await sb.from('project_shares').select('*').eq('project_id', projectId).order('created_at');
  if (error) fail(error);
  return data.map(s => ({ id: s.id, label: s.label, role: s.role, token: s.token, createdAt: s.created_at }));
}

async function createShare(projectId, input) {
  const sb = getClient();
  if (!projectId) throw new Error('projectId es obligatorio');
  const token = crypto.randomBytes(12).toString('hex');
  const role = input.role === 'edit' ? 'edit' : 'view';
  const { data, error } = await sb.from('project_shares')
    .insert({ project_id: projectId, token, label: (input.label || '').trim() || null, role })
    .select('*').single();
  if (error) fail(error);
  return { id: data.id, label: data.label, role: data.role, token: data.token };
}

async function deleteShare(projectId, shareId) {
  const sb = getClient();
  const { error } = await sb.from('project_shares').delete().eq('id', shareId).eq('project_id', projectId);
  if (error) fail(error);
}

async function getShareByToken(token) {
  if (!token) return null;
  const sb = getClient();
  const { data, error } = await sb.from('project_shares').select('*').eq('token', token).maybeSingle();
  if (error) fail(error);
  return data;
}

async function getSharedGantt(token) {
  const share = await getShareByToken(token);
  if (!share) throw new Error('Enlace no válido o revocado');
  const sb = getClient();
  const today = todayBogota();
  const [projRes, secRes, actRes] = await Promise.all([
    sb.from('projects').select('id,name,descripcion,responsable').eq('id', share.project_id).single(),
    sb.from('project_sections').select('*').eq('project_id', share.project_id).order('position'),
    sb.from('activities').select('*').eq('project_id', share.project_id).order('position').order('created_at'),
  ]);
  if (projRes.error) fail(projRes.error);
  if (secRes.error) fail(secRes.error);
  if (actRes.error) fail(actRes.error);
  const activities = annotateCriticalPath(actRes.data.map(a => deriveActivity(a, today)));
  return {
    role: share.role,
    label: share.label,
    project: { name: projRes.data.name, descripcion: projRes.data.descripcion, responsable: projRes.data.responsable },
    sections: secRes.data.map(s => ({ id: s.id, name: s.name, position: s.position, enabled: s.enabled !== false })),
    activities,
    summary: buildProjectSummary(activities, [], today),
  };
}

async function assertShareEdit(token) {
  const share = await getShareByToken(token);
  if (!share) throw new Error('Enlace no válido o revocado');
  if (share.role !== 'edit') throw new Error('Este enlace es de solo lectura');
  return share;
}

async function shareUpdateActivity(token, activityId, input) {
  const share = await assertShareEdit(token);
  const sb = getClient();
  const { data: act, error } = await sb.from('activities').select('id,project_id').eq('id', activityId).maybeSingle();
  if (error) fail(error);
  if (!act || act.project_id !== share.project_id) throw new Error('Actividad no encontrada en este proyecto');
  const allowed = {};
  ['name', 'responsable', 'responsables', 'startDate', 'deadline', 'status', 'pctComplete', 'notes'].forEach(k => {
    if (input[k] !== undefined) allowed[k] = input[k];
  });
  if (input.sectionId !== undefined) {
    if (input.sectionId) {
      const { data: sec, error: secErr } = await sb.from('project_sections').select('id,project_id').eq('id', input.sectionId).maybeSingle();
      if (secErr) fail(secErr);
      if (!sec || sec.project_id !== share.project_id) throw new Error('Fase no válida');
    }
    allowed.sectionId = input.sectionId || null;
  }
  return updateActivity(activityId, allowed);
}

async function shareCreateActivity(token, input) {
  const share = await assertShareEdit(token);
  if (input.sectionId) {
    const sb = getClient();
    const { data: sec, error } = await sb.from('project_sections').select('id,project_id').eq('id', input.sectionId).maybeSingle();
    if (error) fail(error);
    if (!sec || sec.project_id !== share.project_id) throw new Error('Fase no válida');
  }
  return createActivity({
    projectId: share.project_id,
    sectionId: input.sectionId || null,
    name: input.name,
    responsables: input.responsables !== undefined ? input.responsables : (input.responsable || null),
    startDate: input.startDate || null,
    deadline: input.deadline || null,
  });
}

module.exports = {
  getDashboard,
  fetchAllTasks,
  createTask,
  updateTask,
  deleteTask,
  markDone,
  resolveProject,
  createProject,
  updateProject,
  deleteProject,
  listProjects,
  listProjectNames,
  getProjectDetail,
  createActivity,
  updateActivity,
  deleteActivity,
  reorderActivities,
  createSection,
  updateSection,
  deleteSection,
  listShares,
  createShare,
  deleteShare,
  getSharedGantt,
  shareUpdateActivity,
  shareCreateActivity,
  todayBogota,
};
