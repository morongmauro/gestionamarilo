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

  // Exportación HTML de Notion: una tabla; las celdas de selección múltiple traen un <span> por valor
  function parseHTML(txt) {
    const doc = new DOMParser().parseFromString(txt, 'text/html'), t = doc.querySelector('table'); if (!t) return [];
    const head = [...t.querySelectorAll('thead th')].map(th => th.textContent.replace(/\s+/g, ' ').trim());
    return [...t.querySelectorAll('tbody tr')].map(tr => {
      const tds = [...tr.querySelectorAll('td')];
      return Object.fromEntries(head.map((h, i) => { const td = tds[i]; if (!td) return [h, ''];
        const sv = td.querySelectorAll('.selected-value'); if (sv.length) return [h, [...sv].map(s => s.textContent.trim()).join(', ')];
        td.querySelectorAll('br').forEach(b => b.replaceWith('\n')); return [h, td.textContent.replace(/[ \t]+/g, ' ').trim()]; }));
    }).filter(r => Object.values(r).some(Boolean));
  }
  function analizar(txt) {
    const filas = /<table/i.test(txt) ? parseHTML(txt) : parseCSV(txt);
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

  /* ---------- comparar Notion con el sitio ---------- */
  const nombreN = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
  const CAMPOS = [['estado', 'Fase o estado'], ['ice_income', 'Income'], ['valor_crear', 'Valor a crear/capturar'], ['revision_dgv', '¿Revisión DGV?'], ['tipo_valor', 'Tipo de valor'], ['habilitadores', 'Habilitadores'], ['realizadores', 'Realizadores'], ['okrs', 'OKR']];
  const colDe = id => (id === 'estado' ? App.estadoCol() : App.S.columns.find(c => c.id === id));
  // Valor de Notion ya convertido a como lo guarda el sitio
  function valorN(id, raw) {
    if (raw == null || String(raw).trim() === '') return null;
    if (NUM.has(id)) return num(raw);
    if (PEOPLE.has(id)) return lista(raw);
    if (id === 'estado') return Fases.mapear(String(raw).replace(/\s+/g, ' ').trim());
    return String(raw).replace(/\s+/g, ' ').trim();
  }
  const vacio = v => v == null || v === '' || (Array.isArray(v) && !v.length);
  const igual = (id, a, b) => { if (id === 'revision_dgv') { const sn = x => (vacio(x) || /^no$/i.test(String(x).trim()) ? 'NO' : String(x).trim().toUpperCase()); return sn(a) === sn(b); }
    if (vacio(a) && vacio(b)) return true; if (vacio(a) || vacio(b)) return false;
    if (NUM.has(id)) return Math.abs(Number(a) - Number(b)) < 0.5;
    if (Array.isArray(a) || Array.isArray(b)) { const s = x => [].concat(x).map(nombreN).sort().join('|'); return s(a) === s(b); }
    return nombreN(a) === nombreN(b); };
  const verV = (id, v) => vacio(v) ? '—' : id === 'valor_crear' ? App.moneyShort(Number(v)) : Array.isArray(v) ? v.join(', ') : String(v).length > 60 ? String(v).slice(0, 60) + '…' : String(v);
  function comparar(an) {
    const tc = App.titleCol(), kN = Object.keys(an.mapeo).find(h => an.mapeo[h] === 'proyecto');
    const hDe = id => Object.keys(an.mapeo).find(h => an.mapeo[h] === id);
    const sitio = new Map(App.S.projects.filter(p => !App.esEjemplo(p)).map(p => [nombreN((p.props || {})[tc.id]), p]));
    const usados = new Set(), ambos = [], soloN = [];
    an.filas.forEach(f => {
      const k = nombreN(f[kN]); if (!k) return;
      let p = sitio.get(k);
      if (!p && k.length > 12) { for (const [kk, pp] of sitio) if (!usados.has(pp.id) && (kk.startsWith(k) || k.startsWith(kk))) { p = pp; break; } }
      const n = Object.fromEntries(CAMPOS.map(([id]) => [id, hDe(id) ? valorN(id, f[hDe(id)]) : null]));
      if (!p) { soloN.push({ nombre: f[kN], n }); return; }
      usados.add(p.id);
      const dif = [], llenar = {};
      CAMPOS.forEach(([id, lbl]) => { const c = colDe(id); if (!c || !hDe(id)) return; const s = (p.props || {})[c.id], v = n[id];
        if (!igual(id, s, v)) { dif.push({ id, lbl, s, v }); if (vacio(s) && !vacio(v)) llenar[c.id] = v; } });
      ambos.push({ p, nombre: f[kN], n, dif, llenar });
    });
    const soloS = App.S.projects.filter(p => !App.esEjemplo(p) && !usados.has(p.id));
    const vcN = an.filas.filter(f => { const h = hDe('revision_dgv'); return h && /^s[ií]$/i.test(String(f[h]).trim()); }).reduce((a, f) => a + (num(f[hDe('valor_crear')]) || 0), 0);
    const vcS = App.S.projects.filter(p => !App.esEjemplo(p) && App.enAlcance(p)).reduce((a, p) => a + (Number((p.props || {}).valor_crear) || 0), 0);
    return { ambos, soloN, soloS, vcN, vcS };
  }
  function informeHTML(r) {
    const conDif = r.ambos.filter(x => x.dif.length), nLlenar = r.ambos.reduce((a, x) => a + Object.keys(x.llenar).length, 0);
    const faltaS = p => { const v = p.props || {}; return [['ice_income', 'Income'], ['valor_crear', 'valor a crear'], ['tipo_valor', 'tipo de valor'], ['realizadores', 'realizadores']].filter(([id]) => { const c = colDe(id); return c && vacio(v[c.id]); }).map(z => z[1]); };
    return `<div class="nc">
      <p class="nc-res"><b>${r.ambos.length}</b> están en los dos · <b>${r.soloN.length}</b> solo en Notion · <b>${r.soloS.length}</b> solo en el sitio</p>
      <p class="nc-res">Valor a crear/capturar con «¿Revisión DGV?» en SI: Notion <b>${esc(App.moneyShort(r.vcN))}</b> · sitio (foco DGV) <b>${esc(App.moneyShort(r.vcS))}</b>${Math.abs(r.vcN - r.vcS) > 1e6 ? ' · <span class="crit">no coinciden</span>' : ' · <span class="good">coinciden</span>'}</p>
      ${App.canEdit() ? `<div class="nc-acc">${nLlenar ? `<button class="btn primary sm" data-nc="llenar">Completar en el sitio ${nLlenar} ${nLlenar === 1 ? 'dato vacío' : 'datos vacíos'}</button>` : ''}${r.soloN.length ? `<button class="btn sm" data-nc="crear">Crear las ${r.soloN.length} que solo están en Notion</button>` : ''}<span class="faint">Completar no cambia nada que ya tenga dato en el sitio.</span></div>` : ''}
      ${conDif.length ? `<h4>Diferencias (${conDif.length} iniciativas)</h4><div class="nc-tw"><table class="nc-t"><thead><tr><th>Iniciativa</th><th>Campo</th><th>En el sitio</th><th>En Notion</th></tr></thead><tbody>
        ${conDif.map(x => x.dif.map((d, i) => `<tr>${i ? '<td></td>' : `<td rowspan="1"><a href="#/proyectos/${x.p.id}/info">${esc(App.projectName(x.p))}</a></td>`}<td>${esc(d.lbl)}</td><td class="${vacio(d.s) ? 'faint' : ''}">${esc(verV(d.id, d.s))}</td><td>${esc(verV(d.id, d.v))}${vacio(d.s) && !vacio(d.v) ? ' <small class="good">se completa</small>' : ''}</td></tr>`).join('')).join('')}</tbody></table></div>` : ''}
      ${r.soloN.length ? `<h4>Solo en Notion (${r.soloN.length})</h4><div class="nc-l">${r.soloN.map(x => `<span>${esc(x.nombre)}${x.n.revision_dgv ? ` <small>DGV ${esc(x.n.revision_dgv)}</small>` : ''}${x.n.valor_crear ? ` <small>${esc(App.moneyShort(x.n.valor_crear))}</small>` : ''}</span>`).join('')}</div>` : ''}
      ${r.soloS.length ? `<h4>Solo en el sitio (${r.soloS.length}): les falta</h4><div class="nc-l">${r.soloS.map(p => { const f = faltaS(p); return `<a href="#/proyectos/${p.id}/info">${esc(App.projectName(p))}${f.length ? ` <small>${esc(f.join(', '))}</small>` : ' <small class="good">completa</small>'}</a>`; }).join('')}</div>` : ''}
    </div>`;
  }
  // Antes de escribir: que existan las columnas y las opciones de lo que se va a guardar
  async function asegurar(r) {
    const cols = App.S.columns, ids = new Set(CAMPOS.map(c => c[0]));
    COLS.forEach(([id, name, type, hidden]) => { if (ids.has(id) && !cols.find(x => x.id === id)) { const c = { id, name, type, width: type === 'text' ? 240 : 150 }; if (['select', 'multi', 'people'].includes(type)) c.options = []; if (hidden) c.hidden = true; cols.push(c); } });
    ['habilitadores', 'realizadores', 'okrs', 'tipo_valor'].forEach(id => { if (!cols.find(x => x.id === id)) cols.push({ id, name: { habilitadores: 'Habilitadores', realizadores: 'Realizadores', okrs: 'OKRS', tipo_valor: 'Tipo de valor' }[id], type: PEOPLE.has(id) ? 'people' : id === 'tipo_valor' ? 'select' : 'text', width: 180, options: [] }); });
    const vals = r.soloN.map(x => x.n).concat(r.ambos.map(x => x.n));
    CAMPOS.forEach(([id]) => { const c = colDe(id); if (!c || !['select', 'multi', 'people'].includes(c.type)) return; c.options = c.options || [];
      vals.concat(id === 'revision_dgv' ? [{ revision_dgv: 'NO' }] : []).forEach(v => [].concat(v[id] || []).forEach(name => { if (name && !c.options.some(o => o.name === name)) c.options.push({ name, color: c.type === 'people' ? 'azul' : App.COLORS[(c.options.length + 1) % App.COLORS.length] }); })); });
    await App.api('PUT', '/api/config/columnas', { columns: cols });
  }
  async function aplicar(r, que, onProgreso) {
    let n = 0; await asegurar(r);
    if (que === 'llenar') r.ambos.forEach(x => { x.llenar = {}; CAMPOS.forEach(([id]) => { const c = colDe(id); if (c && vacio((x.p.props || {})[c.id]) && !vacio(x.n[id])) x.llenar[c.id] = x.n[id]; }); });
    if (que === 'llenar') { const xs = r.ambos.filter(x => Object.keys(x.llenar).length); for (const x of xs) { await App.api('PATCH', '/api/projects/' + x.p.id, { props: x.llenar }); n++; if (onProgreso) onProgreso(n, xs.length); } }
    if (que === 'crear') { const tc = App.titleCol(); for (const x of r.soloN) { const props = { [tc.id]: x.nombre }; CAMPOS.forEach(([id]) => { const c = colDe(id); if (c && !vacio(x.n[id])) props[c.id] = x.n[id]; }); const cd = colDe('revision_dgv'); if (cd && vacio(x.n.revision_dgv)) props[cd.id] = 'NO'; /* vacío en Notion = fuera del foco, como en la cifra de la Oficina */ await App.api('POST', '/api/projects', { props }); n++; if (onProgreso) onProgreso(n, r.soloN.length); } }
    return n;
  }

  let ultimo = '';
  // Tarjeta de Administración
  function tarjeta() {
    const box = document.createElement('div'); box.className = 'card-box'; box.style.marginBottom = '16px';
    box.innerHTML = `<h3 style="font-size:14px;font-weight:800;margin-bottom:4px">Notion: comparar y completar</h3>
      <div class="muted" style="font-size:12.5px;margin-bottom:10px">Suba la tabla «ICE - Oficina de Generación de Valor» exportada de Notion (HTML o CSV). Primero ve qué coincide y qué no; después puede completar lo vacío o crear lo que falta. El botón de abajo reemplaza todo con Notion. Crea las columnas que falten y una iniciativa por fila; si ya existe una con el mismo nombre, la actualiza. No borra nada.</div>
      <input type="file" accept=".csv,text/csv,.html,text/html" data-nf style="font-size:13px"><div data-ncmp></div>
      <div data-nres style="margin-top:10px;font-size:13px">${ultimo ? `<span class="good">Última importación:</span> ${esc(ultimo)} · <a href="#/proyectos">Ver el portafolio →</a>` : ''}</div>`;
    let an = null;
    box.addEventListener('change', async e => {
      const f = e.target.files && e.target.files[0]; if (!f) return;
      const res = $('[data-nres]', box);
      try {
        an = analizar(await f.text());
        const cmp = comparar(an), bx = $('[data-ncmp]', box); bx.innerHTML = informeHTML(cmp);
        bx.onclick = ev => { const b = ev.target.closest('[data-nc]'); if (!b) return; const q = b.dataset.nc;
          if (q === 'crear' && !confirm(`¿Crear ${cmp.soloN.length} iniciativas que solo están en Notion? Las que no tengan «¿Revisión DGV?» en SI quedan como archivadas.`)) return;
          b.disabled = true; App.guard(async () => { const k = await aplicar(cmp, q, (i, t) => { b.textContent = `${i} de ${t}…`; }); App.toast(q === 'llenar' ? `${k} iniciativas completadas` : `${k} iniciativas creadas`); await App.reload(); }); };
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

  App.ImportarNotion = { parseCSV, parseHTML, analizar, importar, tarjeta, comparar };
})();
