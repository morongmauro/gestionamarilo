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

  // «Mente de Amarilo»: puntos que, mientras esperan, van y vienen entre una nube y el logo de Amarilo;
  // y, mientras piensan, forman un cerebro y luego un bombillo que se enciende, una y otra vez.
  const Mente = (() => {
    const N = 90, ND = 170, P = [], Q = [], CH = [];
    const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    let modo = 'espera', raf = 0, energia = 0, forma = 'nube', desdeForma = 0, luz = 0;
    const t0 = performance.now(), azar = (a, b) => a + Math.random() * (b - a);
    const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
    // El logo: dos escuadras (arriba-izquierda y abajo-derecha), recorridas de ida y vuelta para que nada salte
    const ruta = (k, s0) => { const u = (s0 % 1 + 1) % 1 * 2, s = u < 1 ? u : 2 - u, d = s * 1.34; return k === 0 ? (d < 0.62 ? [0, 0.62 - d] : [d - 0.62, 0]) : (d < 0.62 ? [1, 0.38 + d] : [1 - (d - 0.62), 1]); };
    // Cerebro y bombillo: se dibujan con trazos (caja de 28 × 28) y se toman puntos a lo largo de ellos
    const FORMAS = {
      cerebro: [['M14 6.2c-1.1-1.8-3.1-2.6-5-2-1.6.5-2.7 2-2.8 3.6-1.7.5-2.8 2.1-2.7 3.9.1 1 .5 1.8 1.1 2.4-.8.8-1.2 2-1.1 3.2.2 1.8 1.6 3.2 3.3 3.5.4 1.9 2 3.3 4 3.3 1.1 0 2.1-.5 2.8-1.2', 3], ['espejo', 3],
        ['M14 6.2v18.5', 1], ['M9.7 10.6c1.2.2 2.2 1.1 2.5 2.3', 0.8], ['M18.3 10.6c-1.2.2-2.2 1.1-2.5 2.3', 0.8], ['M8 16.3c1.3-.4 2.7 0 3.6 1', 0.8], ['M20 16.3c-1.3-.4-2.7 0-3.6 1', 0.8], ['M10 21c.9-.6 2-.6 2.8.1', 0.6], ['M18 21c-.9-.6-2-.6-2.8.1', 0.6]],
      bombillo: [['M14 3.8a7.6 7.6 0 0 0-4.6 13.6c.9.7 1.4 1.7 1.4 2.8v1.1h6.4v-1.1c0-1.1.5-2.1 1.4-2.8A7.6 7.6 0 0 0 14 3.8z', 4], ['M10.9 23.4h6.2', 0.8], ['M11.7 25.6h4.6', 0.7],
        ['M11.6 15.4l1.2-2.2 1.2 2.2 1.2-2.2 1.2 2.2', 1.1], ['M14 .4v1.6', 0.35], ['M4.6 3.9l1.2 1.2', 0.35], ['M23.4 3.9l-1.2 1.2', 0.35], ['M1.4 11.4h1.7', 0.35], ['M24.9 11.4h1.7', 0.35]],
    };
    const PTS = {};
    function muestrear() {
      if (PTS.cerebro) return true;
      try {
        const ns = 'http://www.w3.org/2000/svg', sv = document.createElementNS(ns, 'svg'); sv.setAttribute('width', '0'); sv.setAttribute('height', '0'); sv.style.position = 'absolute'; document.body.appendChild(sv);
        for (const [k, lista] of Object.entries(FORMAS)) {
          const tr = []; let prev = null;
          for (const [d, peso] of lista) {
            if (d === 'espejo') { tr.push({ espejo: prev, peso }); continue; }
            const p = document.createElementNS(ns, 'path'); p.setAttribute('d', d); sv.appendChild(p); prev = p; tr.push({ p, peso });
          }
          const tot = tr.reduce((a, x) => a + x.peso, 0);
          const toma = n => { const out = []; tr.forEach(x => { const m = Math.max(2, Math.round(n * x.peso / tot)), el = x.p || x.espejo, L = el.getTotalLength();
            for (let i = 0; i < m; i++) { const q = el.getPointAtLength(L * (i + Math.random() * 0.6) / m); out.push([(x.espejo ? 28 - q.x : q.x) / 28, q.y / 28]); } });
            for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
            while (out.length < n) out.push(out[out.length % Math.max(1, out.length)]); return out.slice(0, n); };
          PTS[k] = { n: toma(N), d: toma(ND) };
        }
        sv.remove(); return true;
      } catch (e) { return false; }
    }
    const lobulos = [[0.36, 0.48], [0.62, 0.52], [0.5, 0.36], [0.47, 0.62]];
    for (let i = 0; i < N; i++) { const [cx, cy] = lobulos[i % 4]; P.push({ hx: cx + gauss() * 0.1, hy: cy + gauss() * 0.11, x: azar(0.3, 0.7), y: azar(0.3, 0.7), ph: azar(0, 6.283), sp: azar(0.35, 1), r: azar(1.1, 2.4), am: i % 3 === 0, k: i % 2, s: (i / N + Math.random() * 0.04) % 1 }); }
    for (let i = 0; i < ND; i++) Q.push({ a: azar(0, 6.283), rad: azar(0.12, 0.48), w: azar(0.1, 0.4) * (Math.random() < 0.5 ? -1 : 1), x: 0.5, y: 0.5, r: azar(0.35, 0.95), ph: azar(0, 6.283), k: i % 2, s: Math.random(), v: azar(0.12, 0.3), off: azar(-0.07, 0.07), am: Math.random() < 0.45, gx: gauss() * 0.018, gy: gauss() * 0.018 });
    // Ritmo: esperando, nube ↔ logo cada pocos segundos; pensando, cerebro ↔ bombillo
    function elegir(t) {
      const ciclo = modo === 'piensa' ? [['cerebro', 2.6], ['bombillo', 2.4]] : [['nube', 1.6], ['logo', 2.2]];
      const tot = ciclo.reduce((a, c) => a + c[1], 0); let x = (t - desdeForma) % tot;
      for (const [f, d] of ciclo) { if (x < d) return f; x -= d; }
      return ciclo[0][0];
    }
    function cuadro(cv, t) {
      const dpr = Math.min(2, window.devicePixelRatio || 1), w = Math.round(cv.clientWidth * dpr), h = Math.round(cv.clientHeight * dpr);
      if (w && h && (cv.width !== w || cv.height !== h)) { cv.width = w; cv.height = h; }
      const W = cv.width, H = cv.height; if (!W || !H) return;
      const g = cv.getContext('2d'), osc = document.documentElement.getAttribute('data-theme') === 'dark';
      const esc = Math.max(0.75, Math.min(W, H) / 170 / dpr) * dpr, S = Math.min(W, H) * (forma === 'logo' ? 0.7 : 0.9), ox = (W - S) / 2, oy = (H - S) / 2;
      const enCaja = (x, y) => [(ox + x * S) / W, (oy + y * S) / H];
      const fluido = forma !== 'nube', resp = 1 + Math.sin(t * 1.1) * 0.04, ag = 1 + energia * 1.8, vel = reduce ? 1 : 0.11;
      P.forEach((p, i) => {
        let tx, ty; const a = t * p.sp * 0.6 + p.ph;
        if (forma === 'nube') { tx = 0.5 + (p.hx - 0.5) * resp + (Math.sin(a) * 0.035 + Math.sin(a * 0.41 + p.ph) * 0.025) * ag; ty = 0.5 + (p.hy - 0.5) * resp + (Math.cos(a * 0.83) * 0.03 + Math.cos(a * 0.29 + p.ph) * 0.02) * ag; }
        else if (forma === 'logo') { const [lx, ly] = ruta(p.k, p.s + t * 0.06); [tx, ty] = enCaja(lx + Math.sin(t * 3 + p.ph) * 0.01, ly - Math.sin(t * 3 + p.ph) * 0.01); }
        else { const q = PTS[forma].n[i]; [tx, ty] = enCaja(q[0] + Math.sin(a * 2) * 0.006 * ag, q[1] + Math.cos(a * 2) * 0.006 * ag); }
        p.x += (tx - p.x) * vel; p.y += (ty - p.y) * vel;
      });
      Q.forEach((q, i) => {
        let tx, ty; const a = q.a + t * q.w * (1 + energia * 2);
        if (forma === 'nube') { const rr = q.rad * (1 + Math.sin(t * 0.8 + q.ph) * 0.12); tx = 0.5 + Math.cos(a) * rr * 0.8; ty = 0.5 + Math.sin(a) * rr * 0.62; }
        else if (forma === 'logo') { const [lx, ly] = ruta(q.k, q.s + t * q.v * 0.6); [tx, ty] = enCaja(lx + q.off * Math.cos(a), ly + q.off * Math.sin(a)); }
        else { const z = PTS[forma].d[i]; [tx, ty] = enCaja(z[0] + q.gx * 0.35 + Math.cos(a * 1.7) * 0.005, z[1] + q.gy * 0.35 + Math.sin(a * 1.7) * 0.005); }
        q.x += (tx - q.x) * vel * 0.85; q.y += (ty - q.y) * vel * 0.85;
      });
      // Estela: el cuadro anterior se desvanece en vez de borrarse
      const fade = reduce ? 1 : forma === 'logo' ? 0.26 : 0.42;
      if (reduce) g.clearRect(0, 0, W, H);
      else { g.globalCompositeOperation = 'destination-out'; g.fillStyle = `rgba(0,0,0,${fade})`; g.fillRect(0, 0, W, H); g.globalCompositeOperation = 'source-over'; }
      const tinta = osc ? '201,195,214' : '22,11,41', oro = '255,201,0';
      // El bombillo se enciende: un halo amarillo que crece desde su centro
      luz += ((forma === 'bombillo' ? 1 : 0) - luz) * 0.06;
      const [hx, hy] = luz > 0.05 ? enCaja(0.5, 0.38) : [0.5, 0.5];
      const hr = Math.min(W, H) * (0.4 + 0.05 * Math.sin(t * 2) - luz * 0.12), halo = g.createRadialGradient(hx * W, hy * H, 0, hx * W, hy * H, hr);
      halo.addColorStop(0, `rgba(${oro},${((0.06 + luz * (0.4 + 0.15 * Math.sin(t * 6)) + energia * 0.06) * fade).toFixed(3)})`); halo.addColorStop(1, `rgba(${oro},0)`);
      g.fillStyle = halo; g.fillRect(0, 0, W, H);
      const D = 30 * esc * (fluido ? 0.7 : 1);
      g.lineWidth = Math.max(0.6, 0.8 * esc);
      const vec = [];
      for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
        const a = P[i], b = P[j], dx = (a.x - b.x) * W, dy = (a.y - b.y) * H, d = Math.hypot(dx, dy); if (d > D) continue;
        vec.push([i, j]);
        g.strokeStyle = `rgba(${a.am && b.am ? oro : tinta},${((1 - d / D) * (0.12 + energia * 0.12)).toFixed(3)})`;
        g.beginPath(); g.moveTo(a.x * W, a.y * H); g.lineTo(b.x * W, b.y * H); g.stroke();
      }
      // Chispas entre neuronas: más cuando escribe o piensa
      if (!reduce && vec.length && Math.random() < 0.12 + (modo === 'piensa' ? 0.4 : 0) + energia * 0.4) { const [i, j] = vec[Math.floor(Math.random() * vec.length)]; CH.push({ i, j, t0: t, dur: azar(0.25, 0.6) }); }
      for (let c = CH.length - 1; c >= 0; c--) {
        const ch = CH[c], f = (t - ch.t0) / ch.dur; if (f >= 1 || CH.length > 50) { CH.splice(c, 1); continue; }
        const a = P[ch.i], b = P[ch.j], x = (a.x + (b.x - a.x) * f) * W, y = (a.y + (b.y - a.y) * f) * H;
        const gl = g.createRadialGradient(x, y, 0, x, y, 6 * esc); gl.addColorStop(0, `rgba(${oro},0.9)`); gl.addColorStop(1, `rgba(${oro},0)`);
        g.fillStyle = gl; g.beginPath(); g.arc(x, y, 6 * esc, 0, 6.283); g.fill();
        g.fillStyle = 'rgba(255,240,180,1)'; g.beginPath(); g.arc(x, y, 1.1 * esc, 0, 6.283); g.fill();
      }
      for (const q of Q) {
        const tw = 0.5 + 0.5 * Math.sin(t * 3.4 + q.ph);
        g.fillStyle = `rgba(${q.am ? oro : tinta},${((0.2 + tw * 0.45) * (fluido && forma !== 'logo' ? 0.6 : 1)).toFixed(3)})`;
        g.beginPath(); g.arc(q.x * W, q.y * H, q.r * esc * (0.7 + tw * 0.5), 0, 6.283); g.fill();
      }
      for (const p of P) {
        const pulso = fluido ? 0.5 + 0.5 * Math.sin(t * 4.5 - p.s * 14) : 0, al = 0.5 + 0.3 * Math.sin(t * 1.6 + p.ph) + pulso * 0.3;
        g.fillStyle = `rgba(${p.am ? oro : tinta},${Math.min(1, al + (p.am ? 0.2 : 0)).toFixed(3)})`;
        g.beginPath(); g.arc(p.x * W, p.y * H, p.r * esc * (fluido ? 0.8 : 1) * (1 + pulso * 0.35), 0, 6.283); g.fill();
      }
    }
    function ciclo() {
      raf = 0; const cvs = document.querySelectorAll('.ag-win canvas.ag-mente'); if (!cvs.length) return;
      const t = reduce ? 2 : (performance.now() - t0) / 1000;
      energia *= 0.95;
      let f = elegir(t); if ((f === 'cerebro' || f === 'bombillo') && !muestrear()) f = 'logo';
      forma = reduce ? (modo === 'piensa' ? (muestrear() ? 'cerebro' : 'logo') : 'logo') : f;
      cvs.forEach(cv => cuadro(cv, t));
      if (!reduce) raf = requestAnimationFrame(ciclo);
    }
    const andar = () => { if (!raf) raf = requestAnimationFrame(ciclo); };
    return {
      modo: m => { if (m !== modo) { modo = m; desdeForma = (performance.now() - t0) / 1000; } andar(); },
      // al escribir: se agita y, si estaba en nube, arma el logo enseguida
      excitar: () => { energia = Math.min(1, energia + 0.35); if (modo === 'espera' && forma === 'nube') desdeForma = (performance.now() - t0) / 1000 - 1.6; andar(); },
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
