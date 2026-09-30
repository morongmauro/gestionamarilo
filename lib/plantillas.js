// ============================================================
// PLANTILLAS DE PLAN DE TRABAJO
// Cada plantilla trae sus fases y actividades con responsable,
// entregable, duración en días hábiles y dependencias (por código).
// Al cargarla en un proyecto, las fechas se calculan en días hábiles
// (Colombia) desde la fecha de inicio que elijas: son una propuesta
// por validar, igual que en el Excel.
// ============================================================

// ---------- Festivos de Colombia (Ley Emiliani) ----------
function isoUTC(d) { return d.toISOString().slice(0, 10); }
function fechaUTC(y, m, d) { return new Date(Date.UTC(y, m - 1, d, 12)); }

// Domingo de Pascua (algoritmo anónimo gregoriano)
function pascua(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
  return fechaUTC(y, mes, dia);
}
function mas(d, n) { const x = new Date(d); x.setUTCDate(x.getUTCDate() + n); return x; }
function alLunes(d) { const dow = d.getUTCDay(); return dow === 1 ? d : mas(d, (8 - dow) % 7); }

const cacheFestivos = {};
function festivosCO(y) {
  if (cacheFestivos[y]) return cacheFestivos[y];
  const p = pascua(y);
  const lista = [
    fechaUTC(y, 1, 1), fechaUTC(y, 5, 1), fechaUTC(y, 7, 20), fechaUTC(y, 8, 7),
    fechaUTC(y, 12, 8), fechaUTC(y, 12, 25),
    mas(p, -3), mas(p, -2),                          // Jueves y Viernes Santo
    alLunes(fechaUTC(y, 1, 6)), alLunes(fechaUTC(y, 3, 19)), alLunes(fechaUTC(y, 6, 29)),
    alLunes(fechaUTC(y, 8, 15)), alLunes(fechaUTC(y, 10, 12)), alLunes(fechaUTC(y, 11, 1)),
    alLunes(fechaUTC(y, 11, 11)),
    alLunes(mas(p, 39)), alLunes(mas(p, 60)), alLunes(mas(p, 68)), // Ascensión, Corpus, Sagrado Corazón
  ];
  cacheFestivos[y] = new Set(lista.map(isoUTC));
  return cacheFestivos[y];
}

function esHabil(iso) {
  const d = new Date(iso + 'T12:00:00Z');
  const dow = d.getUTCDay();
  if (dow === 0 || dow === 6) return false;
  return !festivosCO(d.getUTCFullYear()).has(iso);
}
function sumarDias(iso, n) { return isoUTC(mas(new Date(iso + 'T12:00:00Z'), n)); }
// Primer día hábil desde `iso` (incluido)
function habilDesde(iso) { let x = iso; while (!esHabil(x)) x = sumarDias(x, 1); return x; }
// Fin de una tarea de `dur` días hábiles que arranca en `inicio` (hábil)
function finHabil(inicio, dur) {
  let x = inicio, n = 1;
  while (n < Math.max(1, dur)) { x = sumarDias(x, 1); if (esHabil(x)) n++; }
  return x;
}

