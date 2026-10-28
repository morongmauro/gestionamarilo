// ============================================================
// EXPORTACIÓN PLANA para el data lake / Power BI
// Cada «tabla» sale como filas planas (JSON o CSV), lista para que
// Data Factory, Fabric o Databricks la copien al lago.
// ============================================================
const Finanzas = require('../public/js/finanzas');

const TABLAS = ['proyectos', 'actividades', 'casos', 'flujos', 'sesiones', 'compromisos', 'comites'];

function plano(v) {
  if (v == null) return '';
  if (Array.isArray(v)) return v.map(x => (typeof x === 'object' ? JSON.stringify(x) : x)).join(', ');
  if (typeof v === 'object') return JSON.stringify(v);
  return v;
}

function build(tabla, d) {
  const cols = d.columns || [];
  const titleCol = cols.find(c => c.type === 'title') || { id: 'proyecto' };
  const nombre = id => { const p = d.projects.find(x => x.id === id); return p ? (p.props || {})[titleCol.id] || '' : ''; };
  const comite = id => { const c = d.committees.find(x => x.id === id); return c ? c.name : ''; };
  const meta = r => ({ creado: r.created_at || '', actualizado: r.updated_at || '', actualizado_por: r.updated_by_name || '' });
  switch (tabla) {
    case 'proyectos': return d.projects.map(p => {
      const o = { proyecto_id: p.id };
      for (const c of cols) o[c.name] = plano((p.props || {})[c.id]);
      const acts = d.activities.filter(a => a.project_id === p.id);
      const ini = acts.map(a => a.inicio).filter(Boolean).sort()[0] || '';
      const fin = acts.map(a => a.fin).filter(Boolean).sort().pop() || '';
      o.inicio_cronograma = ini; o.fin_cronograma = fin;
      o.avance_promedio = acts.length ? Math.round(acts.reduce((s, a) => s + (a.avance || 0), 0) / acts.length) : '';
      const caso = d.cases.find(c => c.project_id === p.id);
      o.estado_caso = caso ? caso.estado || '' : '';
      return Object.assign(o, meta(p));
    });
    case 'actividades': return d.activities.map(a => ({
      actividad_id: a.id, proyecto_id: a.project_id, proyecto: nombre(a.project_id), actividad: a.name || '',
      responsable: a.responsable || '', inicio: a.inicio || '', fin: a.fin || '', avance: a.avance || 0, hito: a.hito ? 1 : 0, ...meta(a) }));
    case 'casos': return d.cases.map(c => {
      const f = Finanzas.calc(c);
      return { proyecto_id: c.project_id, proyecto: nombre(c.project_id), estado: c.estado || '', sponsor: c.sponsor || '',
        moneda: c.moneda || 'COP', tasa_descuento: c.tasa ?? '', horizonte_anios: f.anios,
        inversion_total: f.totalInversion, costo_total: f.totalCosto, beneficio_total: f.totalBeneficio,
        vpn: f.vpn ?? '', tir: f.tir ?? '', payback_anios: f.payback ?? '', roi: f.roi ?? '',
        problema: c.problema || '', objetivo: c.objetivo || '', alcance: c.alcance || '', riesgos: c.riesgos || '', recomendacion: c.recomendacion || '', ...meta(c) };
    });
    case 'flujos': return d.cases.flatMap(c => (c.flujos || []).flatMap(fl => (fl.valores || []).map((v, t) => ({
      proyecto_id: c.project_id, proyecto: nombre(c.project_id), concepto: fl.concepto || '', tipo: fl.tipo || '', anio: t, valor: Number(v) || 0 }))));
    case 'sesiones': return d.sessions.map(s => ({
      sesion_id: s.id, comite_id: s.comite_id || '', comite: comite(s.comite_id), titulo: s.titulo || '', fecha: s.fecha || '',
      hora_inicio: s.hora_ini || '', hora_fin: s.hora_fin || '', estado: s.estado || '', lugar: s.lugar || '', enlace: s.enlace || '',
      proyectos: (s.proyectos || []).map(nombre).join(', '), temas: s.temas || '', decisiones: s.decisiones || '', ...meta(s) }));
    case 'compromisos': return d.sessions.flatMap(s => (s.compromisos || []).map(k => ({
      sesion_id: s.id, comite: comite(s.comite_id), fecha_sesion: s.fecha || '', compromiso: k.texto || '',
      responsable: k.responsable || '', fecha_compromiso: k.fecha || '', cumplido: k.hecho ? 1 : 0 })));
    case 'comites': return d.committees.map(c => ({ comite_id: c.id, comite: c.name, frecuencia: c.frecuencia || '', descripcion: c.descripcion || '', integrantes: c.integrantes || '', ...meta(c) }));
  }
  return null;
}

