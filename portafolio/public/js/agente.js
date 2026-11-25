/* ============================================================
   AGENTE «Pregúntele al portafolio»
   Botón siempre a mano (abajo a la derecha) que abre una ventana de chat.
   Responde con Claude desde el servidor (/api/agente) usando solo lo que
   esta persona puede ver: el resumen se arma aquí con sus propios datos.
   ============================================================ */
'use strict';
(function () {
  const { esc } = App;
  let hist = []; try { hist = JSON.parse(sessionStorage.getItem('pf.agente') || '[]'); } catch (e) { hist = []; }
  const guardar = () => { try { sessionStorage.setItem('pf.agente', JSON.stringify(hist.slice(-20))); } catch (e) {} };
  let ocupado = false, win = null;

  // «Mente de Amarilo»: una cabeza de perfil hecha de puntos (gris, negro y amarillo, como una trama de impresión)
  // que gira despacio y respira; cada tanto los puntos se reagrupan en el logo de Amarilo y vuelven.
  // Mientras se escribe, ondas que salen del oído (escucha). Mientras piensa, una ola amarilla y el logo más seguido.
  const Mente = (() => {
    const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    let modo = 'espera', raf = 0, energia = 0, desde = 0, forma = 'cabeza', luz = 0;
    const t0 = performance.now();
    // Perfil mirando a la derecha, en una caja de 100 × 100: nuca, coronilla, frente, nariz, labios, mentón y cuello
    const CABEZA = 'M40 9C58 5 75 13 80 30C82 37 81 42 83 47L90 58C91.5 60.5 89.5 62 86.5 62.5L85 63.5C86.5 66 85.5 68 83 69C84.5 71 84 73.5 81 74.5C81.5 79 80.5 83 76.5 85C71 87 65 85.5 61 87.5L61 98L31 98L33 84C22 77 15.5 64 16 47.5C16.5 26 25 12 40 9Z';
    // El logo: dos escuadras gruesas (arriba-izquierda y abajo-derecha)
    const enLogo = (x, y) => (x >= 18 && x <= 30 && y >= 18 && y <= 66) || (x >= 18 && x <= 76 && y >= 18 && y <= 30) || (x >= 70 && x <= 82 && y >= 34 && y <= 82) || (x >= 24 && x <= 82 && y >= 70 && y <= 82);
    let P = null, nLogo = 0;
    function preparar() {
      if (P) return true;
      try {
        const cv = document.createElement('canvas'); cv.width = cv.height = 10; const g = cv.getContext('2d'), path = new Path2D(CABEZA);
        const paso = 2.15, cab = [], logo = [];
        for (let y = 4; y < 100; y += paso * 0.87) for (let x = 10 + ((Math.round(y / (paso * 0.87)) % 2) * paso / 2); x < 96; x += paso) {
          if (g.isPointInPath(path, x, y)) cab.push([x, y]);
          if (enLogo(x, y)) logo.push([x, y]);
        }
        const gauss = (x, y, cx, cy, s) => Math.exp(-((x - cx) ** 2 + (y - cy) ** 2) / (2 * s * s));
        P = cab.map(([x, y], i) => {
          // sombra: la nuca más oscura, el ojo, el oído, la mejilla y bajo el mentón; la frente y la nariz con luz
          let s = 0.38 + (52 - x) / 85 + 0.45 * gauss(x, y, 71, 44, 4.5) + 0.35 * gauss(x, y, 41, 52, 6) + 0.25 * gauss(x, y, 66, 66, 7) + 0.35 * gauss(x, y, 62, 88, 6) - 0.3 * gauss(x, y, 74, 27, 9);
          // el contorno se marca más (así se lee el perfil: frente, nariz, labios, mentón)
          const borde = [[2.6, 0], [-2.6, 0], [0, 2.6], [0, -2.6], [1.9, 1.9], [-1.9, 1.9], [1.9, -1.9], [-1.9, -1.9]].some(([dx, dy]) => !g.isPointInPath(path, x + dx, y + dy));
          s = Math.max(0.3, Math.min(1, s + (borde ? 0.55 : 0)));
          const am = gauss(x, y, 52, 32, 16) > 0.35 && Math.random() < 0.22; // algunos puntos amarillos en la frente (la idea)
          return { hx: x, hy: y, s, am, x, y, ph: Math.random() * 6.283, lx: 50, ly: 50, vis: 1 };
        });
        // a cada punto, un lugar en el logo (los que sobran se desvanecen)
        const orden = P.map((p, i) => i).sort((a, b) => P[a].hy - P[b].hy || P[a].hx - P[b].hx);
        logo.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
        nLogo = Math.min(logo.length, P.length);
        orden.forEach((pi, k) => { const p = P[pi]; if (k < nLogo) { const q = logo[Math.floor(k * logo.length / nLogo)]; p.lx = q[0]; p.ly = q[1]; p.enL = true; } else { const q = logo[k % logo.length]; p.lx = q[0]; p.ly = q[1]; p.enL = false; } });
        return true;
      } catch (e) { return false; }
    }
    // Ritmo: esperando, casi siempre la cabeza y cada tanto el logo; pensando, alterna más rápido
    function elegir(t) {
      const ciclo = modo === 'piensa' ? [['cabeza', 1.9], ['logo', 1.5]] : [['cabeza', 5.5], ['logo', 2.2]];
      const tot = ciclo.reduce((a, c) => a + c[1], 0); let x = ((t - desde) % tot + tot) % tot;
      for (const [f, d] of ciclo) { if (x < d) return f; x -= d; }
      return 'cabeza';
    }
    function cuadro(cv, t) {
      const dpr = Math.min(2, window.devicePixelRatio || 1), w = Math.round(cv.clientWidth * dpr), h = Math.round(cv.clientHeight * dpr);
      if (w && h && (cv.width !== w || cv.height !== h)) { cv.width = w; cv.height = h; }
      const W = cv.width, H = cv.height; if (!W || !H) return;
      const g = cv.getContext('2d'), osc = document.documentElement.getAttribute('data-theme') === 'dark';
      const S = Math.min(W, H) * 0.94, ox = (W - S) / 2, oy = (H - S) / 2, k = S / 100;
      const giro = reduce ? 0 : Math.sin(t * 0.55) * 0.42, cg = Math.cos(giro), sg = Math.sin(giro), resp = 1 + Math.sin(t * 1.3) * 0.012;
      luz += ((modo === 'piensa' ? 1 : 0) - luz) * 0.05;
      g.clearRect(0, 0, W, H);
      const tinta = osc ? [214, 208, 228] : [28, 22, 38];
      for (const p of P) {
        let tx, ty, vis = 1;
        if (forma === 'logo') { tx = p.lx; ty = p.ly; vis = p.enL ? 1 : 0; }
        else {
          // giro en 3D: la cabeza se ve más angosta al voltear, y respira
          tx = 50 + (p.hx - 50) * cg * resp; ty = 50 + (p.hy - 50) * resp;
          // escucha: ondas que salen del oído mientras se escribe
          if (energia > 0.02) { const dx = p.hx - 41, dy = p.hy - 52, d = Math.hypot(dx, dy) || 1, o = Math.sin(d * 0.32 - t * 11) * energia * 2.6; tx += dx / d * o; ty += dy / d * o; }
        }
        const v = reduce ? 1 : 0.13;
        p.x += (tx - p.x) * v; p.y += (ty - p.y) * v; p.vis += (vis - p.vis) * v;
        if (p.vis < 0.03) continue;
        // sombra según el giro (el lado que se aleja se oscurece) y una ola amarilla cuando piensa
        const s = forma === 'logo' ? 0.8 : Math.max(0.25, Math.min(1, p.s + sg * (p.hx - 50) / -140));
        const ola = luz * Math.max(0, Math.sin(t * 3.2 - p.hy * 0.11 + p.hx * 0.04)) ** 3;
        const amar = p.am ? 0.75 + 0.25 * Math.sin(t * 2 + p.ph) : 0;
        const a = forma === 'logo' ? (p.ph < 5.2 ? 0.9 : 0) : Math.max(amar, ola); // el logo, amarillo como el de Amarilo, con algo de textura
        const col = a > 0.35 ? [255, 201, 0] : tinta;
        const onda = energia > 0.02 && forma !== 'logo' ? energia * Math.max(0, Math.sin(Math.hypot(p.hx - 41, p.hy - 52) * 0.32 - t * 11)) : 0;
        const alfa = (0.3 + s * 0.68 + onda * 0.35) * p.vis;
        const r = (0.28 + s * 0.62 + (a > 0.35 ? 0.15 : 0)) * k * 0.62;
        g.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${Math.min(1, alfa).toFixed(3)})`;
        g.beginPath(); g.arc(ox + p.x * k, oy + p.y * k, r, 0, 6.283); g.fill();
      }
    }
    function ciclo() {
      raf = 0; const cvs = document.querySelectorAll('.ag-win canvas.ag-mente'); if (!cvs.length || !preparar()) return;
      const t = reduce ? 0 : (performance.now() - t0) / 1000;
      energia *= 0.965; forma = reduce ? 'cabeza' : elegir(t);
      cvs.forEach(cv => cuadro(cv, t));
      if (!reduce) raf = requestAnimationFrame(ciclo);
    }
    const andar = () => { if (!raf) raf = requestAnimationFrame(ciclo); };
    return {
      modo: m => { if (m !== modo) { modo = m; desde = (performance.now() - t0) / 1000; } andar(); },
      // al escribir: escucha (ondas desde el oído) y vuelve a la cabeza si estaba en el logo
      excitar: () => { energia = Math.min(1, energia + 0.4); if (modo === 'espera' && forma === 'logo') desde = (performance.now() - t0) / 1000; andar(); },
      andar, parar: () => { if (raf) cancelAnimationFrame(raf); raf = 0; },
    };
  })();

  const m = v => (v ? App.moneyShort(v) : '$0');
  // Resumen del portafolio que la persona puede ver (un invitado solo recibe sus iniciativas)
  function contexto() {
    const Y = +App.d.today().slice(0, 4), ec = App.estadoCol(), L = [];
    let D = null; try { D = App.Dash.datos({ anio: Y, estado: '', tipo: '', alcance: 'todos' }); } catch (e) { D = null; }
    const filas = new Map(D ? D.filas.map(f => [f.p.id, f]) : []);
    const ps = App.projectsSorted().filter(p => !App.esEjemplo(p));
    if (D) L.push(`Totales ${Y} (aproximados): capturado ${m(D.captadoY)}; proyectado en el año ${m(D.proyectadoY)}. Iniciativas: ${ps.length}.`);
    const prop = (p, id) => { const v = (p.props || {})[id]; return Array.isArray(v) ? v.join(', ') : v == null ? '' : String(v); };
    for (const p of ps) {
      const f = filas.get(p.id), pl = App.planOf(p.id), caso = App.caseOf(p.id), rr = App.Riesgos ? App.Riesgos.resumen(p) : null;
      const o = [`## id=${p.id} · ${App.projectName(p)}`];
      o.push([`fase: ${ec ? prop(p, ec.id) || 'sin fase' : '—'}`, prop(p, 'tipo_valor') && `tipo de valor: ${prop(p, 'tipo_valor')}`, prop(p, 'revision_dgv') && `revisión DGV: ${prop(p, 'revision_dgv')}`,
        prop(p, 'habilitadores') && `habilitadores: ${prop(p, 'habilitadores')}`, prop(p, 'realizadores') && `realizadores: ${prop(p, 'realizadores')}`].filter(Boolean).join('; '));
      if (p.frase) o.push('qué es: ' + p.frase);
      o.push(pl.acts.length ? `cronograma: ${pl.acts.length} actividades, avance ${pl.avance} %, ${pl.atrasadas || 0} atrasadas${pl.fin ? ', termina ' + pl.fin : ''}` : 'cronograma: sin actividades');
      const vc = Number((p.props || {}).valor_crear) || 0, dos = caso && App.Avance && window.Finanzas ? App.Avance.dosAnios(Finanzas.calc(caso)) : 0;
      o.push([vc ? `valor a crear/capturar (Notion): ${m(vc)}` : '', caso ? `caso de negocio: ${(caso.estado || 'borrador').toLowerCase()}${dos ? ', ' + m(dos) + ' a dos años' : ''}` : 'sin caso de negocio',
        f ? `capturado ${Y} aprox.: ${m(f.cap)}` : '', f && f.desde ? `capturando desde ${f.desde}` : '', App.iceOf(p) != null ? `ICE ${App.num(App.iceOf(p), 1)}` : ''].filter(Boolean).join('; '));
      if (rr && rr.n) o.push(`riesgos abiertos: ${rr.n} (${rr.criticos} críticos, ${rr.altos} altos): ` + App.Riesgos.lista(p).filter(r => r.estado !== 'Cerrado').sort((a, b) => App.Riesgos.actual(b) - App.Riesgos.actual(a)).slice(0, 3).map(r => r.titulo || 'sin título').join(' | '));
      const nv = App.Novedades ? App.Novedades.lista(p.id).slice(0, 6) : [];
      if (nv.length) o.push('novedades recientes: ' + nv.map(n => `${n.fecha} ${App.Novedades.TIPOS[n.tipo] || ''}: ${n.texto}${n.tipo === 'auto' ? '' : ' (' + (n.autor || '') + ')'}`).join(' || '));
      const ses = App.S.sessions.filter(s => (s.proyectos || []).includes(p.id) && s.fecha >= App.d.today() && s.estado !== 'Cancelada').map(s => s.fecha).sort()[0];
      if (ses) o.push('próximo comité: ' + ses);
      L.push(o.join('\n'));
    }
    const prox = App.S.sessions.filter(s => s.fecha >= App.d.today() && s.estado !== 'Cancelada').sort((a, b) => a.fecha.localeCompare(b.fecha)).slice(0, 6);
    if (prox.length) L.push('Próximos comités: ' + prox.map(s => `${s.fecha} ${App.Agenda ? App.Agenda.tituloOf(s) : 'Comité'} (${(s.proyectos || []).length} iniciativas)`).join('; '));
    return L.join('\n\n').slice(0, 140000);
  }

  // Texto de la respuesta: negritas, listas y nombres de iniciativa que se abren
  function formato(t) {
    let h = esc(t).replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>')
      .replace(/\[\[([A-Za-z0-9_-]{6,64})\|([^\]\n]{1,160})\]\]/g, (_, id, n) => App.byId('projects', id) ? `<a class="ag-ini" href="#/proyectos/${id}">${n}</a>` : n);
    const out = []; let lista = false;
    for (const l of h.split('\n')) {
      const li = /^\s*(?:[-•*]|\d+\.)\s+(.*)$/.exec(l);
      if (li) { if (!lista) { out.push('<ul>'); lista = true; } out.push(`<li>${li[1]}</li>`); continue; }
      if (lista) { out.push('</ul>'); lista = false; }
      out.push(l.trim() ? `<p>${l}</p>` : '');
    }
    if (lista) out.push('</ul>');
    return out.join('');
  }

  const SUG = () => App.esInvitado() ? ['¿Cómo van mis iniciativas?', '¿Qué está atrasado en el cronograma?', '¿Qué novedades hay esta semana?', '¿Qué riesgos tengo abiertos?']
    : ['¿Cuánto valor llevamos capturado este año?', '¿Qué iniciativas tienen bloqueos?', '¿Qué pasó esta semana en el portafolio?', '¿Qué debería revisar el próximo comité?'];
  function pintar() {
    if (!win) return;
    const b = win.querySelector('.ag-b');
    b.innerHTML = hist.length ? hist.map(x => x.rol === 'usuario' ? `<div class="ag-q">${esc(x.texto)}</div>` : `<div class="ag-r ${x.err ? 'err' : ''}">${formato(x.texto) || '<span class="ag-pen"><canvas class="ag-mente mini" aria-hidden="true"></canvas><span>Leyendo el portafolio…</span></span>'}</div>`).join('')
      : `<div class="ag-hola"><canvas class="ag-mente" aria-hidden="true"></canvas><b>Pregúntele al portafolio</b><p>Respondo con los datos que usted puede ver: estado, cronogramas, novedades, riesgos y valor capturado.</p><div class="ag-sug">${SUG().map(s => `<button data-ag-sug>${esc(s)}</button>`).join('')}</div></div>`;
    b.scrollTop = b.scrollHeight;
    Mente.andar();
    win.querySelector('[data-ag-nueva]').hidden = !hist.length;
  }
  async function preguntar(q) {
    q = String(q || '').trim(); if (!q || ocupado) return;
    ocupado = true; win.classList.add('ocupado'); Mente.modo('piensa');
    const previo = hist.filter(x => !x.err).map(x => ({ rol: x.rol, texto: x.texto }));
    hist.push({ rol: 'usuario', texto: q }); const r = { rol: 'agente', texto: '' }; hist.push(r); pintar();
    try {
      const res = await fetch('/api/agente', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-Portafolio': '1' }, body: JSON.stringify({ pregunta: q, historial: previo, contexto: contexto() }) });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || 'El agente no respondió (' + res.status + ')'); }
      const rd = res.body.getReader(), dec = new TextDecoder();
      for (;;) { const { done, value } = await rd.read(); if (done) break; r.texto += dec.decode(value, { stream: true }); pintar(); }
      r.texto += dec.decode(); if (!r.texto.trim()) throw new Error('El agente no devolvió respuesta. Intente de nuevo.');
    } catch (e) { r.texto = e.message; r.err = true; }
    ocupado = false; win.classList.remove('ocupado'); Mente.modo('espera'); guardar(); pintar();
    const ta = win.querySelector('textarea'); if (ta) ta.focus();
  }
  function abrir() {
    if (win) { win.querySelector('textarea').focus(); return; }
    win = document.createElement('section'); win.className = 'ag-win'; win.setAttribute('role', 'dialog'); win.setAttribute('aria-label', 'Pregúntele al portafolio');
    win.innerHTML = `<header><b>Pregúntele al portafolio</b><span class="sp"></span><button class="t-lnk" data-ag-nueva title="Empezar una conversación nueva">Nueva</button><button class="ag-x" data-ag-x aria-label="Cerrar">✕</button></header>
      <div class="ag-b" aria-live="polite"></div>
      <form class="ag-f"><textarea rows="1" maxlength="2000" placeholder="Escriba su pregunta…" aria-label="Pregunta"></textarea><button class="btn primary sm" type="submit" aria-label="Enviar">Enviar</button></form>
      <div class="ag-nota">Usa solo lo que usted puede ver. Las cifras son aproximadas.</div>`;
    document.getElementById('app').appendChild(win);
    document.getElementById('agBtn').classList.add('on');
    const ta = win.querySelector('textarea');
    ta.oninput = () => { Mente.excitar(); ta.style.height = 'auto'; ta.style.height = Math.min(120, ta.scrollHeight) + 'px'; };
    ta.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); win.querySelector('form').requestSubmit(); } if (e.key === 'Escape') cerrar(); };
    win.querySelector('form').onsubmit = e => { e.preventDefault(); const q = ta.value; ta.value = ''; ta.oninput(); preguntar(q); };
    win.onclick = e => {
      if (e.target.closest('[data-ag-x]')) return cerrar();
      if (e.target.closest('[data-ag-nueva]')) { if (ocupado) return; hist = []; guardar(); return pintar(); }
      const s = e.target.closest('[data-ag-sug]'); if (s) return preguntar(s.textContent);
      if (e.target.closest('.ag-ini') && window.innerWidth < 760) cerrar();
    };
    pintar(); ta.focus();
  }
  function cerrar() { if (!win) return; Mente.parar(); win.remove(); win = null; const b = document.getElementById('agBtn'); if (b) { b.classList.remove('on'); b.focus(); } }

  // Ícono: el cuadro de Amarilo hecho de puntos (una escuadra amarilla, otra clara) que titilan
  function icono() {
    // Un cerebro de línea, con sinapsis que titilan
    const lado = m => `<path d="M14 6.2c-1.1-1.8-3.1-2.6-5-2-1.6.5-2.7 2-2.8 3.6-1.7.5-2.8 2.1-2.7 3.9.1 1 .5 1.8 1.1 2.4-.8.8-1.2 2-1.1 3.2.2 1.8 1.6 3.2 3.3 3.5.4 1.9 2 3.3 4 3.3 1.1 0 2.1-.5 2.8-1.2" transform="${m ? 'matrix(-1 0 0 1 28 0)' : ''}"/>`;
    return `<svg class="ag-ico" viewBox="0 0 28 28" aria-hidden="true"><g class="cb">${lado(false)}${lado(true)}<path d="M14 6.2v18.5"/><path d="M9.7 10.6c1.2.2 2.2 1.1 2.5 2.3M18.3 10.6c-1.2.2-2.2 1.1-2.5 2.3M8 16.3c1.3-.4 2.7 0 3.6 1M20 16.3c-1.3-.4-2.7 0-3.6 1"/></g>`
      + [[9.7, 10.6, 0], [18.3, 10.6, .5], [8, 16.3, 1], [20, 16.3, 1.5], [14, 13, .8], [11.6, 20.6, 1.2], [16.4, 20.6, .3]].map(([x, y, d]) => `<circle cx="${x}" cy="${y}" r="1.25" class="sn" style="animation-delay:${d}s"/>`).join('') + '</svg>';
  }
  function montar() {
    const app = document.getElementById('app'); if (!app || document.getElementById('agBtn')) return;
    app.insertAdjacentHTML('beforeend', `<button class="ag-btn" id="agBtn" type="button" title="Pregúntele al portafolio">${icono()}<span>Preguntar</span></button>`);
    document.getElementById('agBtn').onclick = () => (win ? cerrar() : abrir());
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montar); else montar();
  App.Agente = { abrir, cerrar, contexto, formato };
})();
