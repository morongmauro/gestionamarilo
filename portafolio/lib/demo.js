// ============================================================
// DATOS DE EJEMPLO (solo con MODO_DEMO=true)
// Cinco iniciativas inventadas con casos de negocio, valor captado,
// plan de trabajo (capítulos, precedencias, responsables), comités y
// compromisos. Las fechas se calculan desde HOY, así la demostración
// siempre se ve vigente. No crea usuarios (en un enlace público no debe
// haber cuentas con contraseñas conocidas).
// ============================================================
const crypto = require('crypto');

// Identificadores fijos: cada carga produce los mismos. Así, en la demostración sin base de
// datos, todas las copias de la app tienen los mismos proyectos y los enlaces siempre sirven.
let contador = 0;
const id = () => { const h = crypto.createHash('sha256').update('pf-demo:' + (++contador)).digest('hex'); return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`; };
const iso = d => d.toISOString().slice(0, 10);
const hoyUTC = () => { const t = new Date(); return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate())); };
const dias = (base, n) => { const d = new Date(base); d.setUTCDate(d.getUTCDate() + n); return d; };
// Días hábiles (lunes a viernes; los festivos los ajusta el cronograma al editar)
const habil = d => { const x = new Date(d); while ([0, 6].includes(x.getUTCDay())) x.setUTCDate(x.getUTCDate() + 1); return x; };
const masHabiles = (d, n) => { const x = new Date(d); let k = 0; while (k < n) { x.setUTCDate(x.getUTCDate() + 1); if (![0, 6].includes(x.getUTCDay())) k++; } return x; };

const PROYECTOS = [
  { nombre: 'Automatización de cotizaciones', estado: 'L2 - Ejecución', hab: ['Laura Martínez'], rea: ['Carlos Gómez', 'Ana Restrepo'], income: 7, okr: 'Tasa de conversión de cotizaciones', tipo: 'Eficiencia operativa', ice: [8, 7, 6], inicio: -120, atraso: true,
    plan: [['Diagnóstico', [['Levantamiento de procesos actuales', 'Ana Gómez', 8], ['Entrevistas con áreas usuarias', 'Ana Gómez', 6], ['Línea base de indicadores', 'Carlos Ruiz', 5]]],
      ['Diseño de la solución', [['Diseño del proceso objetivo', 'Ana Gómez', 10], ['Requerimientos funcionales', 'Laura Pérez', 8], ['Aprobación en comité', 'Comité de Innovación', 1]]],
      ['Implementación', [['Configuración de la plataforma', 'TI', 15], ['Pruebas con usuarios', 'Laura Pérez', 6], ['Capacitación', 'Gestión Humana', 4], ['Salida en vivo', 'TI', 1]]]] },
  { nombre: 'Portal de autogestión para clientes', estado: 'L1 - Planeación', hab: ['Laura Martínez'], rea: ['Ana Restrepo'], income: 55, okr: 'Satisfacción del cliente', tipo: 'Experiencia', ice: [7, 5, 4], inicio: -90, atraso: true,
    plan: [['Estructuración', [['Análisis de mercado', 'Mercadeo', 10], ['Modelo financiero', 'Finanzas', 7], ['Validación jurídica', 'Jurídica', 6]]],
      ['Piloto', [['Selección de proyecto piloto', 'Carlos Ruiz', 3], ['Ejecución del piloto', 'Operaciones', 20], ['Medición de resultados', 'Carlos Ruiz', 5]]]] },
  { nombre: 'Modelo de riesgo de crédito', estado: 'L1 - Planeación', hab: ['Carlos Gómez'], rea: ['Jorge Pérez'], income: 5, okr: 'Pérdida esperada', tipo: 'Riesgo y cumplimiento', ice: [9, 4, 3], inicio: -45,
    plan: [['Preparación', [['Definir alcance y KPIs', 'Laura Pérez', 4], ['Selección de proveedor', 'Compras', 12]]],
      ['Despliegue', [['Integración con ERP', 'TI', 15], ['Migración de datos', 'TI', 8], ['Estabilización', 'Operaciones', 10]]]] },
  { nombre: 'Analítica de cobranza', estado: 'L3 - Escalamiento', hab: ['Laura Martínez'], rea: ['Carlos Gómez'], income: 34, okr: 'Recaudo a tiempo', tipo: 'Ingresos', ice: [6, 8, 8], inicio: 5,
    plan: [['Idea y validación', [['Prototipo de experiencia', 'Innovación', 8], ['Pruebas con clientes', 'Mercadeo', 6]]],
      ['Lanzamiento', [['Plan comercial', 'Mercadeo', 7], ['Lanzamiento controlado', 'Comercial', 10]]]] },
  { nombre: 'Migración de reportes a la nube', estado: 'Pausado', hab: ['Carlos Gómez'], rea: [], income: null, okr: 'Por definir', tipo: 'Eficiencia operativa', ice: [4, 6, 7], inicio: null, plan: [] },
];
const MIEMBROS = [{ nombre: 'Ana Gómez', area: 'Procesos', rol: 'Líder' }, { nombre: 'Carlos Ruiz', area: 'Planeación', rol: 'Analista' }, { nombre: 'Laura Pérez', area: 'Producto', rol: 'Product owner' }];

async function cargar(store) {
  contador = 0;
  const hoy = hoyUTC(), Y = hoy.getUTCFullYear(), mesHoy = hoy.getUTCMonth() + 1, ahora = new Date().toISOString();
  const meta = { created_at: ahora, updated_at: ahora, updated_by_name: 'Datos de ejemplo' };
  // Se borra lo anterior (solo se llama en modo demostración)
  for (const c of ['activities', 'sections', 'cases', 'sessions', 'projects']) for (const d of await store.list(c)) await store.remove(c, d.id);
  let comites = await store.list('committees');
  if (comites.length < 2) {
    for (const c of [{ name: 'Comité de seguimiento', color: 'amarillo', frecuencia: 'Quincenal' }, { name: 'Comité directivo', color: 'azul', frecuencia: 'Mensual' }].slice(comites.length)) await store.insert('committees', { ...c, id: id(), descripcion: '', integrantes: '', ...meta });
    comites = await store.list('committees');
  }
  const f = n => iso(dias(hoy, n));
  const ids = [];
  for (const [k, P] of PROYECTOS.entries()) {
    const pid = id(); ids.push(pid);
    const fin0 = P.inicio == null ? null : habil(dias(hoy, P.inicio));
    await store.insert('projects', { id: pid, position: k, ...meta, miembros: P.plan.length ? MIEMBROS : [],
      fecha_meta: fin0 ? iso(masHabiles(fin0, P.atraso ? 60 : 90)) : null,
      props: { proyecto: P.nombre, estado: P.estado, habilitadores: P.hab, realizadores: P.rea, income: P.income, okrs: P.okr, tipo_valor: P.tipo, impacto: P.ice[0], confianza: P.ice[1], facilidad: P.ice[2],
        trazabilidad: `${f(-1).slice(8)}/${f(-1).slice(5, 7)}: Avance revisado en comité.\n${f(-15).slice(8)}/${f(-15).slice(5, 7)}: Se ajustó el alcance con el negocio.` } });
    // Plan de trabajo: capítulos en serie, cada actividad depende de la anterior
    let pos = 0, prev = null, ini = fin0;
    for (const [i, [cap, filas]] of P.plan.entries()) {
      const sid = id();
      await store.insert('sections', { id: sid, project_id: pid, name: cap, position: i, parent_id: null, enabled: true, ...meta });
      for (const [j, [nombre, resp, dur]] of filas.entries()) {
        const s = prev ? masHabiles(new Date(prev.fin + 'T00:00:00Z'), 1) : ini, e = dur > 1 ? masHabiles(s, dur - 1) : s;
        const inicio = iso(s), fin = iso(e), hoyIso = iso(hoy);
        // Avance: los atrasados van por detrás de sus fechas; los demás, al día
        let avance = fin < hoyIso ? 100 : inicio <= hoyIso ? Math.min(95, Math.round((hoy - s) / Math.max(1, e - s) * 100)) : 0;
        if (P.atraso && i > 0 && fin < hoyIso) avance = [40, 20, 0][j % 3];
        const a = { id: id(), project_id: pid, section_id: sid, name: nombre, responsable: resp, inicio, fin, duracion: dur, avance, hito: dur === 1, position: pos++,
          deps: prev ? [prev.id] : [], dep_tipos: {}, entregable: j === filas.length - 1 ? `Acta de ${cap.toLowerCase()}` : '', area: '', notas: '', comentarios: [], ...meta };
        if (avance === 100) { a.real_ini = inicio; a.real_fin = fin; }
        await store.insert('activities', a); prev = a;
      }
    }
  }
  // Casos de negocio con flujo a 5 años y valor captado mes a mes (año en curso)
  const meses = (vals, cat) => vals.slice(0, Math.max(0, mesHoy - 1)).map((v, i) => ({ mes: `${Y}-${String(i + 1).padStart(2, '0')}`, categoria: cat, valor: v }));
  const caso = (k, x) => store.insert('cases', { id: id(), project_id: ids[k], moneda: 'COP', tasa: 12, anio_inicio: Y, escenarios: {}, ...meta, ...x });
  await caso(0, { estado: 'En revisión', sponsor: 'Vicepresidencia comercial', anios: 5,
    problema: 'Las cotizaciones se clasifican a mano y tardan dos días en llegar al asesor.', objetivo: 'Clasificar el 90% de las cotizaciones en menos de una hora.',
    flujos: [{ id: 'a', concepto: 'Licencias y desarrollo', tipo: 'inversion', valores: [1200e6, 300e6, 0, 0, 0, 0] }, { id: 'b', concepto: 'Soporte y nube', tipo: 'costo', valores: [0, 120e6, 125e6, 130e6, 135e6, 140e6] },
      { id: 'c', concepto: 'Ahorro en horas de analistas', tipo: 'beneficio', categoria: 'ahorro', valores: [240e6, 400e6, 800e6, 900e6, 950e6, 1000e6] },
      { id: 'd', concepto: 'Ingresos por mayor conversión', tipo: 'beneficio', categoria: 'ingresos', valores: [120e6, 300e6, 450e6, 500e6, 520e6, 540e6] }],
    captado: [...meses([10e6, 12e6, 15e6, 16e6, 18e6, 20e6, 21e6, 19e6, 22e6, 24e6, 25e6], 'ahorro'), ...meses([0, 0, 4e6, 6e6, 8e6, 8e6, 9e6, 10e6, 11e6, 12e6, 12e6], 'ingresos')] });
  await caso(3, { estado: 'Aprobado', sponsor: 'Gerencia de cartera', anios: 4,
    problema: 'La cartera vencida se gestiona sin priorizar por probabilidad de pago.', objetivo: 'Subir el recaudo a tiempo en 8 puntos.',
    flujos: [{ id: 'a', concepto: 'Tablero y modelo', tipo: 'inversion', valores: [600e6] }, { id: 'b', concepto: 'Operación', tipo: 'costo', valores: [0, 80e6, 80e6, 80e6, 80e6] },
      { id: 'c', concepto: 'Mayor recaudo a tiempo', tipo: 'beneficio', categoria: 'ingresos', valores: [300e6, 520e6, 600e6, 650e6, 680e6] },
      { id: 'd', concepto: 'Menos horas de gestión', tipo: 'beneficio', categoria: 'tiempo', valores: [90e6, 120e6, 130e6, 140e6, 150e6] }],
    captado: [...meses([28e6, 30e6, 31e6, 33e6, 29e6, 34e6, 36e6, 35e6, 38e6, 40e6, 41e6], 'ingresos'), ...meses([7e6, 7e6, 8e6, 8e6, 8e6, 9e6, 9e6, 9e6, 10e6, 10e6, 10e6], 'tiempo')] });
  await caso(1, { estado: 'Borrador', anios: 5, problema: 'Los clientes llaman al centro de contacto para trámites que podrían hacer solos.',
    flujos: [{ id: 'a', concepto: 'Desarrollo del portal', tipo: 'inversion', valores: [900e6] }, { id: 'b', concepto: 'Operación', tipo: 'costo', valores: [0, 150e6, 150e6, 150e6, 150e6, 150e6] },
      { id: 'c', concepto: 'Eficiencia en el centro de contacto', tipo: 'beneficio', categoria: 'eficiencia', valores: [0, 120e6, 180e6, 220e6, 240e6, 260e6] }], captado: [] });
  // Agenda de comités
  const [c1, c2] = comites;
  const ses = x => store.insert('sessions', { id: id(), hora_ini: '09:30', hora_fin: '11:00', estado: 'Programada', lugar: '', enlace: '', temas: '', asistentes: '', decisiones: '', compromisos: [], titulo: '', ...meta, ...x });
  await ses({ comite_id: c1.id, fecha: f(7), proyectos: [ids[0], ids[1]], temas: '1. Avance del piloto\n2. Caso de negocio del portal', enlace: 'https://teams.microsoft.com/', compromisos: [{ texto: 'Enviar análisis de riesgos', responsable: 'Carlos Gómez', fecha: f(5), hecho: false }] });
  await ses({ comite_id: c2.id, fecha: f(14), hora_ini: '14:00', hora_fin: '15:30', proyectos: [ids[0], ids[3]], temas: `Aprobación de inversión ${Y + 1}` });
  await ses({ comite_id: c1.id, fecha: f(-7), estado: 'Realizada', proyectos: [ids[2]], decisiones: 'Se aprueba continuar con el piloto.', compromisos: [{ texto: 'Ajustar el cronograma del modelo', responsable: 'Ana Restrepo', fecha: f(-1), hecho: false }] });
  await ses({ comite_id: c1.id, fecha: f(21), proyectos: [ids[2]] });
  await store.setConfig('demo_cargada', { at: ahora });
  return { proyectos: ids.length };
}

module.exports = { cargar };
