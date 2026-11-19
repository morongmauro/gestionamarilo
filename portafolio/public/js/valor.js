/* ============================================================
   VALOR, de la hipótesis al P&G, y los OKR
   - Captura de valor: hipótesis (Income del ICE) → proyectado en
     el caso → capturado (lo reporta la iniciativa) → verificado
     (Finanzas lo encuentra en el P&G). Al Income de la Gerencia
     suma lo verificado. Una captura recurrente se marca una vez y
     cada mes aparece «por confirmar».
   - OKR: cada objetivo tiene resultados clave con línea base,
     meta y fecha. Avance = (actual − base) ÷ (meta − base).
     El actual sale de la captura de valor, de un hito del
     cronograma o del chequeo mensual del responsable.
   Se ven en «Valor» (todo el portafolio) y en cada iniciativa.
   ============================================================ */
'use strict';
(function () {
  const { $, esc } = App;
  const m = v => App.moneyShort(v);
  const hoy = () => App.d.today(), mesHoy = () => hoy().slice(0, 7);
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const mesTxt = ym => `${MESES[+ym.slice(5) - 1]} ${ym.slice(0, 4)}`;
  const mesAnt = (ym, n) => { let [y, mm] = ym.split('-').map(Number); mm -= n; while (mm < 1) { mm += 12; y--; } return `${y}-${String(mm).padStart(2, '0')}`; };
  const plural = (n, s, p) => `${n} ${n === 1 ? s : p}`;
  const nom = p => App.projectName(p);
  const ir = (p, t) => `#/proyectos/${p.id}${t ? '/' + t : ''}`;
  const enFoco = p => p && App.enAlcance(p) && !App.esEjemplo(p);

  /* ---------- captura: cálculos ---------- */
  const catsDe = c => [...new Set((c.flujos || []).filter(f => f.tipo === 'beneficio').map(App.catOf))];
  const proyAnio = (c, y, cat) => { const t = y - (c.anio_inicio || new Date().getFullYear()); if (t < 0) return 0; return (c.flujos || []).filter(f => f.tipo === 'beneficio' && (!cat || App.catOf(f) === cat)).reduce((a, f) => a + (Number((f.valores || [])[t]) || 0), 0); };
  // Plan de captura: lo que el caso dice que se capturará, cada cuánto y hasta qué año del caso.
  // Lo programado aparece solo en el mes a mes; cuenta como capturado cuando alguien lo confirma.
  const FREC_N = { mensual: 12, trimestral: 4, semestral: 2, anual: 1 };
  const FREC_T = { mensual: 'cada mes', trimestral: 'cada trimestre', semestral: 'cada semestre', anual: 'una vez al año' };
  const planDe = c => (c && c.plan_captura && c.plan_captura.activo !== false && c.plan_captura.frecuencia ? c.plan_captura : null);
  function programado(c, ym, cat) {
    const pl = planDe(c); if (!pl) return 0;
    const y = +ym.slice(0, 4), mm = +ym.slice(5), t = y - (c.anio_inicio || y);
    if (t < 0 || (pl.hasta && t >= pl.hasta) || (pl.desde && ym < pl.desde)) return 0;
    const f = FREC_N[pl.frecuencia] ? pl.frecuencia : 'mensual';
    const toca = f === 'mensual' || (f === 'trimestral' && mm % 3 === 0) || (f === 'semestral' && mm % 6 === 0) || (f === 'anual' && mm === (Number(pl.mes) || 12));
    if (!toca) return 0;
    if (Number(pl.monto) > 0) { const k = pl.categoria || (catsDe(c)[0] || 'ahorro'); return !cat || cat === k ? Number(pl.monto) : 0; }
    return proyAnio(c, y, cat) / FREC_N[f];
  }
  // Lo esperado de enero hasta el mes «hasta» (inclusive) según el plan; null si no hay plan
  function esperadoHasta(c, y, hasta) { if (!planDe(c)) return null; let s = 0; for (let i = 1; i <= hasta; i++) s += programado(c, `${y}-${String(i).padStart(2, '0')}`); return s; }
  const capDe = (c, filtro) => (c.captado || []).filter(filtro).reduce((a, x) => a + (Number(x.valor) || 0), 0);
  // Desde qué mes cuenta la captura automática: el mes en que la iniciativa pasó a escalamiento (Fase 3).
  // Si no quedó anotado, se busca en la trazabilidad; si tampoco, desde el inicio del caso.
  const MES_ABR = { ENE: 1, FEB: 2, MAR: 3, ABR: 4, MAY: 5, JUN: 6, JUL: 7, AGO: 8, SEP: 9, OCT: 10, NOV: 11, DIC: 12 };
  function escalaDesde(p, c) {
    if (!p) return null;
    const ec = App.estadoCol(), fa = window.Fases && ec ? Fases.clasificar((p.props || {})[ec.id]) : null;
    if (fa !== 3 && fa !== 'cerrada') return null;
    const pl = c && c.plan_captura; if (pl && pl.desde) return pl.desde;
    if (p.escala_desde) return p.escala_desde;
    const tz = App.S.columns.find(x => x.log) || App.S.columns.find(x => x.id === 'trazabilidad');
    const log = tz ? String((p.props || {})[tz.id] || '') : '';
    // La línea «(organización en 3 fases)» la escribió el sitio al reorganizar: no es la fecha real de escalamiento
    const lin = log.split('\n').find(l => /→\s*Fase 3/i.test(l) && !/organizaci[oó]n en 3 fases/i.test(l));
    const mm = lin && lin.match(/^(\d{1,2})\s+(ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|OCT|NOV|DIC)/i);
    if (mm) { const hy = +hoy().slice(0, 4), hm = +hoy().slice(5, 7), mo = MES_ABR[mm[2].toUpperCase()]; return `${mo > hm ? hy - 1 : hy}-${String(mo).padStart(2, '0')}`; }
    return `${hoy().slice(0, 4)}-01`; // ya estaba en escalamiento antes: se toma desde enero del año en curso (se puede corregir)
  }
  // Lo capturado en un mes: lo registrado a mano si existe; si no, lo que proyecta el caso (aproximado) desde el escalamiento
  const manualMes = (c, ym, cat) => (c.captado || []).filter(x => x.mes === ym && (!cat || x.categoria === cat));
  function autoMes(c, ym, cat) {
    const p = App.byId('projects', c.project_id), d = escalaDesde(p, c); if (!d || ym < d || ym >= mesHoy()) return 0;
    const vc = Number(((p || {}).props || {}).valor_crear) || 0, y = +ym.slice(0, 4), PV = App.periodoValor();
    if (vc > 0) { const tv = App.S.columns.find(x => x.id === 'tipo_valor'); return y >= PV.d && y <= PV.h && cat === App.catDeTipoValor(tv ? (p.props || {})[tv.id] : '') ? vc / PV.n / 12 : 0; }
    return planDe(c) ? programado(c, ym, cat) : proyAnio(c, y, cat) / 12;
  }
  function capMes(c, ym, cat) {
    if (cat) { const r = manualMes(c, ym, cat); return r.length ? r.reduce((a, x) => a + (Number(x.valor) || 0), 0) : autoMes(c, ym, cat); }
    const cs = [...new Set((catsDe(c).length ? catsDe(c) : ['ahorro']).concat((c.captado || []).filter(x => x.mes === ym).map(x => x.categoria)))];
    return cs.reduce((a, k) => a + capMes(c, ym, k), 0);
  }
  const esAuto = (c, ym, cat) => !manualMes(c, ym, cat).length && autoMes(c, ym, cat) > 0;
  const capAnio = (c, y) => { let s = 0; for (let i = 1; i <= 12; i++) s += capMes(c, `${y}-${String(i).padStart(2, '0')}`); return s; };
  const capUlt12 = c => { let s = 0; for (let i = 1; i <= 12; i++) s += capMes(c, mesAnt(mesHoy(), i)); return s; };
  const verHasta = (c, y) => ((c.validacion || {})[String(y)] || {}).hasta || null;
  const esVer = (c, ym) => { const h = verHasta(c, ym.slice(0, 4)); return !!(h && ym <= h); };
  const verAnio = (c, y) => capDe(c, x => String(x.mes).startsWith(y + '-') && esVer(c, x.mes));
  // Income del ICE (banda de dinero a dos años) → hipótesis anual en pesos (punto medio de la banda ÷ 2)
  const BANDAS = [[50e6, 1], [200e6, 2], [600e6, 3], [1200e6, 5], [2200e6, 8], [4200e6, 13], [8200e6, 21], [16200e6, 34], [Infinity, 55]];
  function hipotesis(p) {
    const n = Number((p.props || {}).ice_income); if (!(n > 0)) return null;
    const i = BANDAS.findIndex(b => b[1] >= n); if (i < 0) return null;
    const lo = i ? BANDAS[i - 1][0] : 0, hi = BANDAS[i][0] === Infinity ? lo * 1.5 : BANDAS[i][0];
    return { income: n, anual: (lo + hi) / 2 / 2 };
  }
  // Capturas recurrentes que falta confirmar (meses cerrados, hasta 24 atrás)
  function pendientes(c) {
    return []; // la captura de lo programado es automática: no hay nada que confirmar
    const out = [], lim = mesAnt(mesHoy(), 24);
    (c.recurrentes || []).filter(r => r.activo !== false && r.desde).forEach(r => {
      for (let ym = r.desde < lim ? lim : r.desde; ym < mesHoy(); ym = mesAnt(ym, -1)) if (!(c.captado || []).some(x => x.mes === ym && x.categoria === r.categoria)) out.push({ r, mes: ym });
    });
    if (planDe(c)) {
      const ini = `${c.anio_inicio || hoy().slice(0, 4)}-01`, cs = catsDe(c).length ? catsDe(c) : ['ahorro'];
      for (let ym = [lim, ini, planDe(c).desde || ini].sort().pop(); ym < mesHoy(); ym = mesAnt(ym, -1)) cs.forEach(k => {
        const v = Math.round(programado(c, ym, k));
        if (v > 0 && !(c.captado || []).some(x => x.mes === ym && x.categoria === k) && !out.some(z => z.mes === ym && z.r.categoria === k)) out.push({ r: { id: 'plan', categoria: k, valor: v, plan: true }, mes: ym });
      });
    }
    return out.sort((a, b) => a.mes.localeCompare(b.mes));
  }
  async function guardarCaso(c, cambios) { const r = await App.patch('cases', c.id, cambios); Object.assign(c, cambios); return r; }
  async function confirmar(c, lista) {
    const cap = (c.captado || []).slice();
    lista.forEach(({ r, mes, valor }) => { if (!cap.some(x => x.mes === mes && x.categoria === r.categoria)) cap.push({ mes, categoria: r.categoria, valor: valor != null ? valor : Number(r.valor) || 0, rec: r.id }); });
    await guardarCaso(c, { captado: cap });
  }
  const leerCifra = t => { const v = App.Hoja.parseQty(String(t || '').replace(/\s/g, '')); return v == null ? null : v; };

  /* ---------- captura: por iniciativa ---------- */
  function captura(box, pid) {
    const p = App.byId('projects', pid), c = App.caseOf(pid), ro = !App.canEdit();
    const Y = Number(App.store.get('captura.anio', +hoy().slice(0, 4)));
    if (!c && escalaDesde(p, null)) { const ed = escalaDesde(p, null), vc = Number((p.props || {}).valor_crear) || 0, PV = App.periodoValor();
      box.innerHTML = `<div class="vl-vacio"><b>Captura aproximada desde ${esc(mesTxt(ed))}.</b> ${vc ? `Se toma su valor a crear/capturar (${esc(m(vc))} para ${PV.d}–${PV.h}) repartido por mes desde que escaló.` : 'Sin valor a crear/capturar ni caso de negocio, no hay cifra que repartir.'}${ro ? '' : ` <label class="vl-esc">Escaló en <input type="month" data-esc value="${esc(ed)}"></label>`}</div>`;
      box.onchange = e => { const i = e.target.closest('[data-esc]'); if (!i || !i.value) return; App.guard(async () => { await App.patch('projects', pid, { escala_desde: i.value }); App.toast('Fecha de escalamiento guardada'); captura(box, pid); }); };
      return; }
    if (!c) { box.innerHTML = `<div class="vl-vacio"><b>Esta iniciativa aún no tiene caso de negocio.</b> La captura de valor se mide contra lo que proyecta el caso.${ro ? '' : ` <a class="t-lnk" href="${ir(p, 'caso')}">Crear el caso de negocio</a>`}</div>`; return; }
    const cats = catsDe(c).length ? catsDe(c) : ['ahorro'];
    const pend = pendientes(c), hip = hipotesis(p), proy = proyAnio(c, Y), cap = capAnio(c, Y), ver = verAnio(c, Y), vh = verHasta(c, Y);
    const ult12 = capUlt12(c);
    const meses = Array.from({ length: 12 }, (_, i) => `${Y}-${String(i + 1).padStart(2, '0')}`);
    const celda = (ym, k) => { const v = capMes(c, ym, k), fut = ym >= mesHoy(), au = v && esAuto(c, ym, k), pg = !v && fut && escalaDesde(p, c) ? (planDe(c) ? programado(c, ym, k) : proyAnio(c, +ym.slice(0, 4), k) / 12) : 0;
      return `<td class="${esVer(c, ym) && v && !au ? 'ver' : ''} ${fut ? 'fut' : ''} ${au ? 'au' : ''} ${ro || fut ? '' : 'ed'}" data-cel="${ym}|${k}" title="${au ? 'Aproximado: lo que proyecta el caso. Clic para registrar la cifra real' : pg ? 'Lo que proyecta el caso para este mes' : esVer(c, ym) && v ? 'Verificado' : ''}">${v ? (au ? `<span class="pg">${esc(App.num(v / 1e6, 1))}</span>` : `<b>${esc(App.num(v / 1e6, 1))}</b>`) : pg ? `<span class="pg">${esc(App.num(pg / 1e6, 1))}</span>` : fut ? '' : '·'}</td>`; };
    box.innerHTML = `<div class="vl-bar"><div class="vl-res">
        <span><b>${hip ? esc(m(hip.anual)) : '—'}</b>hipótesis al año${hip ? ` (Income ${hip.income})` : ''}</span><span><b>${esc(m(proy))}</b>proyectado ${Y}</span>
        <span><b>${esc(m(cap))}</b>capturado, aprox.</span><span class="ok"><b>${esc(m(ver))}</b>verificado</span></div><span class="sp"></span>
        ${ro ? '' : '<button class="btn primary sm" data-v="registrar">Registrar captura</button><button class="btn sm" data-v="mas">⋯ Más</button>'}</div>
      ${pend.length ? `<section class="vl-sec"><h3>Por confirmar <small>lo programado de meses ya cerrados: confirme o ajuste la cifra real</small>${ro ? '' : `<button class="t-lnk" data-v="conf-todo">Confirmar todas (${pend.length})</button>`}</h3>
        <div class="vl-pend">${pend.slice(-6).map((z, i) => `<div class="vl-pi"><i class="ico ico-reloj"></i><span><b>${esc(App.catLabel(z.r.categoria))}, ${esc(mesTxt(z.mes))}</b><small>${z.r.plan ? 'programado en el plan de captura' : `recurrente desde ${esc(mesTxt(z.r.desde))}`}</small></span><b class="v">${esc(m(z.r.valor))}</b>${ro ? '' : `<span><button class="btn primary sm" data-conf="${pend.indexOf(z)}">Confirmar</button><button class="btn sm" data-aj="${pend.indexOf(z)}">Ajustar</button></span>`}</div>`).join('')}
        ${pend.length > 6 ? `<div class="faint">y ${pend.length - 6} más anteriores</div>` : ''}</div></section>` : ''}
      <section class="vl-sec"><h3>Mes a mes <small>en millones, aproximado (en cursiva, lo que proyecta el caso desde que la iniciativa escaló); en negrita lo registrado a mano; verde: verificado${vh ? ` hasta ${esc(mesTxt(vh))}` : ''}</small><span class="sp"></span><span class="vl-anio"><button data-anio="-1" aria-label="Año anterior">‹</button><b>${Y}</b><button data-anio="1" aria-label="Año siguiente">›</button></span></h3>
        <div class="vl-tw"><table class="vl-t"><thead><tr><th>Tipo de valor</th>${meses.map(ym => `<th>${App.d.MES3[+ym.slice(5) - 1]}</th>`).join('')}<th>Total</th><th>Proyectado</th></tr></thead><tbody>
        ${cats.map(k => `<tr><td><span class="cat-dot cat-${k}"></span>${esc(App.catLabel(k))}</td>${meses.map(ym => celda(ym, k)).join('')}<td class="tot">${esc(App.num(meses.reduce((a, ym) => a + capMes(c, ym, k), 0) / 1e6, 1))}</td><td class="tot mu">${esc(App.num(proyAnio(c, Y, k) / 1e6, 1))}</td></tr>`).join('')}
        </tbody></table></div>${ro ? '' : '<div class="faint vl-nota">Clic en un mes para registrar o corregir lo capturado.</div>'}</section>
      ${escalaDesde(p, c) ? `<p class="vl-plan-t">Captura aproximada desde <b>${esc(mesTxt(escalaDesde(p, c)))}</b>, mes en que pasó a escalamiento.${ro ? '' : ` <label class="vl-esc">Cambiar <input type="month" data-esc value="${esc(escalaDesde(p, c))}"></label>`}</p>` : ''}
      <section class="vl-sec vl-plan"><h3>Plan de captura</h3>${planTxt(c)}${ro ? '' : `<button class="btn sm" data-v="plan">${planDe(c) ? 'Cambiar el plan' : 'Definir el plan'}</button>`}</section>
      <div class="vl-dos"><section class="vl-sec"><h3>Capturas recurrentes <small>montos fijos</small></h3>
        ${(c.recurrentes || []).length ? `<div class="vl-rec">${c.recurrentes.map(r => `<div class="vl-ri ${r.activo === false ? 'off' : ''}"><span><b>${esc(App.catLabel(r.categoria))}: ${esc(m(r.valor))} al mes</b><small>desde ${esc(mesTxt(r.desde))}${r.activo === false ? ', detenida' : ''}</small></span>${ro ? '' : `<button class="t-lnk" data-rec-t="${r.id}">${r.activo === false ? 'Reanudar' : 'Detener'}</button><button class="t-lnk x" data-rec-x="${r.id}">Quitar</button>`}</div>`).join('')}</div>` : '<p class="faint">Ninguna. Si un ahorro o ingreso se repite cada mes, márquelo una vez y cada mes aparecerá para confirmar.</p>'}
        ${ro ? '' : '<button class="btn sm" data-v="rec">+ Captura recurrente</button>'}</section>
      <section class="vl-sec"><h3>¿Se cumple la hipótesis?</h3>${hip ? `<div class="vl-hip"><div class="tr"><i class="${ult12 >= hip.anual * .9 ? 'g' : ult12 >= hip.anual * .5 ? 'o' : 'r'}" style="width:${Math.min(100, ult12 / hip.anual * 100)}%"></i></div><b>${Math.round(ult12 / hip.anual * 100)} %</b></div>
        <p class="faint">En los últimos 12 meses se capturaron ${esc(m(ult12))} frente a ${esc(m(hip.anual))} al año que supone el Income ${hip.income} del ICE. Sirve para calibrar la Confianza en las próximas iniciativas.</p>` : '<p class="faint">Sin Income en el ICE no hay hipótesis contra qué comparar.</p>'}
        <p class="faint">${vh ? `Finanzas verificó hasta ${esc(mesTxt(vh))}${(c.validacion[String(Y)] || {}).por ? ` (${esc(c.validacion[String(Y)].por)})` : ''}.` : `Aún no hay meses verificados en ${Y}.`}</p></section></div>`;

    const repintar = () => captura(box, pid);
    box.onchange = e => { const i = e.target.closest('[data-esc]'); if (!i || !i.value) return; App.guard(async () => { await App.patch('projects', pid, { escala_desde: i.value }); App.toast('Fecha de escalamiento guardada'); repintar(); }); };
    box.onclick = e => {
      const an = e.target.closest('[data-anio]'); if (an) { App.store.set('captura.anio', Y + Number(an.dataset.anio)); return repintar(); }
      if (ro) return;
      const cf = e.target.closest('[data-conf]'); if (cf) return App.guard(async () => { await confirmar(c, [pend[+cf.dataset.conf]]); App.toast('Captura confirmada'); repintar(); });
      const aj = e.target.closest('[data-aj]'); if (aj) { const z = pend[+aj.dataset.aj]; return App.editText(aj, String(Math.round(z.r.valor)), { placeholder: 'Valor real del mes', width: 240, onSave: t => { const v = leerCifra(t); if (v == null) return App.toast('Escriba una cifra, p. ej. 32,5M', true); App.guard(async () => { await confirmar(c, [{ r: z.r, mes: z.mes, valor: v }]); App.toast('Captura registrada'); repintar(); }); } }); }
      if (e.target.closest('[data-v=conf-todo]')) return App.guard(async () => { await confirmar(c, pend); App.toast(`${plural(pend.length, 'captura confirmada', 'capturas confirmadas')}`); repintar(); });
      const cel = e.target.closest('td.ed[data-cel]'); if (cel) { const [ym, k] = cel.dataset.cel.split('|'); return editarMes(cel, c, ym, k, repintar); }
      const rt = e.target.closest('[data-rec-t]'); if (rt) return App.guard(async () => { await guardarCaso(c, { recurrentes: c.recurrentes.map(r => (r.id === rt.dataset.recT ? { ...r, activo: r.activo === false } : r)) }); repintar(); });
      const rx = e.target.closest('[data-rec-x]'); if (rx) { if (!confirm('¿Quitar esta captura recurrente? Lo ya confirmado se conserva.')) return; return App.guard(async () => { await guardarCaso(c, { recurrentes: c.recurrentes.filter(r => r.id !== rx.dataset.recX) }); repintar(); }); }
      const b = e.target.closest('[data-v]'); if (!b) return;
      if (b.dataset.v === 'registrar') return registrar(b, c, cats, repintar);
      if (b.dataset.v === 'rec') return recurrente(b, c, cats, repintar);
      if (b.dataset.v === 'plan') return editarPlan(b, c, cats, repintar);
      if (b.dataset.v === 'mas') return App.menu(b, [{ id: 'rec', label: 'Captura recurrente' }, { id: 'ver', label: 'Marcar verificado por Finanzas' }, '-', { id: 'caso', label: 'Ver el caso de negocio' }], k => {
        if (k === 'rec') recurrente(b, c, cats, repintar);
        if (k === 'ver') verificar(b, c, Y, repintar);
        if (k === 'caso') App.go(ir(p, 'caso'));
      }, 260);
    };
  }
  function editarMes(anchor, c, ym, k, done) {
    const actual = manualMes(c, ym, k).reduce((a, x) => a + (Number(x.valor) || 0), 0);
    App.editText(anchor, actual ? String(Math.round(actual)) : '', { placeholder: `Capturado en ${mesTxt(ym)} (p. ej. 32,5M)`, width: 260, onSave: t => {
      const v = String(t).trim() === '' ? 0 : leerCifra(t); if (v == null) return App.toast('Escriba una cifra, p. ej. 32,5M', true);
      App.guard(async () => { const cap = (c.captado || []).filter(x => !(x.mes === ym && x.categoria === k)); if (v) cap.push({ mes: ym, categoria: k, valor: v }); await guardarCaso(c, { captado: cap }); done(); });
    } });
  }
  const selMes = (n, sel) => Array.from({ length: n }, (_, i) => mesAnt(mesHoy(), i)).map(ym => `<option value="${ym}" ${ym === sel ? 'selected' : ''}>${mesTxt(ym)}</option>`).join('');
  const selCat = cats => (cats.length ? cats : App.CATS.map(x => x.id)).map(k => `<option value="${k}">${esc(App.catLabel(k))}</option>`).join('');
  function registrar(anchor, c, cats, done) {
    const p = App.openPop(anchor, `<div class="lbl">Registrar captura</div><div class="vl-f">
      <label>Mes <select class="fld" data-r="mes">${selMes(13, mesAnt(mesHoy(), 1))}</select></label>
      <label>Tipo de valor <select class="fld" data-r="cat">${selCat(cats)}</select></label>
      <label>Valor capturado <input class="fld" data-r="valor" placeholder="p. ej. 32,5M o 32.500.000"></label>
      <label class="vl-ck"><input type="checkbox" data-r="rec"> Se repite cada mes desde este mes</label>
      <button class="btn primary sm" data-r="ok">Guardar</button></div>`, { width: 320 });
    p.onclick = e => { if (!e.target.closest('[data-r=ok]')) return; const q = k => p.querySelector(`[data-r=${k}]`), v = leerCifra(q('valor').value);
      if (!v) return App.toast('Escriba el valor capturado', true);
      const mes = q('mes').value, cat = q('cat').value;
      App.guard(async () => { const cap = (c.captado || []).filter(x => !(x.mes === mes && x.categoria === cat)); cap.push({ mes, categoria: cat, valor: v });
        const ch = { captado: cap }; if (q('rec').checked) ch.recurrentes = (c.recurrentes || []).concat({ id: App.uid(), categoria: cat, valor: v, desde: mes, activo: true });
        await guardarCaso(c, ch); App.closePop(true); App.toast('Captura registrada'); done(); });
    };
  }
  const MESES_L = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  function planTxt(c) {
    const pl = planDe(c), ini = c.anio_inicio || +hoy().slice(0, 4), n = c.anios || 10;
    if (!pl) return `<p class="faint">Sin plan, el beneficio de cada año del caso se reparte en 12 meses. Con un plan se precisa cada cuánto llega (mes, trimestre, año) y hasta qué año del caso.</p>`;
    const cuanto = Number(pl.monto) > 0 ? `${esc(m(pl.monto))} de ${esc(App.catLabel(pl.categoria || 'ahorro'))}` : 'Lo que dice el caso';
    const cada = pl.frecuencia === 'anual' ? `una vez al año, en ${MESES_L[(Number(pl.mes) || 12) - 1]}` : FREC_T[pl.frecuencia];
    const hasta = pl.hasta && pl.hasta < n ? `hasta el año ${pl.hasta} del caso (${ini + pl.hasta - 1})` : `durante todo el caso (${n} años, hasta ${ini + n - 1})`;
    return `<p class="vl-plan-t"><b>${cuanto}, ${cada}</b>, ${hasta}${pl.desde ? `, desde ${esc(mesTxt(pl.desde))}` : ''}.${Number(pl.monto) > 0 ? '' : ` <span class="faint">${pl.frecuencia === 'mensual' ? 'El beneficio de cada año se reparte en 12 meses.' : pl.frecuencia === 'anual' ? 'El beneficio del año llega en un solo mes.' : 'El beneficio de cada año se reparte en partes iguales.'}</span>`}</p>`;
  }
  function editarPlan(anchor, c, cats, done) {
    const pl = c.plan_captura || {}, n = c.anios || 10, ini = c.anio_inicio || +hoy().slice(0, 4);
    const op = (v, t, sel) => `<option value="${v}" ${String(sel) === String(v) ? 'selected' : ''}>${t}</option>`;
    const p = App.openPop(anchor, `<div class="lbl">Plan de captura</div><div class="vl-f">
      <label>Cada cuánto se captura<select data-pl="frec">${op('mensual', 'Cada mes', pl.frecuencia || 'mensual')}${op('trimestral', 'Cada trimestre', pl.frecuencia)}${op('semestral', 'Cada semestre', pl.frecuencia)}${op('anual', 'Una vez al año', pl.frecuencia)}</select></label>
      <label data-solo="anual">En qué mes<select data-pl="mes">${MESES_L.map((t, i) => op(i + 1, t, pl.mes || 12)).join('')}</select></label>
      <label>Cuánto<select data-pl="modo">${op('caso', 'Lo que dice el caso, año por año', Number(pl.monto) > 0 ? 'fijo' : 'caso')}${op('fijo', 'Un monto fijo por período', Number(pl.monto) > 0 ? 'fijo' : 'caso')}</select></label>
      <label data-solo="fijo">Monto por período (pesos)<input data-pl="monto" inputmode="decimal" value="${Number(pl.monto) > 0 ? pl.monto : ''}"></label>
      <label data-solo="fijo">Tipo de valor<select data-pl="cat">${cats.map(k => op(k, App.catLabel(k), pl.categoria || cats[0])).join('')}</select></label>
      <label>Hasta cuándo<select data-pl="hasta">${[[2, `Año 2 del caso (${ini + 1})`], [5, `Año 5 (${ini + 4})`], [n, `Todo el caso, ${n} años (${ini + n - 1})`]].filter((z, i, a) => z[0] <= n && a.findIndex(w => w[0] === z[0]) === i).map(([v, t]) => op(v, t, pl.hasta || n)).join('')}</select></label>
      <label>Desde (opcional)<input type="month" data-pl="desde" value="${esc(pl.desde || '')}"></label></div>
      <div class="row"><button class="btn primary sm" data-pl="ok">Guardar</button>${c.plan_captura ? '<button class="btn sm" data-pl="quitar">Quitar el plan</button>' : ''}</div>`, { width: 340 });
    const q = k => p.querySelector(`[data-pl=${k}]`);
    const vis = () => { p.querySelector('[data-solo=anual]').hidden = q('frec').value !== 'anual'; p.querySelectorAll('[data-solo=fijo]').forEach(x => { x.hidden = q('modo').value !== 'fijo'; }); };
    vis(); p.onchange = vis;
    p.onclick = e => {
      if (e.target.closest('[data-pl=quitar]')) return App.guard(async () => { await guardarCaso(c, { plan_captura: null }); App.closePop(true); App.toast('Plan quitado'); done(); });
      if (!e.target.closest('[data-pl=ok]')) return;
      const fijo = q('modo').value === 'fijo', monto = fijo ? leerCifra(q('monto').value) : null;
      if (fijo && !(monto > 0)) return App.toast('Escriba el monto por período', true);
      const nuevo = { frecuencia: q('frec').value, mes: Number(q('mes').value) || 12, hasta: Number(q('hasta').value) || n, monto: fijo ? monto : null, categoria: fijo ? q('cat').value : null, desde: q('desde').value || null, activo: true };
      App.guard(async () => { await guardarCaso(c, { plan_captura: nuevo }); App.closePop(true); App.toast('Plan de captura guardado'); done(); });
    };
  }
  function recurrente(anchor, c, cats, done) {
    const p = App.openPop(anchor, `<div class="lbl">Captura recurrente</div><div class="vl-f">
      <label>Tipo de valor <select class="fld" data-r="cat">${selCat(cats)}</select></label>
      <label>Valor al mes <input class="fld" data-r="valor" placeholder="p. ej. 32,5M"></label>
      <label>Desde <select class="fld" data-r="desde">${selMes(24, mesAnt(mesHoy(), 1))}</select></label>
      <p class="faint">Cada mes cerrado aparece «por confirmar»: se confirma o se ajusta con un clic.</p>
      <button class="btn primary sm" data-r="ok">Guardar</button></div>`, { width: 320 });
    p.onclick = e => { if (!e.target.closest('[data-r=ok]')) return; const q = k => p.querySelector(`[data-r=${k}]`), v = leerCifra(q('valor').value);
      if (!v) return App.toast('Escriba el valor al mes', true);
      App.guard(async () => { await guardarCaso(c, { recurrentes: (c.recurrentes || []).concat({ id: App.uid(), categoria: q('cat').value, valor: v, desde: q('desde').value, activo: true }) }); App.closePop(true); done(); });
    };
  }
  function verificar(anchor, c, Y, done) {
    const v = (c.validacion || {})[String(Y)] || {};
    const p = App.openPop(anchor, `<div class="lbl">Verificado por Finanzas, ${Y}</div><div class="vl-f">
      <label>Lo capturado está en el P&amp;G hasta <select class="fld" data-r="hasta"><option value="">ningún mes</option>${Array.from({ length: 12 }, (_, i) => `${Y}-${String(i + 1).padStart(2, '0')}`).map(ym => `<option value="${ym}" ${ym === v.hasta ? 'selected' : ''}>${mesTxt(ym)}</option>`).join('')}</select></label>
      <label>Nota o soporte <input class="fld" data-r="nota" value="${esc(v.nota || '')}" placeholder="p. ej. cierre contable de septiembre"></label>
      <button class="btn primary sm" data-r="ok">Guardar</button></div>`, { width: 320 });
    p.onclick = e => { if (!e.target.closest('[data-r=ok]')) return; const q = k => p.querySelector(`[data-r=${k}]`);
      App.guard(async () => { const val = Object.assign({}, c.validacion || {}); val[String(Y)] = q('hasta').value ? { hasta: q('hasta').value, nota: q('nota').value, por: (App.S.me || {}).name || '', fecha: hoy() } : null; if (!val[String(Y)]) delete val[String(Y)];
        await guardarCaso(c, { validacion: val }); App.closePop(true); App.toast('Verificación guardada'); done(); });
    };
  }

  /* ---------- captura: todo el portafolio ---------- */
  function capturaPortafolio(main) {
    const Y = Number(App.store.get('captura.anio', +hoy().slice(0, 4)));
    const ps = App.projectsSorted().filter(enFoco), filas = ps.map(p => ({ p, c: App.caseOf(p.id), h: hipotesis(p) }));
    const conC = filas.filter(z => z.c && z.c.moneda !== 'USD');
    const hip = filas.reduce((a, z) => a + (z.h ? z.h.anual : 0), 0), proy = conC.reduce((a, z) => a + proyAnio(z.c, Y), 0), cap = conC.reduce((a, z) => a + capAnio(z.c, Y), 0), ver = conC.reduce((a, z) => a + verAnio(z.c, Y), 0);
    const pend = conC.flatMap(z => pendientes(z.c).map(x => Object.assign({ p: z.p, c: z.c }, x)));
    const mx = Math.max(hip, proy, cap, 1);
    const fila = (n, s, v, cl, pc) => `<div class="vl-e"><span class="n"><b>${n}</b><small>${s}</small></span><span><span class="bar ${cl}" style="width:${Math.max(2, v / mx * 100)}%"></span></span><span class="v">${esc(m(v))}${pc ? `<small>${pc}</small>` : ''}</span></div>`;
    const meses = Array.from({ length: 12 }, (_, i) => `${Y}-${String(i + 1).padStart(2, '0')}`);
    const tabla = conC.filter(z => proyAnio(z.c, Y) || capAnio(z.c, Y)).sort((a, b) => capAnio(b.c, Y) - capAnio(a.c, Y) || proyAnio(b.c, Y) - proyAnio(a.c, Y));
    main.innerHTML = `${cabecera('captura')}
      <p class="vl-flujo"><span>Hipótesis (Income del ICE)</span>→<span>Proyectado en el caso</span>→<span>Capturado</span>→<span>Verificado por Finanzas</span><em>Al Income de la Gerencia suma lo verificado.</em><span class="sp"></span><span class="vl-anio"><button data-anio="-1" aria-label="Año anterior">‹</button><b>${Y}</b><button data-anio="1" aria-label="Año siguiente">›</button></span></p>
      <div class="vl-dos a"><section class="vl-p"><h3>¿Cuánto valor es real? <small>${Y}, iniciativas del foco</small></h3><div class="vl-emb">
          ${fila('Hipótesis', 'Income declarado en el ICE', hip, 'gr')}
          ${fila('Proyectado', 'lo que dicen los casos', proy, 'az', hip ? `${Math.round(proy / hip * 100)} % de la hipótesis` : '')}
          ${fila('Capturado (aprox.)', 'lo proyectado desde el escalamiento, o lo registrado', cap, 'in', proy ? `${Math.round(cap / proy * 100)} % de lo proyectado` : '')}
          ${fila('Verificado', 'Finanzas lo encontró en el P&G', ver, 've', cap ? `${Math.round(ver / cap * 100)} % de lo capturado` : '')}</div></section>
        <section class="vl-p"><h3>Por confirmar <small>lo programado de meses ya cerrados</small></h3>
          ${pend.length ? `<div class="vl-pend">${pend.slice(0, 6).map((z, i) => `<div class="vl-pi"><i class="ico ico-reloj"></i><span><a href="${ir(z.p, 'captura')}"><b>${esc(nom(z.p))}</b></a><small>${esc(App.catLabel(z.r.categoria))}, ${esc(mesTxt(z.mes))}</small></span><b class="v">${esc(m(z.r.valor))}</b>${App.canEdit() ? `<span><button class="btn primary sm" data-pconf="${i}">Confirmar</button></span>` : ''}</div>`).join('')}</div>${pend.length > 6 ? `<p class="faint">y ${pend.length - 6} más</p>` : ''}` : '<p class="faint">Nada por confirmar. Las capturas recurrentes se marcan en la pestaña «Captura de valor» de cada iniciativa.</p>'}</section></div>
      <section class="vl-p"><h3>Mes a mes por iniciativa <small>en millones, aproximado: en cursiva lo que proyecta el caso desde el escalamiento, en negrita lo registrado</small></h3>
        ${tabla.length ? `<div class="vl-tw"><table class="vl-t"><thead><tr><th>Iniciativa</th>${meses.map(ym => `<th>${App.d.MES3[+ym.slice(5) - 1]}</th>`).join('')}<th>Total</th><th>Proyectado</th></tr></thead><tbody>
          ${tabla.map(z => { const pe = pendientes(z.c); return `<tr><td><a href="${ir(z.p, 'captura')}">${esc(nom(z.p))}</a></td>${meses.map(ym => { const v = capMes(z.c, ym), au = v && !manualMes(z.c, ym).length; return `<td class="${v && !au && esVer(z.c, ym) ? 'ver' : ''} ${ym >= mesHoy() ? 'fut' : ''}">${v ? (au ? `<span class="pg">${esc(App.num(v / 1e6, 1))}</span>` : `<b>${esc(App.num(v / 1e6, 1))}</b>`) : ym >= mesHoy() ? '' : '·'}</td>`; }).join('')}<td class="tot">${esc(App.num(capAnio(z.c, Y) / 1e6, 1))}</td><td class="tot mu">${esc(App.num(proyAnio(z.c, Y) / 1e6, 1))}</td></tr>`; }).join('')}
          </tbody></table></div>` : '<p class="faint">Ninguna iniciativa proyecta ni captura valor en este año.</p>'}</section>
      <section class="vl-p"><h3>¿Se cumplió la hipótesis? <small>capturado en los últimos 12 meses frente al Income declarado</small></h3><div class="vl-hips">
        ${filas.filter(z => z.h && z.c).map(z => ({ z, u: capUlt12(z.c) })).sort((a, b) => b.u / b.z.h.anual - a.u / a.z.h.anual).slice(0, 10).map(({ z, u }) => { const pc = Math.round(u / z.h.anual * 100);
          return `<a class="vl-hr" href="${ir(z.p, 'captura')}"><span class="nm">${esc(nom(z.p))}<small>Income ${z.h.income}, ${esc(m(z.h.anual))} al año</small></span><span class="tr"><i class="${pc >= 90 ? 'g' : pc >= 50 ? 'o' : 'r'}" style="width:${Math.min(100, pc)}%"></i></span><b>${pc} %</b></a>`; }).join('') || '<p class="faint">Aún no hay iniciativas con Income y caso de negocio.</p>'}</div></section>`;
    main.onclick = e => {
      if (e.target.closest('.burger')) return App.toggleSide();
      const an = e.target.closest('[data-anio]'); if (an) { App.store.set('captura.anio', Y + Number(an.dataset.anio)); return capturaPortafolio(main); }
      const cf = e.target.closest('[data-pconf]'); if (cf) { const z = pend[+cf.dataset.pconf]; return App.guard(async () => { await confirmar(z.c, [z]); App.toast('Captura confirmada'); capturaPortafolio(main); }); }
    };
  }

  /* ---------- OKR ---------- */
  const okrsCfg = () => (Array.isArray(App.S.okrs) ? App.S.okrs : []);
  const normO = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  const iniciativasDe = nombre => App.projectsSorted().filter(p => !App.esEjemplo(p) && App.okrsDe(p).some(o => normO(o) === normO(nombre)));
  function objetivos() {
    const cfg = okrsCfg().map(o => Object.assign({}, o)), vistos = new Set(cfg.map(o => normO(o.nombre)));
    App.projectsSorted().filter(enFoco).forEach(p => App.okrsDe(p).forEach(n => { if (!vistos.has(normO(n))) { vistos.add(normO(n)); cfg.push({ id: '', nombre: n, krs: [] }); } }));
    return cfg;
  }
  function actualKR(k, o) {
    if (k.tipo === 'captura') { const y = (k.fecha || hoy()).slice(0, 4); return iniciativasDe(o.nombre).reduce((a, p) => { const c = App.caseOf(p.id); return a + (c ? capAnio(c, +y) : 0); }, 0); }
    if (k.tipo === 'hito') { const a = App.S.activities.find(x => x.id === k.hito); return a && Number(a.avance) >= 100 ? k.meta : k.base || 0; }
    const ch = (k.chequeos || []).filter(x => x.valor != null).slice(-1)[0]; return ch ? ch.valor : k.base;
  }
  function pctKR(k, o) {
    const a = actualKR(k, o), b = Number(k.base) || 0, mt = Number(k.meta); if (a == null || !Number.isFinite(mt)) return null;
    if (mt === b) return a >= mt ? 100 : 0;
    return Math.max(0, Math.min(100, Math.round((a - b) / (mt - b) * 100)));
  }
  function avanceObj(o) { const l = (o.krs || []).map(k => pctKR(k, o)).filter(x => x != null); return l.length ? Math.round(l.reduce((a, x) => a + x, 0) / l.length) : null; }
  const fmtKR = (k, v) => (v == null ? '—' : k.tipo === 'captura' || /\$|cop|peso/i.test(k.unidad || '') ? m(v) : `${App.num(v, 2)}${k.unidad ? ' ' + k.unidad : ''}`);
  const ESTADO = { verde: ['g', 'ico-ok', 'en camino'], amarillo: ['o', 'ico-reloj', 'con riesgo'], rojo: ['r', 'ico-alerta', 'fuera de camino'] };
  async function guardarOKR(l) { App.S.okrs = await App.api('PUT', '/api/config/okrs', { okrs: l }); }
  function asegurar(o) { const l = okrsCfg().slice(); let x = l.find(z => (o.id && z.id === o.id) || normO(z.nombre) === normO(o.nombre)); if (!x) { x = { id: App.uid(), nombre: o.nombre, krs: [] }; l.push(x); } return { l, x }; }

  function bloqueOKR(o, conIniciativas) {
    const ro = !App.canEdit(), av = avanceObj(o), ini = iniciativasDe(o.nombre);
    return `<section class="ok-o" data-o="${esc(o.id || o.nombre)}"><div class="ok-h"><div><h3>${esc(o.nombre)}</h3>
        ${conIniciativas ? `<div class="ok-ini">${ini.length ? ini.slice(0, 6).map(p => `<a href="${ir(p, 'okr')}">${esc(nom(p))}</a>`).join('') + (ini.length > 6 ? `<span>y ${ini.length - 6} más</span>` : '') : '<span>sin iniciativas asignadas</span>'}</div>` : ''}</div>
        <div class="ok-av">${av == null ? '<span class="faint">sin resultados clave</span>' : `<b>${av} %</b><span>cumplimiento</span>`}</div></div>
      ${(o.krs || []).length ? `<div class="ok-krs">${o.krs.map(k => { const pc = pctKR(k, o), a = actualKR(k, o), ch = (k.chequeos || []).slice(-1)[0], st = ch ? ESTADO[ch.estado] : null;
        return `<div class="ok-kr"><span class="nm">${esc(k.nombre)}<small>${k.tipo === 'captura' ? 'sale de la captura de valor' : k.tipo === 'hito' ? 'sale de un hito del cronograma' : 'se actualiza con el chequeo'}${k.responsable ? `, ${esc(k.responsable)}` : ''}${k.fecha ? `, meta al ${esc(App.d.fmtShort(k.fecha))}` : ''}</small></span>
          <span class="ok-bar"><span class="tr"><i class="${st ? st[0] : pc >= 70 ? 'g' : pc >= 40 ? 'o' : 'r'}" style="width:${pc || 0}%"></i></span><small>${esc(fmtKR(k, a))} de ${esc(fmtKR(k, k.meta))}${k.base ? ` (base ${esc(fmtKR(k, k.base))})` : ''}</small></span>
          <b class="pc">${pc == null ? '—' : pc + ' %'}</b>
          <span class="ok-st">${st ? `<span class="${st[0]}"><i class="ico ${st[1]}"></i>${st[2]}</span><small>${esc(App.d.fmtShort(ch.fecha))}${ch.nota ? ': ' + esc(ch.nota.slice(0, 60)) : ''}</small>` : '<small class="faint">sin chequeo</small>'}</span>
          ${ro ? '' : `<span class="ok-acc"><button class="btn sm" data-chk="${esc(k.id)}">Chequeo</button><button class="t-lnk" data-kre="${esc(k.id)}">Editar</button></span>`}</div>`; }).join('')}</div>` : ''}
      ${ro ? '' : '<button class="t-lnk ok-add" data-kr-n>+ Resultado clave</button>'}</section>`;
  }
  function editorKR(anchor, o, k, done) {
    const ini = iniciativasDe(o.nombre), hitos = App.S.activities.filter(a => a.hito && ini.some(p => p.id === a.project_id));
    const v = k || { tipo: 'manual' };
    const p = App.openPop(anchor, `<div class="lbl">${k ? 'Editar' : 'Nuevo'} resultado clave</div><div class="vl-f">
      <label>Resultado clave <input class="fld" data-k="nombre" value="${esc(v.nombre || '')}" placeholder="p. ej. Bajar el costo por m² en 3 %"></label>
      <label>Cómo se mide <select class="fld" data-k="tipo"><option value="manual" ${v.tipo === 'manual' ? 'selected' : ''}>Indicador: el responsable lo registra en el chequeo</option><option value="captura" ${v.tipo === 'captura' ? 'selected' : ''}>Valor capturado por sus iniciativas</option><option value="hito" ${v.tipo === 'hito' ? 'selected' : ''}>Un hito del cronograma</option></select></label>
      <label data-solo="hito">Hito <select class="fld" data-k="hito"><option value="">elija un hito</option>${hitos.map(a => `<option value="${a.id}" ${a.id === v.hito ? 'selected' : ''}>${esc(nom(App.byId('projects', a.project_id)))}: ${esc(a.name)}</option>`).join('')}</select></label>
      <div class="vl-f3"><label>Línea base <input class="fld" data-k="base" value="${v.base ?? ''}"></label><label>Meta <input class="fld" data-k="meta" value="${v.meta ?? ''}"></label><label>Unidad <input class="fld" data-k="unidad" value="${esc(v.unidad || '')}" placeholder="%, $, días"></label></div>
      <div class="vl-f3"><label>Fecha meta <input class="fld" type="date" data-k="fecha" value="${v.fecha || ''}"></label><label style="grid-column:span 2">Responsable <input class="fld" data-k="responsable" value="${esc(v.responsable || '')}"></label></div>
      <div class="row" style="gap:8px">${k ? '<button class="t-lnk x" data-k="del">Quitar</button>' : ''}<span class="sp" style="flex:1"></span><button class="btn primary sm" data-k="ok">Guardar</button></div></div>`, { width: 380 });
    const tipo = () => p.querySelector('[data-k=tipo]').value, sync = () => { p.querySelector('[data-solo=hito]').hidden = tipo() !== 'hito'; };
    sync(); p.onchange = sync;
    p.onclick = e => {
      const q = n => p.querySelector(`[data-k=${n}]`).value, num = t => (String(t).trim() === '' ? null : tipo() === 'captura' ? leerCifra(t) : Number(String(t).replace(',', '.')));
      if (e.target.closest('[data-k=del]')) { if (!confirm('¿Quitar este resultado clave?')) return; return App.guard(async () => { const { l, x } = asegurar(o); x.krs = x.krs.filter(z => z.id !== k.id); await guardarOKR(l); App.closePop(true); done(); }); }
      if (!e.target.closest('[data-k=ok]')) return;
      if (!q('nombre').trim()) return App.toast('Escriba el resultado clave', true);
      const nuevo = { id: k ? k.id : App.uid(), nombre: q('nombre').trim(), tipo: tipo(), hito: q('hito'), base: num(q('base')), meta: num(q('meta')), unidad: q('unidad'), fecha: q('fecha') || null, responsable: q('responsable'), chequeos: k ? k.chequeos || [] : [] };
      if (nuevo.meta == null && nuevo.tipo !== 'hito') return App.toast('Falta la meta', true);
      if (nuevo.tipo === 'hito') { nuevo.base = 0; nuevo.meta = 100; nuevo.unidad = '%'; }
      App.guard(async () => { const { l, x } = asegurar(o); const i = x.krs.findIndex(z => z.id === nuevo.id); if (i >= 0) x.krs[i] = nuevo; else x.krs.push(nuevo); await guardarOKR(l); App.closePop(true); done(); });
    };
  }
  function chequeo(anchor, o, k, done) {
    const p = App.openPop(anchor, `<div class="lbl">Chequeo: ${esc(k.nombre)}</div><div class="vl-f">
      ${k.tipo === 'manual' ? `<label>Valor actual${k.unidad ? ` (${esc(k.unidad)})` : ''} <input class="fld" data-c="valor" placeholder="meta: ${esc(fmtKR(k, k.meta))}"></label>` : `<p class="faint">El avance se calcula solo (${k.tipo === 'captura' ? 'captura de valor' : 'hito del cronograma'}). Aquí se registra cómo va y por qué.</p>`}
      <div class="ok-sem">${Object.entries(ESTADO).map(([v, [c, ic, t]], i) => `<label class="${c}"><input type="radio" name="est" value="${v}" ${i === 0 ? 'checked' : ''}><i class="ico ${ic}"></i>${t}</label>`).join('')}</div>
      <label>Comentario <textarea class="fld" data-c="nota" rows="2" placeholder="qué pasó este mes, qué se necesita"></textarea></label>
      <button class="btn primary sm" data-c="ok">Guardar chequeo</button></div>`, { width: 360 });
    p.onclick = e => { if (!e.target.closest('[data-c=ok]')) return; const vi = p.querySelector('[data-c=valor]'), val = vi && vi.value.trim() !== '' ? Number(vi.value.replace(',', '.')) : null;
      if (vi && vi.value.trim() !== '' && !Number.isFinite(val)) return App.toast('El valor debe ser un número', true);
      App.guard(async () => { const { l, x } = asegurar(o); const kk = x.krs.find(z => z.id === k.id); kk.chequeos = (kk.chequeos || []).concat({ fecha: hoy(), valor: val, estado: p.querySelector('[name=est]:checked').value, nota: p.querySelector('[data-c=nota]').value, por: (App.S.me || {}).name || '' }); await guardarOKR(l); App.closePop(true); App.toast('Chequeo guardado'); done(); });
    };
  }
  function eventosOKR(cont, lista, repintar) {
    cont.onclick = e => {
      if (e.target.closest('.burger')) return App.toggleSide();
      const sec = e.target.closest('[data-o]'), o = sec && lista.find(z => (z.id || z.nombre) === sec.dataset.o);
      const ck = e.target.closest('[data-chk]'); if (ck && o) return chequeo(ck, o, o.krs.find(k => k.id === ck.dataset.chk), repintar);
      const ke = e.target.closest('[data-kre]'); if (ke && o) return editorKR(ke, o, o.krs.find(k => k.id === ke.dataset.kre), repintar);
      const kn = e.target.closest('[data-kr-n]'); if (kn && o) return editorKR(kn, o, null, repintar);
      const no = e.target.closest('[data-okr-nuevo]'); if (no) return App.editText(no, '', { placeholder: 'Nombre del objetivo', width: 360, onSave: t => { if (!t.trim()) return; App.guard(async () => { const { l } = asegurar({ nombre: t.trim() }); await guardarOKR(l); repintar(); }); } });
      const ap = e.target.closest('[data-aportar]'); if (ap) { const p = App.byId('projects', ap.dataset.aportar), ya = App.okrsDe(p).map(normO);
        return App.pickList(ap, { multi: false, placeholder: 'Buscar objetivo…', empty: 'No hay más objetivos', items: objetivos().filter(z => !ya.includes(normO(z.nombre))).map(z => ({ id: z.nombre, label: z.nombre, color: 'amarillo' })), onSave: n => { if (!n) return; App.guard(async () => { await App.patch('projects', p.id, { props: { okrs: App.okrsDe(p).concat(n).join('\n') } }); repintar(); }); } }); }
      const qu = e.target.closest('[data-quitar-okr]'); if (qu) { const p = App.byId('projects', qu.dataset.quitarOkr); return App.guard(async () => { await App.patch('projects', p.id, { props: { okrs: App.okrsDe(p).filter(x => normO(x) !== normO(qu.dataset.n)).join('\n') } }); repintar(); }); }
    };
  }
  function okrPortafolio(main) {
    const l = objetivos().sort((a, b) => ((b.krs || []).length - (a.krs || []).length) || iniciativasDe(b.nombre).length - iniciativasDe(a.nombre).length);
    const con = l.filter(o => avanceObj(o) != null), prom = con.length ? Math.round(con.reduce((a, o) => a + avanceObj(o), 0) / con.length) : null;
    main.innerHTML = `${cabecera('okr')}
      <div class="vl-bar"><div class="vl-res"><span><b>${prom == null ? '—' : prom + ' %'}</b>cumplimiento promedio</span><span><b>${l.length}</b>objetivos</span><span><b>${l.reduce((a, o) => a + (o.krs || []).length, 0)}</b>resultados clave</span><span><b>${con.length}</b>con medición</span></div><span class="sp"></span>${App.canEdit() ? '<button class="btn primary sm" data-okr-nuevo>+ Objetivo</button>' : ''}</div>
      <p class="faint vl-nota">Cada objetivo se mide con resultados clave: línea base, meta y fecha. El avance sale solo de la captura de valor o de un hito, o del chequeo mensual del responsable. Las iniciativas se asignan desde su pestaña OKR.</p>
      ${l.map(o => bloqueOKR(o, true)).join('') || '<p class="faint">Aún no hay objetivos. Cree el primero con «+ Objetivo».</p>'}`;
    eventosOKR(main, l, () => okrPortafolio(main));
  }
  function okrProyecto(box, pid) {
    const p = App.byId('projects', pid), ro = !App.canEdit(), mios = App.okrsDe(p), todos = objetivos();
    const l = mios.map(n => todos.find(o => normO(o.nombre) === normO(n)) || { id: '', nombre: n, krs: [] });
    box.innerHTML = `<div class="vl-bar"><div class="vl-res"><span><b>${l.length}</b>${l.length === 1 ? 'objetivo' : 'objetivos'} a los que aporta</span>${l.map(avanceObj).filter(x => x != null).length ? `<span><b>${Math.round(l.map(avanceObj).filter(x => x != null).reduce((a, x) => a + x, 0) / l.map(avanceObj).filter(x => x != null).length)} %</b>cumplimiento promedio</span>` : ''}</div><span class="sp"></span>${ro ? '' : `<button class="btn primary sm" data-aportar="${pid}">Aportar a un objetivo</button>`}</div>
      ${l.map(o => bloqueOKR(o, false).replace('<div class="ok-av">', ro ? '<div class="ok-av">' : `<button class="t-lnk x ok-q" data-quitar-okr="${pid}" data-n="${esc(o.nombre)}">Quitar de esta iniciativa</button><div class="ok-av">`)).join('') || '<p class="faint">Esta iniciativa aún no aporta a ningún objetivo.</p>'}`;
    eventosOKR(box, l, () => okrProyecto(box, pid));
  }

  /* ---------- la sección Valor ---------- */
  const PEST = [['casos', 'Casos de negocio', '#/casos'], ['captura', 'Captura de valor', '#/valor/captura'], ['okr', 'OKR', '#/valor/okr']];
  const subnav = act => `<nav class="vl-sub" aria-label="Valor">${PEST.map(([k, t, h]) => `<a href="${h}" class="${k === act ? 'on' : ''}">${t}</a>`).join('')}</nav>`;
  // Misma cabecera que el Portafolio en las tres pestañas: título, pestañas y cifras siempre en el mismo lugar
  const cabecera = act => `<div class="pf-head vl-head"><div class="pg-top"><button class="burger" data-act="burger" aria-label="Menú">☰</button><h1>Valor</h1><span class="sp"></span></div>${subnav(act)}</div>`;
  App.views.valor = { render: (main, params) => { main.className = 'vl'; if ((params || [])[0] === 'okr') return okrPortafolio(main); return capturaPortafolio(main); } };
  // Casos de negocio pasa a ser la primera pestaña de Valor
  const casos = App.views.casos;
  if (casos) App.views.casos = { render: (main, params) => { casos.render(main, params); if ((params || [])[0]) return; const t = main.querySelector('.pg-top'); if (t) { t.querySelector('h1').textContent = 'Valor'; const kl = t.querySelector('.kl'); const hd = document.createElement('div'); hd.className = 'pf-head vl-head'; t.before(hd); hd.appendChild(t); hd.insertAdjacentHTML('beforeend', subnav('casos')); if (kl) { kl.classList.add('pf-kl'); hd.after(kl); } } } };
  App.Valor = { captura, okrProyecto, avanceObj, objetivos, iniciativasDe, pendientes, planDe, programado, esperadoHasta, escalaDesde, capMes, capAnio };
})();