// ---------- Plantillas ----------
const PLANTILLAS = {
  'constitucion-sas': {
    key: 'constitucion-sas',
    nombre: 'Constitución nueva SAS',
    descripcion: 'Plan de trabajo para constituir y poner en operación una nueva sociedad (SAS): definiciones previas, constitución legal, registro tributario, montaje en Oracle, esquema administrativo y cumplimiento recurrente.',
    fases: [
      {
        nombre: 'Definiciones y aprobaciones previas',
        actividades: [
          { cod: '1.1', nombre: 'Definir tipo societario (SAS)', resp: ['Jurídica', 'Mauro Moron'], entregable: 'Tipo societario definido y sustentado', dur: 3 },
          { cod: '1.2', nombre: 'Validar inversiones permitidas del Sindicado / Credicorp', resp: ['Jurídica', 'Tesorería'], entregable: 'Concepto de inversiones permitidas', dur: 5 },
          { cod: '1.3', nombre: 'Definir capital y accionistas (previa aprobación de Junta)', resp: ['Mauro Moron', 'Jurídica'], entregable: 'Estructura de capital y accionistas aprobada por Junta', dur: 5, deps: ['1.1', '1.2'] },
          { cod: '1.4', nombre: 'Nombramiento del Representante Legal', resp: ['Jurídica'], entregable: 'RL principal y suplente designados, con aceptación', dur: 3, deps: ['1.3'] },
          { cod: '1.5', nombre: 'Definir Revisor Fiscal', resp: ['Contabilidad', 'Jurídica'], entregable: 'Revisor Fiscal designado, con carta de aceptación', dur: 5, deps: ['1.3'] },
        ],
      },
      {
        nombre: 'Constitución legal',
        actividades: [
          { cod: '2.1', nombre: 'Elaborar los estatutos de la sociedad', resp: ['Jurídica'], entregable: 'Estatutos: objeto, capital, órganos y facultades del RL', dur: 5, deps: ['1.3'] },
          { cod: '2.2', nombre: 'Suscribir el acta / documento de constitución', resp: ['Accionistas', 'Jurídica'], entregable: 'Documento de constitución firmado', dur: 2, deps: ['2.1', '1.4', '1.5'] },
          { cod: '2.3', nombre: 'Escritura pública, gastos notariales y de registro (si aplica)', resp: ['Jurídica'], entregable: 'Escritura otorgada y gastos pagados', dur: 3, deps: ['2.2'], notas: 'Aplica si hay aportes en especie (p. ej. inmuebles); si no, la SAS se constituye por documento privado.' },
          { cod: '2.4', nombre: 'Registrar estatutos e inscripción mercantil ante Cámara de Comercio', resp: ['Jurídica'], entregable: 'Certificado de existencia y representación legal', dur: 5, deps: ['2.3'] },
          { cod: '2.5', nombre: 'Inscribir y llevar libros sociales (actas y registro de accionistas)', resp: ['Jurídica'], entregable: 'Libros de actas y de accionistas inscritos', dur: 3, deps: ['2.4'] },
          { cod: '2.6', nombre: 'Formalizar y cumplir los acuerdos de accionistas (si los hay)', resp: ['Jurídica', 'Accionistas'], entregable: 'Acuerdo de accionistas firmado y depositado', dur: 5, deps: ['2.4'] },
        ],
      },
      {
        nombre: 'Registro tributario',
        actividades: [
          { cod: '3.1', nombre: 'Inscripción en el RUT reportando beneficiarios finales (RUB)', resp: ['Impuestos'], entregable: 'RUT definitivo y reporte RUB', dur: 3, deps: ['2.4'] },
          { cod: '3.2', nombre: 'Definir responsabilidades tributarias: renta, IVA, retención en la fuente e impuesto al patrimonio', resp: ['Impuestos'], entregable: 'Matriz de responsabilidades y calendario tributario', dur: 3, deps: ['3.1'] },
          { cod: '3.3', nombre: 'Generar firmas digitales (DIAN) del RL y del Revisor Fiscal', resp: ['Impuestos', 'Representante Legal'], entregable: 'Firmas electrónicas activas en la DIAN', dur: 3, deps: ['3.1'] },
          { cod: '3.4', nombre: 'Inscripción en ICA en el municipio donde ejerce su actividad', resp: ['Impuestos'], entregable: 'Registro de ICA en el municipio', dur: 5, deps: ['3.1'] },
          { cod: '3.5', nombre: 'Habilitar facturación electrónica y obtener resolución de numeración', resp: ['Impuestos', 'TI Oracle'], entregable: 'Resolución de facturación electrónica DIAN', dur: 5, deps: ['3.3'] },
        ],
      },
      {
        nombre: 'Montaje contable y operativo (Oracle)',
        actividades: [
          { cod: '4.1', nombre: 'Solicitar creación de la sociedad en Oracle (ERP Financiero, Activos Fijos, OF, CxP, CxC)', resp: ['Contabilidad', 'TI Oracle'], entregable: 'Sociedad creada y parametrizada en Oracle', dur: 10, deps: ['3.1'] },
          { cod: '4.2', nombre: 'Abrir cuenta bancaria de la sociedad para el recaudo', resp: ['Tesorería'], entregable: 'Cuenta bancaria activa a nombre de la sociedad', dur: 7, deps: ['3.1'] },
          { cod: '4.3', nombre: 'Emitir facturación electrónica desde la sociedad', resp: ['Contabilidad'], entregable: 'Primera factura electrónica emitida y validada por la DIAN', dur: 3, deps: ['3.5', '4.1'] },
          { cod: '4.4', nombre: 'Recaudo directo del 100% del ingreso (más IVA, menos retenciones de los clientes)', resp: ['Tesorería', 'Contabilidad'], entregable: 'Recaudo operando y conciliado', dur: 5, deps: ['4.2', '4.3'] },
          { cod: '4.5', nombre: 'Gastos facturados a nombre de la sociedad y retención en la fuente practicada por ella', resp: ['Contabilidad', 'Compras'], entregable: 'Proveedores informados y retenciones parametrizadas en CxP', dur: 5, deps: ['4.1'] },
        ],
      },
      {
        nombre: 'Esquema administrativo y de socios',
        actividades: [
          { cod: '5.1', nombre: 'Definir esquema de nómina: contratación directa o vía Amarilo con contrato de soporte administrativo', resp: ['Gestión Humana', 'Jurídica'], entregable: 'Esquema de nómina aprobado', dur: 5, deps: ['1.3'] },
          { cod: '5.2', nombre: 'Formalizar contrato de soporte administrativo con Amarilo (si aplica)', resp: ['Jurídica'], entregable: 'Contrato de soporte administrativo firmado', dur: 5, deps: ['5.1', '2.4'] },
          { cod: '5.3', nombre: 'Definir giro de recursos a socios o fideicomitentes (préstamos o pago de dividendos)', resp: ['Tesorería', 'Impuestos', 'Jurídica'], entregable: 'Política de giro a socios aprobada', dur: 5, deps: ['2.4'] },
        ],
      },
      {
        nombre: 'Cumplimiento recurrente y cierre',
        actividades: [
          { cod: '6.1', nombre: 'Primeras declaraciones de IVA, ReteICA y Retefuente (mensual o bimestral)', resp: ['Impuestos'], entregable: 'Declaraciones presentadas y pagadas', dur: 10, deps: ['3.2', '4.3'] },
          { cod: '6.2', nombre: 'Reportar información a entes de control (Cámara de Comercio, etc.)', resp: ['Jurídica', 'Contabilidad'], entregable: 'Reportes y renovación de matrícula al día', dur: 5, deps: ['2.5'] },
          { cod: '6.3', nombre: 'Preparar los 4 Estados Financieros (Situación Financiera, Resultados, Flujo de Efectivo, Cambios en el Patrimonio)', resp: ['Contabilidad', 'Revisor Fiscal'], entregable: 'EEFF con corte a 31-dic firmados por RL, contador y RF', dur: 25, deps: ['4.1'], desde: { mes: 1, dia: 2 } },
          { cod: '6.4', nombre: 'Aprobación de EEFF por Junta Directiva y Asamblea de accionistas', resp: ['Junta Directiva', 'Asamblea de accionistas'], entregable: 'Acta de asamblea ordinaria con EEFF aprobados', dur: 3, deps: ['6.3'] },
          { cod: '6.5', nombre: 'Declaración de renta y complementarios e impuesto al patrimonio', resp: ['Impuestos'], entregable: 'Declaraciones presentadas', dur: 10, deps: ['6.4'] },
        ],
      },
    ],
  },
};

