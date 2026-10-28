/* ============================================================
   IMPORTAR UN EXCEL AL CASO DE NEGOCIO
   Sube un .xlsx (o .csv), detecta años, conceptos y tipo de cada fila
   (inversión, costo, beneficio), descarta los totales y muestra una
   vista previa para corregir antes de traer los datos.
   Lee bien el Excel que descarga la propia app («Descargar Excel»).
   ============================================================ */
'use strict';
(function () {
  const { $, $$, esc } = App;
  const norm = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const numOf = v => (typeof v === 'number' ? v : typeof v === 'string' && /\d/.test(v) ? App.Hoja.parseQty(v) : null);
  const isText = v => typeof v === 'string' && v.trim() && numOf(v) == null;
  const TIPOS = [['inversion', 'Inversión'], ['costo', 'Costo'], ['beneficio', 'Beneficio']];

  function clasificar(s) {
    const n = norm(s);
    if (!n) return null;
    if (/invers|capex|implementac/.test(n)) return 'inversion';
    if (/benefic|ingreso|ahorro|venta|income|utilidad|eficienc|recaudo/.test(n)) return 'beneficio';
    if (/cost|gasto|opex|egreso|manten|operac|nomina|salari|licenc|soporte/.test(n)) return 'costo';
    return null;
  }
  const esTotal = s => /^(total|sub ?total|flujo|acumulad|vpn|van\b|tir\b|npv|irr|payback|roi\b|margen|neto)/.test(norm(s));
  function anioDe(v) {
    if (typeof v === 'number' && Number.isInteger(v) && v >= 1990 && v <= 2100) return { cal: v };
    const n = norm(v);
    let m = /^(?:ano|year|a|y)\s*(\d{1,2})\b(?:\s*\((\d{4})\))?/.exec(n);
    if (m) return { idx: +m[1], cal: m[2] ? +m[2] : null };
    m = /^((?:19|20)\d{2})$/.exec(n);
    return m ? { cal: +m[1] } : null;
  }

  // filas: matriz de valores de una hoja → propuesta de flujo
  function analizar(filas) {
    let hr = -1, cols = [];
    for (let r = 0; r < Math.min(25, filas.length); r++) {
      const hits = (filas[r] || []).map((v, c) => ({ c, a: anioDe(v) })).filter(x => x.a);
      if (hits.length >= 2) { hr = r; cols = hits; break; }
    }
    let anioCols, anioInicio = null;
    if (hr >= 0) {
      const conIdx = cols.every(x => x.a.idx != null);
      anioCols = cols.map((x, i) => ({ c: x.c, idx: conIdx ? x.a.idx : i }));
      const cal = cols.find(x => x.a.cal); if (cal) anioInicio = cal.a.cal - (conIdx ? cal.a.idx : cols.indexOf(cal));
    } else {
      const numCols = new Set();
      filas.forEach(f => { if ((f || []).filter(v => numOf(v) != null).length >= 2) f.forEach((v, c) => { if (numOf(v) != null) numCols.add(c); }); });
      anioCols = [...numCols].sort((a, b) => a - b).map((c, i) => ({ c, idx: i }));
    }
    if (!anioCols.length) return null;
    const minY = Math.min(...anioCols.map(x => x.c));
    const datos = filas.slice(hr + 1);
    const head = hr >= 0 ? filas[hr] || [] : [];
    let conceptCol = head.findIndex((v, c) => c < minY && /concepto|descripcion|rubro|item|cuenta|linea|nombre/.test(norm(v)));
    const tipoCol = head.findIndex(v => /^(tipo|categoria|clase)$/.test(norm(v)));
    if (conceptCol < 0) {
      let best = -1, bestN = 0;
      for (let c = 0; c < minY; c++) { if (c === tipoCol) continue; const n = datos.filter(f => isText((f || [])[c])).length; if (n > bestN) { best = c; bestN = n; } }
      conceptCol = best;
    }
    let seccion = null, invertidos = 0;
    const out = [];
    for (const f of datos) {
      const row = f || [];
      const concepto = conceptCol >= 0 ? String(row[conceptCol] ?? '').trim() : '';
      const vals = anioCols.map(x => numOf(row[x.c]));
      const tieneNum = vals.some(v => v != null);
      if (!tieneNum) { // título de sección: «Inversión», «Costos», «Beneficios»
        const t = row.find(isText); const k = clasificar(t); if (k) seccion = k; continue;
      }
      if (!concepto && vals.every(v => !v)) continue;
      // prioridad: columna «Tipo» → título de sección del Excel → palabras del concepto
      const tipo = (tipoCol >= 0 && clasificar(row[tipoCol])) || seccion || clasificar(concepto) || 'costo';
      const valores = [];
      anioCols.forEach((x, i) => { valores[x.idx] = vals[i] || 0; });
      for (let t = 0; t < valores.length; t++) valores[t] = valores[t] || 0;
      const total = esTotal(concepto);
      if (!total && tipo !== 'beneficio' && valores.reduce((a, b) => a + b, 0) < 0) { for (let t = 0; t < valores.length; t++) valores[t] = Math.abs(valores[t]); invertidos++; }
      out.push({ concepto: concepto || 'Sin nombre', tipo, categoria: tipo === 'beneficio' ? App.inferCat(concepto) : undefined, valores, incluir: !total, motivo: total ? 'Parece un total: no se trae' : '' });
    }
    const maxIdx = Math.max(...anioCols.map(x => x.idx));
    return { filas: out, anios: maxIdx, anioInicio, invertidos };
  }

  // hoja «Caso» (la que genera la app): narrativa y datos generales
  function leerCaso(filas) {
    const map = { estado: 'estado', sponsor: 'sponsor', 'fecha de comite': 'fecha_comite', moneda: 'moneda', 'tasa de descuento (%)': 'tasa', 'ano 0': 'anio_inicio',
      'problema u oportunidad': 'problema', objetivo: 'objetivo', alcance: 'alcance', 'fuera de alcance': 'fuera_alcance', 'beneficios cualitativos': 'beneficios_cual',
      riesgos: 'riesgos', supuestos: 'supuestos', 'recomendacion y decision solicitada': 'recomendacion' };
    const out = {};
    filas.forEach(f => { const k = map[norm((f || [])[0])]; const v = (f || [])[1]; if (k && v != null && v !== '') out[k] = k === 'tasa' || k === 'anio_inicio' ? Number(v) || null : String(v); });
    if (out.fecha_comite && !/^\d{4}-\d{2}-\d{2}$/.test(out.fecha_comite)) delete out.fecha_comite;
    return out;
  }

  function parseCSV(text) {
    const first = text.split(/\r?\n/)[0] || '';
    const sep = (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ';' : first.includes('\t') ? '\t' : ',';
    const rows = []; let row = [], cur = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
      else if (ch === '"') q = true;
      else if (ch === sep) { row.push(cur); cur = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; }
      else cur += ch;
    }
    if (cur || row.length) { row.push(cur); rows.push(row); }
    return rows.map(r => r.map(v => (v.trim() === '' ? null : v.trim())));
  }

  async function importar(file, caso, flActual, done) {
    if (file.size > 3 * 1024 * 1024) return App.toast('El archivo pasa de 3 MB', true);
    let hojas;
    try {
      if (/\.csv$/i.test(file.name)) hojas = [{ nombre: file.name, filas: parseCSV(await file.text()) }];
      else if (/\.xlsx$/i.test(file.name)) {
        const b64 = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(file); });
        App.toast('Leyendo el Excel…');
        hojas = (await App.api('POST', '/api/excel/leer', { archivo: b64 })).hojas;
      } else return App.toast('Sube un archivo .xlsx o .csv (si es .xls, guárdalo como .xlsx)', true);
    } catch (e) { return App.toast(e.message, true); }
    const candidatas = hojas.map(h => ({ h, a: analizar(h.filas) })).filter(x => x.a && x.a.filas.length);
    if (!candidatas.length) return App.toast('No encontré cifras por año en ese archivo. Revisa que tenga una fila de años (Año 0, Año 1… o 2026, 2027…) y una columna de conceptos.', true);
    // la hoja «Flujo» primero; si no, la que más filas trae
    candidatas.sort((x, y) => (norm(y.h.nombre) === 'flujo') - (norm(x.h.nombre) === 'flujo') || y.a.filas.length - x.a.filas.length);
    const hojaCaso = hojas.find(h => norm(h.nombre) === 'caso');
    const narrativa = hojaCaso ? leerCaso(hojaCaso.filas) : null;
    vistaPrevia(file.name, candidatas, narrativa, caso, flActual, done);
  }

  function vistaPrevia(nombre, candidatas, narrativa, caso, flActual, done) {
    let sel = 0, escala = 1, modo = flActual.some(f => (f.valores || []).some(Number)) ? 'reemplazar' : 'reemplazar', traerNarr = !!narrativa;
    const bg = document.createElement('div'); bg.className = 'modal-bg';
    document.body.appendChild(bg);
    const draw = () => {
      const a = candidatas[sel].a, N = a.anios + 1, vis = Math.min(N, 7);
      const incl = a.filas.filter(f => f.incluir).length;
      bg.innerHTML = `<div class="imp-card"><div class="imp-h"><h2>Importar desde Excel</h2><span class="faint">${esc(nombre)}</span><span class="sp"></span><button class="x" data-i="cerrar" title="Cerrar">✕</button></div>
        <div class="imp-opts">
          ${candidatas.length > 1 ? `<label>Hoja <select data-i="hoja">${candidatas.map((x, i) => `<option value="${i}" ${i === sel ? 'selected' : ''}>${esc(x.h.nombre)} (${x.a.filas.length} filas)</option>`).join('')}</select></label>` : ''}
          <label>Las cifras del Excel están en <select data-i="escala">${[[1, 'pesos (unidades)'], [1e3, 'miles'], [1e6, 'millones']].map(([v, l]) => `<option value="${v}" ${v === escala ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
          <label>Al importar <select data-i="modo"><option value="reemplazar" ${modo === 'reemplazar' ? 'selected' : ''}>reemplazar el flujo actual</option><option value="agregar" ${modo === 'agregar' ? 'selected' : ''}>agregar al flujo actual</option></select></label>
          ${narrativa ? `<label class="chk-l"><input type="checkbox" data-i="narr" ${traerNarr ? 'checked' : ''}> Traer también la narrativa y los datos (hoja «Caso»)</label>` : ''}
        </div>
        <div class="imp-info">Encontré <b>${a.filas.length} filas</b> con cifras para <b>${N} años</b> (año 0 a año ${a.anios})${a.anioInicio ? `, desde ${a.anioInicio}` : ''}. Revisa el tipo de cada fila; las de totales no se traen.${a.invertidos ? ` ${a.invertidos} costos o inversiones venían en negativo y se pasaron a positivo.` : ''}${a.anios > App.Hoja.MAXY ? ` Solo caben ${App.Hoja.MAXY} años: se cortan los demás.` : ''}</div>
        <div class="imp-tbl"><table class="lst"><thead><tr><th></th><th>Concepto</th><th>Tipo</th>${Array.from({ length: vis }, (_, t) => `<th class="n">Año ${t}</th>`).join('')}${N > vis ? '<th class="n">…</th>' : ''}<th class="n">Total</th></tr></thead><tbody>
          ${a.filas.map((f, i) => `<tr class="${f.incluir ? '' : 'off'}" title="${esc(f.motivo)}"><td><input type="checkbox" data-inc="${i}" ${f.incluir ? 'checked' : ''}></td><td><b>${esc(f.concepto)}</b>${f.motivo ? `<div class="faint" style="font-size:11px">${esc(f.motivo)}</div>` : ''}</td>
            <td><select data-tipo="${i}">${TIPOS.map(([k, l]) => `<option value="${k}" ${k === f.tipo ? 'selected' : ''}>${l}</option>`).join('')}</select></td>
            ${Array.from({ length: vis }, (_, t) => `<td class="n">${esc(App.num(f.valores[t] || 0, 2))}</td>`).join('')}${N > vis ? '<td class="n faint">…</td>' : ''}<td class="n"><b>${esc(App.num(f.valores.reduce((x, y) => x + y, 0), 2))}</b></td></tr>`).join('')}
        </tbody></table></div>
        <div class="imp-f"><button class="btn" data-i="cerrar">Cancelar</button><button class="btn primary" data-i="ok" ${incl ? '' : 'disabled'}>Importar ${incl} ${incl === 1 ? 'fila' : 'filas'}</button></div></div>`;
    };
    draw();
    bg.addEventListener('change', e => {
      const t = e.target, a = candidatas[sel].a;
      if (t.dataset.i === 'hoja') sel = +t.value;
      else if (t.dataset.i === 'escala') escala = +t.value;
      else if (t.dataset.i === 'modo') modo = t.value;
      else if (t.dataset.i === 'narr') traerNarr = t.checked;
      else if (t.dataset.inc != null) a.filas[+t.dataset.inc].incluir = t.checked;
      else if (t.dataset.tipo != null) a.filas[+t.dataset.tipo].tipo = t.value;
      draw();
    });
    bg.addEventListener('click', e => {
      const b = e.target.closest('[data-i]');
      if (e.target === bg || (b && b.dataset.i === 'cerrar')) return bg.remove();
      if (!b || b.dataset.i !== 'ok') return;
      const a = candidatas[sel].a, maxY = App.Hoja.MAXY;
      const nuevos = a.filas.filter(f => f.incluir).map(f => ({ id: App.uid(), concepto: f.concepto, tipo: f.tipo, ...(f.tipo === 'beneficio' ? { categoria: App.inferCat(f.concepto) } : {}), valores: f.valores.slice(0, maxY + 1).map(v => Math.round((v || 0) * escala * 100) / 100) }));
      if (modo === 'reemplazar' && flActual.some(f => (f.valores || []).some(Number)) && !confirm(`Se reemplazan las ${flActual.length} filas del flujo actual por las ${nuevos.length} del Excel. ¿Continuar?`)) return;
      const flujos = modo === 'reemplazar' ? nuevos : flActual.concat(nuevos);
      // horizonte: hasta el último año con alguna cifra
      let ult = 1; flujos.forEach(f => (f.valores || []).forEach((v, t) => { if (Number(v)) ult = Math.max(ult, t); }));
      const patch = { flujos, anios: Math.min(maxY, modo === 'agregar' ? Math.max(caso.anios || 1, ult) : ult) };
      if (a.anioInicio && (modo === 'reemplazar' || !caso.anio_inicio)) patch.anio_inicio = a.anioInicio;
      if (narrativa && traerNarr) Object.assign(patch, narrativa);
      bg.remove();
      App.patch('cases', caso.id, patch).then(() => { App.toast(`Importadas ${nuevos.length} filas desde Excel`); done(); }).catch(() => {});
    });
  }

  App.Caso.importar = importar;
  App.Caso._analizar = analizar; // para pruebas
})();
