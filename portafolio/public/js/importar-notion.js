/* ============================================================
   IMPORTAR DESDE NOTION · la tabla «ICE - Oficina de Generación de Valor»
   exportada como CSV. Desde Administración: eliges el archivo, ves el
   resumen e importas. Crea las columnas que falten y una iniciativa por
   fila; si ya existe una con el mismo nombre, la actualiza.
   ============================================================ */
'use strict';
(function () {
  const { $, esc } = App;

  // CSV con comillas, saltos de línea dentro de celdas y BOM
  function parseCSV(txt) {
    const rows = []; let row = [], cell = '', q = false;
    txt = txt.replace(/^﻿/, '');
    // Separador: coma, o punto y coma (Excel en español exporta así)
    const l0 = txt.split(/\r?\n/)[0] || '';
    const sep = (l0.match(/;/g) || []).length > (l0.match(/,/g) || []).length ? ';' : ',';
    for (let i = 0; i < txt.length; i++) {
      const c = txt[i];
      if (q) { if (c === '"') { if (txt[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
      else if (c === '"') q = true;
      else if (c === sep) { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && txt[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
      else cell += c;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    if (!rows.length) return [];
    const head = rows.shift().map(h => h.replace(/\s+/g, ' ').trim());
    return rows.filter(r => r.some(x => x.trim())).map(r => Object.fromEntries(head.map((h, i) => [h, (r[i] || '').trim()])));
  }
  // Números como los escribe Notion en Colombia: 1.234.567,89 · 1,5 (coma decimal) · 1,234,567.89 · 1234.5
  const num = s => {
    s = String(s || '').replace(/[^\d,.\-]/g, ''); if (!s) return null;
    if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
    else if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '');
    else if (/^-?\d+,\d+$/.test(s)) s = s.replace(',', '.');
    else if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
    const n = Number(s); return Number.isFinite(n) ? n : null;
  };
  const pct = s => { const n = num(s); return n == null ? null : n; };
  const lista = s => String(s || '').split(/[,;\n]/).map(x => x.trim()).filter(Boolean);
  // Columnas que se crean (id, nombre, tipo, oculta en la tabla)
  const COLS = [
    ['gerencia', 'Gerencia', 'select'], ['vp', 'Vicepresidencia', 'select'], ['cadena_valor', 'Cadena de valor', 'select', true],
    ['captura_creacion', 'Captura o creación', 'select', true], ['criterio', 'Criterio / costos', 'select', true], ['palanca', 'Palanca', 'select', true],
    ['revision_dgv', '¿Revisión DGV?', 'select', true],
    ['ice_income', 'Income', 'number'], ['ice_confianza', 'Confianza (%)', 'number'], ['ice_esfuerzo', 'Esfuerzo (%)', 'number'], ['ice_os', 'OS · objetivos del semestre', 'select'],
    ['valor_crear', 'Valor a crear/capturar (COP)', 'number'], ['pct_captura', '% Captura de valor', 'number', true], ['pct_okr', '% Cumplimiento OKRs', 'number', true],
    ['gastos', 'Gastos enero-agosto (COP)', 'number', true],
    ['objetivo_general', 'Objetivo general', 'text', true], ['meta', 'Meta (% o $)', 'text', true], ['linea_base_txt', 'Línea base', 'text', true],
    ['oe1', 'OE1', 'text', true], ['oe2', 'OE2', 'text', true], ['oe3', 'OE3', 'text', true], ['objetivos_semestre', 'Objetivos del semestre', 'text', true],
    ['comentarios', 'Comentarios', 'text', true], ['observacion', 'Observación', 'text', true], ['plan_trabajo', 'Plan de trabajo (enlace)', 'url', true],
  ];
  // Nombre de columna en el CSV → id interno (se busca sin tildes ni espacios)
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9%?/$()]/g, '');
  const MAPA = { iniciativa: 'proyecto', estado: 'estado', trazabilidad: 'trazabilidad', habilitadores: 'habilitadores', realizadores: 'realizadores', okrs: 'okrs', tipodevalor: 'tipo_valor',
    gerencia: 'gerencia', vp: 'vp', cadenadevalor: 'cadena_valor', 'captura/creacion': 'captura_creacion', 'criterio/costos': 'criterio', palanca: 'palanca', 'revisiondgv?': 'revision_dgv',
    income: 'ice_income', '%confidence': 'ice_confianza', confidence: 'ice_confianza', effort: 'ice_esfuerzo', '%effort': 'ice_esfuerzo', os: 'ice_os', 'valoracrear/capturar': 'valor_crear', '%capturadevalor': 'pct_captura', '%cumplimientookrs': 'pct_okr',
    gastoseneroagosto: 'gastos', objetivogeneral: 'objetivo_general', 'meta(%o$)': 'meta', lineabase: 'linea_base_txt', oe1: 'oe1', oe2: 'oe2', oe3: 'oe3', objetivosdelsemestre: 'objetivos_semestre',
    comentarios: 'comentarios', observacion: 'observacion', plandetrabajo: 'plan_trabajo' };
  const NUM = new Set(['ice_income', 'ice_confianza', 'ice_esfuerzo', 'valor_crear', 'pct_captura', 'pct_okr', 'gastos']);
  const PEOPLE = new Set(['habilitadores', 'realizadores']);
  const SELECT = new Set(['estado', 'tipo_valor', 'gerencia', 'vp', 'cadena_valor', 'captura_creacion', 'criterio', 'palanca', 'revision_dgv']);

  function analizar(txt) {
    const filas = parseCSV(txt);
    if (!filas.length) throw new Error('El archivo no tiene filas');
    const heads = Object.keys(filas[0]);
    const mapeo = {}; heads.forEach(h => { const id = MAPA[norm(h)]; if (id) mapeo[h] = id; });
    if (!Object.values(mapeo).includes('proyecto')) throw new Error('No encuentro la columna «Iniciativa». ¿Es la exportación de la tabla ICE de Notion?');
    return { filas, mapeo, sinMapear: heads.filter(h => !mapeo[h]) };
  }

  async function importar(an, onProgreso) {
    const tc = App.titleCol();
    const cols = App.S.columns;
    const ensureCol = (id, name, type, hidden) => { let c = cols.find(x => x.id === id); if (!c) { c = { id, name, type, width: type === 'text' ? 240 : 150 }; if (['select', 'multi', 'people'].includes(type)) c.options = []; if (hidden) c.hidden = true; cols.push(c); } return c; };
    const usados = new Set(Object.values(an.mapeo));
    COLS.forEach(([id, name, type, hidden]) => { if (usados.has(id)) ensureCol(id, name, type, hidden); });
    const ensureOpt = (c, name) => { c.options = c.options || []; if (name && !c.options.some(o => o.name === name)) c.options.push({ name, color: c.type === 'people' ? 'azul' : App.COLORS[(c.options.length + 1) % App.COLORS.length] }); };
    const docs = an.filas.map(f => {
      const props = {};
      for (const [h, id] of Object.entries(an.mapeo)) {
        const raw = f[h]; if (!raw) continue;
        const col = cols.find(c => c.id === id) || (id === 'proyecto' ? tc : null); if (!col) continue;
        if (NUM.has(id)) { const n = num(raw); if (n != null) props[col.id] = n; }
        else if (PEOPLE.has(id)) { const v = lista(raw); v.forEach(n => ensureOpt(col, n)); props[col.id] = v; }
        else if (id === 'ice_os') { // 0,75 / 1 / 1,25 → la opción de la columna
          const n = App.ICE.leeOS(raw); if (n == null) continue;
          const nom = { 0.75: '0,75 · No alineado', 1: '1 · Alineado', 1.25: '1,25 · Prioridad del semestre' }[n]; ensureOpt(col, nom); props[col.id] = nom;
        }
        else if (SELECT.has(id)) { let v = raw.replace(/\s+/g, ' ').trim(); if (id === 'estado') v = Fases.mapear(v); ensureOpt(col, v); props[col.id] = v; } // estados antiguos (L0…L4) → las 3 fases
        else props[col.id] = raw;
      }
      return props;
    }).filter(p => p[tc.id]);
    await App.api('PUT', '/api/config/columnas', { columns: cols });
    let n = 0, creados = 0, actualizados = 0;
    // Por nombre: los que ya existen se actualizan (también si el archivo repite un nombre)
    const porNombre = new Map(App.S.projects.map(p => [(p.props || {})[tc.id], p.id]));
    for (const props of docs) {
      const ya = porNombre.get(props[tc.id]);
      if (ya) { await App.api('PATCH', '/api/projects/' + ya, { props }); actualizados++; }
      else { const nuevo = await App.api('POST', '/api/projects', { props }); porNombre.set(props[tc.id], nuevo.id); creados++; }
      n++; if (onProgreso) onProgreso(n, docs.length);
    }
    return { creados, actualizados };
  }

  let ultimo = '';
  // Tarjeta de Administración
  function tarjeta() {
    const box = document.createElement('div'); box.className = 'card-box'; box.style.marginBottom = '16px';
    box.innerHTML = `<h3 style="font-size:14px;font-weight:800;margin-bottom:4px">Importar iniciativas desde Notion</h3>
      <div class="muted" style="font-size:12.5px;margin-bottom:10px">Exporta la tabla «ICE - Oficina de Generación de Valor» como CSV (Notion → ··· → Exportar → CSV) y súbela aquí. Crea las columnas que falten y una iniciativa por fila; si ya existe una con el mismo nombre, la actualiza. No borra nada.</div>
      <input type="file" accept=".csv,text/csv" data-nf style="font-size:13px">
      <div data-nres style="margin-top:10px;font-size:13px">${ultimo ? `<span class="good">Última importación:</span> ${esc(ultimo)} · <a href="#/proyectos">Ver el portafolio →</a>` : ''}</div>`;
    let an = null;
    box.addEventListener('change', async e => {
      const f = e.target.files && e.target.files[0]; if (!f) return;
      const res = $('[data-nres]', box);
      try {
        an = analizar(await f.text());
        const n = an.filas.length, est = {}; an.filas.forEach(r => { const k = Object.keys(an.mapeo).find(h => an.mapeo[h] === 'estado'); const v = k ? r[k] : ''; est[v || 'sin estado'] = (est[v || 'sin estado'] || 0) + 1; });
        res.innerHTML = `<b>${n} iniciativas</b> · ${Object.keys(an.mapeo).length} columnas reconocidas${an.sinMapear.length ? ` · sin usar: ${esc(an.sinMapear.join(', '))}` : ''}<div class="faint" style="margin:4px 0 8px">${esc(Object.entries(est).map(([k, v]) => `${k}: ${v}`).join(' · '))}</div><button class="btn amarillo" data-nok>Importar ${n} iniciativas</button>`;
      } catch (ex) { res.innerHTML = `<span class="crit">${esc(ex.message)}</span>`; }
    });
    box.addEventListener('click', e => {
      if (!e.target.closest('[data-nok]') || !an) return;
      const res = $('[data-nres]', box); const b = e.target.closest('[data-nok]'); b.disabled = true;
      App.guard(async () => {
        const r = await importar(an, (i, t) => { b.textContent = `Importando ${i} de ${t}…`; });
        ultimo = `${r.creados} creadas, ${r.actualizados} actualizadas · ${new Date().toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' })}`;
        App.toast(`Importación terminada: ${ultimo}`);
        await App.reload(); // vuelve a pintar Administración con el resultado
      }).then(() => { b.disabled = false; });
    });
    return box;
  }

  App.ImportarNotion = { parseCSV, analizar, importar, tarjeta };
})();
