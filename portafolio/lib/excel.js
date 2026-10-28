// ============================================================
// EXCEL DEL CASO DE NEGOCIO
// - leer(buffer): devuelve los valores de cada hoja (sin fórmulas, con su
//   resultado), para que el navegador arme la vista previa de importación.
// - exportar(caso, nombre): arma un .xlsx con el flujo año a año, totales e
//   indicadores con fórmulas de Excel (SUMA, VNA, TIR) y la narrativa.
//   El mismo archivo se puede editar en Excel y volver a subir.
// ============================================================
const ExcelJS = require('exceljs');
const Finanzas = require('../public/js/finanzas');

const MAX_FILAS = 400, MAX_COLS = 60, MAX_HOJAS = 20;
const TIPO_TXT = { inversion: 'Inversión', costo: 'Costo', beneficio: 'Beneficio' };
const SECCIONES = [
  ['problema', 'Problema u oportunidad'], ['objetivo', 'Objetivo'], ['alcance', 'Alcance'], ['fuera_alcance', 'Fuera de alcance'],
  ['beneficios_cual', 'Beneficios cualitativos'], ['riesgos', 'Riesgos'], ['supuestos', 'Supuestos'], ['recomendacion', 'Recomendación y decisión solicitada'],
];

function plano(v) {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'object') {
    if (v.error) return null;
    if ('result' in v) return plano(v.result);
    if (v.richText) return v.richText.map(t => t.text).join('');
    if ('text' in v) return String(v.text);
    if ('formula' in v || 'sharedFormula' in v) return null; // fórmula sin resultado guardado
    return null;
  }
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  return String(v).trim();
}

async function leer(buffer) {
  const wb = new ExcelJS.Workbook();
  try { await wb.xlsx.load(buffer); }
  catch { const e = new Error('No se pudo leer el archivo. Debe ser un Excel .xlsx (si es .xls, guárdalo como .xlsx).'); e.status = 400; throw e; }
  const hojas = [];
  for (const ws of wb.worksheets.slice(0, MAX_HOJAS)) {
    if (ws.state && ws.state !== 'visible') continue;
    const filas = [];
    const nr = Math.min(ws.rowCount, MAX_FILAS), nc = Math.min(ws.columnCount, MAX_COLS);
    for (let r = 1; r <= nr; r++) {
      const row = ws.getRow(r), fila = [];
      for (let c = 1; c <= nc; c++) fila.push(plano(row.getCell(c).value));
      while (fila.length && (fila.at(-1) == null || fila.at(-1) === '')) fila.pop();
      filas.push(fila);
    }
    while (filas.length && !filas.at(-1).length) filas.pop();
    hojas.push({ nombre: ws.name, filas });
  }
  return { hojas };
}

const colL = n => { let s = ''; n++; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }; // 0 → A

