/* ============================================================
   HOJA · cuadrícula tipo Excel para el flujo del caso de negocio
   - Flechas, Enter, Tab, Esc, F2 · Shift amplía la selección
   - Arrastrar con el mouse selecciona un rango
   - Ctrl+C / Ctrl+V con Excel (también tablas completas con encabezados)
   - Supr borra el rango · Ctrl+D llena hacia abajo · Ctrl+R hacia la derecha
   - Cuadrito azul: arrastrar para llenar (con 2+ celdas sigue la serie)
   - Ctrl+Z / Ctrl+Y deshacer y rehacer
   - En una celda: 1.250.000 · 1,2M · 300k · =150*12 · +5% (sobre el año anterior)
   ============================================================ */
'use strict';
(function () {
  const { $, $$, esc } = App;
  const MAXY = 15; // años máximos (sin contar el año 0)

  /* ---------- interpretar lo que se escribe ---------- */
  const SUF = s => { s = (s || '').toLowerCase(); return s === 'k' || s === 'mil' ? 1e3 : s ? 1e6 : 1; };
  function parseQty(s) {
    s = String(s == null ? '' : s).trim();
    if (!s) return 0;
    let neg = false;
    const par = /^\((.*)\)$/.exec(s); if (par) { neg = true; s = par[1].trim(); } // (1.200) = negativo, como en contabilidad
    const m = /^(-?)\s*(?:US\$|\$)?\s*(\d[\d.,]*)\s*(mm|mil|k|m)?$/i.exec(s.replace(/\s+/g, ' '));
    if (!m) return null;
    const v = App.parseNum(m[2]) * SUF(m[3]) * (m[1] ? -1 : 1);
    return Number.isFinite(v) ? (neg ? -v : v) : null;
  }
  // Calculadora segura (sin eval): + - * / ( ) % y sufijos k / M
  function evalExpr(src) {
    const toks = [];
    const re = /\s*(?:(\d[\d.,]*)\s*(mm|mil|k|m)?\s*(%)?|([-+*/()]))\s*/iy;
    let i = 0;
    while (i < src.length) {
      re.lastIndex = i; const m = re.exec(src);
      if (!m || !m[0].length) return null;
      i = re.lastIndex;
      if (m[1] !== undefined) { let v = App.parseNum(m[1]) * SUF(m[2]); if (m[3]) v /= 100; toks.push({ n: v }); }
      else toks.push({ o: m[4] });
    }
    let p = 0;
    const peek = () => toks[p], eat = () => toks[p++];
    const factor = () => { const t = eat(); if (!t) return null; if (t.n != null) return t.n;
      if (t.o === '-') { const v = factor(); return v == null ? null : -v; } if (t.o === '+') return factor();
      if (t.o === '(') { const v = expr(); const c = eat(); return c && c.o === ')' ? v : null; } return null; };
    const term = () => { let v = factor(); while (v != null && peek() && (peek().o === '*' || peek().o === '/')) { const o = eat().o, r = factor(); if (r == null || (o === '/' && r === 0)) return null; v = o === '*' ? v * r : v / r; } return v; };
    function expr() { let v = term(); while (v != null && peek() && (peek().o === '+' || peek().o === '-')) { const o = eat().o, r = term(); if (r == null) return null; v = o === '+' ? v + r : v - r; } return v; }
    const v = expr();
    return p === toks.length && v != null && Number.isFinite(v) ? v : null;
  }
  // texto de una celda → valor guardado (en pesos). prev = valor del año anterior
  function parseCell(txt, prev, escala) {
    const s = String(txt == null ? '' : txt).trim();
    if (!s) return 0;
    const g = /^([+-])\s*(\d+(?:[.,]\d+)?)\s*%$/.exec(s);
    if (g) { const p = Number(g[2].replace(',', '.')) / 100; return Math.round((prev || 0) * (1 + (g[1] === '-' ? -p : p))); }
    const v = s[0] === '=' ? evalExpr(s.slice(1)) : parseQty(s);
    return v == null ? null : Math.round(v * escala * 100) / 100;
  }

  /* ---------- la cuadrícula ---------- */
  // o: { rows, years (columnas de valores = años + 1), escala, anioInicio, ro, tipos, onLive, onCommit, onYears }
  function mount(el, o) {
    const rows = o.rows;
    const S = { undo: [], redo: [], sel: null, act: null, drag: false, fill: null, focusSnap: null };
    let nav = []; // índice en rows de cada fila visible, en orden
    const NC = () => o.years; // columnas de valores
    const dec = o.escala === 1 ? 0 : 2;
    const show = v => (v == null || v === 0 || v === '' ? '' : App.num(Number(v) / o.escala, dec));
    const val = (idx, t) => Number(((rows[idx] || {}).valores || [])[t]) || 0;
    const setVal = (idx, t, v) => { const r = rows[idx]; r.valores = r.valores || []; while (r.valores.length <= t) r.valores.push(0); r.valores[t] = v; };
    const snapshot = () => JSON.stringify(rows);
    const restore = json => { const a = JSON.parse(json); rows.length = 0; a.forEach(x => rows.push(x)); };
    const pushUndo = before => { S.undo.push(before); if (S.undo.length > 60) S.undo.shift(); S.redo = []; };
    const tdAt = (r, c) => $(`td[data-r="${r}"][data-c="${c}"]`, el);
    const inpAt = (r, c) => { const td = tdAt(r, c); return td && $('input', td); };
    const range = () => { const s = S.sel; return s ? { r0: Math.min(s.r0, s.r1), r1: Math.max(s.r0, s.r1), c0: Math.min(s.c0, s.c1), c1: Math.max(s.c0, s.c1) } : null; };
    const multi = () => { const g = range(); return g && (g.r0 !== g.r1 || g.c0 !== g.c1); };
    const yearLbl = t => `Año ${t}${o.anioInicio ? `<span class="yr">${o.anioInicio + t}</span>` : ''}`;

    function totalsHTML(src) {
      const f = Finanzas.calc({ anios: NC() - 1, flujos: src });
      const sum = a => a.reduce((x, y) => x + y, 0);
      const cells = a => a.map(v => `<td><span class="${v < 0 ? 'neg' : ''}">${esc(App.num(v / o.escala, dec))}</span></td>`).join('');
      const line = (lbl, a, cls, tot = true) => `<tr class="tot ${cls || ''}"><td>${lbl}</td>${cells(a)}<td>${tot ? `<span class="${sum(a) < 0 ? 'neg' : ''}">${esc(App.num(sum(a) / o.escala, dec))}</span>` : ''}</td><td></td></tr>`;
      return line('Inversión', f.inversion) + line('Costos', f.costos) + line('Beneficios', f.beneficios) + line('Flujo neto', f.netos, 'neto') + line('Acumulado', f.acumulado, '', false);
    }
    const rowTotal = idx => (rows[idx].valores || []).slice(0, NC()).reduce((a, b) => a + (Number(b) || 0), 0);

    function render() {
      nav = [];
      const head = `<tr><th>Concepto</th>${Array.from({ length: NC() }, (_, t) => `<th>${yearLbl(t)}</th>`).join('')}<th>Total</th><th></th></tr>`;
      const body = o.tipos.map(([tipo, lbl]) => {
        const idxs = rows.map((r, i) => (r.tipo === tipo ? i : -1)).filter(i => i >= 0);
        const trs = idxs.map(idx => {
          const r = nav.length; nav.push(idx);
          return `<tr data-row="${r}"><td data-r="${r}" data-c="0"><input class="cpt" value="${esc(rows[idx].concepto || '')}" placeholder="Concepto" spellcheck="false" ${o.ro ? 'readonly' : ''}></td>` +
            Array.from({ length: NC() }, (_, t) => `<td data-r="${r}" data-c="${t + 1}"><input value="${esc(show(val(idx, t)))}" inputmode="decimal" spellcheck="false" ${o.ro ? 'readonly' : ''}></td>`).join('') +
            `<td class="rt" data-rt="${idx}">${esc(App.num(rowTotal(idx) / o.escala, dec))}</td><td class="rm">${o.ro ? '' : `<button class="x" data-rowmenu="${idx}" title="Opciones de la fila" tabindex="-1">···</button>`}</td></tr>`;
        }).join('');
        return `<tr class="grp"><td colspan="${NC() + 3}">${lbl}${o.ro ? '' : `<button data-addrow="${tipo}" tabindex="-1">+ fila</button>`}</td></tr>${trs}`;
      }).join('');
      el.innerHTML = `<table class="flujo hoja"><thead>${head}</thead><tbody>${body}</tbody><tbody class="tots">${totalsHTML(rows)}</tbody></table><div class="fillh" hidden></div>`;
      paint();
    }
    function refreshTotals(src) {
      $('tbody.tots', el).innerHTML = totalsHTML(src || rows);
      (src || rows).forEach((r, idx) => { const td = $(`[data-rt="${idx}"]`, el); if (td) td.textContent = App.num((r.valores || []).slice(0, NC()).reduce((a, b) => a + (Number(b) || 0), 0) / o.escala, dec); });
    }
    function paint(preview) {
      $$('td.sel, td.act, td.fillp', el).forEach(td => td.classList.remove('sel', 'act', 'fillp'));
      const g = range(), fh = $('.fillh', el);
      if (!g) { if (fh) fh.hidden = true; return; }
      for (let r = g.r0; r <= g.r1; r++) for (let c = g.c0; c <= g.c1; c++) { const td = tdAt(r, c); if (td) td.classList.add('sel'); }
      if (S.act) { const td = tdAt(S.act.r, S.act.c); if (td) td.classList.add('act'); }
      if (preview) for (let r = preview.r0; r <= preview.r1; r++) for (let c = preview.c0; c <= preview.c1; c++) { const td = tdAt(r, c); if (td && !td.classList.contains('sel')) td.classList.add('fillp'); }
      // cuadrito de llenar en la esquina del rango
      const last = tdAt(g.r1, g.c1);
      if (fh && last && !o.ro) {
        const wr = el.getBoundingClientRect(), tr = last.getBoundingClientRect();
        fh.hidden = false; fh.style.left = (tr.right - wr.left + el.scrollLeft - 5) + 'px'; fh.style.top = (tr.bottom - wr.top + el.scrollTop - 5) + 'px';
      } else if (fh) fh.hidden = true;
    }
    function focusCell(r, c, keepSel) {
      r = Math.max(0, Math.min(nav.length - 1, r)); c = Math.max(0, Math.min(NC(), c));
      const inp = inpAt(r, c); if (!inp) return;
      S.act = { r, c }; if (!keepSel) S.sel = { r0: r, c0: c, r1: r, c1: c };
      S.keep = !!keepSel; inp.focus(); S.keep = false; S.focusSnap = inp.value; paint();
      inp.select();
      const td = inp.parentElement; const wrap = el; // que la celda quede a la vista
      const a = td.getBoundingClientRect(), w = wrap.getBoundingClientRect();
      if (a.right > w.right) wrap.scrollLeft += a.right - w.right + 8; else if (a.left < w.left + 200) wrap.scrollLeft -= (w.left + 200) - a.left;
    }
    function commitInput(inp, quiet) {
      if (o.ro || !inp) return true;
      const td = inp.parentElement, r = +td.dataset.r, c = +td.dataset.c, idx = nav[r];
      if (idx == null) return true;
      if (c === 0) { if ((rows[idx].concepto || '') !== inp.value) { const before = snapshot(); rows[idx].concepto = inp.value; finish(before); } return true; }
      const v = parseCell(inp.value, c > 1 ? val(idx, c - 2) : 0, o.escala);
      if (v == null) { if (!quiet) App.toast(`No entendí «${inp.value}». Escribe un número, 1,2M, 300k, =150*12 o +5%`, true); inp.value = show(val(idx, c - 1)); refreshTotals(); return false; }
      if (v !== val(idx, c - 1)) { const before = snapshot(); setVal(idx, c - 1, v); finish(before); }
      inp.value = show(val(idx, c - 1));
      return true;
    }
    function finish(before) { pushUndo(before); refreshTotals(); o.onCommit(rows); }
    function op(fn, rerender = true) {
      const act = document.activeElement; if (act && el.contains(act)) commitInput(act, true);
      const before = snapshot(); const r = fn(); if (r === false) return;
      if (snapshot() === before) return;
      pushUndo(before);
      if (rerender) { const a = S.act, s = S.sel; render(); S.act = a; S.sel = s; paint(); if (a) focusCell(a.r, a.c, true); } else refreshTotals();
      o.onCommit(rows);
    }
    function undo(redo) {
      const from = redo ? S.redo : S.undo, to = redo ? S.undo : S.redo;
      if (!from.length) return App.toast(redo ? 'Nada para rehacer' : 'Nada para deshacer');
      to.push(snapshot()); restore(from.pop());
      const a = S.act; render(); if (a) focusCell(Math.min(a.r, nav.length - 1), a.c); o.onCommit(rows);
    }

    /* ---------- operaciones de rango ---------- */
    const clearRange = () => op(() => { const g = range(); for (let r = g.r0; r <= g.r1; r++) for (let c = g.c0; c <= g.c1; c++) { const idx = nav[r]; if (c === 0) rows[idx].concepto = ''; else setVal(idx, c - 1, 0); } });
    const fillDown = () => op(() => { const g = range(); if (g.r0 === g.r1) return false; for (let c = g.c0; c <= g.c1; c++) for (let r = g.r0 + 1; r <= g.r1; r++) { if (c === 0) rows[nav[r]].concepto = rows[nav[g.r0]].concepto; else setVal(nav[r], c - 1, val(nav[g.r0], c - 1)); } });
    const fillRight = () => op(() => { const g = range(); const c0 = Math.max(1, g.c0); if (c0 >= g.c1) return false; for (let r = g.r0; r <= g.r1; r++) for (let c = c0 + 1; c <= g.c1; c++) setVal(nav[r], c - 1, val(nav[r], c0 - 1)); });
    function copyText() {
      const g = range(); const out = [];
      for (let r = g.r0; r <= g.r1; r++) {
        const line = [];
        for (let c = g.c0; c <= g.c1; c++) {
          if (c === 0) line.push(rows[nav[r]].concepto || '');
          else { const v = val(nav[r], c - 1) / o.escala; line.push(Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100).replace('.', ',')); }
        }
        out.push(line.join('\t'));
      }
      return out.join('\r\n');
    }
    function paste(text) {
      let lines = String(text).replace(/\r/g, '').split('\n');
      while (lines.length && lines.at(-1) === '') lines.pop();
      let grid = lines.map(l => l.split('\t'));
      if (!grid.length) return;
      const g = range(); let r0 = g.r0, c0 = g.c0;
      const isNum = s => parseQty(s) != null;
      // Un solo valor sobre varias celdas: las llena todas
      if (grid.length === 1 && grid[0].length === 1 && multi()) {
        return op(() => { for (let r = g.r0; r <= g.r1; r++) for (let c = g.c0; c <= g.c1; c++) { if (c === 0) rows[nav[r]].concepto = grid[0][0]; else { const v = parseCell(grid[0][0], c > 1 ? val(nav[r], c - 2) : 0, o.escala); if (v != null) setVal(nav[r], c - 1, v); } } });
      }
      // Tabla completa de Excel: se salta la fila de títulos y se toma la primera columna como concepto
      if (grid.length > 1 && grid[0].length > 1 && grid[0].every(s => !s.trim() || !isNum(s)) && grid.slice(1).some(l => l.slice(1).some(s => s.trim() && isNum(s)))) grid = grid.slice(1);
      if (c0 >= 1 && grid.every(l => l.length > 1 && l[0].trim() && !isNum(l[0]))) c0 = 0;
      const width = Math.max(...grid.map(l => l.length));
      const needYears = c0 + width - 1; // columnas de valores necesarias
      op(() => {
        const tipo = rows[nav[r0]].tipo;
        const groupIdx = rows.map((r, i) => (r.tipo === tipo ? i : -1)).filter(i => i >= 0);
        const start = groupIdx.indexOf(nav[r0]);
        grid.forEach((line, i) => {
          let idx = groupIdx[start + i];
          if (idx == null) { rows.push({ id: App.uid(), concepto: '', tipo, valores: [] }); idx = rows.length - 1; groupIdx.push(idx); }
          line.forEach((cell, j) => {
            const c = c0 + j;
            if (c === 0) { if (cell.trim()) rows[idx].concepto = cell.trim(); return; }
            if (c - 1 >= MAXY + 1) return;
            const v = parseCell(cell, c > 1 ? val(idx, c - 2) : 0, o.escala);
            if (v != null) setVal(idx, c - 1, v);
          });
        });
        S.sel = { r0, c0, r1: r0 + grid.length - 1, c1: c0 + width - 1 };
      });
      App.toast(`Pegado: ${grid.length} ${grid.length === 1 ? 'fila' : 'filas'} × ${width} ${width === 1 ? 'columna' : 'columnas'}`);
      if (needYears > NC()) o.onYears(Math.min(MAXY + 1, needYears));
    }
    function applyFill(target) {
      const g = range(); if (!target) return;
      const down = target.r > g.r1 && (target.r - g.r1) >= (target.c - g.c1);
      const right = !down && target.c > g.c1;
      if (!down && !right) return;
      op(() => {
        if (right) {
          const cS = Math.max(1, g.c0);
          for (let r = g.r0; r <= g.r1; r++) {
            const idx = nav[r], w = g.c1 - cS + 1;
            const last = val(idx, g.c1 - 1), step = w >= 2 ? last - val(idx, g.c1 - 2) : 0;
            for (let c = g.c1 + 1; c <= target.c; c++) setVal(idx, c - 1, w >= 2 ? last + step * (c - g.c1) : last);
          }
          S.sel = { r0: g.r0, c0: g.c0, r1: g.r1, c1: target.c };
        } else {
          const h = g.r1 - g.r0 + 1;
          for (let r = g.r1 + 1; r <= target.r; r++) {
            const src = nav[g.r0 + ((r - g.r1 - 1) % h)], idx = nav[r];
            for (let c = g.c0; c <= g.c1; c++) { if (c === 0) rows[idx].concepto = rows[src].concepto; else setVal(idx, c - 1, val(src, c - 1)); }
          }
          S.sel = { r0: g.r0, c0: g.c0, r1: target.r, c1: g.c1 };
        }
      });
    }

    /* ---------- menú de fila ---------- */
    function rowMenu(anchor, idx) {
      const r = rows[idx];
      App.menu(anchor, [
        { id: 'rep', label: '→ Repetir el primer valor en los años siguientes' },
        { id: 'crec', label: '↗ Crecer un % cada año' },
        { id: 'dist', label: '÷ Repartir un total entre varios años' },
        '-', { id: 'dup', label: '⧉ Duplicar fila' }, { id: 'up', label: '↑ Subir' }, { id: 'down', label: '↓ Bajar' },
        '-', { id: 'del', label: '🗑 Eliminar fila', danger: true }], m => {
        const first = () => { for (let t = 0; t < NC(); t++) if (val(idx, t)) return t; return -1; };
        if (m === 'rep') { const t0 = first(); if (t0 < 0) return App.toast('La fila no tiene valores', true); op(() => { for (let t = t0 + 1; t < NC(); t++) setVal(idx, t, val(idx, t0)); }); }
        if (m === 'crec' || m === 'dist') {
          const p = App.openPop(anchor, m === 'crec'
            ? `<div class="lbl">Crecimiento anual</div><div class="row" style="padding:0 4px"><input type="text" data-h="g" value="5" style="width:80px"><span class="hint" style="margin:0">% por año, desde el primer año con valor</span></div><div class="row" style="padding:4px"><button class="btn primary" data-h="ok">Aplicar</button></div>`
            : `<div class="lbl">Repartir un total</div><div class="row" style="padding:0 4px"><input type="text" data-h="tot" placeholder="Total, p. ej. 1.200M" style="flex:1"></div><div class="row" style="padding:0 4px"><span class="hint" style="margin:0">del año</span><input type="number" data-h="a" value="1" min="0" max="${NC() - 1}" style="width:64px"><span class="hint" style="margin:0">al año</span><input type="number" data-h="b" value="${NC() - 1}" min="0" max="${NC() - 1}" style="width:64px"></div><div class="row" style="padding:4px"><button class="btn primary" data-h="ok">Repartir en partes iguales</button></div>`, { width: 300 });
          p.onclick = e => {
            if (!e.target.closest('[data-h=ok]')) return;
            if (m === 'crec') {
              const g = Number(String($('[data-h=g]', p).value).replace(',', '.').replace('%', '')) / 100, t0 = first();
              if (!Number.isFinite(g)) return; if (t0 < 0) { App.closePop(true); return App.toast('La fila no tiene valores', true); }
              App.closePop(true); op(() => { for (let t = t0 + 1; t < NC(); t++) setVal(idx, t, Math.round(val(idx, t0) * Math.pow(1 + g, t - t0))); });
            } else {
              const tot = parseCell($('[data-h=tot]', p).value, 0, o.escala), a = Math.max(0, +$('[data-h=a]', p).value || 0), b = Math.min(NC() - 1, +$('[data-h=b]', p).value || 0);
              if (tot == null || b < a) return App.toast('Revisa el total y los años', true);
              App.closePop(true); op(() => { for (let t = 0; t < NC(); t++) setVal(idx, t, t >= a && t <= b ? Math.round(tot / (b - a + 1)) : val(idx, t)); });
            }
          };
        }
        if (m === 'dup') op(() => { rows.splice(idx + 1, 0, { ...JSON.parse(JSON.stringify(r)), id: App.uid(), concepto: (r.concepto || '') + ' (copia)' }); });
        if (m === 'up' || m === 'down') op(() => {
          const same = rows.map((x, i) => (x.tipo === r.tipo ? i : -1)).filter(i => i >= 0), k = same.indexOf(idx), j = same[m === 'up' ? k - 1 : k + 1];
          if (j == null) return false; [rows[idx], rows[j]] = [rows[j], rows[idx]];
        });
        if (m === 'del') { if ((r.valores || []).some(Number) && !confirm(`¿Eliminar la fila «${r.concepto || 'sin nombre'}»?`)) return; op(() => { rows.splice(idx, 1); }); S.sel = null; S.act = null; paint(); }
      }, 300);
    }

    /* ---------- eventos ---------- */
    // (focusin / focusout no existen como propiedad «on…» en Chrome: van con addEventListener)
    el.addEventListener('focusin', e => {
      const inp = e.target; if (inp.tagName !== 'INPUT' || !inp.parentElement.dataset.r) return;
      const td = inp.parentElement, r = +td.dataset.r, c = +td.dataset.c;
      S.act = { r, c };
      if (!S.keep && !S.drag) S.sel = { r0: r, c0: c, r1: r, c1: c };
      S.focusSnap = inp.value; inp.select(); paint();
    });
    el.addEventListener('focusout', e => { const inp = e.target; if (inp.tagName === 'INPUT' && inp.parentElement.dataset.r && el.contains(inp)) commitInput(inp); });
    el.oninput = e => {
      const inp = e.target; if (inp.tagName !== 'INPUT') return;
      const td = inp.parentElement, c = +td.dataset.c, idx = nav[+td.dataset.r];
      if (c === 0) return;
      const v = parseCell(inp.value, c > 1 ? val(idx, c - 2) : 0, o.escala);
      if (v == null) return;
      const tmp = JSON.parse(snapshot()); const rr = tmp[idx]; rr.valores = rr.valores || []; while (rr.valores.length <= c - 1) rr.valores.push(0); rr.valores[c - 1] = v;
      refreshTotals(tmp); o.onLive(tmp);
    };
    el.onmousedown = e => {
      if (e.target.closest('.fillh')) { e.preventDefault(); S.fill = { target: null }; return; }
      const td = e.target.closest('td[data-r]'); if (!td || e.button !== 0) return;
      const r = +td.dataset.r, c = +td.dataset.c;
      if (e.shiftKey && S.act) { e.preventDefault(); S.sel = { r0: S.act.r, c0: S.act.c, r1: r, c1: c }; paint(); return; }
      S.drag = true; S.sel = { r0: r, c0: c, r1: r, c1: c }; S.act = { r, c };
      // Primer clic: selecciona la celda entera (escribir la reemplaza). Si ya estaba activa, el clic pone el cursor para editar.
      if (!(e.target.tagName === 'INPUT' && document.activeElement === e.target)) { e.preventDefault(); focusCell(r, c); }
      paint();
    };
    el.onmouseover = e => {
      const td = e.target.closest('td[data-r]'); if (!td) return;
      const r = +td.dataset.r, c = +td.dataset.c;
      if (S.fill) {
        const g = range(); S.fill.target = { r, c };
        const down = r > g.r1 && (r - g.r1) >= (c - g.c1);
        paint(down ? { r0: g.r1 + 1, r1: r, c0: g.c0, c1: g.c1 } : c > g.c1 ? { r0: g.r0, r1: g.r1, c0: g.c1 + 1, c1: c } : null);
      } else if (S.drag && S.sel && (r !== S.sel.r1 || c !== S.sel.c1)) {
        S.sel.r1 = r; S.sel.c1 = c;
        if (document.activeElement && document.activeElement.setSelectionRange) { try { document.activeElement.setSelectionRange(0, 0); } catch {} }
        paint();
      }
    };
    const up = () => { if (S.fill) { const t = S.fill.target; S.fill = null; if (t) applyFill(t); else paint(); } S.drag = false; };
    document.addEventListener('mouseup', up);
    el.onkeydown = e => {
      const inp = e.target; if (inp.tagName !== 'INPUT' || !S.act) return;
      const k = e.key, ctrl = e.ctrlKey || e.metaKey;
      const all = inp.selectionStart === 0 && inp.selectionEnd === inp.value.length;
      const mv = (dr, dc) => {
        if (!commitInput(inp)) return;
        if (e.shiftKey) { const s = S.sel; s.r1 = Math.max(0, Math.min(nav.length - 1, s.r1 + dr)); s.c1 = Math.max(0, Math.min(NC(), s.c1 + dc)); paint(); }
        else focusCell(S.act.r + dr, S.act.c + dc);
      };
      if (ctrl && !e.shiftKey && (k === 'z' || k === 'Z')) { e.preventDefault(); commitInput(inp, true); return undo(false); }
      if (ctrl && (k === 'y' || k === 'Y' || (e.shiftKey && (k === 'z' || k === 'Z')))) { e.preventDefault(); return undo(true); }
      if (o.ro && !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'Enter'].includes(k) && !(ctrl && (k === 'c' || k === 'a'))) return;
      if (ctrl && (k === 'd' || k === 'D')) { e.preventDefault(); return fillDown(); }
      if (ctrl && (k === 'r' || k === 'R')) { e.preventDefault(); return fillRight(); }
      if (k === 'Escape') { if (inp.value !== S.focusSnap) { e.preventDefault(); e.stopPropagation(); inp.value = S.focusSnap; inp.select(); refreshTotals(); o.onLive(rows); } return; }
      if (k === 'F2') { e.preventDefault(); inp.setSelectionRange(inp.value.length, inp.value.length); return; }
      if (k === 'Enter') { e.preventDefault(); return mv(e.shiftKey ? -1 : 1, 0) || (e.shiftKey && (S.sel = { r0: S.act.r, c0: S.act.c, r1: S.act.r, c1: S.act.c })); }
      if (k === 'Tab') { e.preventDefault(); const s = e.shiftKey; if (!commitInput(inp)) return; return focusCell(S.act.r, S.act.c + (s ? -1 : 1)); }
      if (k === 'ArrowUp' || k === 'ArrowDown') { e.preventDefault(); return mv(k === 'ArrowUp' ? -1 : 1, 0); }
      if (k === 'ArrowLeft' || k === 'ArrowRight') {
        const left = k === 'ArrowLeft';
        if (e.shiftKey || all || (left && inp.selectionStart === 0 && inp.selectionEnd === 0) || (!left && inp.selectionStart === inp.value.length)) { e.preventDefault(); return mv(0, left ? -1 : 1); }
        return;
      }
      if ((k === 'Delete' || k === 'Backspace') && multi()) { e.preventDefault(); return clearRange(); }
      if (k === 'Delete' && all) { e.preventDefault(); inp.value = ''; commitInput(inp); return; }
    };
    el.oncopy = e => { if (!multi() && !(document.activeElement && document.activeElement.selectionStart === 0 && document.activeElement.selectionEnd === document.activeElement.value.length)) return; e.preventDefault(); e.clipboardData.setData('text/plain', copyText()); App.toast('Copiado: pégalo en Excel o en otra parte de la hoja'); };
    el.onpaste = e => {
      if (o.ro) return;
      const text = (e.clipboardData || window.clipboardData).getData('text');
      if (!text) return;
      if (!/[\t\n]/.test(text.replace(/\n$/, '')) && !multi()) return; // un valor en una celda: lo pega el navegador
      e.preventDefault(); paste(text);
    };
    el.onclick = e => {
      const add = e.target.closest('[data-addrow]');
      if (add) { op(() => { rows.push({ id: App.uid(), concepto: '', tipo: add.dataset.addrow, valores: [] }); }); const r = nav.indexOf(rows.length - 1); if (r >= 0) focusCell(r, 0); return; }
      const rm = e.target.closest('[data-rowmenu]'); if (rm) rowMenu(rm, +rm.dataset.rowmenu);
    };
    el.ondblclick = e => { const inp = e.target.closest('td[data-r] input'); if (inp && !o.ro) inp.setSelectionRange(inp.value.length, inp.value.length); };
    el.onscroll = () => paint();

    render();
    return {
      undo: () => undo(false), redo: () => undo(true),
      destroy: () => document.removeEventListener('mouseup', up),
      canUndo: () => S.undo.length > 0,
    };
  }

  App.Hoja = { mount, parseCell, evalExpr, parseQty, MAXY };
})();
