// ============================================================
// PLANTILLAS DE PLAN DE TRABAJO
// Cada plantilla trae sus fases y actividades con responsable,
// entregable, duración en días hábiles y dependencias (por código).
// Al cargarla en un proyecto, las fechas se calculan en días hábiles
// (Colombia) desde la fecha de inicio que elijas: son una propuesta
// por validar, igual que en el Excel.
// ============================================================

const { habilDesde, finHabil, sumarDias, esHabil, festivosCO } = require('./calendario');

// ---------- Plantillas ----------
const PLANTILLAS = {
  'constitucion-sas': {
    key: 'constitucion-sas',
    nombre: 'Nueva SAS (capítulos Sociedad)',
    descripcion: 'Plan para constituir y poner en operación la nueva sociedad, con los capítulos y actividades de la matriz «Sociedad»: constitución legal, contabilidad, responsabilidades tributarias, facturación, recaudo, gastos, nómina, giro a socios, estados financieros y aprobación. Duraciones pensadas para cerrar a finales de noviembre.',
    // Capítulos y actividades tal cual la matriz «Asunto / Sociedad» (en su orden).
    // La etapa «0 · Arranque» va primero; todo lo demás arranca después de 0.2.
    fases: [
      {
        nombre: '0 · Arranque del proyecto',
        actividades: [
          { cod: '0.1', nombre: 'Kick off del proyecto', resp: ['Mauro Moron'], entregable: 'Equipo convocado, alcance y roles acordados', dur: 1 },
          { cod: '0.2', nombre: 'Construcción del cronograma', resp: ['Mauro Moron'], entregable: 'Cronograma con duraciones validadas por cada área', dur: 7, deps: ['0.1'] },
        ],
      },
      {
        nombre: 'Constitución Legal',
        actividades: [
          { cod: 'L1', nombre: 'Elaborar y registrar los estatutos ante Cámara de Comercio', resp: ['Jurídica'], entregable: 'Estatutos elaborados y registrados', dur: 8, deps: ['L8', 'L10', 'L11'] },
          { cod: 'L2', nombre: 'Suscribir el acta de constitución y realizar la inscripción mercantil', resp: ['Jurídica'], entregable: 'Acta firmada y matrícula mercantil', dur: 5, deps: ['L6', 'L7', 'L9'] },
          { cod: 'L3', nombre: 'Cumplir los acuerdos de accionistas (si los hay)', resp: ['Jurídica'], entregable: 'Acuerdos de accionistas formalizados', dur: 3, deps: ['L2'] },
          { cod: 'L4', nombre: 'Llevar libros sociales y de actas', resp: ['Jurídica'], entregable: 'Libros de actas y de accionistas inscritos', dur: 3, deps: ['L2'] },
          { cod: 'L5', nombre: 'Reportar información a entes de control (Cámara de Comercio, etc.)', resp: ['Jurídica'], entregable: 'Reportes definidos y calendario de entrega', dur: 3, deps: ['L2'] },
          { cod: 'L6', nombre: 'Escritura pública / gastos notariales y de registro', resp: ['Jurídica'], entregable: 'Escritura otorgada y gastos pagados', dur: 3, deps: ['L1'] },
          { cod: 'L7', nombre: 'Nombramiento del RL', resp: ['Jurídica'], entregable: 'Representante legal designado, con aceptación', dur: 3, deps: ['L8'] },
          { cod: 'L8', nombre: 'Definir tipo societario (SAS)', resp: ['Jurídica'], entregable: 'Tipo societario definido y sustentado', dur: 3, deps: ['0.2'] },
          { cod: 'L9', nombre: 'Definir Revisor Fiscal', resp: ['Contabilidad'], entregable: 'Revisor fiscal designado, con aceptación', dur: 4, deps: ['L8'] },
          { cod: 'L10', nombre: 'Definir Capital y Accionistas (previa aprobación de Junta)', resp: ['Jurídica', 'Tesorería'], entregable: 'Capital y accionistas aprobados por Junta', dur: 5, deps: ['L8', 'L11'] },
          { cod: 'L11', nombre: 'Validar Inversiones permitidas del Sindicado / Credicorp', resp: ['Tesorería'], entregable: 'Concepto de inversiones permitidas', dur: 4, deps: ['0.2'] },
        ],
      },
      {
        nombre: 'Obligación de llevar contabilidad',
        actividades: [
          { cod: 'C1', nombre: 'Solicitar la creación de la sociedad adicional en Oracle (ERP Financiero, Módulo de Activos Fijos, OF, CxP, CxC)', resp: ['Contabilidad', 'TI Oracle'], entregable: 'Sociedad creada y parametrizada en Oracle', dur: 5, deps: ['L2'] },
        ],
      },
      {
        nombre: 'Responsabilidades Tributarias',
        actividades: [
          { cod: 'T1', nombre: 'Inscripción en el RUT (reportando beneficiarios finales)', resp: ['Impuestos'], entregable: 'RUT y reporte de beneficiarios finales', dur: 3, deps: ['L2'] },
          { cod: 'T2', nombre: 'Responsable del impuesto de renta y complementarios', resp: ['Impuestos'], entregable: 'Responsabilidad registrada en el RUT', dur: 1, deps: ['T1'] },
          { cod: 'T3', nombre: 'Mensual o bimestral: Declaración de IVA, ReteICA y Retefuente', resp: ['Impuestos'], entregable: 'Periodicidad definida y calendario tributario', dur: 2, deps: ['T1'] },
          { cod: 'T4', nombre: 'Responsable del IVA', resp: ['Impuestos'], entregable: 'Responsabilidad registrada en el RUT', dur: 1, deps: ['T1'] },
          { cod: 'T5', nombre: 'Retención en la fuente', resp: ['Impuestos'], entregable: 'Agente de retención parametrizado', dur: 1, deps: ['T1'] },
          { cod: 'T6', nombre: 'ICA en el municipio donde ejerce su actividad', resp: ['Impuestos'], entregable: 'Inscripción de ICA en el municipio', dur: 3, deps: ['T1'] },
          { cod: 'T7', nombre: 'Presentar declaraciones tributarias y cumplir deberes formales', resp: ['Impuestos'], entregable: 'Procedimiento y responsables de las declaraciones', dur: 2, deps: ['T2', 'T3', 'T4', 'T5'] },
          { cod: 'T8', nombre: 'Generación de firmas digitales', resp: ['Impuestos'], entregable: 'Firmas electrónicas activas en la DIAN', dur: 2, deps: ['T1'] },
          { cod: 'T9', nombre: 'Impuesto al Patrimonio', resp: ['Impuestos'], entregable: 'Obligación evaluada y registrada', dur: 1, deps: ['T1'] },
        ],
      },
      {
        nombre: 'Facturación de los ingresos',
        actividades: [
          { cod: 'F1', nombre: 'Emisión de facturación electrónica desde la sociedad (resolución de facturación)', resp: ['Contabilidad', 'Impuestos'], entregable: 'Resolución de facturación y primera factura emitida', dur: 3, deps: ['T8', 'C1'] },
        ],
      },
      {
        nombre: 'Recaudo de los ingresos',
        actividades: [
          { cod: 'R1', nombre: 'Recaudo directo del 100% del ingreso, más IVA menos retenciones en la fuente efectuadas por clientes', resp: ['Tesorería'], entregable: 'Recaudo operando y conciliado', dur: 2, deps: ['F1'] },
        ],
      },
      {
        nombre: 'Reconocimiento de los gastos y retención de impuestos',
        actividades: [
          { cod: 'G1', nombre: 'Facturación a nombre de la sociedad y retención en la fuente efectuada por la misma', resp: ['Contabilidad'], entregable: 'Proveedores informados y retenciones parametrizadas', dur: 3, deps: ['C1', 'T5'] },
        ],
      },
      {
        nombre: 'Gastos de nómina',
        actividades: [
          { cod: 'N1', nombre: 'Contratación directa de la sociedad o a través de Amarilo con contrato de soporte administrativo', resp: ['Gestión Humana', 'Jurídica'], entregable: 'Esquema de nómina definido', dur: 5, deps: ['L2'] },
        ],
      },
      {
        nombre: 'Giro de recursos a Socios o Fideicomitentes',
        actividades: [
          { cod: 'S1', nombre: 'Préstamos a socios o pago de dividendos', resp: ['Tesorería', 'Jurídica'], entregable: 'Mecanismo de giro a socios definido', dur: 4, deps: ['L10'] },
        ],
      },
      {
        nombre: 'Estados Financieros',
        actividades: [
          { cod: 'E1', nombre: 'Preparación y presentación de los 4 Estados Financieros (Situación Financiera, Resultados, Flujo de Efectivo y Cambios en el Patrimonio)', resp: ['Contabilidad'], entregable: 'Esquema de preparación y presentación definido', dur: 3, deps: ['C1'] },
        ],
      },
      {
        nombre: 'Toma de decisiones y aprobación de EEFF',
        actividades: [
          { cod: 'D1', nombre: 'Junta Directiva y Asamblea de accionistas', resp: ['Junta Directiva', 'Asamblea de accionistas'], entregable: 'Instancias y calendario de aprobación de EEFF definidos', dur: 2, deps: ['E1'] },
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

// Calcula inicio y fin de cada actividad de la plantilla desde `inicio`,
// resolviendo las dependencias aunque aparezcan después en la lista.
function programar(plantilla, inicio) {
  const todas = {};
  plantilla.fases.forEach(f => f.actividades.forEach(a => { todas[a.cod] = a; }));
  const out = {};
  const base = habilDesde(inicio);
  const calc = (cod, pila) => {
    if (out[cod]) return out[cod];
    if (pila.has(cod) || !todas[cod]) return null; // ciclo o código inexistente
    pila.add(cod);
    const a = todas[cod];
    let desde = base;
    (a.deps || []).forEach(c => {
      const p = calc(c, pila);
      if (p) { const sig = sumarDias(p.fin, 1); if (sig > desde) desde = sig; }
    });
    const ini = habilDesde(aplicarAncla(desde, a.desde));
    out[cod] = { inicio: ini, fin: finHabil(ini, a.dur) };
    return out[cod];
  };
  Object.keys(todas).forEach(c => calc(c, new Set()));
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
