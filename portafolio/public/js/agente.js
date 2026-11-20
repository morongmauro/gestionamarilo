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

  // «Mente de Amarilo»: una nube de puntos que respira mientras espera y, cuando piensa,
  // se ordena en el cuadro del logo y lo recorre. Los puntos son los mismos en la bienvenida
  // y en la burbuja de «leyendo», así que pasan de una forma a la otra sin saltos.
  const Mente = (() => {
    const N = 80, ND = 150, P = [], Q = [], CH = [];
    const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    let modo = 'espera', raf = 0, mezcla = 0, energia = 0;
    const t0 = performance.now(), azar = (a, b) => a + Math.random() * (b - a);
    const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
    // El logo: dos escuadras que forman el cuadro (arriba-izquierda y abajo-derecha)
    // ida y vuelta por cada escuadra: así ningún punto salta del final al comienzo
    const ruta = (k, s0) => { const u = (s0 % 1) * 2, s = u < 1 ? u : 2 - u, d = s * 1.34; return k === 0 ? (d < 0.62 ? [0, 0.62 - d] : [d - 0.62, 0]) : (d < 0.62 ? [1, 0.38 + d] : [1 - (d - 0.62), 1]); };
    const lobulos = [[0.36, 0.48], [0.62, 0.52], [0.5, 0.36], [0.47, 0.62]];
    // Neuronas: los puntos grandes, unidos por líneas
    for (let i = 0; i < N; i++) { const [cx, cy] = lobulos[i % 4]; P.push({ hx: cx + gauss() * 0.1, hy: cy + gauss() * 0.11, x: azar(0.3, 0.7), y: azar(0.3, 0.7), ph: azar(0, 6.283), sp: azar(0.35, 1), r: azar(1.1, 2.5), am: i % 3 === 0, k: i % 2, s: (i / N + Math.random() * 0.04) % 1 }); }
    // Polvo: puntos diminutos que orbitan la nube y, al pensar, corren por el cuadro como una corriente
    for (let i = 0; i < ND; i++) Q.push({ a: azar(0, 6.283), rad: azar(0.12, 0.48), w: azar(0.08, 0.35) * (Math.random() < 0.5 ? -1 : 1), x: 0.5, y: 0.5, r: azar(0.35, 0.95), ph: azar(0, 6.283), k: i % 2, s: Math.random(), v: azar(0.12, 0.32), off: azar(-0.09, 0.09), am: Math.random() < 0.45 });
    function cuadro(cv) {
      const dpr = Math.min(2, window.devicePixelRatio || 1), w = Math.round(cv.clientWidth * dpr), h = Math.round(cv.clientHeight * dpr);
      if (w && h && (cv.width !== w || cv.height !== h)) { cv.width = w; cv.height = h; }
      const W = cv.width, H = cv.height; if (!W || !H) return;
      const g = cv.getContext('2d'), osc = document.documentElement.getAttribute('data-theme') === 'dark';
      const t = reduce ? 2 : (performance.now() - t0) / 1000, esc = Math.max(0.75, Math.min(W, H) / 170 / dpr) * dpr;
      mezcla += ((modo === 'piensa' ? 1 : 0) - mezcla) * (reduce ? 1 : 0.045); energia *= 0.95;
      const S = Math.min(W, H) * 0.66, ox = (W - S) / 2, oy = (H - S) / 2, resp = 1 + Math.sin(t * 0.9) * 0.035;
      const logo = (k, s, o) => { const [lx, ly] = ruta(k, s); const nx = k === 0 ? (ly > 0.01 ? -1 : 0) : (ly < 0.99 ? 1 : 0), ny = k === 0 ? (ly > 0.01 ? 0 : -1) : (ly < 0.99 ? 0 : 1); return [(ox + (lx + nx * o) * S) / W, (oy + (ly + ny * o) * S) / H]; };
      for (const p of P) {
        const a = t * p.sp * 0.42 + p.ph, ag = 1 + energia * 1.6;
        const cx = 0.5 + (p.hx - 0.5) * resp + (Math.sin(a) * 0.035 + Math.sin(a * 0.41 + p.ph) * 0.025) * ag;
        const cy = 0.5 + (p.hy - 0.5) * resp + (Math.cos(a * 0.83) * 0.03 + Math.cos(a * 0.29 + p.ph) * 0.02) * ag;
        const [lx, ly] = logo(p.k, p.s + t * 0.035, Math.sin(t * 3 + p.ph) * 0.012);
        const tx = cx * (1 - mezcla) + lx * mezcla, ty = cy * (1 - mezcla) + ly * mezcla;
        p.x += (tx - p.x) * (reduce ? 1 : 0.075); p.y += (ty - p.y) * (reduce ? 1 : 0.075);
      }
      for (const q of Q) {
        const a = q.a + t * q.w * (1 + energia * 2), rr = q.rad * (1 + Math.sin(t * 0.7 + q.ph) * 0.12);
        const cx = 0.5 + Math.cos(a) * rr * 0.8, cy = 0.5 + Math.sin(a) * rr * 0.62;
        const [lx, ly] = logo(q.k, q.s + t * q.v * 0.5, q.off + Math.sin(t * 5 + q.ph) * 0.02);
        const tx = cx * (1 - mezcla) + lx * mezcla, ty = cy * (1 - mezcla) + ly * mezcla;
        q.x += (tx - q.x) * (reduce ? 1 : 0.06); q.y += (ty - q.y) * (reduce ? 1 : 0.06);
      }
      // Estela: el cuadro anterior se desvanece en vez de borrarse (más larga cuando piensa)
      if (reduce) g.clearRect(0, 0, W, H);
      const fade = reduce ? 1 : 0.42 - mezcla * 0.2;
      if (!reduce) { g.globalCompositeOperation = 'destination-out'; g.fillStyle = `rgba(0,0,0,${fade.toFixed(3)})`; g.fillRect(0, 0, W, H); g.globalCompositeOperation = 'source-over'; }
      const tinta = osc ? '201,195,214' : '22,11,41', oro = '255,201,0', D = 34 * esc * (1 - mezcla * 0.45);
      // Halo suave que late detrás de la mente
      const hr = Math.min(W, H) * (0.42 + 0.04 * Math.sin(t * 1.4)), halo = g.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, hr);
      halo.addColorStop(0, `rgba(${oro},${((0.06 + mezcla * 0.05 + energia * 0.05) * fade).toFixed(3)})`); halo.addColorStop(1, `rgba(${oro},0)`);
      g.fillStyle = halo; g.fillRect(0, 0, W, H);
      g.lineWidth = Math.max(0.6, 0.8 * esc);
      const vec = [];
      for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
        const a = P[i], b = P[j], dx = (a.x - b.x) * W, dy = (a.y - b.y) * H, d = Math.hypot(dx, dy); if (d > D) continue;
        vec.push([i, j]);
        g.strokeStyle = `rgba(${a.am && b.am ? oro : tinta},${((1 - d / D) * (0.1 - mezcla * 0.04 + energia * 0.1)).toFixed(3)})`;
        g.beginPath(); g.moveTo(a.x * W, a.y * H); g.lineTo(b.x * W, b.y * H); g.stroke();
      }
      // Chispas: una señal que viaja de una neurona a otra (más seguido cuando piensa)
      if (!reduce && vec.length && Math.random() < 0.05 + mezcla * 0.35 + energia * 0.3) { const [i, j] = vec[Math.floor(Math.random() * vec.length)]; CH.push({ i, j, t0: t, dur: azar(0.35, 0.8) }); }
      for (let c = CH.length - 1; c >= 0; c--) {
        const ch = CH[c], f = (t - ch.t0) / ch.dur; if (f >= 1 || CH.length > 40) { CH.splice(c, 1); continue; }
        const a = P[ch.i], b = P[ch.j], x = (a.x + (b.x - a.x) * f) * W, y = (a.y + (b.y - a.y) * f) * H;
        const gl = g.createRadialGradient(x, y, 0, x, y, 6 * esc); gl.addColorStop(0, `rgba(${oro},0.9)`); gl.addColorStop(1, `rgba(${oro},0)`);
        g.fillStyle = gl; g.beginPath(); g.arc(x, y, 6 * esc, 0, 6.283); g.fill();
        g.fillStyle = 'rgba(255,240,180,1)'; g.beginPath(); g.arc(x, y, 1.1 * esc, 0, 6.283); g.fill();
      }
      for (const q of Q) {
        const tw = 0.5 + 0.5 * Math.sin(t * 3.1 + q.ph);
        g.fillStyle = `rgba(${q.am ? oro : tinta},${(0.18 + tw * 0.45 + mezcla * 0.15).toFixed(3)})`;
        g.beginPath(); g.arc(q.x * W, q.y * H, q.r * esc * (0.7 + tw * 0.5), 0, 6.283); g.fill();
      }
      for (const p of P) {
        const pulso = mezcla * (0.5 + 0.5 * Math.sin(t * 4.2 - p.s * 14)), al = 0.42 + 0.3 * Math.sin(t * 1.3 + p.ph) * (1 - mezcla) + pulso * 0.5;
        g.fillStyle = `rgba(${p.am ? oro : tinta},${Math.min(1, al + (p.am ? 0.25 : 0)).toFixed(3)})`;
        g.beginPath(); g.arc(p.x * W, p.y * H, p.r * esc * (1 - mezcla * 0.25 + pulso * 0.5), 0, 6.283); g.fill();
      }
    }
    function ciclo() { raf = 0; const cvs = document.querySelectorAll('.ag-win canvas.ag-mente'); if (!cvs.length) return; cvs.forEach(cuadro); if (!reduce) raf = requestAnimationFrame(ciclo); }
    const andar = () => { if (!raf) raf = requestAnimationFrame(ciclo); };
    return { modo: m => { modo = m; andar(); }, excitar: () => { energia = Math.min(1, energia + 0.35); andar(); }, andar, parar: () => { if (raf) cancelAnimationFrame(raf); raf = 0; } };
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
