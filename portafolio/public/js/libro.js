/* ============================================================
   LIBRO, el caso de negocio como un libro de Excel
   - Varias hojas (Supuestos, Gastos, Flujo…), cada una con sus filas de
     título, sección, encabezado, datos y totales, y sus propias columnas.
   - Fórmulas como en Excel: =D11*D13/12, =SUM(E6:E9), =IF(D6="",0,D6),
     =MAX(0,B25)*Supuestos!$D$7, ='Flujo 10 años'!B12, rangos y $ fijos.
   - Al insertar, borrar o mover filas y columnas, las fórmulas se ajustan
     solas (como en Excel): siguen apuntando a la misma celda.
   - Las filas del flujo marcadas como ingreso, gasto o inversión alimentan
     el resto del sitio (valor a dos años, tablero, ICE).
   Funciona en el navegador y en el servidor (para leer el Excel subido).
   ============================================================ */
(function (root, factory) {
  const L = factory();
  if (typeof module === 'object' && module.exports) module.exports = L;
  else { root.App = root.App || {}; root.App.Libro = L; root.Libro = L; }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const ERR = { REF: '#REF!', DIV: '#DIV/0!', VAL: '#VALUE!', NAME: '#NAME?', CIRC: '#CIRC!', NUM: '#NUM!' };
  const esErr = v => typeof v === 'string' && /^#(REF!|DIV\/0!|VALUE!|NAME\?|CIRC!|NUM!|N\/A)$/.test(v);

  /* ---------- direcciones ---------- */
  const colNum = s => { let n = 0; for (const ch of s.toUpperCase()) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; };
  const colLet = n => { let s = ''; n++; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
  const dir = (r, c) => colLet(c) + (r + 1);

  /* ---------- fichas de una fórmula ---------- */
  // Una referencia: ['Hoja con espacios'!|Hoja!]$A$1[:$B$2]
  const RX_REF = /^(?:'((?:[^']|'')+)'!|([A-Za-zÀ-ÿ_][\wÀ-ÿ.]*)!)?(\$?)([A-Za-z]{1,3})(\$?)(\d{1,7})(?::(\$?)([A-Za-z]{1,3})(\$?)(\d{1,7}))?(?![\w(])/;
  function fichas(src) {
    const out = []; let i = 0;
    while (i < src.length) {
      const ch = src[i];
      if (/\s/.test(ch)) { i++; continue; }
      const rest = src.slice(i);
      let m;
      if (ch === '"') { let j = i + 1, s = ''; while (j < src.length) { if (src[j] === '"') { if (src[j + 1] === '"') { s += '"'; j += 2; continue; } break; } s += src[j++]; } out.push({ k: 'str', v: s, a: i, b: j + 1 }); i = j + 1; continue; }
      if ((m = RX_REF.exec(rest))) {
        const hoja = m[1] != null ? m[1].replace(/''/g, "'") : m[2] || null;
        const r1 = { c: colNum(m[4]), r: +m[6] - 1, fc: !!m[3], fr: !!m[5] };
        const r2 = m[8] ? { c: colNum(m[8]), r: +m[10] - 1, fc: !!m[7], fr: !!m[9] } : null;
        out.push({ k: 'ref', hoja, r1, r2, a: i, b: i + m[0].length }); i += m[0].length; continue;
      }
      if ((m = /^(\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|\.\d+)/.exec(rest))) { out.push({ k: 'num', v: Number(m[1]), a: i, b: i + m[1].length }); i += m[1].length; continue; }
      if ((m = /^([A-Za-zÀ-ÿ_][\wÀ-ÿ.]*)\s*\(/.exec(rest))) { out.push({ k: 'fn', v: m[1].toUpperCase(), a: i, b: i + m[1].length }); i += m[1].length; continue; }
      if ((m = /^(TRUE|FALSE|VERDADERO|FALSO)\b/i.exec(rest))) { out.push({ k: 'bool', v: /^(TRUE|VERDADERO)$/i.test(m[1]), a: i, b: i + m[1].length }); i += m[1].length; continue; }
      if ((m = /^(<=|>=|<>|[-+*/^&=<>%(),;:])/.exec(rest))) { out.push({ k: 'op', v: m[1], a: i, b: i + m[1].length }); i += m[1].length; continue; }
      if ((m = /^#(REF!|DIV\/0!|VALUE!|NAME\?|N\/A)/.exec(rest))) { out.push({ k: 'err', v: m[0], a: i, b: i + m[0].length }); i += m[0].length; continue; }
      throw new Error('No entiendo «' + rest.slice(0, 12) + '»');
    }
    return out;
  }

  /* ---------- árbol de la fórmula (precedencia de Excel) ---------- */
  function arbol(src) {
    const T = fichas(src); let p = 0;
    const ver = () => T[p], toma = () => T[p++];
    const es = v => T[p] && T[p].k === 'op' && T[p].v === v;
    function comp() { let a = concat(); while (T[p] && T[p].k === 'op' && ['=', '<>', '<', '>', '<=', '>='].includes(T[p].v)) { const o = toma().v; a = { k: 'bin', o, a, b: concat() }; } return a; }
    function concat() { let a = suma(); while (es('&')) { toma(); a = { k: 'bin', o: '&', a, b: suma() }; } return a; }
    function suma() { let a = prod(); while (es('+') || es('-')) { const o = toma().v; a = { k: 'bin', o, a, b: prod() }; } return a; }
    function prod() { let a = pot(); while (es('*') || es('/')) { const o = toma().v; a = { k: 'bin', o, a, b: pot() }; } return a; }
    function pot() { let a = una(); while (es('^')) { toma(); a = { k: 'bin', o: '^', a, b: una() }; } return a; }
    function una() { if (es('-')) { toma(); return { k: 'neg', a: una() }; } if (es('+')) { toma(); return una(); } return pct(); }
    function pct() { let a = prim(); while (es('%')) { toma(); a = { k: 'bin', o: '/', a, b: { k: 'num', v: 100 } }; } return a; }
    function prim() {
      const t = toma(); if (!t) throw new Error('Fórmula incompleta');
      if (t.k === 'num' || t.k === 'str' || t.k === 'bool' || t.k === 'err') return { k: t.k, v: t.v };
      if (t.k === 'ref') return { k: 'ref', hoja: t.hoja, r1: t.r1, r2: t.r2 };
      if (t.k === 'fn') { toma(); const args = []; if (!es(')')) { do { if (es(',') || es(';')) { toma(); } if (es(')')) break; args.push(comp()); } while (es(',') || es(';')); } if (!es(')')) throw new Error('Falta cerrar el paréntesis'); toma(); return { k: 'fn', v: t.v, args }; }
      if (t.k === 'op' && t.v === '(') { const a = comp(); if (!es(')')) throw new Error('Falta cerrar el paréntesis'); toma(); return a; }
      throw new Error('Algo sobra en la fórmula');
    }
    const a = comp(); if (p < T.length) throw new Error('Algo sobra en la fórmula'); return a;
  }

  /* ---------- cálculo ---------- */
  const num = v => (v == null || v === '' ? 0 : typeof v === 'number' ? v : typeof v === 'boolean' ? (v ? 1 : 0) : esErr(v) ? v : isNaN(Number(v)) ? ERR.VAL : Number(v));
  const FN = {
    SUM: a => a.flat(Infinity).reduce((s, x) => (esErr(s) ? s : esErr(x) ? x : typeof x === 'number' ? s + x : s), 0),
    MAX: a => { const l = a.flat(Infinity).filter(x => typeof x === 'number'); const e = a.flat(Infinity).find(esErr); return e || (l.length ? Math.max(...l) : 0); },
    MIN: a => { const l = a.flat(Infinity).filter(x => typeof x === 'number'); const e = a.flat(Infinity).find(esErr); return e || (l.length ? Math.min(...l) : 0); },
    AVERAGE: a => { const l = a.flat(Infinity).filter(x => typeof x === 'number'); return l.length ? l.reduce((s, x) => s + x, 0) / l.length : ERR.DIV; },
    COUNT: a => a.flat(Infinity).filter(x => typeof x === 'number').length,
    ABS: a => { const x = num(a[0]); return esErr(x) ? x : Math.abs(x); },
    ROUND: a => { const x = num(a[0]), d = num(a[1]); if (esErr(x)) return x; const f = Math.pow(10, d || 0); return Math.round(x * f) / f; },
    ROUNDUP: a => { const x = num(a[0]), f = Math.pow(10, num(a[1]) || 0); return Math.sign(x) * Math.ceil(Math.abs(x) * f) / f; },
    ROUNDDOWN: a => { const x = num(a[0]), f = Math.pow(10, num(a[1]) || 0); return Math.sign(x) * Math.floor(Math.abs(x) * f) / f; },
    POWER: a => Math.pow(num(a[0]), num(a[1])),
    AND: a => a.flat(Infinity).every(x => !!num(x)), OR: a => a.flat(Infinity).some(x => !!num(x)), NOT: a => !num(a[0]),
  };
  FN.SUMA = FN.SUM; FN['MÁX'] = FN.MAX; FN.MAXIMO = FN.MAX; FN['MÍN'] = FN.MIN; FN.MINIMO = FN.MIN; FN.PROMEDIO = FN.AVERAGE; FN.REDONDEAR = FN.ROUND; FN.Y = FN.AND; FN.O = FN.OR;

  function crear(libro) {
    const H = libro.hojas || [];
    const idx = new Map(H.map((h, i) => [norm(h.nombre), i]));
    let memo = new Map(), pila = new Set(), cache = new Map();
    const hojaDe = (n, actual) => (n == null ? actual : idx.has(norm(n)) ? idx.get(norm(n)) : -1);
    const crudo = (h, r, c) => { const f = (H[h] && H[h].filas[r]) || null; return f && f.c ? f.c[c] : undefined; };
    function celda(h, r, c) {
      const k = h + ':' + r + ':' + c;
      if (memo.has(k)) return memo.get(k);
      const v = crudo(h, r, c);
      if (typeof v !== 'string' || v[0] !== '=') { const x = v === undefined || v === '' ? null : v; memo.set(k, x); return x; }
      if (pila.has(k)) return ERR.CIRC;
      pila.add(k);
      let out;
      try { let a = cache.get(v); if (!a) { a = arbol(v.slice(1)); cache.set(v, a); } out = ev(a, h); }
      catch (e) { out = ERR.NAME; }
      pila.delete(k);
      if (typeof out === 'number' && !isFinite(out)) out = ERR.NUM;
      if (Array.isArray(out)) out = ERR.VAL;
      memo.set(k, out); return out;
    }
    function rango(n, h) {
      const hh = hojaDe(n.hoja, h); if (hh < 0) return ERR.REF;
      if (!n.r2) return celda(hh, n.r1.r, n.r1.c);
      const r0 = Math.min(n.r1.r, n.r2.r), r1 = Math.max(n.r1.r, n.r2.r), c0 = Math.min(n.r1.c, n.r2.c), c1 = Math.max(n.r1.c, n.r2.c), out = [];
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) out.push(celda(hh, r, c));
      return out;
    }
    function ev(n, h) {
      switch (n.k) {
        case 'num': case 'str': case 'bool': case 'err': return n.v;
        case 'ref': return rango(n, h);
        case 'neg': { const x = num(esc(ev(n.a, h))); return esErr(x) ? x : -x; }
        case 'fn': {
          if (n.v === 'IF' || n.v === 'SI') { const c = esc(ev(n.args[0], h)); if (esErr(c)) return c; return (typeof c === 'string' ? c !== '' : !!num(c)) ? (n.args[1] ? esc(ev(n.args[1], h)) : true) : (n.args[2] ? esc(ev(n.args[2], h)) : false); }
          if (n.v === 'IFERROR' || n.v === 'SI.ERROR') { const x = esc(ev(n.args[0], h)); return esErr(x) ? esc(ev(n.args[1], h)) : x; }
          const f = FN[n.v]; if (!f) return ERR.NAME;
          return f(n.args.map(a => ev(a, h)));
        }
        case 'bin': {
          const a = esc(ev(n.a, h)), b = esc(ev(n.b, h));
          if (n.o === '&') return (a == null ? '' : String(a)) + (b == null ? '' : String(b));
          if (['=', '<>', '<', '>', '<=', '>='].includes(n.o)) {
            const A = a == null ? (typeof b === 'string' ? '' : 0) : a, B = b == null ? (typeof a === 'string' ? '' : 0) : b;
            const x = typeof A === 'string' && typeof B === 'string' ? A.toLowerCase() : A, y = typeof A === 'string' && typeof B === 'string' ? B.toLowerCase() : B;
            return n.o === '=' ? x === y : n.o === '<>' ? x !== y : n.o === '<' ? x < y : n.o === '>' ? x > y : n.o === '<=' ? x <= y : x >= y;
          }
          const x = num(a), y = num(b); if (esErr(x)) return x; if (esErr(y)) return y;
          if (n.o === '+') return x + y; if (n.o === '-') return x - y; if (n.o === '*') return x * y;
          if (n.o === '/') return y === 0 ? ERR.DIV : x / y; if (n.o === '^') return Math.pow(x, y);
        }
      }
      return ERR.VAL;
    }
    const esc = v => (Array.isArray(v) ? (v.length === 1 ? v[0] : ERR.VAL) : v);
    return {
      val: (h, r, c) => celda(h, r, c),
      reset: () => { memo = new Map(); },
      hoja: n => hojaDe(n, -1),
    };
  }
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

  /* ---------- ajustar fórmulas al insertar, borrar o mover ---------- */
  // f(hojaIdx, eje: 'r'|'c', índice) -> nuevo índice o null (borrado)
  function reescribir(formula, hActual, H, mover) {
    if (typeof formula !== 'string' || formula[0] !== '=') return formula;
    let T; try { T = fichas(formula.slice(1)); } catch (e) { return formula; }
    let out = '', ult = 0; const src = formula.slice(1);
    for (const t of T) {
      if (t.k !== 'ref') continue;
      const hi = t.hoja == null ? hActual : H.findIndex(x => norm(x.nombre) === norm(t.hoja));
      if (hi < 0) continue;
      const ext = r => ({ r: mover(hi, 'r', r.r), c: mover(hi, 'c', r.c) });
      let a = ext(t.r1), b = t.r2 ? ext(t.r2) : null;
      let txt;
      if (a.r == null || a.c == null || (b && (b.r == null || b.c == null))) {
        // si es un rango y se borró solo un borde, se encoge; si se borró todo, #REF!
        if (b) { const rr = encoger(hi, t, mover); if (rr) { a = rr[0]; b = rr[1]; } else txt = '#REF!'; } else txt = '#REF!';
      }
      if (!txt) {
        const pre = t.hoja == null ? '' : (/^[A-Za-zÀ-ÿ_][\wÀ-ÿ.]*$/.test(t.hoja) ? t.hoja : "'" + t.hoja.replace(/'/g, "''") + "'") + '!';
        const d = (x, f) => (f.fc ? '$' : '') + colLet(x.c) + (f.fr ? '$' : '') + (x.r + 1);
        if (b) { const r0 = Math.min(a.r, b.r), r1 = Math.max(a.r, b.r), c0 = Math.min(a.c, b.c), c1 = Math.max(a.c, b.c); txt = pre + d({ r: r0, c: c0 }, t.r1) + ':' + d({ r: r1, c: c1 }, t.r2); }
        else txt = pre + d(a, t.r1);
      }
      out += src.slice(ult, t.a) + txt; ult = t.b;
    }
    return '=' + out + src.slice(ult);
  }
  function encoger(hi, t, mover) {
    const r0 = Math.min(t.r1.r, t.r2.r), r1 = Math.max(t.r1.r, t.r2.r), c0 = Math.min(t.r1.c, t.r2.c), c1 = Math.max(t.r1.c, t.r2.c);
    const filas = []; for (let r = r0; r <= r1; r++) { const n = mover(hi, 'r', r); if (n != null) filas.push(n); }
    const cols = []; for (let c = c0; c <= c1; c++) { const n = mover(hi, 'c', c); if (n != null) cols.push(n); }
    if (!filas.length || !cols.length) return null;
    return [{ r: Math.min(...filas), c: Math.min(...cols) }, { r: Math.max(...filas), c: Math.max(...cols) }];
  }
  function aplicar(libro, mover) {
    libro.hojas.forEach((h, hi) => h.filas.forEach(f => { if (f.c) f.c = f.c.map(v => reescribir(v, hi, libro.hojas, mover)); }));
  }
  const fila = (t = 'dato', n) => (n ? { t, n, c: [] } : { t, c: [] });
  function insertarFila(libro, h, r, plantilla) {
    aplicar(libro, (hi, eje, i) => (hi === h && eje === 'r' && i >= r ? i + 1 : i));
    const base = plantilla ? { t: plantilla.t === 'total' || plantilla.t === 'encab' || plantilla.t === 'titulo' || plantilla.t === 'seccion' ? 'dato' : plantilla.t, ...(plantilla.n ? { n: plantilla.n } : {}), ...(plantilla.rol ? { rol: plantilla.rol } : {}), c: [] } : fila();
    libro.hojas[h].filas.splice(r, 0, base);
  }
  function eliminarFila(libro, h, r) {
    aplicar(libro, (hi, eje, i) => (hi === h && eje === 'r' ? (i === r ? null : i > r ? i - 1 : i) : i));
    libro.hojas[h].filas.splice(r, 1);
  }
  function insertarCol(libro, h, c) {
    aplicar(libro, (hi, eje, i) => (hi === h && eje === 'c' && i >= c ? i + 1 : i));
    libro.hojas[h].filas.forEach(f => { if (f.c.length > c) f.c.splice(c, 0, ''); });
    const A = libro.hojas[h].anchos; if (A) A.splice(c, 0, A[c] || 110);
  }
  function eliminarCol(libro, h, c) {
    aplicar(libro, (hi, eje, i) => (hi === h && eje === 'c' ? (i === c ? null : i > c ? i - 1 : i) : i));
    libro.hojas[h].filas.forEach(f => { if (f.c.length > c) f.c.splice(c, 1); });
    const A = libro.hojas[h].anchos; if (A) A.splice(c, 1);
  }
  // Mover una fila de «de» a «a» (como cortar e insertar en Excel): las fórmulas siguen a sus celdas
  function moverFila(libro, h, de, a) {
    if (de === a) return;
    const n = libro.hojas[h].filas.length;
    const orden = Array.from({ length: n }, (_, i) => i); const [x] = orden.splice(de, 1); orden.splice(a, 0, x);
    const nueva = new Map(orden.map((viejo, nuevo) => [viejo, nuevo]));
    aplicar(libro, (hi, eje, i) => (hi === h && eje === 'r' && nueva.has(i) ? nueva.get(i) : i));
    const F = libro.hojas[h].filas; const [f] = F.splice(de, 1); F.splice(a, 0, f);
  }
  // Mover una columna de «de» a «a»: las fórmulas siguen a sus celdas
  function moverCol(libro, h, de, a) {
    if (de === a) return;
    const H = libro.hojas[h], n = Math.max(de, a, ...H.filas.map(f => (f.c || []).length - 1)) + 1;
    const orden = Array.from({ length: n }, (_, i) => i); const [x] = orden.splice(de, 1); orden.splice(a, 0, x);
    const nueva = new Map(orden.map((viejo, nuevo) => [viejo, nuevo]));
    aplicar(libro, (hi, eje, i) => (hi === h && eje === 'c' && nueva.has(i) ? nueva.get(i) : i));
    H.filas.forEach(f => { const c = f.c || []; while (c.length < n) c.push(''); const [v] = c.splice(de, 1); c.splice(a, 0, v); while (c.length && (c[c.length - 1] === '' || c[c.length - 1] == null)) c.pop(); f.c = c; });
    if (H.anchos) { while (H.anchos.length < n) H.anchos.push(120); const [w] = H.anchos.splice(de, 1); H.anchos.splice(a, 0, w); }
  }
  // Copiar una fórmula a otra celda moviendo sus referencias relativas (llenar a la derecha o hacia abajo)
  function desplazar(formula, dr, dc) {
    if (typeof formula !== 'string' || formula[0] !== '=') return formula;
    let T; try { T = fichas(formula.slice(1)); } catch (e) { return formula; }
    const src = formula.slice(1); let out = '', ult = 0;
    for (const t of T) {
      if (t.k !== 'ref') continue;
      const m = x => ({ r: x.fr ? x.r : x.r + dr, c: x.fc ? x.c : x.c + dc });
      const a = m(t.r1), b = t.r2 ? m(t.r2) : null;
      const pre = t.hoja == null ? '' : (/^[A-Za-zÀ-ÿ_][\wÀ-ÿ.]*$/.test(t.hoja) ? t.hoja : "'" + t.hoja.replace(/'/g, "''") + "'") + '!';
      const d = (x, f) => (x.r < 0 || x.c < 0 ? '#REF!' : (f.fc ? '$' : '') + colLet(x.c) + (f.fr ? '$' : '') + (x.r + 1));
      out += src.slice(ult, t.a) + pre + d(a, t.r1) + (b ? ':' + d(b, t.r2) : ''); ult = t.b;
    }
    return '=' + out + src.slice(ult);
  }

  /* ---------- el flujo para el resto del sitio ---------- */
  // Las filas con «rol» (ingreso, gasto, inversión) de la hoja del flujo, con sus valores año a año
  function flujos(libro) {
    const F = libro.flujo || {}; const h = F.hoja != null ? F.hoja : libro.hojas.length - 1, hoja = libro.hojas[h]; if (!hoja) return [];
    const E = crear(libro), c0 = F.col0 != null ? F.col0 : 1, n = F.anios || 10, out = [];
    // cada año se busca por su encabezado («Año 1», «Año 2»…): si se mueven o insertan columnas, el año sigue siendo el mismo
    const colDe = Array.from({ length: n }, (_, t) => c0 + t);
    const enc = hoja.filas.find(f => (f.c || []).some(x => /^a[nñ]o\s*1\b/i.test(String(x).trim())));
    if (enc) enc.c.forEach((x, c) => { const m = /^a[nñ]o\s*(\d+)\b/i.exec(String(x).trim()); if (m && +m[1] >= 1 && +m[1] <= n) colDe[+m[1] - 1] = c; });
    hoja.filas.forEach((f, r) => {
      if (!f.rol) return;
      const valores = Array.from({ length: n }, (_, t) => { const v = E.val(h, r, colDe[t]); return typeof v === 'number' ? Math.round(v * 100) / 100 : 0; });
      const concepto = String((f.c || [])[F.colNombre || 0] || '').trim() || 'Concepto';
      // la inversión se registra en positivo aunque en la hoja sea una salida de caja (negativa)
      out.push({ concepto, tipo: f.rol, valores: f.rol === 'inversion' ? valores.map(v => Math.abs(v)) : valores, ...(f.cat ? { categoria: f.cat } : {}) });
    });
    return out;
  }

  return { crear, arbol, fichas, colLet, colNum, dir, esErr, ERR, norm, reescribir, insertarFila, eliminarFila, insertarCol, eliminarCol, moverFila, moverCol, desplazar, flujos };
});
