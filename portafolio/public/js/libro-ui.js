/* ============================================================
   LIBRO EN PANTALLA: la hoja del caso como en Excel
   - Barra de fórmulas arriba (celda y su contenido), letras de columna y
     números de fila suaves, para escribir fórmulas como en Excel.
   - Clic: elige la celda. Doble clic, Enter o empezar a escribir: edita.
     Flechas, Tab, Enter, Esc, Supr; Ctrl+Z / Ctrl+Y.
   - Clic derecho (o el «+» al lado del número de fila): insertar fila arriba
     o abajo, columna a la izquierda o derecha, borrar, mover, copiar la
     fórmula a la derecha, tipo de fila, formato y si cuenta en el flujo.
   - Arrastrar el número de la fila la mueve; las fórmulas la siguen.
   ============================================================ */
'use strict';
(function () {
  const { $, esc } = App, L = App.Libro;
  const TIPOS_FILA = [['titulo', 'Título'], ['seccion', 'Sección'], ['encab', 'Encabezado de columnas'], ['dato', 'Dato'], ['total', 'Total'], ['vacia', 'Espacio']];
  const FORMATOS = [['cop', 'Pesos'], ['pct', 'Porcentaje'], ['num', 'Número'], ['', 'Texto o general']];
  const ROLES = [['beneficio', 'Ingreso o ahorro'], ['costo', 'Gasto'], ['inversion', 'Inversión'], ['', 'No cuenta en el flujo']];

  function ver(v, n) {
    if (v == null || v === '') return '';
    if (typeof v === 'boolean') return v ? 'VERDADERO' : 'FALSO';
    if (typeof v !== 'number') return String(v);
    if (n === 'pct') return App.num(v * 100, Math.abs(v * 100) < 1 && v !== 0 ? 2 : (Math.round(v * 1000) % 10 ? 2 : 1)).replace(/,0+$/, '') + ' %';
    if (n === 'cop') return (v < 0 ? '-$' : '$') + App.num(Math.round(Math.abs(v)), 0);
    return App.num(v, Math.round(v) === v ? 0 : 2);
  }
  // Lo que se escribe en una celda: fórmula, número (es-CO), porcentaje o texto
  function leer(txt, n) {
    const s = String(txt == null ? '' : txt).trim();
    if (!s) return '';
    if (s[0] === '=') return s;
    const pc = /^(-?[\d.,]+)\s*%$/.exec(s); if (pc) { const x = App.parseNum(pc[1]); if (Number.isFinite(x)) return x / 100; }
    const limpio = s.replace(/^\$\s*|\s*COP$/gi, '').replace(/^-\$/, '-');
    if (/^-?[\d.,]+$/.test(limpio)) { const x = App.parseNum(limpio); if (Number.isFinite(x)) return n === 'pct' && Math.abs(x) >= 1 ? x / 100 : x; }
    return s;
  }

  function montar(el, o) {
    // o: { libro, hoja (índice), ro, onChange(libro), onHoja(i) }
    const S = { h: o.hoja || 0, sel: { r: 0, c: 0 }, edit: null, undo: [], redo: [], arr: null, arrC: null, entera: null };
    const lib = o.libro;
    const hoja = () => lib.hojas[S.h];
    const nCols = () => Math.max(4, ...hoja().filas.map(f => (f.c || []).length)) + 1;
    let E = L.crear(lib);
    const recalc = () => { E = L.crear(lib); };
    const snap = () => JSON.stringify(lib);
    const cambio = antes => { S.undo.push(antes); if (S.undo.length > 80) S.undo.shift(); S.redo = []; recalc(); pintar(); o.onChange && o.onChange(lib); };
    const restaurar = j => { const x = JSON.parse(j); lib.hojas = x.hojas; lib.flujo = x.flujo; recalc(); pintar(); o.onChange && o.onChange(lib); };
    const raw = (r, c) => { const f = hoja().filas[r]; return f && f.c ? f.c[c] : undefined; };
    const fijar = (r, c, v) => { const f = hoja().filas[r]; if (!f) return; f.c = f.c || []; while (f.c.length <= c) f.c.push(''); f.c[c] = v; while (f.c.length && (f.c[f.c.length - 1] === '' || f.c[f.c.length - 1] == null)) f.c.pop(); };
    const esFlujo = () => lib.flujo && lib.flujo.hoja === S.h;

    function pintar() {
      const H = hoja(), nc = nCols(), A = H.anchos || [];
      // ancho: el del Excel, y nunca menos que la cifra más larga de la columna (como el ajuste automático de Excel)
      const largoNum = Array(nc).fill(0);
      H.filas.forEach((f, r) => (f.c || []).forEach((v, c) => { const x = typeof v === 'string' && v[0] === '=' ? E.val(S.h, r, c) : v; if (typeof x === 'number') largoNum[c] = Math.max(largoNum[c], ver(x, f.n).length * (f.t === 'total' ? 8.4 : 7.9) + 26); }));
      const w = c => Math.round(Math.max((A[c] || (c === 0 ? 200 : 120)) * 1.05, largoNum[c] || 0));
      const ent = S.entera;
      const enc = `<tr class="lb-letras"><th class="lb-n"></th>${Array.from({ length: nc }, (_, c) => `<th data-col="${c}" class="${ent && ent.t === 'col' && ent.i === c ? 'ent' : ''}" ${o.ro ? '' : 'draggable="true"'} title="${o.ro ? '' : 'Clic: elegir la columna (insertar o borrar). Arrastre: moverla'}" style="width:${w(c)}px;min-width:${w(c)}px">${L.colLet(c)}</th>`).join('')}</tr>`;
      let g = 0;
      const filas = H.filas.map((f, r) => {
        if (f.t === 'seccion') g++;
        // Como en Excel: un texto se desborda sobre las celdas vacías de su derecha (títulos, secciones, notas largas)
        const vacia = c => { const x = raw(r, c); return x == null || x === ''; };
        let salta = 0;
        const celdas = Array.from({ length: nc }, (_, c) => {
          if (salta > 0) { salta--; return ''; }
          const v = raw(r, c), fx = typeof v === 'string' && v[0] === '=';
          let span = 1;
          if (typeof v === 'string' && v && !fx && !(S.sel.r === r && S.sel.c > c)) { while (c + span < nc && vacia(c + span) && !(S.sel.r === r && S.sel.c === c + span)) span++; }
          salta = span - 1;
          const cs = span > 1 ? ` colspan="${span}"` : '';
          const val = fx ? E.val(S.h, r, c) : v, txt = ver(val, f.n), err = L.esErr(val);
          const numerica = typeof val === 'number', largo = !numerica && !err && txt.length > 24 ? ` title="${esc(txt)}"` : '';
          return `<td data-r="${r}" data-c="${c}"${cs} class="${numerica ? 'n' : ''}${fx ? ' fx' : ''}${err ? ' err' : ''}${ent && ((ent.t === 'col' && ent.i === c) || (ent.t === 'fila' && ent.i === r)) ? ' ent' : ''}"${span > 1 ? '' : largo}${err ? ` title="${esc(err === '#REF!' ? 'La fórmula apunta a una celda que se borró' : err === '#CIRC!' ? 'La fórmula se usa a sí misma' : err === '#NAME?' ? 'Fórmula no válida' : err)}"` : ''}>${esc(txt)}</td>`;
        }).join('');
        const rol = esFlujo() && f.rol ? `<i class="lb-rol ${f.rol}" title="Cuenta en el flujo del sitio como ${esc((ROLES.find(x => x[0] === f.rol) || [])[1] || '')}"></i>` : '';
        return `<tr class="lb-${f.t} lb-g${g % 2}" data-fila="${r}"><th class="lb-n${ent && ent.t === 'fila' && ent.i === r ? ' ent' : ''}" data-n="${r}" ${o.ro ? '' : 'draggable="true"'} title="${o.ro ? '' : 'Clic: elegir la fila (insertar, mover o borrar). Arrastre: moverla'}">${rol}${r + 1}${o.ro ? '' : '<button class="lb-mas" data-mas="' + r + '" title="Insertar una fila debajo" tabindex="-1">+</button>'}</th>${celdas}</tr>`;
      }).join('');
      const s = S.sel, crudo = raw(s.r, s.c);
      const acc = ent && !o.ro ? (ent.t === 'col'
        ? `<div class="lb-barra lb-acc"><b>Columna ${L.colLet(ent.i)}</b><button data-acc="ci">← Insertar a la izquierda</button><button data-acc="cd">Insertar a la derecha →</button><span class="lb-tip">o arrastre la letra para moverla</span><span class="sp"></span><button data-acc="bc" class="borrar">Borrar columna ${L.colLet(ent.i)}</button><button data-acc="x" class="x" title="Volver a la celda (Esc)">✕</button></div>`
        : `<div class="lb-barra lb-acc"><b>Fila ${ent.i + 1}</b><button data-acc="fa">↑ Insertar arriba</button><button data-acc="fb">Insertar abajo ↓</button><button data-acc="mu" title="Subir la fila">Subir</button><button data-acc="md" title="Bajar la fila">Bajar</button><span class="lb-tip">o arrastre el número para moverla</span><span class="sp"></span><button data-acc="bf" class="borrar">Borrar fila ${ent.i + 1}</button><button data-acc="x" class="x" title="Volver a la celda (Esc)">✕</button></div>`) : '';
      el.innerHTML = acc || `<div class="lb-barra"><span class="lb-dir">${L.dir(s.r, s.c)}</span><span class="lb-fx">ƒx</span><input class="lb-in" spellcheck="false" ${o.ro ? 'readonly' : ''} value="${esc(crudo == null ? '' : typeof crudo === 'number' && hoja().filas[s.r] && hoja().filas[s.r].n === 'pct' ? App.num(crudo * 100, 4).replace(/,?0+$/, '') + '%' : String(crudo))}" aria-label="Contenido de la celda ${L.dir(s.r, s.c)}"></div>`;
      el.innerHTML += `
        <div class="lb-wrap"><table class="lb" style="width:${46 + Array.from({ length: nc }, (_, c) => w(c)).reduce((x, y) => x + y, 0)}px"><thead>${enc}</thead><tbody>${filas}</tbody></table></div>`;
      marcar();
    }
    function marcar() {
      el.querySelectorAll('td.sel').forEach(x => x.classList.remove('sel'));
      const td = el.querySelector(`td[data-r="${S.sel.r}"][data-c="${S.sel.c}"]`); if (td) td.classList.add('sel');
      const b = el.querySelector('.lb-in'), d = el.querySelector('.lb-dir'); const v = raw(S.sel.r, S.sel.c), f = hoja().filas[S.sel.r];
      if (d) d.textContent = L.dir(S.sel.r, S.sel.c);
      if (b && document.activeElement !== b) b.value = v == null ? '' : typeof v === 'number' && f && f.n === 'pct' ? App.num(v * 100, 4).replace(/,?0+$/, '') + '%' : String(v);
    }
    function ir(r, c) {
      S.sel = { r: Math.max(0, Math.min(hoja().filas.length - 1, r)), c: Math.max(0, Math.min(nCols() - 1, c)) };
      if (!el.querySelector(`td[data-r="${S.sel.r}"][data-c="${S.sel.c}"]`) || el.querySelector(`tr[data-fila="${S.sel.r}"] td[colspan]`)) pintar(); else marcar();
      const td = el.querySelector(`td[data-r="${S.sel.r}"][data-c="${S.sel.c}"]`); if (td) td.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
    function editar(inicial) {
      if (o.ro) return;
      const td = el.querySelector(`td[data-r="${S.sel.r}"][data-c="${S.sel.c}"]`); if (!td) return;
      const f = hoja().filas[S.sel.r], v = raw(S.sel.r, S.sel.c);
      const actual = v == null ? '' : typeof v === 'number' && f.n === 'pct' ? App.num(v * 100, 4).replace(/,?0+$/, '') + '%' : typeof v === 'number' ? App.num(v, 6).replace(/,?0+$/, '') : String(v);
      td.innerHTML = `<input class="lb-ed" spellcheck="false" value="${esc(inicial != null ? inicial : actual)}">`;
      const i = td.querySelector('input'); i.focus(); if (inicial == null) i.select(); else i.setSelectionRange(i.value.length, i.value.length);
      S.edit = { r: S.sel.r, c: S.sel.c, i };
      i.onkeydown = e => {
        if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); guardar(i.value); ir(S.sel.r + (e.key === 'Enter' ? (e.shiftKey ? -1 : 1) : 0), S.sel.c + (e.key === 'Tab' ? (e.shiftKey ? -1 : 1) : 0)); el.focus(); }
        if (e.key === 'Escape') { S.edit = null; pintar(); el.focus(); }
        e.stopPropagation();
      };
      i.onblur = () => { if (S.edit && S.edit.i === i) guardar(i.value); };
    }
    function guardar(txt, r = S.edit ? S.edit.r : S.sel.r, c = S.edit ? S.edit.c : S.sel.c) {
      S.edit = null;
      const f = hoja().filas[r]; if (!f) return;
      const v = leer(txt, f.n);
      if (typeof v === 'string' && v[0] === '=') { try { L.arbol(v.slice(1)); } catch (e) { App.toast('Revise la fórmula: ' + e.message, true); } }
      if ((raw(r, c) ?? '') === v) return pintar();
      const antes = snap(); fijar(r, c, v); cambio(antes);
    }
    const op = (fn, msg) => { const antes = snap(); fn(); cambio(antes); if (msg) App.toast(msg); };

    function menu(anchor, r, c) {
      if (o.ro) return;
      const f = hoja().filas[r] || {};
      const it = [{ id: 'fa', label: 'Insertar fila arriba' }, { id: 'fb', label: 'Insertar fila abajo' }, { id: 'ci', label: 'Insertar columna a la izquierda' }, { id: 'cd', label: 'Insertar columna a la derecha' }, '-',
        { id: 'mu', label: 'Mover fila arriba' }, { id: 'md', label: 'Mover fila abajo' }, { id: 'der', label: 'Copiar esta fórmula a la derecha' }, '-',
        { id: 'tipo', label: 'Tipo de fila: ' + ((TIPOS_FILA.find(x => x[0] === f.t) || [])[1] || 'Dato') }, { id: 'fmt', label: 'Formato: ' + ((FORMATOS.find(x => x[0] === (f.n || '')) || [])[1]) }]
        .concat(esFlujo() && f.t === 'dato' ? [{ id: 'rol', label: 'En el flujo: ' + ((ROLES.find(x => x[0] === (f.rol || '')) || [])[1]) }] : [])
        .concat(['-', { id: 'bf', label: 'Borrar fila', danger: true }, { id: 'bc', label: 'Borrar columna ' + L.colLet(c), danger: true }]);
      App.menu(anchor, it, m => {
        const H = hoja();
        if (m === 'fa') op(() => L.insertarFila(lib, S.h, r, f));
        if (m === 'fb') op(() => { L.insertarFila(lib, S.h, r + 1, f); S.sel = { r: r + 1, c }; });
        if (m === 'ci') op(() => L.insertarCol(lib, S.h, c));
        if (m === 'cd') op(() => { L.insertarCol(lib, S.h, c + 1); S.sel = { r, c: c + 1 }; });
        if (m === 'mu' && r > 0) op(() => { L.moverFila(lib, S.h, r, r - 1); S.sel = { r: r - 1, c }; });
        if (m === 'md' && r < H.filas.length - 1) op(() => { L.moverFila(lib, S.h, r, r + 1); S.sel = { r: r + 1, c }; });
        if (m === 'der') { const v = raw(r, c); if (typeof v !== 'string' || v[0] !== '=') return App.toast('Esa celda no tiene fórmula', true);
          op(() => { const fin = Math.max(nCols() - 2, c + 1); for (let k = c + 1; k <= fin; k++) fijar(r, k, L.desplazar(v, 0, k - c)); }, 'Fórmula copiada a la derecha'); }
        if (m === 'bf') { if (!confirm(`¿Borrar la fila ${r + 1}? Las fórmulas que la usan quedarán con #REF!`)) return; op(() => { L.eliminarFila(lib, S.h, r); S.sel = { r: Math.max(0, r - 1), c }; }); }
        if (m === 'bc') { if (!confirm(`¿Borrar la columna ${L.colLet(c)}? Las fórmulas que la usan quedarán con #REF!`)) return; op(() => L.eliminarCol(lib, S.h, c)); }
        if (m === 'tipo') return setTimeout(() => App.menu(anchor, TIPOS_FILA.map(([k, l]) => ({ id: k, label: (k === f.t ? '✓ ' : '') + l })), k => op(() => { f.t = k; if (k !== 'dato') delete f.rol; })), 0);
        if (m === 'fmt') return setTimeout(() => App.menu(anchor, FORMATOS.map(([k, l]) => ({ id: k || 'gen', label: ((f.n || '') === k ? '✓ ' : '') + l })), k => op(() => { if (k === 'gen') delete f.n; else f.n = k; })), 0);
        if (m === 'rol') return setTimeout(() => App.menu(anchor, ROLES.map(([k, l]) => ({ id: k || 'no', label: ((f.rol || '') === k ? '✓ ' : '') + l })), k => op(() => { if (k === 'no') delete f.rol; else f.rol = k; })), 0);
      }, 250);
    }

    function accion(k) {
      const e = S.entera; if (!e) return;
      const nFilas = hoja().filas.length;
      if (k === 'x') { S.entera = null; return pintar(); }
      if (k === 'ci') op(() => { L.insertarCol(lib, S.h, e.i); S.entera = { t: 'col', i: e.i }; });
      if (k === 'cd') op(() => { L.insertarCol(lib, S.h, e.i + 1); S.entera = { t: 'col', i: e.i + 1 }; });
      if (k === 'fa') op(() => { L.insertarFila(lib, S.h, e.i, hoja().filas[e.i]); S.entera = { t: 'fila', i: e.i }; });
      if (k === 'fb') op(() => { L.insertarFila(lib, S.h, e.i + 1, hoja().filas[e.i]); S.entera = { t: 'fila', i: e.i + 1 }; });
      if (k === 'mu' && e.i > 0) op(() => { L.moverFila(lib, S.h, e.i, e.i - 1); S.entera = { t: 'fila', i: e.i - 1 }; });
      if (k === 'md' && e.i < nFilas - 1) op(() => { L.moverFila(lib, S.h, e.i, e.i + 1); S.entera = { t: 'fila', i: e.i + 1 }; });
      if (k === 'bf') { if (!confirm(`¿Borrar la fila ${e.i + 1}? Si alguna fórmula la usa, quedará con #REF! (se puede deshacer con Ctrl+Z).`)) return; op(() => { L.eliminarFila(lib, S.h, e.i); S.entera = null; S.sel = { r: Math.max(0, e.i - 1), c: S.sel.c }; }, 'Fila borrada'); }
      if (k === 'bc') { if (!confirm(`¿Borrar la columna ${L.colLet(e.i)}? Si alguna fórmula la usa, quedará con #REF! (se puede deshacer con Ctrl+Z).`)) return; op(() => { L.eliminarCol(lib, S.h, e.i); S.entera = null; S.sel = { r: S.sel.r, c: Math.max(0, e.i - 1) }; }, 'Columna borrada'); }
    }
    el.tabIndex = 0; el.classList.add('lb-host');
    el.onmousedown = e => { const td = e.target.closest('td[data-r]'); if (!td || e.target.closest('.lb-ed')) return; if (S.edit) guardar(S.edit.i.value);
      const habia = !!S.entera; S.entera = null;
      let c = +td.dataset.c; const span = +(td.getAttribute('colspan') || 1);
      // clic sobre la parte desbordada de un texto: se elige la celda vacía que está debajo
      if (span > 1) { const tw = td.getBoundingClientRect(), ths = [...el.querySelectorAll('.lb-letras th[data-col]')]; const x = e.clientX; const k = ths.findIndex(th => { const b = th.getBoundingClientRect(); return x >= b.left && x < b.right; }); if (k > c && k < c + span) c = k; }
      const antes = S.sel; S.sel = { r: +td.dataset.r, c }; if (habia || span > 1 && c !== +td.dataset.c || (antes.r === S.sel.r && antes.c !== S.sel.c && el.querySelector(`tr[data-fila="${S.sel.r}"] td[colspan]`))) pintar(); else marcar(); if (e.button === 0) el.focus(); };
    el.ondblclick = e => { if (e.target.closest('td[data-r]')) editar(); };
    el.oncontextmenu = e => { const td = e.target.closest('td[data-r], th[data-n]'); if (!td || o.ro) return; e.preventDefault();
      const r = td.dataset.r != null ? +td.dataset.r : +td.dataset.n, c = td.dataset.c != null ? +td.dataset.c : S.sel.c; S.sel = { r, c }; marcar(); menu(td, r, c); };
    el.onclick = e => {
      const ac = e.target.closest('[data-acc]'); if (ac) return accion(ac.dataset.acc);
      if (!o.ro && !e.target.closest('[data-mas]')) { const th = e.target.closest('th[data-col], tbody th[data-n]'); if (th) { S.entera = th.dataset.col != null ? { t: 'col', i: +th.dataset.col } : { t: 'fila', i: +th.dataset.n }; if (S.entera.t === 'col') S.sel = { r: S.sel.r, c: S.entera.i }; else S.sel = { r: S.entera.i, c: S.sel.c }; pintar(); el.focus(); return; } }
      const b = e.target.closest('[data-mas]'); if (b) { e.stopPropagation(); const r = +b.dataset.mas; op(() => { L.insertarFila(lib, S.h, r + 1, hoja().filas[r]); S.sel = { r: r + 1, c: 0 }; }); } };
    el.onkeydown = e => {
      if (S.edit || e.target.classList.contains('lb-in')) return;
      if (S.entera) { if (e.key === 'Escape') { e.preventDefault(); S.entera = null; return pintar(); } if ((e.key === 'Delete' || e.key === 'Backspace') && !o.ro) { e.preventDefault(); return accion(S.entera.t === 'col' ? 'bc' : 'bf'); } if (/^Arrow/.test(e.key)) { S.entera = null; pintar(); } }
      const { r, c } = S.sel, ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && (e.key === 'z' || e.key === 'y')) { e.preventDefault(); const de = e.key === 'z' ? S.undo : S.redo, a = e.key === 'z' ? S.redo : S.undo; if (de.length) { a.push(snap()); restaurar(de.pop()); } return; }
      const mov = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1], Tab: [0, e.shiftKey ? -1 : 1], Enter: [1, 0] }[e.key];
      if (e.key === 'Enter' && !o.ro && !e.shiftKey) { e.preventDefault(); return editar(); }
      if (mov) { e.preventDefault(); return ir(r + mov[0], c + mov[1]); }
      if (e.key === 'F2') { e.preventDefault(); return editar(); }
      if ((e.key === 'Delete' || e.key === 'Backspace') && !o.ro) { e.preventDefault(); if (raw(r, c) != null && raw(r, c) !== '') { const antes = snap(); fijar(r, c, ''); cambio(antes); } return; }
      if (!o.ro && e.key.length === 1 && !ctrl && !e.altKey) { e.preventDefault(); editar(e.key); }
    };
    // barra de fórmulas
    el.addEventListener('keydown', e => { const b = e.target.closest('.lb-in'); if (!b) return; if (e.key === 'Enter') { e.preventDefault(); guardar(b.value, S.sel.r, S.sel.c); el.focus(); } if (e.key === 'Escape') { marcar(); el.focus(); } });
    el.addEventListener('change', e => { const b = e.target.closest('.lb-in'); if (b && !o.ro) guardar(b.value, S.sel.r, S.sel.c); });
    // arrastrar filas por su número
    el.addEventListener('dragstart', e => { const tc = e.target.closest('th[data-col]'); if (tc) { S.arrC = +tc.dataset.col; e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', 'columna'); } catch (x) {} return; }
      const th = e.target.closest('th[data-n]'); if (!th) return; S.arr = +th.dataset.n; e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', 'fila'); } catch (x) {} });
    el.addEventListener('dragover', e => {
      if (S.arrC != null) { const t = e.target.closest('[data-col], td[data-c]'); if (!t) return; e.preventDefault(); const k = t.dataset.col != null ? +t.dataset.col : +t.dataset.c; el.querySelectorAll('.lb-dropc').forEach(x => x.classList.remove('lb-dropc')); el.querySelectorAll(`th[data-col="${k}"], td[data-c="${k}"]`).forEach(x => x.classList.add('lb-dropc')); return; }
      if (S.arr == null) return; const tr = e.target.closest('tr[data-fila]'); if (!tr) return; e.preventDefault(); el.querySelectorAll('tr.lb-drop').forEach(x => x.classList.remove('lb-drop')); tr.classList.add('lb-drop'); });
    el.addEventListener('drop', e => {
      if (S.arrC != null) { const t = e.target.closest('[data-col], td[data-c]'); const de = S.arrC; S.arrC = null; el.querySelectorAll('.lb-dropc').forEach(x => x.classList.remove('lb-dropc')); if (!t) return; e.preventDefault(); const a = t.dataset.col != null ? +t.dataset.col : +t.dataset.c; if (a !== de) op(() => { L.moverCol(lib, S.h, de, a); S.entera = { t: 'col', i: a }; S.sel = { r: S.sel.r, c: a }; }, `Columna movida a ${L.colLet(a)}: las fórmulas siguen a sus celdas`); return; }
      if (S.arr == null) return; const tr = e.target.closest('tr[data-fila]'); const de = S.arr; S.arr = null; if (!tr) return; e.preventDefault(); const a = +tr.dataset.fila; if (a !== de) op(() => { L.moverFila(lib, S.h, de, a); S.sel = { r: a, c: S.sel.c }; }, 'Fila movida: las fórmulas siguen a sus celdas'); });
    el.addEventListener('dragend', () => { S.arr = null; S.arrC = null; el.querySelectorAll('.lb-dropc').forEach(x => x.classList.remove('lb-dropc')); el.querySelectorAll('tr.lb-drop').forEach(x => x.classList.remove('lb-drop')); });

    pintar();
    return {
      hoja: i => { if (S.edit) guardar(S.edit.i.value); S.h = i; S.sel = { r: 0, c: 0 }; pintar(); },
      undo: () => { if (S.undo.length) { S.redo.push(snap()); restaurar(S.undo.pop()); } },
      redo: () => { if (S.redo.length) { S.undo.push(snap()); restaurar(S.redo.pop()); } },
      agregar: tipo => op(() => { if (tipo === 'fila') { L.insertarFila(lib, S.h, S.sel.r + 1, hoja().filas[S.sel.r]); S.sel = { r: S.sel.r + 1, c: S.sel.c }; } else { L.insertarCol(lib, S.h, S.sel.c + 1); S.sel = { r: S.sel.r, c: S.sel.c + 1 }; } }),
      repintar: () => { recalc(); pintar(); },
    };
  }

  // Un caso que aún no tiene libro: se arma con sus filas, en hojas como el Excel de la Oficina
  // (Supuestos, Gastos y Flujo), y sus fórmulas de la tabla anterior ([Nombre], [Nombre; año anterior],
  // [Total ingresos], máx(…)) pasan a fórmulas de Excel. Si las cifras no quedan idénticas, se usan los valores.
  function desdeFlujos(caso) {
    const conFx = armar(caso, true);
    if (iguales(caso, conFx)) return conFx;
    return armar(caso, false);
  }
  function iguales(caso, lb) {
    try {
      const a = Finanzas.calc(caso), b = Finanzas.calc(Object.assign({}, caso, { flujos: L.flujos(lb), anios: lb.flujo.anios - 1 }));
      const eq = (x, y) => x.every((v, i) => Math.abs(v - (y[i] || 0)) <= Math.max(1, Math.abs(v) * 1e-9));
      return eq(a.beneficios, b.beneficios) && eq(a.costos, b.costos) && eq(a.inversion, b.inversion);
    } catch (e) { return false; }
  }
  function armar(caso, conFormulas) {
    const fl = caso.flujos || [], N = Math.max(1, Math.round(caso.anios != null ? caso.anios : 9)) + 1, y0 = caso.anio_inicio || null;
    const nom = x => String(x || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
    const FX = r => (conFormulas && r.formulas) || {}, val = (r, t) => Number((r.valores || [])[t]) || 0, esSup = r => r.tipo === 'supuesto';
    const efectivo = (r, t) => { if (!esSup(r)) return val(r, t); for (let k = t; k >= 0; k--) if (val(r, k) || (r.formulas || {})[k]) return val(r, k); return 0; };
    const fijo = r => esSup(r) && !Object.keys(FX(r)).length && Array.from({ length: N }, (_, t) => efectivo(r, t)).every(v => v === efectivo(r, 0));
    // Supuestos como en el Excel: un valor por fila. Los que cambian por año van en una fila por cada año en que cambian;
    // los que se calculan año a año con fórmulas pasan al Flujo, en «Cálculos de apoyo»
    const conFx = r => Object.keys(FX(r)).length > 0;
    const sup = fl.filter(esSup), fijos = sup.filter(fijo), calcSup = sup.filter(r => !fijo(r) && conFx(r)), varios = sup.filter(r => !fijo(r) && !conFx(r));
    const cortes = r => Array.from({ length: N }, (_, t) => t).filter(t => t === 0 || efectivo(r, t) !== efectivo(r, t - 1));
    const de = k => fl.filter(r => r.tipo === k), ben = de('beneficio'), cos = de('costo'), inv = de('inversion'), calc = de('calculo');
    const anios = Array.from({ length: N }, (_, t) => 'Año ' + (t + 1) + (y0 ? ` (${y0 + t})` : ''));
    const H = [], pos = new Map(), tot = {};
    // 1) dónde va cada fila
    const S = { nombre: 'Supuestos', anchos: [250, 300, 80, 150, 260], filas: [{ t: 'titulo', c: ['SUPUESTOS DEL CASO DE NEGOCIO'] }, { t: 'vacia', c: [] }] };
    if (fijos.length) { S.filas.push({ t: 'seccion', c: ['SUPUESTOS GENERALES'] }, { t: 'encab', c: ['Línea', 'Concepto', 'Unidad', 'Valor', 'Tipo'] }); fijos.forEach(r => { pos.set(nom(r.concepto), { h: 0, r: S.filas.length, fijo: true }); S.filas.push({ t: 'dato', n: r.pct ? 'pct' : 'num', src: r, kind: 'fijo' }); }); S.filas.push({ t: 'vacia', c: [] }); }
    if (varios.length) {
      S.filas.push({ t: 'seccion', c: ['SUPUESTOS QUE CAMBIAN POR AÑO'] }, { t: 'encab', c: ['Línea', 'Concepto', 'Unidad', 'Valor', 'Tipo'] });
      varios.forEach(r => { const porAnio = Array(N).fill(0); cortes(r).forEach(t0 => { const fila = S.filas.length; for (let t = t0; t < N; t++) porAnio[t] = fila; S.filas.push({ t: 'dato', n: r.pct ? 'pct' : 'num', src: r, kind: 'corte', t0 }); }); pos.set(nom(r.concepto), { h: 0, porAnio }); });
      S.filas.push({ t: 'vacia', c: [] });
    }
    if (S.filas.length === 2) S.filas.push({ t: 'seccion', c: ['SUPUESTOS GENERALES'] }, { t: 'encab', c: ['Línea', 'Concepto', 'Unidad', 'Valor', 'Tipo'] }, { t: 'dato', c: [] });
    H.push(S);
    if (cos.length) {
      const h = H.length, G = { nombre: 'Gastos', anchos: [300].concat(Array(N).fill(140)), filas: [{ t: 'titulo', c: ['GASTOS DEL CASO'] }, { t: 'vacia', c: [] }, { t: 'encab', c: ['Concepto'].concat(anios) }, { t: 'seccion', c: ['GASTOS ANUALES'] }] };
      const d = G.filas.length; cos.forEach(r => { pos.set(nom(r.concepto), { h, r: G.filas.length }); G.filas.push({ t: 'dato', n: 'cop', src: r, kind: 'anual' }); });
      G.filas.push({ t: 'total', n: 'cop', kind: 'suma', de: [d, G.filas.length - 1], c: ['TOTAL GASTOS'] }); H.push(G);
    }
    const hF = H.length, Fl = { nombre: `Flujo ${N} años`, anchos: [300].concat(Array(N).fill(140)), filas: [{ t: 'titulo', c: [`FLUJO DE INGRESOS Y GASTOS A ${N} AÑOS`] }, { t: 'vacia', c: [] }, { t: 'encab', c: ['Concepto'].concat(anios) }] };
    const bloque = (titulo, rows, rol, nt, key, enlace) => {
      if (!rows.length) return; Fl.filas.push({ t: 'seccion', c: [titulo] }); const d = Fl.filas.length;
      rows.forEach(r => { if (!enlace) pos.set(nom(r.concepto), { h: hF, r: Fl.filas.length }); Fl.filas.push({ t: 'dato', n: 'cop', rol, ...(r.categoria ? { cat: r.categoria } : {}), src: r, kind: enlace ? 'enlace' : 'anual' }); });
      tot[key] = { h: hF, r: Fl.filas.length }; Fl.filas.push({ t: 'total', n: 'cop', kind: 'suma', de: [d, Fl.filas.length - 1], c: [nt] }); Fl.filas.push({ t: 'vacia', c: [] });
    };
    if (calcSup.length) { Fl.filas.push({ t: 'seccion', c: ['CÁLCULOS DE APOYO'] }); calcSup.forEach(r => { pos.set(nom(r.concepto), { h: hF, r: Fl.filas.length }); Fl.filas.push({ t: 'dato', n: r.pct ? 'pct' : 'num', src: r, kind: 'anual' }); }); Fl.filas.push({ t: 'vacia', c: [] }); }
    bloque('INGRESOS Y AHORROS', ben, 'beneficio', 'TOTAL INGRESOS Y AHORROS', 'beneficio');
    bloque('GASTOS', cos, 'costo', 'TOTAL GASTOS', 'costo', true);
    bloque('INVERSIÓN', inv, 'inversion', 'TOTAL INVERSIÓN', 'inversion');
    if (calc.length) { Fl.filas.push({ t: 'seccion', c: ['RESULTADOS'] }); calc.forEach(r => { pos.set(nom(r.concepto), { h: hF, r: Fl.filas.length }); Fl.filas.push({ t: 'dato', n: r.pct ? 'pct' : 'cop', src: r, kind: 'anual' }); }); Fl.filas.push({ t: 'vacia', c: [] }); }
    Fl.filas.push({ t: 'seccion', c: ['FLUJO DE CAJA'] }); const fc = Fl.filas.length;
    Fl.filas.push({ t: 'total', n: 'cop', kind: 'neto', c: ['Flujo de caja del año'] }, { t: 'total', n: 'cop', kind: 'acum', c: ['Flujo de caja acumulado'] });
    H.push(Fl);
    // 2) las celdas, con referencias tipo Excel
    const pre = (h, actual) => (h === actual ? '' : (/^[A-Za-zÀ-ÿ_][\wÀ-ÿ.]*$/.test(H[h].nombre) ? H[h].nombre : `'${H[h].nombre}'`) + '!');
    const celda = (p, t, actual) => pre(p.h, actual) + (p.porAnio ? '$D$' + (p.porAnio[t] + 1) : p.fijo ? '$D$' + (p.r + 1) : L.colLet(t + 1) + (p.r + 1));
    const TOT = { 'total ingresos': 'beneficio', 'total beneficios': 'beneficio', 'total ingresos y ahorros': 'beneficio', 'total gastos': 'costo', 'total costos': 'costo', 'total inversion': 'inversion' };
    const letras = i => { let x = ''; do { x = String.fromCharCode(97 + i % 26) + x; i = Math.floor(i / 26); } while (i > 0); return x; };
    function tr(fx, t, actual) {
      const refs = [];
      let x = String(fx).replace(/^\s*=/, '').replace(/\[([^\]]{1,160})\]/g, (_, n) => {
        const m = /^(.*?)\s*(?:;\s*a[nñ]o\s+anterior|@\s*-\s*1)\s*$/i.exec(n), nm = nom(m ? m[1] : n), k = t - (m ? 1 : 0);
        const p = pos.get(nm) || (TOT[nm] && tot[TOT[nm]]);
        refs.push(k < 0 ? '0' : p ? celda(p, k, actual) : '#REF!');
        return '\u0001' + letras(refs.length - 1) + '\u0002';
      });
      x = x.replace(/m[aá]x\s*\(/gi, 'MAX(').replace(/m[ií]n\s*\(/gi, 'MIN(');
      x = x.replace(/(\d[\d.,]*)\s*(mm|mil|k|m)?(?![A-Za-z\u0002])/gi, (todo, num, suf) => { const v = App.parseNum(num) * (suf ? (/^(k|mil)$/i.test(suf) ? 1e3 : 1e6) : 1); return Number.isFinite(v) ? String(v) : todo; });
      return '=' + x.replace(/\u0001([a-z]+)\u0002/g, (_, k) => refs[[...k].reduce((a, ch) => a * 26 + ch.charCodeAt(0) - 97, 0)]);
    }
    const yr = t => L.colLet(t + 1);
    H.forEach((h, hi) => h.filas.forEach(f => {
      const r = f.src;
      if (f.kind === 'fijo') f.c = ['', r.concepto || '', r.pct ? '%' : '', efectivo(r, 0), r.nota || 'Input editable'];
      else if (f.kind === 'corte') f.c = [r.concepto || '', f.t0 === 0 ? 'Desde el Año 1' + (y0 ? ` (${y0})` : '') : `Desde el Año ${f.t0 + 1}` + (y0 ? ` (${y0 + f.t0})` : ''), r.pct ? '%' : '', efectivo(r, f.t0), f.t0 === 0 ? (r.nota || 'Input editable') : 'Input editable'];
      else if (f.kind === 'anual') f.c = [r.concepto || ''].concat(Array.from({ length: N }, (_, t) => (FX(r)[t] ? tr(FX(r)[t], t, hi) : esSup(r) ? efectivo(r, t) : val(r, t))));
      else if (f.kind === 'enlace') { const p = pos.get(nom(r.concepto)); f.c = [r.concepto || ''].concat(Array.from({ length: N }, (_, t) => '=' + celda(p, t, hi))); }
      else if (f.kind === 'suma') f.c = f.c.concat(Array.from({ length: N }, (_, t) => `=SUM(${yr(t)}${f.de[0] + 1}:${yr(t)}${f.de[1] + 1})`));
      else if (f.kind === 'neto') f.c = f.c.concat(Array.from({ length: N }, (_, t) => '=' + ['beneficio', 'costo', 'inversion'].map((k, i) => (tot[k] ? (i ? '-' : '') + yr(t) + (tot[k].r + 1) : i ? '' : '0')).join('')));
      else if (f.kind === 'acum') f.c = f.c.concat(Array.from({ length: N }, (_, t) => `=SUM($B${fc + 1}:${yr(t)}${fc + 1})`));
      delete f.src; delete f.kind; delete f.de; delete f.t0;
    }));
    return { v: 1, hojas: H, flujo: { hoja: hF, col0: 1, anios: N, colNombre: 0 } };
  }

  App.LibroUI = { montar, desdeFlujos, ver, leer };
})();