// Encabezados fijos por tabla: una tabla vacía igual sale con sus columnas
const META = ['creado', 'actualizado', 'actualizado_por'];
const HEADERS = {
  actividades: ['actividad_id', 'proyecto_id', 'proyecto', 'actividad', 'responsable', 'inicio', 'fin', 'avance', 'hito', ...META],
  casos: ['proyecto_id', 'proyecto', 'estado', 'sponsor', 'moneda', 'tasa_descuento', 'horizonte_anios', 'inversion_total', 'costo_total', 'beneficio_total', 'vpn', 'tir', 'payback_anios', 'roi', 'problema', 'objetivo', 'alcance', 'riesgos', 'recomendacion', ...META],
  flujos: ['proyecto_id', 'proyecto', 'concepto', 'tipo', 'anio', 'valor'],
  sesiones: ['sesion_id', 'comite_id', 'comite', 'titulo', 'fecha', 'hora_inicio', 'hora_fin', 'estado', 'lugar', 'enlace', 'proyectos', 'temas', 'decisiones', ...META],
  compromisos: ['sesion_id', 'comite', 'fecha_sesion', 'compromiso', 'responsable', 'fecha_compromiso', 'cumplido'],
  comites: ['comite_id', 'comite', 'frecuencia', 'descripcion', 'integrantes', ...META],
};
function headersOf(tabla, d) {
  if (tabla === 'proyectos') return ['proyecto_id', ...(d.columns || []).map(c => c.name), 'inicio_cronograma', 'fin_cronograma', 'avance_promedio', 'estado_caso', ...META];
  return HEADERS[tabla];
}

function toCSV(rows, headers) {
  const heads = headers || [...new Set(rows.flatMap(r => Object.keys(r)))];
  if (!heads.length) return '';
  const cell = v => { const s = String(v ?? ''); return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return [heads.map(cell).join(','), ...rows.map(r => heads.map(h => cell(r[h])).join(','))].join('\r\n');
}

// Archivo .ics (Outlook / Teams) de una sesión de comité
function toICS(s, comiteNombre, proyectos, offset) {
  const off = /^[+-]\d{2}:\d{2}$/.test(offset || '') ? offset : '-05:00';
  const utc = (fecha, hora) => {
    const d = new Date(`${fecha}T${hora || '08:00'}:00${off}`);
    return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  };
  const escI = t => String(t || '').replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  const fold = l => { const out = []; while (l.length > 74) { out.push(l.slice(0, 74)); l = ' ' + l.slice(74); } out.push(l); return out.join('\r\n'); };
  const desc = [s.temas && `Temas:\n${s.temas}`, proyectos.length && `Proyectos:\n- ${proyectos.join('\n- ')}`, s.enlace && `Enlace: ${s.enlace}`].filter(Boolean).join('\n\n');
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Portafolio//Comites//ES', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT', `UID:${s.id}@portafolio`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`,
    `DTSTART:${utc(s.fecha, s.hora_ini)}`, `DTEND:${utc(s.fecha, s.hora_fin || addHour(s.hora_ini))}`,
    `SUMMARY:${escI(s.titulo || comiteNombre || 'Comité')}`,
    s.lugar || s.enlace ? `LOCATION:${escI(s.lugar || s.enlace)}` : null,
    desc ? `DESCRIPTION:${escI(desc)}` : null,
    s.estado === 'Cancelada' ? 'STATUS:CANCELLED' : 'STATUS:CONFIRMED',
    'END:VEVENT', 'END:VCALENDAR',
  ].filter(Boolean);
  return lines.map(fold).join('\r\n') + '\r\n';
}
function addHour(h) {
  const [H, M] = String(h || '08:00').split(':').map(Number);
  return `${String(Math.min(23, H + 1)).padStart(2, '0')}:${String(M || 0).padStart(2, '0')}`;
}

module.exports = { TABLAS, build, toCSV, toICS, headersOf };
