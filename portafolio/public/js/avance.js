/* ============================================================
   AVANCE DE FASE · qué cumple cada iniciativa y qué le falta
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
        { ok: !!(f && f.totalBeneficio > 0), txt: 'Caso de negocio con beneficios', href: `#/proyectos/${id}/caso` },
        { ok: !!(f && f.totalInversion > 0), txt: 'Inversión en el caso de negocio', href: `#/proyectos/${id}/caso` },
        { ok: ice.income != null && ice.income >= App.ICE.UMBRAL_OFICINA, txt: `ICE sobre el umbral (Income 3 o más${ice.income != null ? `; hoy ${ice.income}` : ''})`, href: `#/proyectos/${id}` },
        { ok: pl.acts.length > 0, txt: 'Cronograma cargado', href: `#/proyectos/${id}/cronograma` },
      ];
    } else if (fase.id === 2) {
      sig = Fases.deId(3);
      const piloto = pl.acts.filter(a => /piloto|pmv/i.test(a.name || ''));
      crit = [
        { ok: piloto.some(a => (a.avance || 0) >= 100), txt: piloto.length ? 'PMV en marcha: hito del piloto cumplido' : 'PMV en marcha: el cronograma no tiene una actividad «piloto»', href: `#/proyectos/${id}/cronograma` },
        { ok: verificado(caso) > 0, txt: 'Resultados validados: valor capturado y verificado', href: `#/proyectos/${id}/caso` },
      ];
    } else if (fase.id === 3) {
      sig = Fases.deId('cerrada');
      const meta = dosAnios(f), ver = verificado(caso);
      crit = [{ ok: meta > 0 && ver >= meta, txt: `Valor en P&G: verificado ${App.moneyShort(ver)}${meta ? ` de ${App.moneyShort(meta)} (valor a dos años)` : ' (el caso aún no proyecta beneficios)'}`, href: `#/proyectos/${id}/caso` }];
    }
    return { fase, sig, crit, listo: crit.length > 0 && crit.every(c => c.ok), faltan: crit.filter(c => !c.ok).length };
  }

  function html(p, ro) {
    const a = de(p); if (!a) return '';
    return `<div class="card-box av-box ${a.listo ? 'listo' : ''}">
      <div class="av-h"><b>${a.listo ? `✓ Lista para pasar a ${esc(a.sig.nombre)}` : `Para pasar a ${esc(a.sig.nombre)}`}</b><span class="faint">${esc(a.fase.criterio || '')}</span>
        ${a.listo && !ro ? `<button class="btn primary sm" data-p="avanzar" data-fase="${esc(a.sig.nombre)}">Pasar a ${esc(a.sig.corto)}</button>` : `<span class="faint">${a.faltan ? `falta${a.faltan === 1 ? '' : 'n'} ${a.faltan}` : ''}</span>`}</div>
      <div class="av-l">${a.crit.map(c => `<a href="${c.href}" class="${c.ok ? 'ok' : 'no'}"><span>${c.ok ? '✓' : '✕'}</span>${esc(c.txt)}</a>`).join('')}</div></div>`;
  }

  App.Avance = { de, html, verificado, dosAnios };
})();