// Si la actividad tiene ancla `desde` (p. ej. cierre anual en enero),
// no arranca antes de la siguiente ocurrencia de esa fecha.
function aplicarAncla(iso, desde) {
  if (!desde) return iso;
  const y = Number(iso.slice(0, 4));
  const mm = String(desde.mes).padStart(2, '0'), dd = String(desde.dia).padStart(2, '0');
  let ancla = `${y}-${mm}-${dd}`;
  if (ancla < iso) ancla = `${y + 1}-${mm}-${dd}`;
  return ancla;
}

// Calcula inicio y fin de cada actividad de la plantilla desde `inicio`
function programar(plantilla, inicio) {
  const out = {};
  const base = habilDesde(inicio);
  plantilla.fases.forEach(f => f.actividades.forEach(a => {
    let desde = base;
    (a.deps || []).forEach(c => {
      const p = out[c];
      if (p) { const sig = sumarDias(p.fin, 1); if (sig > desde) desde = sig; }
    });
    const ini = habilDesde(aplicarAncla(desde, a.desde));
    out[a.cod] = { inicio: ini, fin: finHabil(ini, a.dur) };
  }));
  return out;
}

function listarPlantillas() {
  return Object.values(PLANTILLAS).map(p => ({
    key: p.key,
    nombre: p.nombre,
    descripcion: p.descripcion,
    fases: p.fases.map(f => f.nombre),
    actividades: p.fases.reduce((s, f) => s + f.actividades.length, 0),
  }));
}

module.exports = { PLANTILLAS, listarPlantillas, programar, habilDesde, esHabil, festivosCO };
