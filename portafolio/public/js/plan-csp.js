/* ============================================================
   PLAN · puente con la política de seguridad (CSP)
   La hoja del plan (public/plan/plan.js, la misma de la app de gestión)
   pinta botones con onclick="planSetOpt('zoom','mes')" y similares.
   Este portafolio no deja correr JavaScript escrito dentro del HTML
   (script-src 'self'), así que:
     1) lo que devuelve Plan.render pasa por aquí y cada onclick/onchange/
        onkeydown queda como data-plan-click/-change/-keydown, y
     2) un solo escuchador por tipo de evento lee esa instrucción y la
        ejecuta con un intérprete mínimo que solo conoce lo que usa la
        hoja: llamar planOn…/planSetOpt/Plan.… con textos, números,
        true/false/null, this, this.value(.trim()), Number(…), event.key,
        objetos {clave:valor} y un «if(…)» delante. Nada más se ejecuta.
   ============================================================ */
'use strict';
(function () {
  const EVENTOS = ['click', 'change', 'keydown'];
  const RX = / on(click|change|keydown)="/g;
  const sinInline = html => String(html).replace(RX, ' data-plan-$1="');

  // ---------- Intérprete mínimo ----------
  function tokens(src) {
    const out = [];
    let i = 0;
    while (i < src.length) {
      const c = src[i];
      if (/\s/.test(c)) { i++; continue; }
      if (c === "'" || c === '"') {
        let j = i + 1, s = '';
        while (j < src.length && src[j] !== c) { if (src[j] === '\\' && j + 1 < src.length) { s += src[j + 1]; j += 2; } else s += src[j++]; }
        if (j >= src.length) throw new Error('texto sin cerrar');
        out.push({ t: 'str', v: s }); i = j + 1; continue;
      }
      const num = /^-?\d+(\.\d+)?/.exec(src.slice(i));
      if (num && (c !== '-' || !out.length || ['(', ',', ':', '==='].includes(out[out.length - 1].v))) { out.push({ t: 'num', v: Number(num[0]) }); i += num[0].length; continue; }
      const id = /^[A-Za-z_$][\w$]*/.exec(src.slice(i));
      if (id) { out.push({ t: 'id', v: id[0] }); i += id[0].length; continue; }
      if (src.startsWith('===', i)) { out.push({ t: 'p', v: '===' }); i += 3; continue; }
      if ('(){},:.!;'.includes(c)) { out.push({ t: 'p', v: c }); i++; continue; }
      throw new Error('símbolo no permitido: ' + c);
    }
    return out;
  }
  const PERMITIDA = n => /^plan[A-Z]\w*$/.test(n) || n === 'toast';
  const METODOS_PLAN = ['pickDate', 'cambiarDuracion'];

  function ejecutar(src, el, ev) {
    const tk = tokens(src);
    let k = 0;
    const ver = () => tk[k], toma = v => { const x = tk[k]; if (!x || (v !== undefined && x.v !== v)) throw new Error('se esperaba ' + v); k++; return x; };
    const es = v => tk[k] && tk[k].t === 'p' && tk[k].v === v;

    function valor() {
      const x = ver(); if (!x) throw new Error('falta un valor');
      if (x.t === 'p' && x.v === '!') { k++; return !valor(); }
      if (x.t === 'str' || x.t === 'num') { k++; return x.v; }
      if (x.t === 'p' && x.v === '{') {
        k++; const o = {};
        while (!es('}')) {
          const key = toma(); if (key.t !== 'id' && key.t !== 'str') throw new Error('clave inválida');
          if (['__proto__', 'constructor', 'prototype'].includes(key.v)) throw new Error('clave no permitida');
          toma(':'); o[key.v] = valor();
          if (es(',')) k++; else break;
        }
        toma('}'); return o;
      }
      if (x.t !== 'id') throw new Error('valor inválido');
      k++;
      if (x.v === 'true') return true;
      if (x.v === 'false') return false;
      if (x.v === 'null') return null;
      if (x.v === 'Number') { toma('('); const v = valor(); toma(')'); return Number(v); }
      if (x.v === 'this' || x.v === 'event') {
        let v = x.v === 'this' ? el : ev;
        while (es('.')) {
          k++; const p = toma().v;
          if (x.v === 'this' && p === 'value') v = v.value;
          else if (x.v === 'event' && p === 'key') v = v.key;
          else if (p === 'trim' && typeof v === 'string') { toma('('); toma(')'); v = v.trim(); }
          else throw new Error('propiedad no permitida: ' + p);
        }
        return v;
      }
      throw new Error('nombre no permitido: ' + x.v);
    }
    function llamada() {
      const n = toma(); if (n.t !== 'id') throw new Error('se esperaba una función');
      let fn;
      if (n.v === 'Plan') { toma('.'); const m = toma().v; if (!METODOS_PLAN.includes(m)) throw new Error('Plan.' + m + ' no permitido'); fn = window.Plan[m]; }
      else if (PERMITIDA(n.v)) fn = window[n.v];
      else throw new Error('función no permitida: ' + n.v);
      toma('('); const args = [];
      while (!es(')')) { args.push(valor()); if (es(',')) k++; else break; }
      toma(')');
      if (typeof fn === 'function') fn.apply(null, args);
    }
    while (k < tk.length) {
      if (tk[k].t === 'id' && tk[k].v === 'if') {
        k++; toma('(');
        let c = valor();
        if (es('===')) { k++; c = c === valor(); }
        toma(')');
        if (c) llamada(); else { // saltar la llamada sin ejecutarla
          let prof = 0;
          while (k < tk.length) { const v = tk[k++].v; if (v === '(') prof++; else if (v === ')' && --prof === 0) break; }
        }
      } else llamada();
      if (es(';')) k++;
    }
  }

  // ---------- Un escuchador por evento: recorre de adentro hacia afuera, como el navegador ----------
  EVENTOS.forEach(tipo => {
    document.addEventListener(tipo, ev => {
      let el = ev.target && ev.target.closest ? ev.target.closest(`[data-plan-${tipo}]`) : null;
      while (el) {
        try { ejecutar(el.getAttribute(`data-plan-${tipo}`), el, ev); }
        catch (e) { console.warn('plan:', e.message, el.getAttribute(`data-plan-${tipo}`)); }
        if (ev.cancelBubble) break;
        el = el.parentElement && el.parentElement.closest(`[data-plan-${tipo}]`);
      }
    });
  });

  // Plan.render devuelve el HTML ya sin JavaScript en línea
  if (window.Plan && !window.Plan.__csp) {
    const render = window.Plan.render;
    window.Plan.render = (m, o) => sinInline(render(m, o));
    window.Plan.__csp = true;
  }
  window.PlanCSP = { sinInline, ejecutar };
})();