async function exportar(caso, nombreProyecto, plantilla) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Portafolio de proyectos';
  const anios = plantilla ? 10 : Math.max(1, Math.min(15, Math.round(caso.anios || 5)));
  const N = anios + 1, ini = caso.anio_inicio || null;
  const flujos = plantilla
    ? [{ tipo: 'inversion', concepto: 'Inversión inicial', valores: [] }, { tipo: 'costo', concepto: 'Costos de operación', valores: [] }, { tipo: 'beneficio', concepto: 'Beneficio esperado', valores: [] }]
    : ['inversion', 'costo', 'beneficio'].flatMap(t => (caso.flujos || []).filter(f => f.tipo === t));
  const f = Finanzas.calc(plantilla ? { anios, flujos } : caso);
  const fmt = '#,##0;[Red]-#,##0';
  const ws = wb.addWorksheet('Flujo', { views: [{ state: 'frozen', xSplit: 2, ySplit: 5 }] });
  ws.columns = [{ width: 13 }, { width: 34 }, ...Array.from({ length: N + 1 }, () => ({ width: 15 }))];

  ws.getCell('A1').value = plantilla ? 'Caso de negocio · plantilla' : `Caso de negocio · ${nombreProyecto}`;
  ws.getCell('A1').font = { bold: true, size: 14 };
  ws.getCell('A2').value = 'Tasa de descuento'; ws.getCell('C2').value = (caso.tasa ?? 12) / 100; ws.getCell('C2').numFmt = '0.0%';
  ws.getCell('D2').value = `Moneda: ${caso.moneda || 'COP'} · cifras en unidades (no en miles ni millones)`;
  ws.getCell('A3').value = plantilla ? 'Llena una fila por concepto. En «Tipo» escribe Inversión, Costo o Beneficio. Puedes agregar filas y años; luego súbelo en la app con «Subir Excel».' : 'Puedes editar este archivo en Excel y volver a subirlo en la app con «Subir Excel».';
  ws.getCell('A3').font = { italic: true, color: { argb: 'FF6E6858' } };

  const H = 5; // fila de encabezados
  const head = ['Tipo', 'Concepto', ...Array.from({ length: N }, (_, t) => (ini ? `Año ${t} (${ini + t})` : `Año ${t}`)), 'Total'];
  ws.getRow(H).values = head;
  ws.getRow(H).font = { bold: true }; ws.getRow(H).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4F2EC' } };
  const yc = t => colL(2 + t), last = colL(2 + N - 1), totCol = colL(2 + N);
  let r = H + 1;
  const first = r;
  for (const fl of flujos) {
    const row = ws.getRow(r);
    row.getCell(1).value = TIPO_TXT[fl.tipo] || 'Costo';
    row.getCell(2).value = fl.concepto || '';
    for (let t = 0; t < N; t++) { const v = Number((fl.valores || [])[t]) || 0; const cell = row.getCell(3 + t); cell.value = plantilla ? null : v; cell.numFmt = fmt; }
    const sum = (fl.valores || []).slice(0, N).reduce((a, b) => a + (Number(b) || 0), 0);
    row.getCell(3 + N).value = { formula: `SUM(${yc(0)}${r}:${last}${r})`, result: plantilla ? 0 : sum };
    row.getCell(3 + N).numFmt = fmt; row.getCell(3 + N).font = { bold: true };
    r++;
  }
  const lastData = Math.max(first, r - 1);
  r++;
  // Totales con fórmulas: si el comité cambia una cifra en Excel, todo se recalcula
  const rng = c => `${c}$${first}:${c}$${lastData}`;
  const tipoRng = `$A$${first}:$A$${lastData}`;
  const filaTot = (lbl, tipo, arr) => {
    const row = ws.getRow(r); row.getCell(2).value = lbl; row.getCell(2).font = { bold: true };
    for (let t = 0; t <= N; t++) { const c = t < N ? yc(t) : totCol; const res = t < N ? arr[t] : arr.reduce((a, b) => a + b, 0);
      row.getCell(3 + t).value = { formula: `SUMIF(${tipoRng},"${tipo}",${rng(c)})`, result: plantilla ? 0 : res }; row.getCell(3 + t).numFmt = fmt; }
    return r++;
  };
  const rInv = filaTot('Total inversión', TIPO_TXT.inversion, f.inversion);
  const rCos = filaTot('Total costos', TIPO_TXT.costo, f.costos);
  const rBen = filaTot('Total beneficios', TIPO_TXT.beneficio, f.beneficios);
  const rNet = r++; const rowN = ws.getRow(rNet); rowN.getCell(2).value = 'Flujo neto'; rowN.font = { bold: true };
  for (let t = 0; t <= N; t++) { const c = t < N ? yc(t) : totCol; const res = t < N ? f.netos[t] : f.netos.reduce((a, b) => a + b, 0);
    rowN.getCell(3 + t).value = { formula: `${c}${rBen}-${c}${rCos}-${c}${rInv}`, result: plantilla ? 0 : res }; rowN.getCell(3 + t).numFmt = fmt; }
  const rAcu = r++; const rowA = ws.getRow(rAcu); rowA.getCell(2).value = 'Acumulado';
  for (let t = 0; t < N; t++) { rowA.getCell(3 + t).value = { formula: t === 0 ? `${yc(0)}${rNet}` : `${yc(t - 1)}${rAcu}+${yc(t)}${rNet}`, result: plantilla ? 0 : f.acumulado[t] }; rowA.getCell(3 + t).numFmt = fmt; }
  r++;
  const kpi = (lbl, formula, result, numFmt) => { const row = ws.getRow(r++); row.getCell(2).value = lbl; row.getCell(2).font = { bold: true }; row.getCell(3).value = { formula, result: plantilla ? 0 : result }; row.getCell(3).numFmt = numFmt; row.getCell(3).font = { bold: true }; };
  kpi('VPN', `NPV($C$2,${yc(1)}${rNet}:${last}${rNet})+${yc(0)}${rNet}`, f.vpn ?? 0, fmt);
  kpi('TIR', `IFERROR(IRR(${yc(0)}${rNet}:${last}${rNet}),"")`, f.tir ?? '', '0.0%');

  // Hoja con la narrativa y los datos generales
  const ws2 = wb.addWorksheet('Caso');
  ws2.columns = [{ width: 34 }, { width: 100 }];
  const datos = [['Proyecto', plantilla ? '' : nombreProyecto], ['Estado', caso.estado || 'Borrador'], ['Sponsor', caso.sponsor || ''], ['Fecha de comité', caso.fecha_comite || ''],
    ['Moneda', caso.moneda || 'COP'], ['Tasa de descuento (%)', caso.tasa ?? 12], ['Horizonte (años)', anios], ['Año 0', ini || ''],
    ...SECCIONES.map(([k, l]) => [l, plantilla ? '' : caso[k] || ''])];
  datos.forEach(([k, v], i) => { const row = ws2.getRow(i + 1); row.getCell(1).value = k; row.getCell(1).font = { bold: true }; row.getCell(2).value = v; row.getCell(2).alignment = { wrapText: true, vertical: 'top' }; });
  return wb.xlsx.writeBuffer();
}

module.exports = { leer, exportar, SECCIONES };
