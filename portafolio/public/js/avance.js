/* ============================================================
   AVANCE DE FASE, qué cumple cada iniciativa y qué le falta
   Criterios de la lámina de la Oficina:
     Fase 1 → 2: caso de negocio (beneficios e inversión), ICE sobre el
                 umbral (Income 3 o más) y cronograma cargado.
     Fase 2 → 3: PMV en marcha (hito del piloto cumplido) y resultados
                 validados (valor capturado y verificado).
     Fase 3 → Cerrada: valor en P&G (lo verificado cubre el valor a dos años).
   Cuando cumple todo, la ficha ofrece pasarla de fase con un clic:
   no se cambia sola porque el paso lleva el aval del Comité.
   ============================================================ */
'use strict';
(function () {
  const { esc } = App;
  const verificado = caso => (caso && caso.moneda !== 'USD' ? (caso.captado || []) : []).filter(x => App.Mejoras.verificado(x, caso)).reduce((a, x) => a + (Number(x.valor) || 0), 0);
  // Beneficios de los dos primeros años con beneficios (la misma base del Income)
  const dosAnios = f => { const b = (f && f.beneficios) || [], t = b.findIndex(v => v > 0); return t < 0 ? 0 : (b[t] || 0) + (b[t + 1] || 0); };

  function de(p) {
    const ec = App.estadoCol(), estado = ec ? (p.props || {})[ec.id] : '';
    const fase = window.Fases ? Fases.de(estado) : null;
    if (!fase || fase.fuera) return null;
    const caso = App.caseOf(p.id), f = caso && caso.moneda !== 'USD' ? Finanzas.calc(caso) : null;
    const pl = App.planOf(p.id), ice = App.ICE.detalle(p), id = p.id;
    let crit = [], sig;
    if (fase.id === 1) {
      sig = Fases.deId(2);
      crit = [
        { ok: pl.acts.length > 0, txt: 'Cronograma cargado', corto: 'Cronograma', paso: 'cargar el cronograma', href: `#/proyectos/${id}/cronograma` },
        { ok: !!(f && f.totalBeneficio > 0), txt: 'Caso de negocio con beneficios', corto: 'Caso con beneficios', paso: caso ? 'poner los beneficios en el caso de negocio' : 'crear el caso de negocio', href: `#/proyectos/${id}/caso` },
        { ok: !!(f && f.totalInversion > 0), txt: 'Inversión en el caso de negocio', corto: 'Inversión en el caso', paso: 'registrar la inversión en el caso de negocio', href: `#/proyectos/${id}/caso` },
        { ok: ice.income != null && ice.income >= App.ICE.UMBRAL_OFICINA, txt: `ICE sobre el umbral (Income 3 o más${ice.income != null ? `; hoy ${ice.income}` : ''})`, corto: `ICE 3 o más${ice.income != null ? ` (hoy ${ice.income})` : ''}`, paso: 'calificar el ICE (Income 3 o más)', ice: true, href: `#/proyectos/${id}/valor/ice` },
      ];
    } else if (fase.id === 2) {
      sig = Fases.deId(3);
      const piloto = pl.acts.filter(a => /piloto|pmv/i.test(a.name || ''));
      crit = [
        { ok: piloto.some(a => (a.avance || 0) >= 100), txt: piloto.length ? 'PMV en marcha: hito del piloto cumplido' : 'PMV en marcha: el cronograma no tiene una actividad «piloto»', corto: 'Piloto cumplido', paso: piloto.length ? 'cumplir el hito del piloto' : 'agregar al cronograma la actividad del piloto', href: `#/proyectos/${id}/cronograma` },
        { ok: verificado(caso) > 0, txt: 'Resultados validados: valor capturado y verificado', corto: 'Valor verificado', paso: 'registrar y verificar el valor capturado', href: `#/proyectos/${id}/valor` },
      ];
    } else if (fase.id === 3) {
      sig = Fases.deId('cerrada');
      const meta = dosAnios(f), ver = verificado(caso);
      crit = [{ ok: meta > 0 && ver >= meta, txt: `Valor en P&G: verificado ${App.moneyShort(ver)}${meta ? ` de ${App.moneyShort(meta)} (valor a dos años)` : ' (el caso aún no proyecta beneficios)'}`, corto: `Valor en P&G${meta ? `: ${App.moneyShort(ver)} de ${App.moneyShort(meta)}` : ''}`, paso: meta ? 'verificar en el P&G el valor a dos años' : 'poner los beneficios en el caso de negocio', href: `#/proyectos/${id}/valor` }];
    }
    return { fase, sig, crit, listo: crit.length > 0 && crit.every(c => c.ok), faltan: crit.filter(c => !c.ok).length };
  }

  // Propuesta A: una franja con el siguiente paso; lo que falta para la siguiente fase son botones
  function html(p, ro) {
    const a = de(p); if (!a) return '';
    const sig = a.sig.corto.replace(/^F(\d)$/, 'Fase $1');
    if (a.listo) return `<div class="av-next listo"><div><div class="t">Lista para pasar a ${esc(sig)}</div><div class="s">Cumple todo lo que pide ${esc(a.sig.nombre)}. El paso lo avala el comité.</div></div><span class="sp"></span>${ro ? '' : `<button class="btn primary sm" data-p="avanzar" data-fase="${esc(a.sig.nombre)}">Pasar a ${esc(sig)}</button>`}</div>`;
    const no = a.crit.filter(c => !c.ok), uno = no[0];
    const chip = c => c.ok ? `<span class="av-chip ok" title="${esc(c.txt)}"><i></i>${esc(c.corto || c.txt)}</span>`
      : c.ice && !ro ? `<button class="av-chip" data-p="ice" title="${esc(c.txt)}"><i></i>${esc(c.corto || c.txt)}</button>`
      : `<a class="av-chip" href="${c.href}" title="${esc(c.txt)}"><i></i>${esc(c.corto || c.txt)}</a>`;
    return `<div class="av-next"><div><div class="t">Siguiente paso: ${esc(uno.paso || uno.txt)}</div><div class="s">Para pasar a ${esc(sig)} ${no.length === 1 ? 'falta 1 cosa' : `faltan ${no.length} cosas`} de ${a.crit.length}.</div></div><span class="sp"></span><div class="av-chips">${a.crit.map(chip).join('')}</div></div>`;
  }
  function htmlLinea(p, ro) {
    const a = de(p); if (!a) return '';
    // Una frase: qué le falta para pasar de fase (o el botón si ya cumple)
    const no = a.crit.filter(c => !c.ok), si = a.crit.filter(c => c.ok);
    return `<div class="av-line ${a.listo ? 'listo' : ''}" title="${esc(a.fase.criterio || '')}">${a.listo
      ? `Cumple lo necesario para pasar a <b>${esc(a.sig.nombre)}</b>.${ro ? '' : ` <button class="t-lnk" data-p="avanzar" data-fase="${esc(a.sig.nombre)}">Pasar a ${esc(a.sig.corto)}</button>`}`
      : `Para pasar a <b>${esc(a.sig.nombre)}</b> le falta: ${no.map(c => `<a href="${c.href}">${esc((/^[A-ZÁÉÍÓÚ][a-záéíóúñ]/.test(c.txt) ? c.txt.charAt(0).toLowerCase() + c.txt.slice(1) : c.txt))}</a>`).join('; ')}.${si.length ? ` <span class="faint">Ya cumple: ${si.map(c => esc((/^[A-ZÁÉÍÓÚ][a-záéíóúñ]/.test(c.txt) ? c.txt.charAt(0).toLowerCase() + c.txt.slice(1) : c.txt))).join('; ')}.</span>` : ''}`}</div>`;
  }

  App.Avance = { de, html, htmlLinea, verificado, dosAnios };
})();
