// ============================================================
// MOTOR DE PRIORIZACIÓN + DASHBOARD
// (misma lógica que usaba lib/notion.js, ahora independiente de la fuente)
// ============================================================
const DAY = 86400000;

function urgencyFromDueDate(dueDate) {
  if (!dueDate) return 10;
  const d = (new Date(dueDate).getTime() - Date.now()) / DAY;
  if (d < 0)   return 100;
  if (d < 1)   return 85;
  if (d <= 3)  return 65;
  if (d <= 7)  return 40;
  if (d <= 14) return 20;
  return 10;
}

function typeMultiplier(tipo) {
  if (tipo === 'Depende Tercero') return 1.4;
  if (tipo === 'Compartida')      return 1.2;
  return 1.0;
}

function stagnationDays(task) {
  if (task.tipoGestion !== 'Depende Tercero') return 0;
  return Math.floor((Date.now() - new Date(task.lastEdited).getTime()) / DAY);
}

function stagnationMultiplier(days) {
  if (days >= 6) return 1.5;
  if (days >= 3) return 1.2;
  return 1.0;
}

function scoreTask(task) {
  const urgency = urgencyFromDueDate(task.dueDate);
  const typeMult = typeMultiplier(task.tipoGestion);
  const iceFactor = (task.ice ?? 50) / 50;
  const prioBoost = task.priority === 'High' ? 1.3 : 1.0;
  const stagDays = stagnationDays(task);
  const stagMult = stagnationMultiplier(stagDays);
  return {
    score: Math.round(urgency * typeMult * iceFactor * prioBoost * stagMult),
    urgency,
    stagDays,
    isOverdue: urgency === 100,
  };
}

function enrich(task) {
  return { ...task, ...scoreTask(task) };
}

function buildBandejas(todo) {
  const enriched = todo.map(enrich);
  const sorted = [...enriched].sort((a, b) => b.score - a.score);
  const foco = sorted[0] ?? null;
  const focoId = foco?.id;
  const rest = enriched.filter(t => t.id !== focoId);

  return {
    foco,
    allEnriched: enriched,
    activaTerceros: rest.filter(t => t.tipoGestion === 'Depende Tercero').sort((a, b) => b.score - a.score).slice(0, 5),
    ejecutaTu:     rest.filter(t => t.tipoGestion === 'Propia' && t.effortLevel !== 'Small').sort((a, b) => b.score - a.score).slice(0, 5),
    coordina:      rest.filter(t => t.tipoGestion === 'Compartida').sort((a, b) => b.score - a.score).slice(0, 5),
    quickWins:     rest.filter(t => t.effortLevel === 'Small').sort((a, b) => b.score - a.score).slice(0, 5),
  };
}

function calcHealth(enriched, doneThisWeek) {
  let h = 100;
  const stagnant = enriched.filter(t => t.stagDays >= 5).length;
  const overdue = enriched.filter(t => t.isOverdue).length;
  h -= stagnant * 8;
  h -= overdue * 6;
  h += Math.min(20, doneThisWeek * 2);
  return Math.max(20, Math.min(100, Math.round(h)));
}

function buildExecReport(enriched, doneAll, topicMap) {
  const weekAgo = Date.now() - 7 * DAY;
  const doneThisWeek = doneAll.filter(t => new Date(t.lastEdited).getTime() > weekAgo);
  const logrosTopics = {};
  doneThisWeek.forEach(t => {
    if (t.topic) logrosTopics[t.topic] = (logrosTopics[t.topic] || 0) + 1;
  });
  const topLogros = Object.entries(logrosTopics).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const stagnantTercero = enriched.filter(t => t.stagDays >= 5);
  const overdue = enriched.filter(t => t.isOverdue);
  const highScoreNext = enriched.filter(t => t.score >= 80).sort((a, b) => b.score - a.score).slice(0, 3);

  return {
    logros: doneThisWeek.length > 0
      ? `Cerradas ${doneThisWeek.length} tareas esta semana. ${topLogros.map(([t, n]) => `${t}: ${n}`).join(' · ')}.`
      : 'Sin tareas cerradas en los últimos 7 días.',
    riesgos: (stagnantTercero.length || overdue.length)
      ? `${stagnantTercero.length} tareas estancadas con terceros (+5 días sin movimiento). ${overdue.length} tareas vencidas requieren acción inmediata.`
      : 'Sin riesgos críticos detectados. Buen momentum.',
    foco: highScoreNext.length
      ? highScoreNext.map(t => `· ${t.title} (${t.topic || 'general'})`).join('  ')
      : 'No hay tareas de alto score esta semana.',
    avances: `${enriched.length} tareas activas distribuidas en ${Object.keys(topicMap).length} frentes.`,
  };
}

