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

  // «Galaxia de conocimiento»: miles de puntos (gris, negro y amarillo) en un disco espiral que gira en 3D.
  // Esperando: la galaxia gira despacio y cada tanto forma el logo de Amarilo. Al escribir: gira más rápido
  // y late hacia el centro. Al pensar: los puntos forman un círculo en órbita con una estela amarilla, y el logo.
  const Mente = (() => {
    const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    let modo = 'espera', raf = 0, energia = 0, desde = 0, forma = 'galaxia', P = null;
    const t0 = performance.now(), TAU = Math.PI * 2;
    const enLogo = (x, y) => (x >= -0.62 && x <= -0.38 && y >= -0.14 && y <= 0.62) || (x >= -0.62 && x <= 0.42 && y >= 0.38 && y <= 0.62) || (x >= 0.38 && x <= 0.62 && y >= -0.62 && y <= 0.14) || (x >= -0.42 && x <= 0.62 && y >= -0.62 && y <= -0.38);
    function preparar() {
      if (P) return true;
      let s = 11; const azar = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
      const gauss = () => { let u = 0, v = 0; while (!u) u = azar(); while (!v) v = azar(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v); };
      const N = 6500, logo = [];
      for (let y = 0.62; y >= -0.62; y -= 0.026) for (let x = -0.62; x <= 0.62; x += 0.026) if (enLogo(x, y)) logo.push([x + (azar() - 0.5) * 0.012, y + (azar() - 0.5) * 0.012]);
      P = Array.from({ length: N }, (_, i) => {
        const nucleo = i < N * 0.16, brazo = i % 3;
        const r = nucleo ? Math.abs(gauss()) * 0.14 : 0.12 + Math.pow(azar(), 0.75) * 0.95;
        const a = nucleo ? azar() * TAU : brazo * TAU / 3 + r * 3.4 + gauss() * 0.32 / (0.5 + r);
        const h = gauss() * (nucleo ? 0.07 : 0.03 * (1.15 - r));
        const q = logo[i % logo.length];
        return { r, a, h, tam: 0.45 + azar() * 1.1, am: nucleo ? azar() < 0.45 : azar() < 0.07, ph: azar() * TAU,
          ra: azar() * TAU, rr: 0.84 + gauss() * 0.035, rh: gauss() * 0.03, lx: q[0], ly: q[1], enL: i < logo.length * 1.15, x: 0, y: 0, z: 0, vis: 1 };
      });
      return true;
    }
    function elegir(t) {
      const ciclo = modo === 'piensa' ? [['circulo', 2.6], ['logo', 1.4]] : [['galaxia', 7.5], ['logo', 2.3]];
      const tot = ciclo.reduce((a, c) => a + c[1], 0); let x = ((t - desde) % tot + tot) % tot;
      for (const [f, d] of ciclo) { if (x < d) return f; x -= d; }
      return ciclo[0][0];
    }
    function cuadro(cv, t) {
      const dpr = Math.min(2, window.devicePixelRatio || 1), w = Math.round(cv.clientWidth * dpr), h = Math.round(cv.clientHeight * dpr);
      if (w && h && (cv.width !== w || cv.height !== h)) { cv.width = w; cv.height = h; }
      const W = cv.width, H = cv.height; if (!W || !H) return;
      const g = cv.getContext('2d'), osc = document.documentElement.getAttribute('data-theme') === 'dark';
      g.clearRect(0, 0, W, H);
      const esc = Math.min(W, H) * 0.44, ox = W / 2, oy = H / 2, foco = 3.6;
      // la galaxia inclinada (se ve en perspectiva) y girando sobre sí misma
      const incl = 1.05 + Math.sin(t * 0.17) * 0.12, ci = Math.cos(incl), si = Math.sin(incl), gy = t * 0.05, cg = Math.cos(gy), sg = Math.sin(gy);
      const vel = 0.18 * (1 + energia * 2.5), cabeza = (t * 2.4) % TAU;
      const tinta = osc ? '226,220,238' : '26,20,38', oro = '255,201,0', lotes = new Map();
      // un resplandor suave en el centro (el núcleo de la galaxia o del círculo)
      if (forma !== 'logo') { const gr = g.createRadialGradient(ox, oy, 0, ox, oy, esc * (forma === 'circulo' ? 0.9 : 0.5)); gr.addColorStop(0, `rgba(${oro},${0.1 + energia * 0.1})`); gr.addColorStop(1, `rgba(${oro},0)`); g.fillStyle = gr; g.fillRect(0, 0, W, H); }
      for (const p of P) {
        let x, y, z, vis = 1, brillo = 0;
        if (forma === 'logo') { x = p.lx; y = p.ly; z = 0; vis = p.enL ? 1 : 0; }
        else if (forma === 'circulo') {
          // órbita: el círculo gira y una estela amarilla lo recorre
          const a = p.ra + t * 0.9; x = Math.cos(a) * p.rr; y = Math.sin(a) * p.rr; z = p.rh;
          const atras = ((cabeza - a) % TAU + TAU) % TAU; brillo = Math.exp(-atras * 1.4);
        } else {
          // galaxia: giro diferencial (el centro más rápido); al escribir, late hacia el centro
          const a = p.a + t * vel / (0.25 + p.r), r = p.r * (1 - energia * 0.09 * Math.sin(p.r * 11 - t * 9));
          const X = Math.cos(a) * r, Z = Math.sin(a) * r, Y = p.h;
          const x1 = X * cg + Z * sg, z1 = -X * sg + Z * cg; x = x1; y = Y * ci - z1 * si; z = Y * si + z1 * ci;
          brillo = energia * Math.max(0, Math.sin(p.r * 11 - t * 9)) * 0.8;
        }
        const v = reduce ? 1 : 0.075; p.x += (x - p.x) * v; p.y += (y - p.y) * v; p.z += (z - p.z) * v; p.vis += (vis - p.vis) * v;
        if (p.vis < 0.04) continue;
        const k = foco / (foco - p.z), sx = ox + p.x * esc * k, sy = oy - p.y * esc * k;
        const tw = 0.75 + 0.25 * Math.sin(t * 2.3 + p.ph);
        const am = p.am || brillo > 0.45 || (forma === 'logo' && p.ph < 5.3);
        const prof = forma === 'logo' ? 1 : Math.max(0.25, Math.min(1, 0.62 + p.z * 0.6));
        const r = (forma === 'logo' ? 1.75 : p.tam * 1.15) * (1 + brillo * 0.9) * esc / 220 * k;
        const a = Math.min(1, (am ? 0.9 : 0.62) * prof * tw * p.vis + brillo * 0.3);
        const llave = (am ? oro : tinta) + '|' + (Math.round(a * 20) / 20);
        let pth = lotes.get(llave); if (!pth) { pth = new Path2D(); lotes.set(llave, pth); }
        pth.moveTo(sx + r, sy); pth.arc(sx, sy, r, 0, TAU);
      }
      lotes.forEach((pth, llave) => { const [c, a] = llave.split('|'); g.fillStyle = `rgba(${c},${a})`; g.fill(pth); });
    }
    function ciclo() {
      raf = 0; const cvs = document.querySelectorAll('.ag-win canvas.ag-mente'); if (!cvs.length || !preparar()) return;
      const t = reduce ? 0 : (performance.now() - t0) / 1000;
      energia *= 0.97; forma = reduce ? (modo === 'piensa' ? 'circulo' : 'galaxia') : elegir(t);
      cvs.forEach(cv => cuadro(cv, t));
      if (!reduce) raf = requestAnimationFrame(ciclo);
    }
    const andar = () => { if (!raf) raf = requestAnimationFrame(ciclo); };
    return {
      modo: m => { if (m !== modo) { modo = m; desde = (performance.now() - t0) / 1000; } andar(); },
      // al escribir: la galaxia gira más rápido y late; si estaba en el logo, vuelve a la galaxia
      excitar: () => { energia = Math.min(1, energia + 0.35); if (modo === 'espera' && forma === 'logo') desde = (performance.now() - t0) / 1000; andar(); },
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
    // Columnas del portafolio (para cambiar campos de una iniciativa)
    L.push('Columnas del portafolio (id: nombre, tipo, opciones): ' + App.S.columns.filter(c => c.type !== 'title').map(c => `${c.id}: ${c.name}, ${c.type}${(c.options || []).length ? ', opciones: ' + c.options.slice(0, 20).map(o => o.name).join(' / ') : ''}`).join(' || '));
    // La iniciativa abierta en pantalla: su libro del caso (celdas con fórmulas y resultados) y su cronograma (con ids)
    const m0 = /^#\/proyectos\/([^/]+)/.exec(location.hash), abierta = m0 && App.byId('projects', decodeURIComponent(m0[1]));
    if (abierta) {
      L.push(`# INICIATIVA ABIERTA EN PANTALLA: id=${abierta.id} · ${App.projectName(abierta)}`);
      const caso = App.caseOf(abierta.id);
      if (caso) { try { L.push('## Libro del caso de negocio (dirección=contenido → resultado)\n' + libroTexto(caso)); } catch (e) {} }
      const secs = (App.S.sections || []).filter(x => x.project_id === abierta.id).sort((a, b) => (a.position || 0) - (b.position || 0));
      const acts = App.actsOf(abierta.id).slice().sort((a, b) => (a.position || 0) - (b.position || 0));
      if (secs.length || acts.length) L.push('## Cronograma\nEtapas: ' + secs.map(x => `${x.id}=${x.name}`).join(' | ') + '\nActividades (id | etapa | nombre | inicio | fin | avance | responsable):\n' + acts.map(a => [a.id, a.section_id || '', a.name || '', a.inicio || '', a.fin || '', (a.avance || 0) + '%', a.responsable || ''].join(' | ')).join('\n'));
    } else L.push('No hay ninguna iniciativa abierta en pantalla: para cambiar el libro de un caso o un cronograma, pida abrir esa iniciativa.');
    return L.join('\n\n').slice(0, 170000);
  }

  const numTxt = v => (typeof v === 'number' ? String(Math.round(v * 100) / 100) : String(v));
  function libroTexto(c) {
    const lb = c.libro && Array.isArray(c.libro.hojas) && c.libro.hojas.length ? c.libro : App.LibroUI.desdeFlujos(c), E = App.Libro.crear(lb), out = [];
    lb.hojas.forEach((h, hi) => {
      out.push(`### Hoja «${h.nombre}»${lb.flujo && lb.flujo.hoja === hi ? ' (es la hoja del flujo: las filas con «flujo:» alimentan el valor del sitio)' : ''}`);
      h.filas.forEach((f, r) => {
        const cs = (f.c || []).map((v, k) => (v === '' || v == null ? '' : `${App.Libro.dir(r, k)}=${typeof v === 'string' && v[0] === '=' ? v + ' → ' + numTxt(E.val(hi, r, k)) : typeof v === 'number' ? numTxt(v) : JSON.stringify(v)}`)).filter(Boolean);
        if (cs.length) out.push(`fila ${r + 1} [${f.t}${f.n ? ', ' + f.n : ''}${f.rol ? ', flujo: ' + f.rol : ''}]: ${cs.join(' | ')}`);
      });
    });
    return out.join('\n');
  }

  /* ---------- Cambios propuestos por el agente (solo administradores; se aplican con su clic) ---------- */
  const apiAg = (m, u, b) => fetch(u, { method: m, credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-Portafolio': '1', 'X-Agente': '1' }, body: JSON.stringify(b) })
    .then(async r => { const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'Error ' + r.status); return j; });
  const nomP = id => { const p = App.byId('projects', id); return p ? App.projectName(p) : 'iniciativa desconocida'; };
  const CAMPOS_ACT = ['name', 'inicio', 'fin', 'avance', 'responsable', 'section_id', 'hito', 'entregable', 'notas'];
  async function aplicarCambios(prop) {
    const sel = prop.cambios.map((c, k) => ({ c, k })).filter(x => prop.sel[x.k] !== false);
    const libros = new Map(), plan = new Map(), props = new Map(), res = prop.res = {};
    const fallo = (k, e) => { res[k] = e.message || String(e); };
    for (const { c, k } of sel) {
      try {
        const p = App.byId('projects', c.project_id); if (!p) throw new Error('No encontré la iniciativa');
        if (c.tipo === 'celda' || c.tipo === 'insertar_fila' || c.tipo === 'borrar_fila') {
          const caso = App.caseOf(p.id); if (!caso) throw new Error('La iniciativa no tiene caso de negocio');
          let G = libros.get(caso.id);
          if (!G) { G = { caso, lb: JSON.parse(JSON.stringify(caso.libro && Array.isArray(caso.libro.hojas) && caso.libro.hojas.length ? caso.libro : App.LibroUI.desdeFlujos(caso))), ks: [] }; libros.set(caso.id, G); }
          const h = G.lb.hojas.findIndex(x => App.Libro.norm(x.nombre) === App.Libro.norm(c.hoja || '')); if (h < 0) throw new Error(`No existe la hoja «${c.hoja}»`);
          const F = G.lb.hojas[h].filas;
          if (c.tipo === 'celda') {
            const m = /^\$?([A-Za-z]{1,3})\$?(\d{1,5})$/.exec(String(c.celda || '').trim()); if (!m) throw new Error('Celda inválida: ' + c.celda);
            const r = +m[2] - 1, col = App.Libro.colNum(m[1]);
            while (F.length <= r) F.push({ t: 'vacia', c: [] });
            const f = F[r]; if (f.t === 'vacia') f.t = 'dato'; f.c = f.c || []; while (f.c.length <= col) f.c.push('');
            const v = App.LibroUI.leer(c.valor == null ? '' : String(c.valor), f.n);
            if (typeof v === 'string' && v[0] === '=') App.Libro.arbol(v.slice(1)); // fórmula mal escrita: no se aplica
            f.c[col] = v;
          } else if (c.tipo === 'insertar_fila') {
            const r = Math.max(0, Math.min(F.length, (+c.fila || F.length + 1) - 1));
            App.Libro.insertarFila(G.lb, h, r, F[r] || F[r - 1]);
            const f = F[r]; if (c.tipo_fila) f.t = c.tipo_fila; if (c.formato) f.n = c.formato; if (c.flujo) f.rol = c.flujo;
            if (Array.isArray(c.valores)) f.c = c.valores.map(x => App.LibroUI.leer(x == null ? '' : String(x), f.n));
          } else {
            const r = (+c.fila || 0) - 1; if (r < 0 || r >= F.length) throw new Error('Esa fila no existe');
            App.Libro.eliminarFila(G.lb, h, r);
          }
          G.ks.push(k);
        } else if (c.tipo === 'actividad_editar' || c.tipo === 'actividad_crear') {
          const d = {}; Object.entries(c.campos || {}).forEach(([x, v]) => { if (CAMPOS_ACT.includes(x)) d[x] = v; });
          if (d.avance != null) d.avance = Math.max(0, Math.min(100, Math.round(Number(d.avance) || 0)));
          let lst = plan.get(p.id); if (!lst) { lst = { up: [], ks: [] }; plan.set(p.id, lst); }
          if (c.tipo === 'actividad_editar') {
            const a = App.byId('activities', c.activity_id); if (!a || a.project_id !== p.id) throw new Error('Esa actividad no es de esta iniciativa');
            lst.up.push({ id: a.id, ...d });
          } else {
            const secs = (App.S.sections || []).filter(x => x.project_id === p.id).sort((a, b) => (a.position || 0) - (b.position || 0));
            if (!d.section_id) { if (!secs.length) throw new Error('El cronograma no tiene etapas: cree una primero'); d.section_id = secs[secs.length - 1].id; }
            if (!d.name) throw new Error('Falta el nombre de la actividad');
            const pos = App.actsOf(p.id).reduce((mx, a) => Math.max(mx, a.position || 0), 0) + 1 + lst.up.length;
            lst.up.push({ id: App.uid(), position: pos, ...d });
          }
          lst.ks.push(k);
        } else if (c.tipo === 'iniciativa_campo') {
          const col = App.S.columns.find(x => x.id === c.columna); if (!col) throw new Error('No existe la columna ' + c.columna);
          let v = c.valor;
          if (col.type === 'number') v = v === '' || v == null ? null : App.parseNum(String(v));
          else if (col.type === 'multi' || col.type === 'people') v = Array.isArray(v) ? v : String(v || '').split(',').map(x => x.trim()).filter(Boolean);
          else if (col.type === 'check') v = v === true || /^(s[ií]|true|1|x)$/i.test(String(v));
          else v = v == null ? '' : String(v);
          let o = props.get(p.id); if (!o) { o = { props: {}, ks: [] }; props.set(p.id, o); }
          o.props[col.id] = v; o.ks.push(k);
        } else throw new Error('Tipo de cambio desconocido');
      } catch (e) { fallo(k, e); }
    }
    const lote = async (ks, fn) => { const vivos = ks.filter(k => res[k] == null); if (!vivos.length) return; try { await fn(); vivos.forEach(k => { res[k] = 'ok'; }); } catch (e) { vivos.forEach(k => fallo(k, e)); } };
    for (const [id, G] of libros) await lote(G.ks, () => apiAg('PATCH', '/api/cases/' + id, { libro: G.lb, flujos: App.Libro.flujos(G.lb) }));
    for (const [pid, x] of plan) await lote(x.ks, () => apiAg('POST', '/api/plan/' + pid, { activities: { upsert: x.up } }));
    for (const [pid, x] of props) await lote(x.ks, () => apiAg('PATCH', '/api/projects/' + pid, { props: x.props }));
    prop.estado = 'aplicado';
    try { await App.reload(); } catch (e) {}
    return Object.values(res).filter(v => v === 'ok').length;
  }
  function propHTML(x, i) {
    const pr = x.prop; if (!pr) return '';
    const n = pr.cambios.length, nSel = pr.cambios.filter((c, k) => pr.sel[k] !== false).length, ok = pr.res ? Object.values(pr.res).filter(v => v === 'ok').length : 0;
    const TIPO = { celda: 'Caso', insertar_fila: 'Caso', borrar_fila: 'Caso', actividad_editar: 'Cronograma', actividad_crear: 'Cronograma', iniciativa_campo: 'Portafolio' };
    return `<div class="ag-prop"><div class="ag-pt"><b>${n} cambio${n === 1 ? '' : 's'} propuesto${n === 1 ? '' : 's'}</b>${pr.resumen ? `<span>${esc(pr.resumen)}</span>` : ''}</div><ul>${pr.cambios.map((c, k) => {
      const r = pr.res && pr.res[k];
      return `<li class="${r === 'ok' ? 'ok' : r ? 'mal' : ''}"><label><input type="checkbox" data-pk="${i}:${k}" ${pr.sel[k] !== false ? 'checked' : ''} ${pr.estado !== 'pendiente' ? 'disabled' : ''}><span><em>${TIPO[c.tipo] || ''} · ${esc(nomP(c.project_id))}</em>${esc(c.descripcion || '')}${r && r !== 'ok' ? `<small>No se aplicó: ${esc(r)}</small>` : ''}</span></label></li>`; }).join('')}</ul>
      ${pr.estado === 'pendiente' ? `<div class="ag-pb"><button class="btn primary sm" data-ap="${i}" ${nSel ? '' : 'disabled'}>Aplicar ${nSel === n ? (n === 1 ? 'el cambio' : 'todo') : nSel + ' de ' + n}</button><button class="btn sm" data-dp="${i}">Descartar</button></div>`
        : pr.estado === 'aplicando' ? '<div class="ag-pe">Aplicando…</div>' : `<div class="ag-pe">${pr.estado === 'aplicado' ? `✓ Aplicado${ok === nSel ? '' : `: ${ok} de ${nSel}`}. Queda en el Historial como cambio suyo con el agente; Ctrl+Z en la hoja o el cronograma lo deshace.` : 'Descartado: no se cambió nada.'}</div>`}</div>`;
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
    : ['¿Cuánto valor llevamos capturado este año?', '¿Qué iniciativas tienen bloqueos?', '¿Qué debería revisar el próximo comité?', 'En la iniciativa abierta, corra una semana las actividades atrasadas'];
  function pintar() {
    if (!win) return;
    const b = win.querySelector('.ag-b');
    b.innerHTML = hist.length ? hist.map(x => x.rol === 'usuario' ? `<div class="ag-q">${esc(x.texto)}</div>` : `<div class="ag-r ${x.err ? 'err' : ''}">${formato(x.texto) || (x.prop ? '' : '<span class="ag-pen"><canvas class="ag-mente mini" aria-hidden="true"></canvas><span>Leyendo el portafolio…</span></span>')}</div>${propHTML(x, hist.indexOf(x))}`).join('')
      : `<div class="ag-hola"><canvas class="ag-mente" aria-hidden="true"></canvas><b>Pregúntele al portafolio</b><p>Consulto el portafolio y propongo cambios en los casos de negocio, los cronogramas y el Portafolio. Nada cambia hasta que usted lo aplique.</p><div class="ag-sug">${SUG().map(s => `<button data-ag-sug>${esc(s)}</button>`).join('')}</div></div>`;
    b.scrollTop = b.scrollHeight;
    Mente.andar();
    win.querySelector('[data-ag-nueva]').hidden = !hist.length;
  }
  async function preguntar(q) {
    q = String(q || '').trim(); if (!q || ocupado) return;
    ocupado = true; win.classList.add('ocupado'); Mente.modo('piensa');
    const previo = hist.filter(x => !x.err).map(x => ({ rol: x.rol, texto: x.texto + (x.prop ? `\n[Propuse ${x.prop.cambios.length} cambios: ${x.prop.estado === 'aplicado' ? 'el usuario los aplicó' : x.prop.estado === 'descartado' ? 'el usuario los descartó' : 'aún sin decidir'}]` : '') }));
    hist.push({ rol: 'usuario', texto: q }); const r = { rol: 'agente', texto: '' }; hist.push(r); pintar();
    try {
      const res = await fetch('/api/agente', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-Portafolio': '1' }, body: JSON.stringify({ pregunta: q, historial: previo, contexto: contexto() }) });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || 'El agente no respondió (' + res.status + ')'); }
      const rd = res.body.getReader(), dec = new TextDecoder();
      for (;;) { const { done, value } = await rd.read(); if (done) break; r.texto += dec.decode(value, { stream: true }); if (!r.texto.includes('\u0000')) pintar(); }
      r.texto += dec.decode();
      const iP = r.texto.indexOf('\u0000PROPUESTA');
      if (iP >= 0) { try { const pr = JSON.parse(r.texto.slice(iP + 10)); if (pr && Array.isArray(pr.cambios) && pr.cambios.length) r.prop = { resumen: pr.resumen || '', cambios: pr.cambios.slice(0, 60), sel: pr.cambios.map(() => true), estado: 'pendiente' }; } catch (e) {} r.texto = r.texto.slice(0, iP).trim(); }
      if (!r.texto.trim() && !r.prop) throw new Error('El agente no devolvió respuesta. Intente de nuevo.');
    } catch (e) { r.texto = e.message; r.err = true; }
    ocupado = false; win.classList.remove('ocupado'); Mente.modo('espera'); guardar(); pintar();
    const ta = win.querySelector('textarea'); if (ta) ta.focus();
  }
  function abrir() {
    if (!App.esAdmin()) return; // el agente es solo para administradores
    if (win) { win.querySelector('textarea').focus(); return; }
    win = document.createElement('section'); win.className = 'ag-win'; win.setAttribute('role', 'dialog'); win.setAttribute('aria-label', 'Pregúntele al portafolio');
    win.innerHTML = `<header><b>Pregúntele al portafolio</b><span class="sp"></span><button class="t-lnk" data-ag-nueva title="Empezar una conversación nueva">Nueva</button><button class="ag-x" data-ag-x aria-label="Cerrar">✕</button></header>
      <div class="ag-b" aria-live="polite"></div>
      <form class="ag-f"><textarea rows="1" maxlength="2000" placeholder="Escriba su pregunta…" aria-label="Pregunta"></textarea><button class="btn primary sm" type="submit" aria-label="Enviar">Enviar</button></form>
      <div class="ag-nota">Las cifras son aproximadas. Los cambios solo se hacen cuando usted los aplica.</div>`;
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
      const pk = e.target.closest('[data-pk]'); if (pk) { const [i, k] = pk.dataset.pk.split(':').map(Number); const pr = hist[i] && hist[i].prop; if (pr && pr.estado === 'pendiente') { pr.sel[k] = pk.checked; guardar(); pintar(); } return; }
      const dp = e.target.closest('[data-dp]'); if (dp) { const pr = hist[+dp.dataset.dp].prop; pr.estado = 'descartado'; guardar(); return pintar(); }
      const ap = e.target.closest('[data-ap]'); if (ap) { const pr = hist[+ap.dataset.ap].prop; if (pr.estado !== 'pendiente') return; pr.estado = 'aplicando'; pintar();
        return aplicarCambios(pr).then(n => { guardar(); pintar(); App.toast(n ? `Aplicado${n === 1 ? '' : 's'} ${n} cambio${n === 1 ? '' : 's'}` : 'No se pudo aplicar ningún cambio', !n); if (n) App.render(); }); }
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
  App.Agente = { abrir, cerrar, contexto, formato, aplicarCambios };
})();
