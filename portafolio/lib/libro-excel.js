// ============================================================
// LIBRO DEL CASO <-> EXCEL
// leer(buffer): toma un Excel del caso de negocio con sus hojas, fórmulas y
// formatos, y lo convierte en el «libro» del sitio (public/js/libro.js).
// - Título, secciones (franjas oscuras), encabezados (amarillo) y totales
//   (gris o negrita) se reconocen por su formato.
// - La hoja «Consideraciones» pasa al texto de consideraciones del caso.
// - La hoja del flujo (la que tiene «Año 1, Año 2…») marca qué filas son
//   ingresos, gastos e inversión para el resto del sitio.
// exportar(libro): el mismo libro de vuelta a Excel, con fórmulas.
// ============================================================
const ExcelJS = require('exceljs');
const Libro = require('../public/js/libro');

const argb = c => (c && c.argb ? String(c.argb).toUpperCase().slice(-6) : null);
const relleno = cell => { const f = cell.fill; if (!f || f.type !== 'pattern' || f.pattern === 'none') return null; const c = f.fgColor || {}; return argb(c) || (c.theme != null ? 'TEMA' + c.theme : 'X'); };
const oscuro = h => { if (!h) return false; if (/^TEMA/.test(h)) return true; const n = parseInt(h, 16); if (isNaN(n)) return false; const r = n >> 16, g = (n >> 8) & 255, b = n & 255; return (r * 299 + g * 587 + b * 114) / 1000 < 90; };
const amarillo = h => { if (!h || /^TEMA/.test(h)) return false; const n = parseInt(h, 16); const r = n >> 16, g = (n >> 8) & 255, b = n & 255; return r > 200 && g > 150 && b < 100; };
const grisClaro = h => { if (!h || /^TEMA/.test(h)) return false; const n = parseInt(h, 16); const r = n >> 16, g = (n >> 8) & 255, b = n & 255; return r > 225 && g > 225 && b > 225 && !(r === 255 && g === 255 && b === 255); };
const formatoDe = f => (!f || f === 'General' ? null : /%/.test(f) ? 'pct' : /\$|COP/.test(f) ? 'cop' : /[#0]/.test(f) ? 'num' : null);

function valorDe(cell) {
  // en celdas combinadas, el valor va solo en la primera (las demás quedan vacías, como se ven en Excel)
  if (cell.isMerged && cell.master && cell.master.address !== cell.address) return '';
  const v = cell.value;
  if (v == null) return '';
  if (typeof v === 'object') {
    if (v.formula || v.sharedFormula) { const f = cell.formula || v.formula; return f ? '=' + f : (v.result != null ? v.result : ''); }
    if (v.richText) return v.richText.map(x => x.text).join('');
    if (v.text) return String(v.text);
    if (v.result != null) return v.result;
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    return '';
  }
  return v;
}

async function leer(buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const hojas = [], resultados = {};
  let consideraciones = '';
  wb.eachSheet(ws => {
    const nombre = ws.name;
    if (/consideraci/i.test(nombre)) { // texto: título por línea y viñetas
      const lineas = [];
      ws.eachRow({ includeEmpty: true }, row => { const t = []; row.eachCell(c => { const x = valorDe(c); if (x !== '' && x != null) t.push(String(x)); }); lineas.push(t.join(' ').replace(/^•\s*/, '• ')); });
      consideraciones = lineas.join('\n').replace(/\n{3,}/g, '\n\n').trim();
      return;
    }
    const nCols = Math.min(ws.columnCount || 0, 40), nFilas = Math.min(ws.rowCount || 0, 600);
    const filas = [], res = [];
    for (let r = 1; r <= nFilas; r++) {
      const row = ws.getRow(r), c = [], rr = [];
      let primera = null, num = null, hayTexto = false, hayNum = false;
      for (let k = 1; k <= nCols; k++) {
        const cell = row.getCell(k); let v = valorDe(cell);
        if (typeof v === 'number') v = Math.round(v * 1e9) / 1e9;
        c.push(v === undefined ? '' : v);
        const raw = cell.value; rr.push(raw && typeof raw === 'object' && 'result' in raw ? raw.result : typeof raw === 'object' ? null : raw);
        if (typeof v === 'string' && !v.trim()) { c[c.length - 1] = ''; v = ''; }
        if (v !== '' && v != null) { if (!primera) primera = cell; if (typeof v === 'number' || (typeof v === 'string' && v[0] === '=')) { hayNum = true; if (!num) num = cell; } else hayTexto = true; }
      }
      while (c.length && (c[c.length - 1] === '' || c[c.length - 1] == null)) c.pop();
      if (!c.length) { filas.push({ t: 'vacia', c: [] }); res.push([]); continue; }
      const fl = relleno(primera), negrita = !!(primera.font && primera.font.bold);
      let t = 'dato';
      if (!filas.some(f => f.t !== 'vacia') && negrita && !hayNum) t = 'titulo';
      else if (amarillo(fl)) t = 'encab';
      else if (grisClaro(fl) && hayNum) t = 'total';
      else if (oscuro(fl) && !hayNum) t = 'seccion';
      else if (negrita && !hayNum && hayTexto && String(primera.value || '').toUpperCase() === String(primera.value || '')) t = 'seccion';
      else if (negrita && hayNum) t = 'total';
      const f = { t, c };
      const n = num ? formatoDe(num.numFmt) : null; if (n) f.n = n;
      filas.push(f); res.push(rr);
    }
    while (filas.length && filas[filas.length - 1].t === 'vacia') { filas.pop(); res.pop(); }
    const anchos = []; for (let k = 1; k <= nCols; k++) { const w = ws.getColumn(k).width; anchos.push(Math.round(Math.max(60, Math.min(420, (w || 10) * 7.2)))); }
    hojas.push({ nombre, filas, anchos });
    resultados[nombre] = res;
  });
  if (!hojas.length) throw new Error('El archivo no tiene hojas con datos');
  const libro = { v: 1, hojas };
  marcarFlujo(libro);
  return { libro, consideraciones, resultados };
}

// La hoja del flujo: la que tiene un encabezado «Año 1, Año 2…». Sus filas de datos se marcan según la sección:
// ingresos → ingreso; gastos → gasto; «aporte de capital» o «inversión inicial» → inversión; el impuesto de renta → gasto.
function marcarFlujo(libro) {
  // la fila de encabezado con más años seguidos («Año 1, Año 2…» o 2026, 2027…)
  let h = -1, fila = -1, col0 = 1, anios = 0;
  libro.hojas.forEach((hj, i) => hj.filas.forEach((f, r) => {
    const k = f.c.findIndex(x => /^a[nñ]o\s*1\b/i.test(String(x).trim()));
    if (k < 0) return;
    let n = 0; while (k + n < f.c.length && /^a[nñ]o\s*\d+/i.test(String(f.c[k + n]).trim())) n++;
    if (n > anios) { h = i; fila = r; col0 = k; anios = n; }
  }));
  if (h < 0) return;
  let sec = '';
  libro.hojas[h].filas.forEach((f, r) => {
    if (r <= fila) return;
    if (f.t === 'seccion') { sec = String(f.c.find(x => x !== '') || '').toLowerCase(); return; }
    if (f.t !== 'dato') return;
    const nom = String(f.c[0] || '').toLowerCase();
    if (/aporte de capital|inversi[oó]n inicial|capex|capital inicial/.test(nom)) f.rol = 'inversion';
    else if (/impuesto de renta/.test(nom)) f.rol = 'costo';
    else if (/flujo de caja|acumulad|neto/.test(sec) || /neto|acumulad/.test(nom)) return;
    else if (/ingreso|ahorro|beneficio/.test(sec)) f.rol = 'beneficio';
    else if (/gasto|costo/.test(sec)) f.rol = 'costo';
  });
  libro.flujo = { hoja: h, col0, anios: anios || 10, colNombre: 0 };
}

async function exportar(libro, titulo) {
  const wb = new ExcelJS.Workbook(); wb.creator = 'Portafolio de Generación de Valor';
  const E = Libro.crear(libro);
  libro.hojas.forEach((h, hi) => {
    const ws = wb.addWorksheet(String(h.nombre || 'Hoja').slice(0, 31));
    (h.anchos || []).forEach((w, k) => { ws.getColumn(k + 1).width = Math.max(8, Math.round(w / 7.2)); });
    h.filas.forEach((f, r) => {
      const row = ws.getRow(r + 1);
      (f.c || []).forEach((v, k) => {
        const cell = row.getCell(k + 1);
        if (typeof v === 'string' && v[0] === '=') { const res = E.val(hi, r, k); cell.value = { formula: v.slice(1), result: typeof res === 'number' || typeof res === 'string' ? res : undefined }; }
        else cell.value = v === '' ? null : v;
        if (f.n === 'pct') cell.numFmt = '0.00%'; else if (f.n === 'cop') cell.numFmt = '"$"#,##0;[Red]\\("$"#,##0\\);"-"'; else if (f.n === 'num') cell.numFmt = '#,##0.##';
        const osc = f.t === 'titulo' || f.t === 'seccion';
        if (osc) { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF160B29' } }; cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }; }
        if (f.t === 'encab') { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC900' } }; cell.font = { bold: true }; }
        if (f.t === 'total') { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } }; cell.font = { bold: true }; }
      });
    });
  });
  return wb.xlsx.writeBuffer();
}

module.exports = { leer, exportar, marcarFlujo };
