// ============================================================
// CAPA DE DATOS · SUPABASE
// Fuente única de datos: tareas (micromanagement) +
// proyectos con secciones y actividades (Gantt, management general)
// ============================================================
const crypto = require('crypto');
const { getClient } = require('./supabase');
const { enrich, buildDashboardPayload } = require('./scoring');
const plantillas = require('./plantillas');
const cal = require('./calendario');

const DAY = 86400000;
const DEFAULT_SECTIONS = ['Estructuración y planeación', 'Ejecución y seguimiento a piloto', 'Implementación al negocio'];
const TASK_SELECT = '*, project:projects(id,name,ice), activity:activities(id,name)';

function fail(error) {
  const msg = error.message || String(error);
  // Aviso claro si la base todavía no tiene las columnas nuevas
  const faltaColumna = /column .* does not exist|could not find the .* column/i.test(msg);
  if (faltaColumna && /fecha_meta/i.test(msg)) {
    throw new Error(`${msg} · Falta correr en Supabase → SQL Editor el archivo supabase/TODAS-octubre-2026.sql`);
  }
  if (/activity_notes/i.test(msg)) {
    throw new Error(`${msg} · Falta correr en Supabase → SQL Editor el archivo supabase/TODAS-octubre-2026.sql`);
  }
  if (/project_members/i.test(msg)) {
    throw new Error(`${msg} · Falta correr en Supabase → SQL Editor el archivo supabase/TODAS-octubre-2026.sql`);
  }
  if ((faltaColumna || /propuestas_cambio/i.test(msg)) && /baseline|linea_base|propuestas_cambio/i.test(msg)) {
    throw new Error(`${msg} · Falta correr en Supabase → SQL Editor el archivo supabase/TODAS-octubre-2026.sql`);
  }
  if (faltaColumna && /real_start|real_end|propuesta/i.test(msg)) {
    throw new Error(`${msg} · Falta correr en Supabase → SQL Editor el archivo supabase/TODAS-octubre-2026.sql`);
  }
  if (/historial_cambios|parent_id/i.test(msg) || /project_shares_role_check/i.test(msg)) {
    throw new Error(`${msg} · Falta correr en Supabase → SQL Editor el archivo supabase/migracion-2026-10-edicion.sql`);
  }
  if (faltaColumna && /duracion/i.test(msg)) {
    throw new Error(`${msg} · Falta correr en Supabase → SQL Editor el archivo supabase/migracion-2026-10-duracion.sql`);
  }
  if (faltaColumna && /activities\.area|'area' column|column "?area"? /i.test(msg)) {
    throw new Error(`${msg} · Falta correr en Supabase → SQL Editor el archivo supabase/migracion-2026-10-area.sql`);
  }
  if (faltaColumna && /entregable/i.test(msg)) {
    throw new Error(`${msg} · Falta correr en Supabase → SQL Editor el archivo supabase/TODAS-octubre-2026.sql`);
  }
  if (faltaColumna) {
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

// El estado sale del avance: 0% pendiente · 1-99% en curso · 100% completada
function statusFromPct(pct) {
  if (pct >= 100) return 'completada';
  if (pct > 0) return 'en_curso';
  return 'pendiente';
}

function depsOf(row) {
  return (row.depends_on_ids && row.depends_on_ids.length)
    ? parseIdList(row.depends_on_ids)
    : parseIdList(row.depends_on);
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
    ...(/^\d{4}-\d{2}-\d{2}$/.test(input.fechaMeta || '') ? { fecha_meta: input.fechaMeta } : {}),
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
  if (input.fechaMeta !== undefined) fields.fecha_meta = /^\d{4}-\d{2}-\d{2}$/.test(input.fechaMeta || '') ? input.fechaMeta : null;
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
    entregable: a.entregable || null,
    // Área responsable elegida a mano (si no, la app la saca de los involucrados)
    area: a.area || null,
    // Duración en días hábiles: la guardada, o la que dan las fechas
    duracion: a.duracion || (a.start_date && a.deadline ? cal.diasHabiles(a.start_date, a.deadline) : null),
    realStart: a.real_start || null,
    realEnd: a.real_end || null,
    baselineStart: a.baseline_start || null,
    baselineEnd: a.baseline_end || null,
    propuesta: !!a.propuesta,
    propuestaPor: a.propuesta_por || null,
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
  const [projRes, actRes, taskRes, propRes] = await Promise.all([
    sb.from('projects').select('*').eq('archivado', false).order('created_at'),
    sb.from('activities').select('*'),
    sb.from('tasks').select('id, project_id, status'),
    sb.from('propuestas_cambio').select('project_id').eq('estado', 'pendiente'),
  ]);
  if (projRes.error) fail(projRes.error);
  if (actRes.error) fail(actRes.error);
  if (taskRes.error) fail(taskRes.error);
  // Sin la migración de línea base la tabla no existe: se cuenta 0
  const ajustes = propRes.error ? [] : propRes.data;

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
      fechaMeta: p.fecha_meta || null,
      // Propuestas del enlace compartido esperando al dueño (ajustes + actividades nuevas)
      propuestasPendientes: ajustes.filter(x => x.project_id === p.id).length + acts.filter(a => a.propuesta).length,
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
  const [propuestas, miembros, notas] = await Promise.all([listPropuestas(id), listMiembros(id), listNotas(id)]);

  return {
    id: p.id,
    name: p.name,
    descripcion: p.descripcion,
    responsable: p.responsable,
    ice: p.ice != null ? Number(p.ice) : null,
    lineaBaseAt: p.linea_base_at || null,
    fechaMeta: p.fecha_meta || null,
    sections: secRes.data.map(formatSeccion),
    activities,
    tasks,
    propuestas,
    miembros,
    notas,
    summary: buildProjectSummary(activities, tasks, today),
  };
}

async function createActivity(input, autor) {
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
  // Con duración (días hábiles) e inicio, el fin se calcula solo. Sin inicio queda
  // solo la duración: se programa sola al terminar sus precedentes.
  let startDate = input.startDate || null, deadline = input.deadline || null;
  const duracion = Math.round(Number(input.duracion) || 0);
  if (duracion > 0 && !deadline && startDate) {
    startDate = cal.habilDesde(startDate);
    deadline = cal.finHabil(startDate, duracion);
  }
  const row = {
    project_id: input.projectId,
    section_id: input.sectionId || null,
    name,
    responsable: responsables.join(', ') || null,
    responsables,
    start_date: startDate,
    deadline,
    status: input.status || statusFromPct(Number(input.pctComplete) || 0),
    pct_complete: input.pctComplete ?? 0,
    depends_on: dependsOnIds[0] || null,
    depends_on_ids: dependsOnIds,
    notes: input.notes || null,
    position,
  };
  // Las columnas nuevas solo se mandan si vienen: la app no se cae si falta una migración
  if (input.entregable) row.entregable = String(input.entregable).trim();
  if (input.propuesta) {
    row.propuesta = true;
    if (input.propuestaPor) row.propuesta_por = String(input.propuestaPor).trim().slice(0, 80);
  }
  if (duracion > 0) row.duracion = duracion;
  else if (startDate && deadline) row.duracion = cal.diasHabiles(startDate, deadline);
  let { data, error } = await sb.from('activities').insert(row).select('*').single();
  if (error && /duracion/i.test(error.message || '')) {
    // La base aún no tiene la columna «duracion»: como antes (arranca el próximo día hábil)
    delete row.duracion;
    if (duracion > 0 && !row.deadline) {
      row.start_date = cal.habilDesde(row.start_date || cal.sumarDias(todayBogota(), 1));
      row.deadline = cal.finHabil(row.start_date, duracion);
    }
    ({ data, error } = await sb.from('activities').insert(row).select('*').single());
  }
  if (error) fail(error);
  if (dependsOnIds.length) await shiftSuccessors(input.projectId);
  if (!input.propuesta) await registrarCambio(input.projectId, { activityId: data.id, autor, accion: 'creó', objeto: data.name,
    detalle: [await nombreSeccion(data.section_id) && `en «${await nombreSeccion(data.section_id)}»`, data.start_date && `${fCortaSrv(data.start_date)} → ${fCortaSrv(data.deadline)}`, data.duracion && `${data.duracion} días`].filter(Boolean).join(' · ') });
  return deriveActivity(data, todayBogota());
}

// Fin efectivo: si ya terminó de verdad, manda la fecha real
const finEfectivo = a => a.real_end || a.deadline || null;

async function updateActivity(id, input, autor) {
  const sb = getClient();
  const { data: antes, error: antesErr } = await sb.from('activities').select('*').eq('id', id).maybeSingle();
  if (antesErr) fail(antesErr);
  if (!antes) throw new Error('Actividad no encontrada');
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
  if (input.realStart !== undefined) fields.real_start = input.realStart || null;
  if (input.realEnd !== undefined) fields.real_end = input.realEnd || null;
  if (input.status !== undefined) fields.status = input.status;
  if (input.pctComplete !== undefined) {
    const pct = Math.max(0, Math.min(100, Number(input.pctComplete) || 0));
    fields.pct_complete = pct;
    // No hay que elegir estado a mano: sale del avance
    if (input.status === undefined) fields.status = statusFromPct(pct);
  }
  // Las fechas reales solo las pone el usuario: nunca se inventan. Lo único
  // automático es que poner el fin real deja el avance en 100%.
  if (fields.real_end && input.pctComplete === undefined) {
    fields.pct_complete = 100;
    fields.status = 'completada';
  }
  if (input.dependsOnIds !== undefined || input.dependsOn !== undefined) {
    const ids = parseIdList(input.dependsOnIds !== undefined ? input.dependsOnIds : input.dependsOn)
      .filter(x => x !== id);
    await assertSinCiclos(id, ids);
    fields.depends_on_ids = ids;
    fields.depends_on = ids[0] || null;
  }
  if (input.notes !== undefined) fields.notes = input.notes || null;
  if (input.entregable !== undefined) fields.entregable = String(input.entregable || '').trim() || null;
  if (input.area !== undefined) fields.area = parseNameList(input.area).join(', ') || null;
  if (input.propuesta !== undefined) fields.propuesta = !!input.propuesta;
  if (input.position !== undefined) fields.position = input.position;
  if (fields.status === 'completada' && input.pctComplete === undefined) fields.pct_complete = 100;
  reglaDuracion(antes, input, fields);
  const { data, error } = await sb.from('activities').update(fields).eq('id', id).select('*').single();
  if (error) fail(error);
  // Si se movió el fin (plan o real), lo que depende de ella se corre lo mismo,
  // hacia adelante o hacia atrás. Luego se asegura que nada arranque antes de
  // que termine lo que lo condiciona.
  const tocoFechas = ['start_date', 'deadline', 'real_start', 'real_end', 'depends_on_ids', 'duracion'].some(k => fields[k] !== undefined);
  let corridas = 0;
  if (tocoFechas) {
    const delta = cal.difHabiles(finEfectivo(antes), finEfectivo(data));
    if (delta && finEfectivo(antes) && finEfectivo(data)) corridas += await cascadaSucesoras(data.project_id, id, delta);
    corridas += await shiftSuccessors(data.project_id);
  }
  if (!input._sinHistorial) {
    const detalle = await describirCambios(antes, data);
    if (detalle) await registrarCambio(data.project_id, { activityId: id, autor, accion: 'editó', objeto: data.name,
      detalle: detalle + (corridas ? ` · se corrieron ${corridas} fecha${corridas === 1 ? '' : 's'} por dependencias` : '') });
  }
  return deriveActivity(data, todayBogota());
}

// ------------------------------------------------------------
// DURACIÓN (días hábiles), como en un cronograma de proyecto:
//  · Se puede poner la duración sin fechas: queda guardada y, si tiene
//    precedentes con fecha, se programa sola al terminar ellos.
//  · Con duración, poner (o mover) el inicio deja el fin como consecuencia.
//  · Cambiar la duración con inicio recalcula el fin.
//  · Poner el fin a mano (con inicio) actualiza la duración.
// Si la base aún no tiene la columna «duracion», solo se calculan fechas.
// ------------------------------------------------------------
const tieneDuracion = row => row && Object.prototype.hasOwnProperty.call(row, 'duracion');
function duracionDe(row) {
  if (row.duracion) return row.duracion;
  return row.start_date && row.deadline ? cal.diasHabiles(row.start_date, row.deadline) : null;
}
function reglaDuracion(antes, input, fields) {
  const guarda = tieneDuracion(antes);
  let nueva;
  if (input.duracion !== undefined) {
    const n = Math.round(Number(input.duracion));
    nueva = n >= 1 && n <= 999 ? n : null;
    if (guarda) fields.duracion = nueva;
  }
  const dur = nueva !== undefined ? nueva : duracionDe(antes);
  let ini = fields.start_date !== undefined ? fields.start_date : antes.start_date;
  const ponenFin = input.deadline !== undefined;
  if (dur && !ponenFin && (fields.start_date !== undefined || nueva !== undefined)) {
    if (!ini && !guarda && nueva) ini = cal.habilDesde(cal.sumarDias(todayBogota(), 1)); // sin la columna: como antes
    if (ini) {
      ini = cal.habilDesde(ini);
      fields.start_date = ini;
      fields.deadline = cal.finHabil(ini, dur);
    }
  }
  if (ponenFin && fields.deadline && ini && nueva === undefined && guarda) {
    fields.duracion = cal.diasHabiles(ini, fields.deadline);
  }
  if (fields.start_date === null && fields.deadline === undefined && nueva === undefined && dur && guarda) {
    fields.deadline = null; // borrar el inicio con duración: queda solo la duración
    fields.duracion = dur;
  }
}

// ------------------------------------------------------------
// LAS FECHAS SE MUEVEN EN CASCADA
// Si una actividad termina N días hábiles después (o antes) de lo que
// estaba, todo lo que depende de ella —directa o indirectamente— se
// corre esos mismos N días hábiles, conservando su duración. Lo que
// ya terminó (100% o con fin real) no se toca.
// ------------------------------------------------------------
async function cascadaSucesoras(projectId, desdeId, delta) {
  const sb = getClient();
  const { data, error } = await sb.from('activities').select('*').eq('project_id', projectId);
  if (error) fail(error);
  const sucesoras = new Map(data.map(a => [a.id, []]));
  data.forEach(a => depsOf(a).forEach(pid => { if (sucesoras.has(pid) && pid !== a.id) sucesoras.get(pid).push(a); }));
  const vistas = new Set([desdeId]);
  const cola = [...(sucesoras.get(desdeId) || [])];
  const cambios = [];
  while (cola.length) {
    const a = cola.shift();
    if (vistas.has(a.id)) continue;
    vistas.add(a.id);
    if (a.real_end || (a.pct_complete || 0) >= 100) continue;
    if (a.start_date || a.deadline) {
      const r = cal.moverRango(a.start_date, a.deadline, delta);
      cambios.push({ id: a.id, start_date: r.inicio, deadline: r.fin });
    }
    (sucesoras.get(a.id) || []).forEach(s => cola.push(s));
  }
  await Promise.all(cambios.map(c => sb.from('activities')
    .update({ start_date: c.start_date, deadline: c.deadline }).eq('id', c.id)
    .then(({ error: e }) => { if (e) fail(e); })));
  return cambios.length;
}

// ------------------------------------------------------------
// NADA ARRANCA ANTES DE QUE TERMINE LO QUE LO CONDICIONA
// Si A precede a B, B empieza como pronto el día hábil siguiente al fin
// de A (el real, si ya lo tiene). Cuando hace falta se empuja B (y su
// cadena) conservando su duración en días hábiles.
// ------------------------------------------------------------
async function shiftSuccessors(projectId) {
  const sb = getClient();
  const { data, error } = await sb.from('activities').select('*').eq('project_id', projectId);
  if (error) fail(error);
  const byId = new Map(data.map(a => [a.id, a]));
  const preds = new Map(data.map(a => [a.id, depsOf(a).filter(x => byId.has(x) && x !== a.id)]));
  const cambios = [];
  const estado = {};

  function resolver(a) {
    if (estado[a.id]) return;          // 'listo' o 'visitando' (ciclo: no se toca)
    estado[a.id] = 'visitando';
    let minimo = null;
    preds.get(a.id).forEach(pid => {
      const p = byId.get(pid);
      resolver(p);
      const fin = finEfectivo(p);
      if (fin) {
        const siguiente = cal.habilDesde(cal.sumarDias(fin, 1));
        if (!minimo || siguiente > minimo) minimo = siguiente;
      }
    });
    const inicio = a.start_date || a.deadline;
    const yaTermino = a.real_end || (a.pct_complete || 0) >= 100;
    // Solo duración (sin fechas): arranca al terminar lo que la condiciona
    if (minimo && !inicio && a.duracion > 0 && !yaTermino) {
      a.start_date = minimo;
      a.deadline = cal.finHabil(minimo, a.duracion);
      cambios.push({ id: a.id, start_date: a.start_date, deadline: a.deadline });
    } else if (minimo && inicio && inicio < minimo && !yaTermino) {
      const r = cal.moverRango(a.start_date, a.deadline, cal.difHabiles(cal.habilDesde(inicio), minimo));
      a.start_date = r.inicio;
      a.deadline = r.fin;
      cambios.push({ id: a.id, start_date: r.inicio, deadline: r.fin });
    }
    estado[a.id] = 'listo';
  }
  data.forEach(resolver);

  if (cambios.length) {
    await Promise.all(cambios.map(c => sb.from('activities')
      .update({ start_date: c.start_date, deadline: c.deadline }).eq('id', c.id)
      .then(({ error: e }) => { if (e) fail(e); })));
  }
  return cambios.length;
}

// Actividades de un proyecto ya derivadas y con la ruta crítica marcada
async function listProjectActivities(projectId) {
  const sb = getClient();
  const today = todayBogota();
  const { data, error } = await sb.from('activities').select('*')
    .eq('project_id', projectId).order('position').order('created_at');
  if (error) fail(error);
  return annotateCriticalPath(data.map(a => deriveActivity(a, today)));
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

// Reordenar actividades: recibe [{ id, position, sectionId? }, ...] y las guarda
// de una. `sectionId` solo viene cuando la fila se arrastró a otra fase.
async function reorderActivities(input, autor) {
  const items = Array.isArray(input) ? input : (input && input.reorder) || [];
  if (!items.length) throw new Error('No hay actividades para reordenar');
  const sb = getClient();
  // Para el historial: qué actividades cambiaron de capítulo
  const movidas = items.filter(x => x.sectionId !== undefined).map(x => x.id);
  let antes = [];
  if (movidas.length) {
    const r = await sb.from('activities').select('id,name,section_id,project_id').in('id', movidas);
    antes = r.data || [];
  }
  await Promise.all(items.map(({ id, position, sectionId }) => {
    if (!id) throw new Error('Cada actividad necesita id');
    const fields = { position: Number(position) || 0 };
    if (sectionId !== undefined) fields.section_id = sectionId || null;
    return sb.from('activities').update(fields).eq('id', id)
      .then(({ error }) => { if (error) fail(error); });
  }));
  const projectId = (input && input.projectId) || (antes[0] && antes[0].project_id);
  if (projectId) {
    const cambiaron = antes.filter(a => { const it = items.find(x => x.id === a.id); return (it.sectionId || null) !== (a.section_id || null); });
    for (const a of cambiaron) {
      const it = items.find(x => x.id === a.id);
      await registrarCambio(projectId, { activityId: a.id, autor, accion: 'movió', objeto: a.name,
        detalle: `de «${(await nombreSeccion(a.section_id)) || 'sin capítulo'}» a «${(await nombreSeccion(it.sectionId)) || 'sin capítulo'}»` });
    }
    if (!cambiaron.length && input && input.registrar !== false) await registrarCambio(projectId, { autor, accion: 'reordenó', objeto: 'actividades', detalle: 'cambió el orden de las filas' });
  }
  return items.length;
}

// Mover varias actividades a la vez (p. ej. «mover etapa 3 +5 días»). Se
// guardan tal cual, sin cascada por cada una (se correrían doble), y al
// final se asegura que nada arranque antes de lo que lo condiciona.
async function moverFechasLote(projectId, items, autor) {
  if (!projectId) throw new Error('projectId es obligatorio');
  const lista = Array.isArray(items) ? items : [];
  if (!lista.length) throw new Error('No hay fechas para mover');
  const sb = getClient();
  await Promise.all(lista.map(async ({ id, startDate, deadline, duracion }) => {
    if (!id) throw new Error('Cada actividad necesita id');
    const f = { start_date: startDate || null, deadline: deadline || null };
    if (duracion !== undefined) f.duracion = Number(duracion) > 0 ? Math.round(Number(duracion)) : null;
    let { error } = await sb.from('activities').update(f).eq('id', id).eq('project_id', projectId);
    if (error && /duracion/i.test(error.message || '')) { delete f.duracion; ({ error } = await sb.from('activities').update(f).eq('id', id).eq('project_id', projectId)); }
    if (error) fail(error);
  }));
  await shiftSuccessors(projectId);
  await registrarCambio(projectId, { autor, accion: 'movió fechas', objeto: `${lista.length} actividad${lista.length === 1 ? '' : 'es'}`, detalle: 'cambio de fechas en lote' });
  return lista.length;
}

async function deleteActivity(id, autor) {
  const sb = getClient();
  const { data: a } = await sb.from('activities').select('id,name,project_id,section_id').eq('id', id).maybeSingle();
  const { error } = await sb.from('activities').delete().eq('id', id);
  if (error) fail(error);
  if (a) await registrarCambio(a.project_id, { activityId: id, autor, accion: 'eliminó', objeto: a.name, detalle: (await nombreSeccion(a.section_id)) ? `de «${await nombreSeccion(a.section_id)}»` : '' });
}

// ------------------------------------------------------------
// FASES (secciones del Gantt): renombrar, activar/desactivar, agregar
// ------------------------------------------------------------
const formatSeccion = s => ({ id: s.id, name: s.name, position: s.position, enabled: s.enabled !== false, parentId: s.parent_id || null });

async function createSection(input, autor) {
  const sb = getClient();
  const name = String(input.name || '').trim();
  if (!name) throw new Error('El nombre de la fase es obligatorio');
  if (!input.projectId) throw new Error('projectId es obligatorio');
  const { data: maxRows, error: maxErr } = await sb.from('project_sections')
    .select('position').eq('project_id', input.projectId)
    .order('position', { ascending: false }).limit(1);
  if (maxErr) fail(maxErr);
  const position = maxRows && maxRows.length ? (maxRows[0].position + 1) : 0;
  const fila = { project_id: input.projectId, name, position };
  if (input.parentId) fila.parent_id = input.parentId;
  const { data, error } = await sb.from('project_sections').insert(fila).select('*').single();
  if (error) fail(error);
  await registrarCambio(input.projectId, { autor, accion: 'creó capítulo', objeto: name });
  return formatSeccion(data);
}

async function updateSection(id, input, autor) {
  const sb = getClient();
  const { data: antes } = await sb.from('project_sections').select('*').eq('id', id).maybeSingle();
  const fields = {};
  if (input.name !== undefined) {
    fields.name = String(input.name).trim();
    if (!fields.name) throw new Error('El nombre de la fase no puede quedar vacío');
  }
  if (input.enabled !== undefined) fields.enabled = !!input.enabled;
  if (input.position !== undefined) fields.position = input.position;
  if (input.parentId !== undefined) fields.parent_id = input.parentId || null;
  const { data, error } = await sb.from('project_sections').update(fields).eq('id', id).select('*').single();
  if (error) fail(error);
  if (antes && !input._sinHistorial) {
    const det = [];
    if (fields.name !== undefined && fields.name !== antes.name) det.push(`nombre: «${antes.name}» → «${fields.name}»`);
    if (fields.enabled !== undefined && fields.enabled !== (antes.enabled !== false)) det.push(fields.enabled ? 'vuelve a aplicar' : 'no aplica');
    if (det.length) await registrarCambio(data.project_id, { autor, accion: 'editó capítulo', objeto: data.name, detalle: det.join(' · ') });
  }
  return formatSeccion(data);
}

// Elimina el capítulo; con `conActividades` borra también sus actividades y sus subcapítulos
async function deleteSection(id, opciones, autor) {
  const sb = getClient();
  const { data: sec } = await sb.from('project_sections').select('*').eq('id', id).maybeSingle();
  if (!sec) return;
  const { data: hijos } = await sb.from('project_sections').select('id').eq('parent_id', id);
  const ids = [id, ...((hijos || []).map(h => h.id))];
  let n = 0;
  if (opciones && opciones.conActividades) {
    const { data: acts } = await sb.from('activities').select('id').in('section_id', ids);
    n = (acts || []).length;
    if (n) { const { error } = await sb.from('activities').delete().in('section_id', ids); if (error) fail(error); }
  }
  // Los subcapítulos se van con él
  if (ids.length > 1) { const { error } = await sb.from('project_sections').delete().in('id', ids.slice(1)); if (error) fail(error); }
  const { error } = await sb.from('project_sections').delete().eq('id', id);
  if (error) fail(error);
  await registrarCambio(sec.project_id, { autor, accion: 'eliminó capítulo', objeto: sec.name,
    detalle: [n && `con ${n} actividad${n === 1 ? '' : 'es'}`, ids.length > 1 && `y ${ids.length - 1} subcapítulo${ids.length > 2 ? 's' : ''}`].filter(Boolean).join(' ') });
}

// Un capítulo arrastrado sobre otro queda como SUBCAPÍTULO. Si el destino ya tenía
// actividades sueltas, se agrupan en un subcapítulo nuevo (para ponerle nombre)
// y nada de lo que ya estaba se altera.
async function anidarSeccion(id, padreId, autor) {
  const sb = getClient();
  if (!id || !padreId || id === padreId) throw new Error('Elige otro capítulo');
  const [{ data: src }, { data: dst }] = await Promise.all([
    sb.from('project_sections').select('*').eq('id', id).maybeSingle(),
    sb.from('project_sections').select('*').eq('id', padreId).maybeSingle(),
  ]);
  if (!src || !dst || src.project_id !== dst.project_id) throw new Error('Capítulo no encontrado');
  if (dst.parent_id) throw new Error('Solo se puede meter dentro de un capítulo principal');
  const { data: hijosSrc } = await sb.from('project_sections').select('id').eq('parent_id', id);
  if ((hijosSrc || []).length) throw new Error('Ese capítulo ya tiene subcapítulos: no se puede meter dentro de otro');
  const { data: hijosDst } = await sb.from('project_sections').select('*').eq('parent_id', padreId).order('position');
  const { data: sueltas } = await sb.from('activities').select('id').eq('section_id', padreId);
  let grupo = null;
  if ((sueltas || []).length) {
    const r = await sb.from('project_sections').insert({ project_id: dst.project_id, name: 'Subcapítulo sin nombre', position: 0, parent_id: padreId }).select('*').single();
    if (r.error) fail(r.error);
    grupo = r.data;
    const { error } = await sb.from('activities').update({ section_id: grupo.id }).eq('section_id', padreId);
    if (error) fail(error);
  }
  const orden = [...(grupo ? [grupo] : []), ...(hijosDst || []).filter(h => h.id !== id), src];
  await Promise.all(orden.map((h, i) => sb.from('project_sections').update({ position: i, ...(h.id === id ? { parent_id: padreId } : {}) }).eq('id', h.id)
    .then(({ error }) => { if (error) fail(error); })));
  await registrarCambio(dst.project_id, { autor, accion: 'movió capítulo', objeto: src.name, detalle: `ahora es subcapítulo de «${dst.name}»${grupo ? ' (las actividades que ya tenía quedaron en un subcapítulo nuevo)' : ''}` });
  return { nuevoGrupo: grupo ? formatSeccion(grupo) : null };
}

// Saca un subcapítulo y lo deja como capítulo principal, justo después de su capítulo
async function sacarSeccion(id, autor) {
  const sb = getClient();
  const { data: src } = await sb.from('project_sections').select('*').eq('id', id).maybeSingle();
  if (!src || !src.parent_id) return;
  const { data: todas } = await sb.from('project_sections').select('*').eq('project_id', src.project_id).order('position');
  const padre = todas.find(x => x.id === src.parent_id);
  const tops = todas.filter(x => !x.parent_id && x.id !== id);
  const i = tops.findIndex(x => x.id === src.parent_id);
  tops.splice(i + 1, 0, src);
  await Promise.all(tops.map((h, k) => sb.from('project_sections').update({ position: k, ...(h.id === id ? { parent_id: null } : {}) }).eq('id', h.id)
    .then(({ error }) => { if (error) fail(error); })));
  await registrarCambio(src.project_id, { autor, accion: 'movió capítulo', objeto: src.name, detalle: `salió de «${padre ? padre.name : ''}» y quedó como capítulo` });
}

// ------------------------------------------------------------
// HISTORIAL DE CAMBIOS: quién cambió qué y cuándo
// (si falta la tabla, la edición sigue funcionando; solo no queda registro)
// ------------------------------------------------------------
const MESES_C = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const fCortaSrv = iso => iso ? `${Number(String(iso).slice(8, 10))} ${MESES_C[Number(String(iso).slice(5, 7)) - 1]}` : '—';
async function nombreSeccion(id) {
  if (!id) return null;
  const { data } = await getClient().from('project_sections').select('name').eq('id', id).maybeSingle();
  return data ? data.name : null;
}
async function registrarCambio(projectId, c) {
  try {
    if (!projectId) return;
    const { error } = await getClient().from('historial_cambios').insert({
      project_id: projectId, activity_id: c.activityId || null, autor: c.autor || null,
      accion: c.accion, objeto: c.objeto ? String(c.objeto).slice(0, 300) : null, detalle: c.detalle ? String(c.detalle).slice(0, 1000) : null,
    });
    if (error) console.warn('historial:', error.message);
  } catch (e) { console.warn('historial:', e.message); }
}
async function describirCambios(antes, despues) {
  const det = [];
  const lista = v => (Array.isArray(v) ? v : String(v || '').split(',')).map(x => String(x).trim()).filter(Boolean).join(', ') || '—';
  const igual = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  if (!igual(antes.name, despues.name)) det.push(`nombre: «${antes.name}» → «${despues.name}»`);
  if (!igual(antes.start_date, despues.start_date)) det.push(`inicio: ${fCortaSrv(antes.start_date)} → ${fCortaSrv(despues.start_date)}`);
  if (!igual(antes.deadline, despues.deadline)) det.push(`fin: ${fCortaSrv(antes.deadline)} → ${fCortaSrv(despues.deadline)}`);
  if ('duracion' in despues && !igual(antes.duracion, despues.duracion) && (antes.duracion || despues.duracion)) det.push(`duración: ${antes.duracion || '—'} → ${despues.duracion || '—'} días`);
  if (!igual(antes.real_start, despues.real_start)) det.push(`inicio real: ${fCortaSrv(antes.real_start)} → ${fCortaSrv(despues.real_start)}`);
  if (!igual(antes.real_end, despues.real_end)) det.push(`fin real: ${fCortaSrv(antes.real_end)} → ${fCortaSrv(despues.real_end)}`);
  if (!igual(antes.pct_complete, despues.pct_complete)) det.push(`avance: ${antes.pct_complete || 0}% → ${despues.pct_complete || 0}%`);
  if (!igual(lista(antes.responsables), lista(despues.responsables))) det.push(`responsables: ${lista(antes.responsables)} → ${lista(despues.responsables)}`);
  if ('area' in despues && !igual(antes.area, despues.area)) det.push(`área: ${antes.area || 'automática'} → ${despues.area || 'automática'}`);
  if (!igual(antes.entregable, despues.entregable)) det.push(`entregable: ${antes.entregable || '—'} → ${despues.entregable || '—'}`);
  if (!igual(antes.notes, despues.notes)) det.push('nota general actualizada');
  if (!igual(antes.section_id, despues.section_id)) det.push(`capítulo: «${(await nombreSeccion(antes.section_id)) || '—'}» → «${(await nombreSeccion(despues.section_id)) || '—'}»`);
  const da = depsOf(antes), dd = depsOf(despues);
  if (!igual([...da].sort(), [...dd].sort())) {
    const ids = [...new Set([...da, ...dd])];
    const { data } = ids.length ? await getClient().from('activities').select('id,name').in('id', ids) : { data: [] };
    const nm = x => x.map(i => { const r = (data || []).find(y => y.id === i); return r ? `«${r.name}»` : null; }).filter(Boolean).join(', ') || 'nada';
    det.push(`depende de: ${nm(da)} → ${nm(dd)}`);
  }
  return det.join(' · ');
}
async function listHistorial(projectId, limite) {
  const sb = getClient();
  const { data, error } = await sb.from('historial_cambios').select('*').eq('project_id', projectId)
    .order('created_at', { ascending: false }).limit(Math.min(Number(limite) || 300, 1000));
  if (error) {
    if (/historial_cambios/i.test(error.message || '') && /does not exist|schema cache|not find/i.test(error.message || '')) return { cambios: [], falta: true };
    fail(error);
  }
  return { cambios: data.map(c => ({ id: c.id, activityId: c.activity_id, autor: c.autor, accion: c.accion, objeto: c.objeto, detalle: c.detalle, createdAt: c.created_at })) };
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
  const role = input.role === 'editor' ? 'editor' : input.role === 'edit' ? 'edit' : 'view';
  const label = (input.label || '').trim() || null;
  if (role === 'editor' && !label) throw new Error('Escribe el nombre y apellido de la persona que va a editar');
  const { data, error } = await sb.from('project_shares')
    .insert({ project_id: projectId, token, label, role })
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
    sb.from('projects').select('*').eq('id', share.project_id).single(),
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
    project: { name: projRes.data.name, descripcion: projRes.data.descripcion, responsable: projRes.data.responsable, lineaBaseAt: projRes.data.linea_base_at || null, fechaMeta: projRes.data.fecha_meta || null },
    sections: secRes.data.map(formatSeccion),
    activities,
    miembros: await listMiembros(share.project_id),
    summary: buildProjectSummary(activities, [], today),
  };
}

async function assertShareEdit(token) {
  const share = await getShareByToken(token);
  if (!share) throw new Error('Enlace no válido o revocado');
  if (share.role !== 'edit') throw new Error('Este enlace es de solo lectura');
  return share;
}

// Desde el enlace no se tocan las actividades ya asentadas: se proponen ajustes
async function shareUpdateActivity() {
  throw new Error('Desde el enlace compartido no se editan actividades: usa «Proponer un ajuste»');
}

async function assertFaseDelProyecto(sectionId, projectId) {
  const sb = getClient();
  const { data: sec, error } = await sb.from('project_sections').select('id,project_id').eq('id', sectionId).maybeSingle();
  if (error) fail(error);
  if (!sec || sec.project_id !== projectId) throw new Error('Área no válida');
}

// ------------------------------------------------------------
// ENLACE DE EDITOR (con nombre): edita el cronograma de verdad —crear, mover,
// eliminar, fechas, duraciones, capítulos— y cada cambio queda en el
// historial a su nombre. Nunca ve ni toca las tareas del día a día.
// ------------------------------------------------------------
async function assertEditor(token) {
  const share = await getShareByToken(token);
  if (!share) throw new Error('Enlace no válido o revocado');
  if (share.role !== 'editor') throw new Error('Este enlace es de solo lectura: propone los cambios');
  return share;
}
async function assertActDelProyecto(activityId, projectId) {
  const { data, error } = await getClient().from('activities').select('id,project_id').eq('id', activityId).maybeSingle();
  if (error) fail(error);
  if (!data || data.project_id !== projectId) throw new Error('Actividad no encontrada');
}
const CAMPOS_EDITOR = ['name', 'sectionId', 'responsables', 'startDate', 'deadline', 'duracion', 'realStart', 'realEnd', 'pctComplete', 'dependsOnIds', 'entregable', 'notes', 'area'];
async function shareEditar(token, body) {
  const share = await assertEditor(token);
  const autor = share.label || 'Editor';
  const pid = share.project_id;
  const b = body || {};
  switch (b.op) {
    case 'patch': {
      await assertActDelProyecto(b.activityId, pid);
      const cambios = {};
      CAMPOS_EDITOR.forEach(k => { if (b.cambios && b.cambios[k] !== undefined) cambios[k] = b.cambios[k]; });
      if (cambios.sectionId) await assertFaseDelProyecto(cambios.sectionId, pid);
      await updateActivity(b.activityId, cambios, autor);
      break;
    }
    case 'crear': {
      const d = b.datos || {};
      if (d.sectionId) await assertFaseDelProyecto(d.sectionId, pid);
      const datos = { projectId: pid };
      ['name', 'sectionId', 'responsables', 'startDate', 'deadline', 'duracion', 'entregable', 'dependsOnIds'].forEach(k => { if (d[k] !== undefined) datos[k] = d[k]; });
      const act = await createActivity(datos, autor);
      return Object.assign(await getSharedGantt(token), { creada: act.id });
    }
    case 'eliminar':
      await assertActDelProyecto(b.activityId, pid);
      await deleteActivity(b.activityId, autor);
      break;
    case 'orden': {
      const items = Array.isArray(b.reorder) ? b.reorder : [];
      for (const it of items) await assertActDelProyecto(it.id, pid);
      for (const it of items) if (it.sectionId) await assertFaseDelProyecto(it.sectionId, pid);
      await reorderActivities({ projectId: pid, reorder: items }, autor);
      break;
    }
    case 'seccion-crear':
      if (b.parentId) await assertFaseDelProyecto(b.parentId, pid);
      await createSection({ projectId: pid, name: b.name, parentId: b.parentId || null }, autor);
      break;
    case 'seccion-editar':
      await assertFaseDelProyecto(b.id, pid);
      await updateSection(b.id, { name: b.name, enabled: b.enabled }, autor);
      break;
    case 'seccion-eliminar':
      await assertFaseDelProyecto(b.id, pid);
      await deleteSection(b.id, { conActividades: true }, autor);
      break;
    case 'seccion-anidar': {
      await assertFaseDelProyecto(b.id, pid); await assertFaseDelProyecto(b.padreId, pid);
      const r = await anidarSeccion(b.id, b.padreId, autor);
      return Object.assign(await getSharedGantt(token), r);
    }
    case 'seccion-sacar':
      await assertFaseDelProyecto(b.id, pid);
      await sacarSeccion(b.id, autor);
      break;
    default: throw new Error('Operación no válida');
  }
  return getSharedGantt(token);
}

// Cualquiera con el enlace puede proponer una actividad: aparece marcada como
// «propuesta» y el dueño la acepta o descarta.
async function shareCreateActivity(token, input) {
  const share = await getShareByToken(token);
  if (!share) throw new Error('Enlace no válido o revocado');
  if (input.sectionId) await assertFaseDelProyecto(input.sectionId, share.project_id);
  const esPropuesta = true;
  return createActivity({
    projectId: share.project_id,
    sectionId: input.sectionId || null,
    name: input.name,
    responsables: input.responsables !== undefined ? input.responsables : (input.responsable || null),
    startDate: input.startDate || null,
    deadline: input.deadline || null,
    duracion: input.duracion,
    entregable: input.entregable || null,
    propuesta: esPropuesta,
    propuestaPor: input.propuestaPor || share.label || null,
  });
}

// ------------------------------------------------------------
// LÍNEA BASE
// Congela las fechas planeadas de hoy. Desde ahí, lo que se mueve (por
// fechas reales y dependencias) es la fecha proyectada, y se ve el desvío
// contra lo pactado. Las actividades que se agreguen después no tienen línea
// base («nuevas») hasta que se vuelva a fijar.
// ------------------------------------------------------------
async function fijarLineaBase(projectId) {
  const sb = getClient();
  const { data, error } = await sb.from('activities').select('id,start_date,deadline').eq('project_id', projectId);
  if (error) fail(error);
  await Promise.all(data.map(a => sb.from('activities')
    .update({ baseline_start: a.start_date || null, baseline_end: a.deadline || null }).eq('id', a.id)
    .then(({ error: e }) => { if (e) fail(e); })));
  const { error: pErr } = await sb.from('projects').update({ linea_base_at: new Date().toISOString() }).eq('id', projectId);
  if (pErr) fail(pErr);
  return data.length;
}

async function quitarLineaBase(projectId) {
  const sb = getClient();
  const { error } = await sb.from('activities').update({ baseline_start: null, baseline_end: null }).eq('project_id', projectId);
  if (error) fail(error);
  const { error: pErr } = await sb.from('projects').update({ linea_base_at: null }).eq('id', projectId);
  if (pErr) fail(pErr);
}

// ------------------------------------------------------------
// AJUSTES PROPUESTOS desde el enlace compartido
// ------------------------------------------------------------
const CAMPOS_AJUSTE = ['deadline', 'startDate', 'duracion', 'responsables', 'entregable', 'name', 'nota'];

async function listPropuestas(projectId) {
  const sb = getClient();
  const { data, error } = await sb.from('propuestas_cambio').select('*')
    .eq('project_id', projectId).eq('estado', 'pendiente').order('created_at');
  // Sin la migración de línea base la tabla no existe: la app sigue funcionando
  if (error) return [];
  return data.map(r => ({ id: r.id, activityId: r.activity_id, campo: r.campo, valor: r.valor, motivo: r.motivo, propuestoPor: r.propuesto_por, createdAt: r.created_at }));
}

// Arma una fila de ajuste propuesto ya validada (o lanza el error)
function filaAjuste(share, actIds, input, propuestoPor) {
  const campo = String(input.campo || '');
  if (!CAMPOS_AJUSTE.includes(campo)) throw new Error('Ajuste no válido');
  if (!actIds.has(input.activityId)) throw new Error('Actividad no encontrada en este proyecto');
  const valor = String(input.valor == null ? '' : input.valor).trim().slice(0, 500);
  if ((campo === 'deadline' || campo === 'startDate') && !/^\d{4}-\d{2}-\d{2}$/.test(valor)) throw new Error('La fecha propuesta no es válida');
  if (campo === 'duracion' && !(Number(valor) >= 1 && Number(valor) <= 365)) throw new Error('La duración va en días hábiles, de 1 a 365');
  if (!valor && campo !== 'nota') throw new Error('Escribe el valor que propones');
  return {
    project_id: share.project_id,
    activity_id: input.activityId,
    campo,
    valor: campo === 'duracion' ? String(Math.round(Number(valor))) : valor,
    motivo: String(input.motivo || '').trim().slice(0, 500) || null,
    propuesto_por: String(input.propuestoPor || propuestoPor || share.label || '').trim().slice(0, 80) || null,
    estado: 'pendiente',
  };
}

// Uno o varios ajustes a la vez (p. ej. la ronda de estimación de duraciones)
async function shareProponerAjuste(token, input) {
  const share = await getShareByToken(token);
  if (!share) throw new Error('Enlace no válido o revocado');
  const sb = getClient();
  const { data: acts, error } = await sb.from('activities').select('id').eq('project_id', share.project_id);
  if (error) fail(error);
  const actIds = new Set(acts.map(a => a.id));
  const items = Array.isArray(input.items) ? input.items : [input];
  if (!items.length) throw new Error('No hay nada que proponer');
  if (items.length > 200) throw new Error('Demasiados ajustes de una vez');
  const filas = items.map(it => filaAjuste(share, actIds, it, input.propuestoPor));
  const { error: insErr } = await sb.from('propuestas_cambio').insert(filas);
  if (insErr) fail(insErr);
  return filas.length;
}

async function resolverPropuesta(projectId, propuestaId, aceptar) {
  const sb = getClient();
  const { data: p, error } = await sb.from('propuestas_cambio').select('*').eq('id', propuestaId).maybeSingle();
  if (error) fail(error);
  if (!p || p.project_id !== projectId) throw new Error('Propuesta no encontrada');
  if (aceptar && p.campo === 'duracion' && p.activity_id) {
    // La duración manda: con inicio, el fin sale solo; sin inicio queda la duración
    // (y se programa al terminar sus precedentes)
    await updateActivity(p.activity_id, { duracion: Number(p.valor) || 1 });
  } else if (aceptar && p.campo !== 'nota' && p.activity_id) {
    await updateActivity(p.activity_id, { [p.campo]: p.valor });
  }
  const { error: upErr } = await sb.from('propuestas_cambio').update({ estado: aceptar ? 'aceptada' : 'descartada' }).eq('id', propuestaId);
  if (upErr) fail(upErr);
  return true;
}

// Aplica todos los ajustes pendientes en el orden del plan (así la cascada
// de fechas queda bien). Los comentarios quedan pendientes para leerlos.
async function aplicarTodasPropuestas(projectId) {
  const sb = getClient();
  const [pRes, aRes] = await Promise.all([
    sb.from('propuestas_cambio').select('*').eq('project_id', projectId).eq('estado', 'pendiente'),
    sb.from('activities').select('id,position').eq('project_id', projectId),
  ]);
  if (pRes.error) fail(pRes.error);
  if (aRes.error) fail(aRes.error);
  const pos = new Map(aRes.data.map(a => [a.id, a.position]));
  const lista = pRes.data.filter(p => p.campo !== 'nota')
    .sort((x, y) => (pos.get(x.activity_id) ?? 1e9) - (pos.get(y.activity_id) ?? 1e9) || String(x.created_at).localeCompare(String(y.created_at)));
  for (const p of lista) await resolverPropuesta(projectId, p.id, true);
  return lista.length;
}

// ------------------------------------------------------------
// BITÁCORA DE NOTAS POR ACTIVIDAD (privada: no se expone en el enlace)
// ------------------------------------------------------------
const formatNota = n => ({ id: n.id, activityId: n.activity_id, texto: n.texto, createdAt: n.created_at });

async function listNotas(projectId) {
  const sb = getClient();
  const { data, error } = await sb.from('activity_notes').select('*').eq('project_id', projectId).order('created_at', { ascending: false });
  // Sin la migración la tabla no existe: la app sigue funcionando
  if (error) return [];
  return data.map(formatNota);
}

async function crearNota(activityId, texto, fecha) {
  const limpio = String(texto || '').trim().slice(0, 4000);
  if (!limpio) throw new Error('La nota está vacía');
  const sb = getClient();
  const { data: act, error: aErr } = await sb.from('activities').select('id,project_id').eq('id', activityId).maybeSingle();
  if (aErr) fail(aErr);
  if (!act) throw new Error('Actividad no encontrada');
  const fila = { project_id: act.project_id, activity_id: act.id, texto: limpio };
  // Comentario con fecha propia (p. ej. lo que se dijo en el comité del martes); hoy = la hora actual
  if (/^\d{4}-\d{2}-\d{2}$/.test(fecha || '') && fecha !== todayBogota()) fila.created_at = `${fecha}T12:00:00-05:00`;
  const { data, error } = await sb.from('activity_notes').insert(fila).select('*').single();
  if (error) fail(error);
  return formatNota(data);
}

async function borrarNota(activityId, noteId) {
  const sb = getClient();
  const { error } = await sb.from('activity_notes').delete().eq('id', noteId).eq('activity_id', activityId);
  if (error) fail(error);
}

// ------------------------------------------------------------
// INVOLUCRADOS DEL PROYECTO
// Quiénes participan y de qué área son. En el responsable de cada
// actividad se pueden usar sus nombres; la vista «por área» usa su área.
// ------------------------------------------------------------
const formatMiembro = m => ({ id: m.id, nombre: m.nombre, area: m.area || null, rol: m.rol || null });

async function listMiembros(projectId) {
  const sb = getClient();
  const { data, error } = await sb.from('project_members').select('*').eq('project_id', projectId).order('created_at');
  // Sin la migración la tabla no existe: la app sigue funcionando
  if (error) return [];
  return data.map(formatMiembro);
}

async function guardarMiembro(projectId, input) {
  const sb = getClient();
  const nombre = String(input.nombre || '').trim().slice(0, 80);
  if (!nombre) throw new Error('El nombre es obligatorio');
  const fila = { nombre, area: String(input.area || '').trim().slice(0, 80) || null, rol: String(input.rol || '').trim().slice(0, 80) || null };
  if (input.id) {
    const { data, error } = await sb.from('project_members').update(fila).eq('id', input.id).eq('project_id', projectId).select('*').single();
    if (error) fail(error);
    return formatMiembro(data);
  }
  const { data, error } = await sb.from('project_members').insert({ project_id: projectId, ...fila }).select('*').single();
  if (error) fail(error);
  return formatMiembro(data);
}

async function borrarMiembro(projectId, memberId) {
  const sb = getClient();
  const { error } = await sb.from('project_members').delete().eq('id', memberId).eq('project_id', projectId);
  if (error) fail(error);
}

// ------------------------------------------------------------
// PLANTILLAS DE PLAN DE TRABAJO
// Carga fases + actividades de una plantilla en un proyecto que ya
// existe. No duplica: si la fase o la actividad ya está (mismo nombre),
// la reutiliza (y conserva sus fechas). Las fases por defecto vacías se quitan.
// Con `reemplazar`, el proyecto queda con la estructura exacta de la
// plantilla y sus fechas planeadas: lo que no está en ella se borra (salvo
// propuestas del equipo). Las fechas reales nunca se tocan.
// Las tareas NO se vinculan solas: eso lo decide el usuario a mano.
// ------------------------------------------------------------
const normNombre = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

async function aplicarPlantilla(projectId, key, input) {
  const plantilla = plantillas.PLANTILLAS[key];
  if (!plantilla) throw new Error('Plantilla no encontrada');
  if (!projectId) throw new Error('projectId es obligatorio');
  const reemplazar = !!(input && input.reemplazar);
  const sb = getClient();
  const inicio = plantillas.habilDesde(
    /^\d{4}-\d{2}-\d{2}$/.test((input && input.inicio) || '') ? input.inicio : todayBogota()
  );

  const [secRes, actRes] = await Promise.all([
    sb.from('project_sections').select('*').eq('project_id', projectId).order('position'),
    sb.from('activities').select('id,name,section_id,position,depends_on,depends_on_ids,propuesta').eq('project_id', projectId),
  ]);
  if (secRes.error) fail(secRes.error);
  if (actRes.error) fail(actRes.error);
  let secciones = secRes.data;
  const actividades = actRes.data;

  // 1) Cada código de la plantilla queda con su id desde ya (la actividad que
  //    ya existe con ese nombre, o una nueva), así las dependencias pueden
  //    apuntar a actividades que aparecen más abajo en la lista.
  const idPorCodigo = {};
  const existentePorCodigo = {};
  plantilla.fases.forEach(f => f.actividades.forEach(a => {
    const existe = actividades.find(x => normNombre(x.name) === normNombre(a.nombre) && !Object.values(existentePorCodigo).includes(x));
    if (existe) existentePorCodigo[a.cod] = existe;
    idPorCodigo[a.cod] = existe ? existe.id : crypto.randomUUID();
  }));
  const usadas = new Set(Object.values(existentePorCodigo).map(a => a.id));

  // 2) Reemplazar: fuera lo que no está en la plantilla (las propuestas del equipo se quedan)
  let borradas = 0;
  if (reemplazar) {
    const sobran = actividades.filter(a => !usadas.has(a.id) && !a.propuesta).map(a => a.id);
    if (sobran.length) {
      const { error } = await sb.from('activities').delete().in('id', sobran);
      if (error) fail(error);
      borradas = sobran.length;
    }
  }
  const quedan = actividades.filter(a => usadas.has(a.id) || !reemplazar || a.propuesta);

  // 3) Fases: las de la plantilla, en su orden
  let fasesCreadas = 0;
  const seccionesPlantilla = [];
  for (const fase of plantilla.fases) {
    let sec = secciones.find(s => normNombre(s.name) === normNombre(fase.nombre));
    if (!sec) {
      const { data, error } = await sb.from('project_sections')
        .insert({ project_id: projectId, name: fase.nombre, position: 1000 + fasesCreadas }).select('*').single();
      if (error) fail(error);
      sec = data; secciones.push(sec); fasesCreadas++;
    } else if (reemplazar && sec.name !== fase.nombre) {
      // Mismo capítulo con otra escritura: queda con el nombre exacto de la plantilla
      const { error } = await sb.from('project_sections').update({ name: fase.nombre }).eq('id', sec.id);
      if (error) fail(error);
      sec.name = fase.nombre;
    }
    seccionesPlantilla.push(sec);
  }

  // Fases que sobran y quedaron vacías: las por defecto siempre; con reemplazar, todas
  const defaults = new Set(DEFAULT_SECTIONS.map(normNombre));
  const enPlantilla = new Set(seccionesPlantilla.map(s => s.id));
  const vacias = secciones.filter(s => !enPlantilla.has(s.id)
    && (reemplazar || defaults.has(normNombre(s.name)))
    && !quedan.some(a => a.section_id === s.id && !usadas.has(a.id)));
  if (vacias.length) {
    const { error } = await sb.from('project_sections').delete().in('id', vacias.map(s => s.id));
    if (error) fail(error);
    secciones = secciones.filter(s => !vacias.includes(s));
  }

  // 4) Actividades
  const programa = plantillas.programar(plantilla, inicio);
  let posAct = reemplazar ? 0 : quedan.reduce((m, a) => Math.max(m, a.position), -1) + 1;
  const nuevas = [];
  const cambios = []; // actividades que ya existían: etapa, orden y dependencias
  let omitidas = 0;
  plantilla.fases.forEach((fase, fi) => {
    const sec = seccionesPlantilla[fi];
    for (const a of fase.actividades) {
      const id = idPorCodigo[a.cod];
      const deps = (a.deps || []).map(c => idPorCodigo[c]).filter(d => d && d !== id);
      const existe = existentePorCodigo[a.cod];
      if (existe) {
        omitidas++;
        const actuales = parseIdList(existe.depends_on_ids && existe.depends_on_ids.length ? existe.depends_on_ids : existe.depends_on);
        if (reemplazar) {
          // La estructura manda: etapa, orden, dependencias y fechas planeadas de la plantilla.
          // Las fechas reales, el avance, el responsable y las notas se conservan.
          cambios.push({ id, fields: { section_id: sec.id, position: posAct++, depends_on_ids: deps, depends_on: deps[0] || null,
            start_date: programa[a.cod].inicio, deadline: programa[a.cod].fin } });
        } else {
          const faltan = deps.filter(d => !actuales.includes(d));
          if (faltan.length) { const ids = [...actuales, ...faltan]; cambios.push({ id, fields: { depends_on_ids: ids, depends_on: ids[0] || null } }); }
        }
        continue;
      }
      const resp = parseNameList(a.resp);
      nuevas.push({
        id,
        project_id: projectId,
        section_id: sec.id,
        name: a.nombre,
        responsables: resp,
        responsable: resp.join(', ') || null,
        entregable: a.entregable || null,
        start_date: programa[a.cod].inicio,
        deadline: programa[a.cod].fin,
        status: 'pendiente',
        pct_complete: 0,
        depends_on_ids: deps,
        depends_on: deps[0] || null,
        notes: a.notas || null,
        position: posAct++,
      });
    }
  });
  // Propuestas del equipo que se conservan: al final
  if (reemplazar) quedan.filter(a => !usadas.has(a.id)).forEach(a => cambios.push({ id: a.id, fields: { position: posAct++ } }));

  // Las etapas quedan en el orden de la plantilla (p. ej. la 0 · Arranque de primera);
  // las que el usuario creó aparte van después
  const otras = secciones.filter(s => !enPlantilla.has(s.id)).sort((x, y) => x.position - y.position);
  await Promise.all([...seccionesPlantilla, ...otras].map((s, i) => s.position === i ? null
    : sb.from('project_sections').update({ position: i }).eq('id', s.id).then(({ error }) => { if (error) fail(error); })));
  // Primero las nuevas (las existentes pueden depender de ellas)
  if (nuevas.length) {
    const { error } = await sb.from('activities').insert(nuevas);
    if (error) fail(error);
  }
  await Promise.all(cambios.map(c => sb.from('activities').update(c.fields).eq('id', c.id)
    .then(({ error }) => { if (error) fail(error); })));
  // Nada arranca antes de que termine lo que lo condiciona (empuja hacia adelante)
  if (nuevas.length || cambios.length) await shiftSuccessors(projectId);
  return { plantilla: plantilla.nombre, inicio, reemplazar, fasesCreadas, creadas: nuevas.length, omitidas, borradas,
    fasesBorradas: vacias.length };
}

module.exports = {
  shareEditar,
  anidarSeccion,
  sacarSeccion,
  listHistorial,
  listarPlantillas: plantillas.listarPlantillas,
  fijarLineaBase,
  quitarLineaBase,
  listPropuestas,
  shareProponerAjuste,
  resolverPropuesta,
  aplicarTodasPropuestas,
  listMiembros,
  listNotas,
  crearNota,
  borrarNota,
  guardarMiembro,
  borrarMiembro,
  aplicarPlantilla,
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
  moverFechasLote,
  listProjectActivities,
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