function buildTipoGestionStats(enriched) {
  const counts = { 'Depende Tercero': 0, 'Propia': 0, 'Compartida': 0, 'Sin asignar': 0 };
  enriched.forEach(t => {
    const tipo = t.tipoGestion;
    if (counts[tipo] !== undefined) counts[tipo]++;
    else if (!tipo) counts['Sin asignar']++;
    else counts[tipo] = (counts[tipo] || 0) + 1;
  });
  return Object.entries(counts)
    .filter(([, n]) => n > 0)
    .map(([tipo, count]) => ({ tipo, count }));
}

function buildDueIn14Days(enriched) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const buckets = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(today.getTime() + i * DAY);
    buckets.push({ date: d.toISOString().slice(0, 10), label: d.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric' }), count: 0, tasks: [] });
  }
  enriched.forEach(t => {
    if (!t.dueDate) return;
    const due = new Date(t.dueDate + 'T12:00:00');
    due.setHours(0, 0, 0, 0);
    const idx = Math.floor((due - today) / DAY);
    if (idx >= 0 && idx < 14) {
      buckets[idx].count++;
      buckets[idx].tasks.push({ id: t.id, title: t.title, topic: t.topic });
    }
  });
  return buckets;
}

function buildProjectHealth(enriched) {
  const map = {};
  enriched.forEach(t => {
    const topic = t.topic || 'Sin proyecto';
    if (!map[topic]) map[topic] = { topic, active: 0, overdue: 0, stagnant: 0, highPrio: 0, avgScore: 0, totalScore: 0, ice: null };
    map[topic].active++;
    if (t.isOverdue) map[topic].overdue++;
    if (t.stagDays >= 5) map[topic].stagnant++;
    if (t.priority === 'High') map[topic].highPrio++;
    map[topic].totalScore += t.score;
    if (t.ice && (!map[topic].ice || t.ice > map[topic].ice)) map[topic].ice = t.ice;
  });
  return Object.values(map).map(p => {
    p.avgScore = p.active ? Math.round(p.totalScore / p.active) : 0;
    delete p.totalScore;
    const ratio = p.overdue + p.stagnant;
    p.status = ratio >= 3 || p.overdue >= 2 ? 'red' : ratio >= 1 ? 'yellow' : 'green';
    return p;
  }).sort((a, b) => {
    const ord = { red: 0, yellow: 1, green: 2 };
    if (ord[a.status] !== ord[b.status]) return ord[a.status] - ord[b.status];
    return b.avgScore - a.avgScore;
  });
}

function buildDashboardPayload(todo, done) {
  const bandejas = buildBandejas(todo);

  const active = todo.length;
  const highPriority = bandejas.allEnriched.filter(t => t.priority === 'High').length;
  const waitingThirdParty = bandejas.activaTerceros.length;
  const quickWinsCount = bandejas.quickWins.length;
  const stagnantCount = bandejas.allEnriched.filter(t => t.stagDays >= 5).length;
  const overdueCount = bandejas.allEnriched.filter(t => t.isOverdue).length;

  const weekAgo = Date.now() - 7 * DAY;
  const doneThisWeek = done.filter(t => new Date(t.lastEdited).getTime() > weekAgo).length;

  const topicMap = {};
  todo.forEach(t => { if (t.topic) topicMap[t.topic] = (topicMap[t.topic] || 0) + 1; });
  const byTopic = Object.entries(topicMap).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([topic, count]) => ({ topic, count }));

  const totalAll = active + done.length;
  const completionPct = totalAll > 0 ? Math.round((done.length / totalAll) * 100) : 0;
  const healthScore = calcHealth(bandejas.allEnriched, doneThisWeek);
  const report = buildExecReport(bandejas.allEnriched, done, topicMap);

  const tipoGestionStats = buildTipoGestionStats(bandejas.allEnriched);
  const dueIn14Days = buildDueIn14Days(bandejas.allEnriched);
  const projectHealth = buildProjectHealth(bandejas.allEnriched);
  const doneRecent = done
    .filter(t => new Date(t.lastEdited).getTime() > Date.now() - 7 * DAY)
    .sort((a, b) => new Date(b.lastEdited) - new Date(a.lastEdited));

  return {
    kpis: { active, highPriority, waitingThirdParty, quickWins: quickWinsCount, stagnantCount, overdueCount, done: done.length, doneThisWeek, completionPct, healthScore },
    foco: bandejas.foco,
    bandejas: { activaTerceros: bandejas.activaTerceros, ejecutaTu: bandejas.ejecutaTu, coordina: bandejas.coordina, quickWins: bandejas.quickWins },
    allTasks: bandejas.allEnriched,
    doneRecent,
    byTopic,
    tipoGestionStats,
    dueIn14Days,
    projectHealth,
    report,
  };
}

module.exports = { enrich, buildDashboardPayload };
