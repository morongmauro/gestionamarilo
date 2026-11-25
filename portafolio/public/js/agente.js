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

  // «Mente de Amarilo»: una cabeza en 3D hecha de miles de puntos (trama de impresión): de frente y en perspectiva,
  // con luz y sombra (en la sombra los puntos son más grandes y oscuros), girando despacio. Unas zonas amarillas se
  // mueven sobre la piel. Al escribir, la superficie vibra (escucha); al pensar, el amarillo crece y se forma el logo.
  const Mente = (() => {
    const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    let modo = 'espera', raf = 0, energia = 0, desde = 0, forma = 'cara', luz = 0, P = null;
    const t0 = performance.now();
    /* ---------- la cabeza como campo de distancia (y hacia arriba, z hacia quien mira) ---------- */
    const len = (x, y, z) => Math.sqrt(x * x + y * y + z * z);
    const smin = (a, b, k) => { const h = Math.max(0, Math.min(1, 0.5 + 0.5 * (b - a) / k)); return b + (a - b) * h - k * h * (1 - h); };
    const smax = (a, b, k) => -smin(-a, -b, k);
    const elip = (x, y, z, cx, cy, cz, rx, ry, rz) => { const k0 = len((x - cx) / rx, (y - cy) / ry, (z - cz) / rz), k1 = len((x - cx) / (rx * rx), (y - cy) / (ry * ry), (z - cz) / (rz * rz)); return k1 ? k0 * (k0 - 1) / k1 : -Math.min(rx, ry, rz); };
    const esf = (x, y, z, cx, cy, cz, r) => len(x - cx, y - cy, z - cz) - r;
    const cap = (x, y, z, ax, ay, az, bx, by, bz, r) => { const px = x - ax, py = y - ay, pz = z - az, vx = bx - ax, vy = by - ay, vz = bz - az; const h = Math.max(0, Math.min(1, (px * vx + py * vy + pz * vz) / (vx * vx + vy * vy + vz * vz))); return len(px - vx * h, py - vy * h, pz - vz * h) - r; };
    function sdfDetalle(x, y, z) {
      const ax = Math.abs(x); // la cara es simétrica
      let d = elip(x, y, z, 0, 0.18, -0.08, 0.74, 0.92, 0.84);                    // cráneo
      d = smin(d, elip(x, y, z, 0, -0.38, 0.12, 0.56, 0.6, 0.62), 0.22);          // cara y mandíbula
      d = smin(d, elip(x, y, z, 0, -0.86, 0.36, 0.22, 0.16, 0.2), 0.16);          // mentón
      d = smin(d, esf(ax, y, z, 0.38, -0.1, 0.46, 0.21), 0.16);                   // pómulos
      d = smin(d, cap(ax, y, z, 0, 0.36, 0.64, 0.4, 0.33, 0.56, 0.1), 0.12);      // frente y cejas
      d = smax(d, -esf(ax, y, z, 0.27, 0.16, 0.86, 0.17), 0.1);                    // cuencas de los ojos
      d = smin(d, esf(ax, y, z, 0.27, 0.15, 0.62, 0.135), 0.05);                  // ojos
      d = smin(d, cap(x, y, z, 0, 0.16, 0.74, 0, -0.2, 0.95, 0.07), 0.08);        // tabique de la nariz
      d = smin(d, esf(x, y, z, 0, -0.24, 0.9, 0.1), 0.08);                        // punta de la nariz
      d = smin(d, esf(ax, y, z, 0.1, -0.27, 0.8, 0.075), 0.06);                   // aletas
      d = smin(d, cap(ax, y, z, 0, -0.45, 0.84, 0.19, -0.47, 0.74, 0.065), 0.06); // labio superior
      d = smin(d, cap(ax, y, z, 0, -0.56, 0.8, 0.16, -0.55, 0.72, 0.07), 0.06);   // labio inferior
      d = smax(d, -cap(ax, y, z, 0, -0.505, 0.9, 0.2, -0.505, 0.82, 0.018), 0.02);// comisura
      d = smin(d, elip(ax, y, z, 0.76, 0.02, -0.06, 0.08, 0.22, 0.14), 0.06);     // orejas
      d = smin(d, cap(x, y, z, 0, -0.75, -0.12, 0, -1.6, -0.18, 0.36), 0.2);      // cuello
      return Math.max(d, -(y + 1.42));                                             // corte del cuello
    }
    // Cabeza suave: solo el volumen, con un leve relieve de la frente y la nariz (sin ojos, labios ni orejas)
    function sdfSuave(x, y, z) {
      let d = elip(x, y, z, 0, 0.16, -0.06, 0.74, 0.9, 0.82);
      d = smin(d, elip(x, y, z, 0, -0.4, 0.14, 0.54, 0.58, 0.6), 0.3);
      d = smin(d, elip(x, y, z, 0, -0.82, 0.32, 0.24, 0.18, 0.22), 0.22);
      d = smin(d, cap(x, y, z, 0, 0.1, 0.72, 0, -0.18, 0.84, 0.05), 0.16);
      d = smin(d, cap(Math.abs(x), y, z, 0, 0.34, 0.66, 0.34, 0.31, 0.58, 0.06), 0.16);
      d = smin(d, cap(x, y, z, 0, -0.72, -0.12, 0, -1.6, -0.16, 0.35), 0.26);
      return Math.max(d, -(y + 1.42));
    }
    const sdfOrbe = (x, y, z) => len(x, y, z) - 1.02;
    // Dos perfiles suaves mirándose (cada cabeza girada hacia la otra)
    function sdfDos(x, y, z) {
      const S = 0.62, una = (cx, giro) => { const px = (x - cx) / S, py = (y + 0.05) / S, pz = z / S, c = Math.cos(giro), sn = Math.sin(giro); return sdfSuave(px * c - pz * sn, py, px * sn + pz * c) * S; };
      return Math.min(una(-0.62, -1.25), una(0.62, 1.25));
    }
    const VARIANTES = { suave: [sdfSuave, [1.8, 2.9, 2.1]], orbe: [sdfOrbe, [2.2, 2.2, 2.2]], dos: [sdfDos, [2.6, 2.0, 1.6]], detalle: [sdfDetalle, [1.8, 2.9, 2.1]] };
    let variante = (() => { try { return App.store.get('agente.forma', 'suave'); } catch (e) { return 'suave'; } })();
    if (!VARIANTES[variante]) variante = 'suave';
    const sdf = (x, y, z) => VARIANTES[variante][0](x, y, z);
    const normal = (x, y, z) => { const e = 0.004, nx = sdf(x + e, y, z) - sdf(x - e, y, z), ny = sdf(x, y + e, z) - sdf(x, y - e, z), nz = sdf(x, y, z + e) - sdf(x, y, z - e), l = len(nx, ny, nz) || 1; return [nx / l, ny / l, nz / l]; };
    // El logo en 3D: dos escuadras gruesas, como una placa de puntos
    const enLogo = (x, y) => (x >= -0.62 && x <= -0.38 && y >= -0.14 && y <= 0.62) || (x >= -0.62 && x <= 0.42 && y >= 0.38 && y <= 0.62) || (x >= 0.38 && x <= 0.62 && y >= -0.62 && y <= 0.14) || (x >= -0.42 && x <= 0.62 && y >= -0.62 && y <= -0.38);
    function preparar() {
      if (P) return true;
      // puntos al azar proyectados sobre la superficie y repartidos parejo (una celda, un punto)
      let s = 7; const azar = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
      const celdas = new Map(), C = 0.021, out = [];
      for (let i = 0; i < 140000 && out.length < 16000; i++) {
        const [bx, by, bz] = VARIANTES[variante][1];
        let x = (azar() - 0.5) * bx, y = (azar() - 0.5) * by, z = (azar() - 0.5) * bz;
        for (let k = 0; k < 7; k++) { const d = sdf(x, y, z); if (Math.abs(d) < 1e-4) break; const n = normal(x, y, z); x -= n[0] * d; y -= n[1] * d; z -= n[2] * d; }
        if (Math.abs(sdf(x, y, z)) > 0.004) continue;
        const key = Math.round(x / C) + ',' + Math.round(y / C) + ',' + Math.round(z / C); if (celdas.has(key)) continue; celdas.set(key, 1);
        const n = normal(x, y, z);
        // oclusión: cuánto «se hunde» el punto (cuencas, comisuras, debajo de la nariz): más oscuro
        const oc = Math.max(0, Math.min(1, (sdf(x + n[0] * 0.08, y + n[1] * 0.08, z + n[2] * 0.08) - 0.08) / -0.08));
        out.push({ x, y, z, nx: n[0], ny: n[1], nz: n[2], oc, ph: azar() * 6.283, lx: 0, ly: 0, lz: 0, enL: false, vis: 1, cx: x, cy: y, cz: z });
      }
      // a cada punto, su lugar en el logo (los que sobran se esconden)
      const logo = []; for (let y = 0.62; y >= -0.62; y -= 0.03) for (let x = -0.62; x <= 0.62; x += 0.03) if (enLogo(x, y)) for (const z of [-0.06, 0, 0.06]) logo.push([x, y, z]);
      const orden = out.map((p, i) => i).sort((a, b) => out[b].y - out[a].y || out[a].x - out[b].x);
      orden.forEach((pi, k) => { const p = out[pi]; const q = logo[Math.floor(k * logo.length / out.length)] || logo[k % logo.length]; p.lx = q[0]; p.ly = q[1]; p.lz = q[2]; p.enL = k % Math.max(1, Math.round(out.length / logo.length)) === 0 || out.length <= logo.length; });
      P = out; return true;
    }
    function elegir(t) {
      const ciclo = modo === 'piensa' ? [['cara', 2.4], ['logo', 1.6]] : [['cara', 7], ['logo', 2.2]];
      const tot = ciclo.reduce((a, c) => a + c[1], 0); let x = ((t - desde) % tot + tot) % tot;
      for (const [f, d] of ciclo) { if (x < d) return f; x -= d; }
      return 'cara';
    }
    const LX = -0.78, LY = 0.42, LZ = 0.55, LL = len(LX, LY, LZ); // luz: de frente, arriba a la izquierda
    function cuadro(cv, t) {
      const dpr = Math.min(2, window.devicePixelRatio || 1), w = Math.round(cv.clientWidth * dpr), h = Math.round(cv.clientHeight * dpr);
      if (w && h && (cv.width !== w || cv.height !== h)) { cv.width = w; cv.height = h; }
      const W = cv.width, H = cv.height; if (!W || !H) return;
      const g = cv.getContext('2d'), osc = document.documentElement.getAttribute('data-theme') === 'dark';
      g.clearRect(0, 0, W, H);
      luz += ((modo === 'piensa' ? 1 : 0) - luz) * 0.04;
      // giro: de frente, volteando a cada lado (tres cuartos) y un leve cabeceo
      const yaw = reduce ? 0.35 : variante === 'orbe' ? t * 0.25 : variante === 'dos' ? Math.sin(t * 0.3) * 0.35 : Math.sin(t * 0.32) * 0.75 + 0.2, pitch = reduce ? 0.08 : 0.08 + Math.sin(t * 0.21) * 0.07;
      const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
      const esc = variante === 'orbe' ? Math.min(W, H) / 2.6 : variante === 'dos' ? Math.min(W / 2.9, H / 2.2) : Math.min(W / 2.3, H / 3.05), ox = W / 2, oy = H * (variante === 'suave' || variante === 'detalle' ? 0.47 : 0.5), foco = 4.2;
      const tinta = osc ? '226,220,238' : '24,18,34', oro = '255,201,0';
      const lotes = new Map();
      for (const p of P) {
        // hacia dónde va el punto: la cara (con su vibración al escribir) o el logo
        let tx = p.x, ty = p.y, tz = p.z, vis = 1;
        if (forma === 'logo') { tx = p.lx; ty = p.ly; tz = p.lz; vis = p.enL ? 1 : 0; }
        else if (energia > 0.02) { const o = Math.sin(len(p.x - 0.76, p.y, p.z) * 14 - t * 10) * 0.025 * energia; tx += p.nx * o; ty += p.ny * o; tz += p.nz * o; }
        const v = reduce ? 1 : 0.1; p.cx += (tx - p.cx) * v; p.cy += (ty - p.cy) * v; p.cz += (tz - p.cz) * v; p.vis += (vis - p.vis) * v;
        if (p.vis < 0.04) continue;
        // rotar y proyectar con perspectiva
        const x1 = p.cx * cy + p.cz * sy, z1 = -p.cx * sy + p.cz * cy, y2 = p.cy * cp - z1 * sp, z2 = p.cy * sp + z1 * cp;
        const enLogoAhora = p.vis < 0.999 || forma === 'logo';
        const nx1 = p.nx * cy + p.nz * sy, nz1 = -p.nx * sy + p.nz * cy, ny2 = p.ny * cp - nz1 * sp, nz2 = p.ny * sp + nz1 * cp;
        const mira = forma === 'logo' ? 1 : nz2; if (mira < -0.05) continue; // solo la cara que se ve
        const k = foco / (foco - z2), sx = ox + x1 * esc * k, syy = oy - y2 * esc * k;
        // luz y sombra (Lambert) + oclusión; la trama: sombra = puntos más grandes y oscuros
        const dif = forma === 'logo' ? 0.55 : Math.max(0, (nx1 * LX + ny2 * LY + nz2 * LZ) / LL);
        let oscuro = Math.max(0, Math.min(1, 1 - (0.08 + 0.92 * dif) + p.oc * 0.5));
        // zonas amarillas que se mueven sobre la piel (como el rojo de la referencia); al pensar crecen
        // manchas suaves: cada punto es amarillo con una probabilidad que sigue un campo que se mueve despacio
        const campo = 0.5 + 0.5 * Math.sin(p.x * 2.2 + t * 0.6) * Math.cos(p.y * 1.7 - t * 0.45) + 0.35 * Math.sin(p.z * 2.4 + p.y * 1.3 + t * 0.5);
        const prob = forma === 'logo' ? (p.ph < 5 ? 1 : 0) : Math.max(0, campo - 0.52) * 1.9 * (0.75 + luz * 0.9) + luz * 0.6 * Math.max(0, Math.sin(t * 2.6 - p.y * 4)) ** 4;
        const amar = (p.ph / 6.283) < prob ? 1 : 0;
        const prof = forma === 'logo' ? 1 : Math.pow(Math.max(0, mira), 0.7); // el borde se desvanece (sin contorno)
        // puntos diminutos y tenues: la sombra se forma por acumulación
        const r = (0.32 + oscuro * 0.95) * esc / 330 * k * (forma === 'logo' ? 1.5 : 1);
        if (r < 0.12) continue;
        const a = Math.min(1, (0.14 + oscuro * 0.74) * prof * p.vis);
        const esAm = amar > 0.4, col = esAm ? oro : tinta, aq = Math.round((esAm ? Math.min(1, a * 1.6 + 0.25) : a) * 20) / 20;
        if (aq <= 0) continue;
        const llave = col + '|' + aq; let pth = lotes.get(llave); if (!pth) { pth = new Path2D(); lotes.set(llave, pth); }
        pth.moveTo(sx + r, syy); pth.arc(sx, syy, r, 0, 6.283);
      }
      lotes.forEach((pth, llave) => { const [c, a] = llave.split('|'); g.fillStyle = `rgba(${c},${a})`; g.fill(pth); });
    }
    function ciclo() {
      raf = 0; const cvs = document.querySelectorAll('.ag-win canvas.ag-mente'); if (!cvs.length || !preparar()) return;
      const t = reduce ? 0 : (performance.now() - t0) / 1000;
      energia *= 0.965; forma = reduce ? 'cara' : elegir(t);
      cvs.forEach(cv => cuadro(cv, t));
      if (!reduce) raf = requestAnimationFrame(ciclo);
    }
    const andar = () => { if (!raf) raf = requestAnimationFrame(ciclo); };
    return {
      variante: v => { if (VARIANTES[v]) { variante = v; P = null; try { App.store.set('agente.forma', v); } catch (e) {} andar(); } },
      modo: m => { if (m !== modo) { modo = m; desde = (performance.now() - t0) / 1000; } andar(); },
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
  App.Agente = { abrir, cerrar, contexto, formato, forma: v => Mente.variante(v) };
})();
