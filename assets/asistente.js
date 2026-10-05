// ============================================================
// CAJITA DE AJUSTES · sin IA, sin tokens
// Entiende frases con forma conocida y las vuelve cambios al plan:
//   «2.1 responsable Jurídica, Mauro»   «3.5 fin 20 nov»
//   «1.3 inicio 5 oct»                  «2.4 avance 60»
//   «1.1 terminó 29 sep»                «2.2 empezó ayer»
//   «4.1 dura 8 días»                   «3.2 depende de 3.1»
//   «mover etapa 3 +5 días»             «2.3 entregable Escritura firmada»
//   «2.3 nota: …»                       «2.3 tarea: llamar a la notaría para viernes»
//   «cuenta bancaria fin viernes»  (por nombre, si hay una sola que calce)
// Devuelve una vista previa; nada se guarda hasta que se confirma.
// Necesita assets/plan.js (calendario hábil y códigos 1.1, 1.2…).
// ============================================================
(function () {
  const COMB = /[̀-ͯ]/g;
  // Normaliza letra por letra para que los índices sigan coincidiendo con el texto original
  const normar = s => [...String(s || '')].map(c => (c.normalize('NFD').replace(COMB, '') || c).slice(0, 1).toLowerCase()).join('');
  const MESES = { ene: 1, enero: 1, feb: 2, febrero: 2, mar: 3, marzo: 3, abr: 4, abril: 4, may: 5, mayo: 5, jun: 6, junio: 6, jul: 7, julio: 7, ago: 8, agosto: 8, sep: 9, sept: 9, septiembre: 9, setiembre: 9, oct: 10, octubre: 10, nov: 11, noviembre: 11, dic: 12, diciembre: 12 };
  const DIAS = { domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6 };
  const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const p2 = n => String(n).padStart(2, '0');
  const valida = (y, m, d) => { const x = new Date(Date.UTC(y, m - 1, d, 12)); return x.getUTCMonth() === m - 1 && x.getUTCDate() === d; };

  // ---------- Fechas en español ----------
  function parseFecha(txt, today) {
    const t = normar(txt).replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!t) return null;
    if (/^(hoy|ahora)\b/.test(t)) return today;
    if (/^pasado manana\b/.test(t)) return addDays(today, 2);
    if (/^manana\b/.test(t)) return addDays(today, 1);
    if (/^ayer\b/.test(t)) return addDays(today, -1);
    let m;
    if ((m = t.match(/^en (\d{1,3}) (dias?|semanas?)( habiles?)?/))) {
      const n = Number(m[1]) * (m[2].startsWith('semana') ? (m[3] ? 5 : 7) : 1);
      return m[3] ? Plan.cal.sumarHabiles(today, n) : addDays(today, n);
    }
    if ((m = t.match(/^fin de mes\b/))) { const d = new Date(today.slice(0, 8) + '01T12:00:00Z'); d.setUTCMonth(d.getUTCMonth() + 1); return addDays(d.toISOString().slice(0, 10), -1); }
    if ((m = t.match(/^(?:el |este |proximo |el proximo )?(domingo|lunes|martes|miercoles|jueves|viernes|sabado)\b/))) {
      const obj = DIAS[m[1]]; let x = addDays(today, 1);
      while (new Date(x + 'T12:00:00Z').getUTCDay() !== obj) x = addDays(x, 1);
      return x;
    }
    if ((m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})\b/))) return valida(+m[1], +m[2], +m[3]) ? `${m[1]}-${p2(m[2])}-${p2(m[3])}` : null;
    const anioDe = (mm, dd, yy) => {
      if (yy) return yy < 100 ? 2000 + yy : yy;
      // Sin año: la próxima vez que caiga (con un margen hacia atrás de dos meses)
      const y = Number(today.slice(0, 4));
      return `${y}-${p2(mm)}-${p2(dd)}` < addDays(today, -60) ? y + 1 : y;
    };
    if ((m = t.match(/^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/))) {
      const dd = +m[1], mm = +m[2], y = anioDe(mm, dd, m[3] ? +m[3] : 0);
      return valida(y, mm, dd) ? `${y}-${p2(mm)}-${p2(dd)}` : null;
    }
    if ((m = t.match(/^(\d{1,2})(?: de)? ([a-z]+)(?:(?: de| del)? (\d{4}))?\b/)) && MESES[m[2]]) {
      const dd = +m[1], mm = MESES[m[2]], y = anioDe(mm, dd, m[3] ? +m[3] : 0);
      return valida(y, mm, dd) ? `${y}-${p2(mm)}-${p2(dd)}` : null;
    }
    return null;
  }

  // ---------- Reglas: qué se quiere cambiar ----------
  // Cada regla busca en el texto normalizado; los valores de texto se sacan del original.
  const REGLAS = [
    // «2.1 nota: …» y «2.1 tarea: … para viernes» (con dos puntos, para no confundir)
    { campo: 'nota', re: /\b(nota|comentario|apunte)\s*:/d },
    { campo: 'tarea', re: /\b(tarea|pendiente|to ?do)\s*:/d },
    { campo: 'realEnd', re: /\b(termino|finalizo|se cerro|se termino|quedo lista|quedo listo|fin real|esta lista|esta listo|completada|completado|ya se hizo)\b/d, fecha: 'opcional' },
    { campo: 'realStart', re: /\b(empezo|arranco|comenzo|inicio real|se inicio|ya empezo)\b/d, fecha: 'opcional' },
    { campo: 'mover', re: /\b(mover|mueve|correr|corre|aplazar|aplaza|posponer|pospon|adelantar|adelanta|atrasar|atrasa|retrasar|retrasa)\b/d },
    { campo: 'duracion', re: /\b(dura|duracion|toma|tarda|demora)\b/d },
    { campo: 'pct', re: /\b(avance|va en|va al|progreso|lleva)\b|\d{1,3}\s*%/d },
    { campo: 'deadline', re: /\b(fecha limite|fecha de fin|fecha fin|fin|termina|vence|deadline|hasta|se entrega)\b/d, fecha: 'requerida' },
    { campo: 'startDate', re: /\b(fecha de inicio|inicio|empieza|arranca|comienza|desde)\b/d, fecha: 'requerida' },
    { campo: 'deps', re: /\b(no depende de|quitar dependencia de|quita dependencia de|depende de|despues de)\b/d },
    { campo: 'responsables', re: /\b(responsables?|a cargo de|encargad[oa]s?|asignar a|asigna a|asignala a|asignalo a)\b/d },
    { campo: 'entregable', re: /\b(entregable|resultado)\b/d },
    { campo: 'name', re: /\b(renombrar a|renombra a|cambiar nombre a|nuevo nombre)\b/d },
  ];
  const RE_COD = /\b(\d{1,2}\.\d{1,2})\b/;
  const RE_ETAPA = /\b(?:etapa|fase|area)\s+(\d{1,2})\b/;
  const LIMPIA_INICIO = /^(?:(?:pon|ponle|poner|pongale|cambia|cambiar|cambiale|actualiza|actualizar|la|el|de|a|en|actividad|tarea|que|para)\s+)+/;
  const STOP = new Set('de del la las el los en y o a al con por para se su sus un una que lo como es son'.split(' '));

  function buscarActividad(textoNorm, acts) {
    const palabras = textoNorm.split(/\s+/).filter(w => w.length >= 3 && !STOP.has(w));
    if (!palabras.length) return { error: 'No sé a qué actividad te refieres. Usa su ID (ej. 2.1) o parte de su nombre.' };
    const cand = acts.map(a => {
      const n = normar(a.name);
      return { a, hits: palabras.filter(w => n.includes(w)).length };
    }).filter(x => x.hits === palabras.length);
    if (cand.length === 1) return { act: cand[0].a };
    if (!cand.length) return { error: `No encontré una actividad que diga «${palabras.join(' ')}».` };
    return { error: `«${palabras.join(' ')}» calza con varias: ${cand.slice(0, 5).map(x => x.a._cod).join(', ')}. Usa el ID.` };
  }

  function valorTexto(orig, desde) {
    return orig.slice(desde)
      .replace(/^\s*(?:(?:es|son|a|de|por|como|ahora)\s+|[:=]\s*)?/i, '')
      .replace(/\s*(?:\b(?:en|de|para|a)\s+)?\b\d{1,2}\.\d{1,2}\b\s*/g, ' ')
      .replace(/\s+/g, ' ').trim();
  }

  function interpretarUno(orig, model, today) {
    const n = normar(orig);
    const acts = model.activities || [];
    const porCod = {}; acts.forEach(a => { if (a._cod) porCod[a._cod] = a; });
    // ¿Qué regla aplica? La que aparezca primero en la frase (y la más específica si empatan)
    let regla = null, m = null;
    for (const r of REGLAS) {
      const x = n.match(r.re);
      if (x && (!m || x.index < m.index)) { regla = r; m = x; }
    }
    if (!regla) return { error: `No entendí «${orig}». Ej.: «2.1 fin 20 nov», «1.3 responsable Jurídica», «2.4 avance 60».` };
    const finKw = m.index + m[0].length;
    const resto = n.slice(finKw);

    // Objetivo: etapa, ID o nombre
    const mEt = n.match(RE_ETAPA);
    const mCod = n.match(RE_COD);
    let act = null, etapa = null;
    if (regla.campo === 'mover' && mEt) {
      const g = Plan.etapas(model).find(x => x.cod === mEt[1]);
      if (!g) return { error: `No existe la etapa ${mEt[1]}.` };
      etapa = g;
    } else if (mCod && porCod[mCod[1]]) act = porCod[mCod[1]];
    else if (mCod) return { error: `No existe la actividad ${mCod[1]}.` };
    else {
      const antes = n.slice(0, m.index).replace(LIMPIA_INICIO, '').trim();
      const r = buscarActividad(antes, acts);
      if (r.error) return r;
      act = r.act;
    }
    const etiqueta = act ? `${act._cod} · ${act.name}` : `Etapa ${etapa.cod} · ${etapa.name}`;
    const fc = iso => iso ? Plan.fCorta(iso) : '—';

    if (regla.campo === 'mover') {
      const x = n.match(/([+-]?\d{1,3})\s*(dias?|semanas?)/);
      if (!x) return { error: 'Dime cuántos días: «mover 2.1 +3 días» o «mover etapa 3 +1 semana».' };
      let dias = Math.abs(Number(x[1])) * (x[2].startsWith('semana') ? 5 : 1);
      const atras = x[1].startsWith('-') || /\b(adelantar|adelanta)\b/.test(n);
      if (atras) dias = -dias;
      const lista = act ? [act] : etapa.acts;
      const items = lista.filter(a => a.startDate || a.deadline).map(a => {
        const r = Plan.cal.moverRango(a.startDate, a.deadline, dias);
        return { id: a.id, startDate: r.ini, deadline: r.fin };
      });
      if (!items.length) return { error: `${etiqueta} no tiene fechas para mover.` };
      const desc = `${etiqueta} · ${dias > 0 ? 'atrasar' : 'adelantar'} ${Math.abs(dias)} día${Math.abs(dias) === 1 ? '' : 's'} hábil${Math.abs(dias) === 1 ? '' : 'es'}${act ? ` (${fc(act.startDate)}–${fc(act.deadline)} → ${fc(items[0].startDate)}–${fc(items[0].deadline)})` : ` (${items.length} actividades)`}`;
      return act ? { accion: { tipo: 'patch', id: act.id, cambios: { startDate: items[0].startDate, deadline: items[0].deadline }, desc } }
        : { accion: { tipo: 'lote', items, desc } };
    }
    if (!act) return { error: 'Eso se hace sobre una actividad: usa su ID (ej. 2.1).' };

    if (regla.campo === 'realEnd' || regla.campo === 'realStart') {
      // La fecha real la dice el usuario: sin fecha no se asume ninguna
      const f = parseFecha(resto.replace(/^\s*(?:el|en|:)?\s*/, ''), today);
      if (!f) return { error: `¿Qué fecha? Ej.: «${act._cod} ${regla.campo === 'realEnd' ? 'terminó' : 'empezó'} 29 sep» o «${act._cod} ${regla.campo === 'realEnd' ? 'terminó' : 'empezó'} hoy».` };
      const cambios = { [regla.campo]: f };
      return { accion: { tipo: 'patch', id: act.id, cambios, desc: `${etiqueta} · ${regla.campo === 'realEnd' ? 'terminó el' : 'empezó el'} ${fc(f)}${regla.campo === 'realEnd' ? ' (queda completada)' : ''}` } };
    }
    if (regla.campo === 'deadline' || regla.campo === 'startDate') {
      const f = parseFecha(resto.replace(/^\s*(?:(?:el|es|para)\s+|[:=]\s*)?/, ''), today);
      if (!f) return { error: `No entendí la fecha en «${orig}». Ej.: «20 nov», «20/11», «viernes», «en 5 días».` };
      const antes = act[regla.campo];
      return { accion: { tipo: 'patch', id: act.id, cambios: { [regla.campo]: f }, desc: `${etiqueta} · ${regla.campo === 'deadline' ? 'fin' : 'inicio'}: ${fc(antes)} → ${fc(f)}` } };
    }
    if (regla.campo === 'duracion') {
      const x = resto.match(/(\d{1,3})\s*(dias?|semanas?)?/);
      if (!x) return { error: 'Dime la duración: «4.1 dura 8 días».' };
      const dur = Number(x[1]) * (x[2] && x[2].startsWith('semana') ? 5 : 1);
      // La duración manda: con inicio el fin sale solo; sin inicio queda la duración
      // (y se programa al terminar sus precedentes)
      const fin = act.startDate ? Plan.cal.finHabil(act.startDate, dur) : null;
      return { accion: { tipo: 'patch', id: act.id, cambios: { duracion: dur }, desc: `${etiqueta} · dura ${dur} días hábiles${fin ? `: ${fc(act.startDate)} → ${fc(fin)}` : ' (sin fechas aún)'}` } };
    }
    if (regla.campo === 'pct') {
      const x = n.slice(m.index).match(/(\d{1,3})/);
      if (!x) return { error: 'Dime el avance: «2.4 avance 60».' };
      const p = Math.max(0, Math.min(100, Number(x[1])));
      return { accion: { tipo: 'patch', id: act.id, cambios: { pctComplete: p }, desc: `${etiqueta} · avance: ${act.pctComplete || 0}% → ${p}%` } };
    }
    if (regla.campo === 'deps') {
      const quitar = /^(no depende de|quitar dependencia de|quita dependencia de)/.test(m[0]);
      const codigos = (resto.match(/\d{1,2}\.\d{1,2}/g) || []);
      if (!codigos.length) return { error: 'Dime de cuál depende con su ID: «3.2 depende de 3.1».' };
      const ids = [];
      for (const c of codigos) { if (!porCod[c]) return { error: `No existe la actividad ${c}.` }; if (porCod[c].id === act.id) return { error: 'Una actividad no puede depender de sí misma.' }; ids.push(porCod[c].id); }
      const actuales = act.dependsOnIds || [];
      const nuevos = quitar ? actuales.filter(x => !ids.includes(x)) : [...new Set([...actuales, ...ids])];
      return { accion: { tipo: 'patch', id: act.id, cambios: { dependsOnIds: nuevos }, desc: `${etiqueta} · ${quitar ? 'ya no depende de' : 'depende de'} ${codigos.join(', ')}` } };
    }
    if (regla.campo === 'nota' || regla.campo === 'tarea') {
      let texto = orig.slice(finKw).trim();
      if (!texto) return { error: `¿Qué ${regla.campo}? Ej.: «${act._cod} ${regla.campo}: ${regla.campo === 'nota' ? 'la notaría pidió otro documento' : 'llamar a la notaría para viernes'}».` };
      if (regla.campo === 'nota') return { accion: { tipo: 'nota', id: act.id, texto, desc: `${etiqueta} · nota: «${texto}»` } };
      // «… para viernes» al final = fecha límite de la tarea
      let due = null;
      const mp = normar(texto).match(/\s+para\s+(.+)$/);
      if (mp) { const f = parseFecha(mp[1], today); if (f) { due = f; texto = texto.slice(0, mp.index).trim(); } }
      return { accion: { tipo: 'tarea', id: act.id, texto, due, desc: `${etiqueta} · nueva tarea: «${texto}»${due ? ` (vence ${fc(due)})` : ''}` } };
    }
    // Campos de texto: el valor se toma del texto original (con mayúsculas y tildes)
    const valor = valorTexto(orig, finKw);
    if (!valor) return { error: `Falta el valor en «${orig}».` };
    if (regla.campo === 'responsables') {
      return { accion: { tipo: 'patch', id: act.id, cambios: { responsables: valor }, desc: `${etiqueta} · responsable: ${Plan.respDe(act).join(', ') || '—'} → ${valor}` } };
    }
    if (regla.campo === 'entregable') return { accion: { tipo: 'patch', id: act.id, cambios: { entregable: valor }, desc: `${etiqueta} · entregable → ${valor}` } };
    if (regla.campo === 'name') return { accion: { tipo: 'patch', id: act.id, cambios: { name: valor }, desc: `${act._cod} · nombre: ${act.name} → ${valor}` } };
    return { error: `No entendí «${orig}».` };
  }

  // «pon a Jurídica de responsable en 2.1» → «2.1 responsable Jurídica»
  function reordenar(orig) {
    const n = normar(orig);
    const m = n.match(/^\s*(?:pon|ponle|poner|pongan?)\s+a\s+(.+?)\s+(?:de|como)\s+responsables?\s+(?:en|de|a|para)\s+(.+)$/d);
    if (m) return `${orig.slice(m.indices[2][0], m.indices[2][1])} responsable ${orig.slice(m.indices[1][0], m.indices[1][1])}`;
    return orig;
  }

  function interpretar(texto, model) {
    const today = model.today;
    Plan.etapas(model); // asegura los códigos 1.1, 1.2…
    const partes = String(texto || '').split(/[;\n]+/).map(s => s.trim()).filter(Boolean);
    const acciones = [], errores = [];
    partes.forEach(p => {
      const r = interpretarUno(reordenar(p), model, today);
      if (r.error) errores.push(r.error); else acciones.push(r.accion);
    });
    return { acciones, errores };
  }

  window.Asistente = {
    interpretar, parseFecha,
    ejemplos: ['2.1 responsable Jurídica, Mauro', '3.5 fin 20 nov', '1.1 terminó 29 sep', '2.4 avance 60', '4.1 dura 8 días', '3.2 depende de 3.1', 'mover etapa 3 +5 días', '2.3 nota: la notaría pidió otro documento', '2.3 tarea: llamar a la notaría para viernes'],
  };
})();
