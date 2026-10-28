/* ============================================================
   SISTEMA DE DISEÑO · referencia viva (sección «Sistema de diseño»)
   Muestra los tokens y componentes reales de css/marca.css: lo que se
   ve aquí es exactamente lo que usa la aplicación. Los contrastes se
   calculan en el navegador con los colores ya resueltos (claro u oscuro).
   ============================================================ */
'use strict';
(function () {
  const { esc } = App;

  // ---------- contraste WCAG con el color ya resuelto ----------
  const probe = () => { let p = document.getElementById('ds-probe'); if (!p) { p = document.createElement('i'); p.id = 'ds-probe'; p.style.display = 'none'; document.body.appendChild(p); } return p; };
  function rgb(cssVar) {
    const p = probe(); p.style.color = `var(${cssVar})`;
    const m = getComputedStyle(p).color.match(/[\d.]+/g) || [0, 0, 0, 1];
    const a = m[3] == null ? 1 : +m[3];
    if (a >= 1) return [+m[0], +m[1], +m[2]];
    // colores con transparencia: se mezclan sobre la tarjeta
    const b = rgbSolid('--card');
    return [0, 1, 2].map(i => +m[i] * a + b[i] * (1 - a));
  }
  function rgbSolid(v) { const p = probe(); p.style.color = `var(${v})`; return (getComputedStyle(p).color.match(/[\d.]+/g) || [255, 255, 255]).slice(0, 3).map(Number); }
  const lum = c => { const [r, g, b] = c.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const hex = c => '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();
  function sw(v, nombre, uso, sobre = '--card', texto = true) {
    const c = rgb(v), r = ratio(c, rgbSolid(sobre));
    const ok = texto ? (r >= 4.5 ? ['good', 'AA texto'] : r >= 3 ? ['warn', 'solo gráfico / texto grande'] : ['crit', 'no para texto']) : (r >= 3 ? ['good', 'AA gráfico'] : ['neutral', 'decorativo']);
    return `<div class="ds-sw"><div class="c" style="background:var(${v})"></div><div class="t"><b>${esc(nombre)}</b><code>${v} · ${hex(c)}</code><div style="margin:4px 0 2px">${esc(uso)}</div><span class="badge ${ok[0]}">${r.toFixed(1)}:1 · ${ok[1]}</span></div></div>`;
  }
  const sec = (t, p, html) => `<section class="ds-sec card-box"><h2>${t}</h2>${p ? `<p>${p}</p>` : ''}${html}</section>`;
  const ICONOS = ['tablero', 'proyectos', 'cronograma', 'casos', 'agenda', 'historial', 'usuarios', 'sistema', 'alerta', 'check', 'x', 'info', 'flecha', 'filtro', 'ajustes'];

  function render(main) {
    main.innerHTML = `<div class="dash-head"><button class="burger" data-act="burger" aria-label="Menú">☰</button><div><div class="eyebrow">Amarilo · Portafolio de Generación de Valor</div><h1>Sistema de diseño</h1><div class="sub">Dirección «Cimiento cálido» · referencia viva de colores, tipografía y componentes</div></div></div>

      ${sec('Marca', 'Qué está respaldado y qué es propuesta. En el repositorio no hay manual de marca, logo ni tipografías oficiales de Amarilo: todo lo de marca aquí es una interpretación para validar con Mercadeo.', `
        <div class="ds-row" style="gap:18px;align-items:flex-start">
          <div class="ds-box" style="width:120px;height:120px;border-radius:18px"><img src="/marca/marca.svg" alt="Símbolo provisional" width="64" height="64"><span>Símbolo provisional</span></div>
          <div style="flex:1;min-width:260px">
            <div class="alert info"><svg aria-hidden="true"><use href="#i-info"/></svg><div><b>Reemplazable sin tocar código</b><span>El logo oficial va en <code>public/marca/marca.svg</code> (mismo nombre) y el nombre de la organización en la variable <code>ORG_NAME</code>.</span></div></div>
            <table class="lst"><thead><tr><th>Elemento</th><th>Origen</th><th>Estado</th></tr></thead><tbody>
              <tr><td>Nombre «Amarilo»</td><td>Contexto del proyecto</td><td><span class="badge good"><svg><use href="#i-check"/></svg>Confirmado</span></td></tr>
              <tr><td>Amarillo #FFD000</td><td>Producto actual (app de gestión)</td><td><span class="badge warn"><svg><use href="#i-alerta"/></svg>Validar valor exacto</span></td></tr>
              <tr><td>Montserrat (títulos) · Inter (interfaz)</td><td>Propuesta</td><td><span class="badge info"><svg><use href="#i-info"/></svg>Propuesta</span></td></tr>
              <tr><td>Símbolo de la barra lateral</td><td>Provisional</td><td><span class="badge crit"><svg><use href="#i-x"/></svg>Cambiar por el oficial</span></td></tr>
            </tbody></table>
          </div>
        </div>
        <div class="ds-note"><b>Regla del amarillo:</b> es identidad y énfasis puntual (marca, sección activa, subrayado de la cifra principal, botón de acción estratégica). Nunca comunica un estado: «advertencia» es naranja, para que nadie confunda la marca con una alerta.</div>`)}

      ${sec('Color', 'Neutros cálidos para la calma y la lectura; tinta casi negra para la solidez. El contraste se mide aquí mismo sobre la tarjeta.', `
        <h4 class="ds-h">Marca y neutros</h4><div class="ds-grid">
          ${sw('--amarillo', 'Amarillo Amarilo', 'Identidad y énfasis', '--nav-bg', false)}
          ${sw('--amarillo-ink', 'Amarillo tinta', 'Texto sobre amarillo suave', '--amarillo-soft')}
          ${sw('--ink', 'Tinta', 'Títulos, cifras, texto principal')}
          ${sw('--muted', 'Texto secundario', 'Descripciones, etiquetas')}
          ${sw('--faint', 'Texto terciario', 'Notas y ayudas')}
          ${sw('--paper', 'Lienzo', 'Fondo de la aplicación', '--card', false)}
          ${sw('--sunk', 'Hundido', 'Campos, chips, zonas', '--card', false)}
          ${sw('--nav-bg', 'Marco', 'Barra lateral e ingreso', '--card', false)}
        </div>
        <h4 class="ds-h">Semánticos (siempre con ícono y texto)</h4><div class="ds-grid">
          ${sw('--good-ink', 'Éxito', 'En meta, completado')}
          ${sw('--warn-ink', 'Advertencia', 'Por debajo, por vencer')}
          ${sw('--crit-ink', 'Crítico', 'Rezagado, atrasado, error')}
          ${sw('--info-ink', 'Información', 'Próximo, neutral, foco')}
        </div>
        <h4 class="ds-h">Gráficas</h4>
        <p class="muted" style="font-size:12px;margin-bottom:8px">Categórica en orden fijo para el tipo de valor; secuencia de azules para etapas (orden); estados con su ícono. No se usan dos ejes ni más de 6 categorías.</p>
        <div class="ds-grid">${App.CATS.map(c => sw('--cat-' + c.id, c.label, 'Tipo de valor', '--card', false)).join('')}</div>
        <div class="ds-row" style="margin-top:10px;gap:4px">${[1, 2, 3, 4, 5].map(i => `<div style="flex:1;height:28px;border-radius:6px;background:var(--ord-${i})" title="--ord-${i}"></div>`).join('')}<div style="flex:1;height:28px;border-radius:6px;background:var(--ord-paus)" title="--ord-paus"></div></div>
        <div class="muted" style="font-size:11px;margin-top:4px">Etapas: planeación → escalamiento · gris: pausado</div>`)}

      ${sec('Tipografía', 'Montserrat da carácter a títulos y cifras; Inter da legibilidad a tablas y formularios. Cifras con ancho fijo para comparar columnas.', `<div class="ds-type">
        <div><code>Display · 48 / 800</code><span class="display" style="font-size:48px;font-weight:800;letter-spacing:-.035em;line-height:1">$664 M</span></div>
        <div><code>Título 1 · 32 / 800</code><span class="display" style="font-size:32px;font-weight:800;letter-spacing:-.03em">Tablero ejecutivo</span></div>
        <div><code>Título 2 · 24 / 800</code><span class="display" style="font-size:24px;font-weight:800;letter-spacing:-.025em">Casos de negocio</span></div>
        <div><code>Título 3 · 15 / 700</code><span class="display" style="font-size:15px;font-weight:700">Requiere atención</span></div>
        <div><code>Cuerpo grande · 16 / 400</code><span style="font-size:16px">En 2026 el portafolio ha capturado $664 M.</span></div>
        <div><code>Cuerpo · 13–14 / 400</code><span style="font-size:13.5px">Texto de interfaz, tablas y formularios.</span></div>
        <div><code>Pequeño · 12 / 500</code><span style="font-size:12px;color:var(--muted)">Descripciones y ayudas.</span></div>
        <div><code>Sobretítulo · 11 / 700</code><span class="eyebrow">Portafolio de Generación de Valor</span></div>
      </div>`)}

      ${sec('Espacio, radios y sombras', 'Base de 4 px. Radios moderados (corporativo, no juguetón). Sombras suaves con un borde nítido.', `
        <div class="ds-row" style="align-items:flex-end">${[4, 8, 12, 16, 20, 24, 32, 40, 56].map(n => `<div style="text-align:center;font-size:11px;color:var(--muted)"><div style="width:${n}px;height:${n}px;background:var(--amarillo);border-radius:3px;margin:0 auto 4px"></div>${n}</div>`).join('')}</div>
        <div class="ds-row" style="margin-top:16px">${[['xs', 6], ['sm', 8], ['md', 10], ['lg', 14], ['xl', 18], ['pill', 999]].map(([k, n]) => `<div class="ds-box" style="width:86px;height:64px;border-radius:${n}px">--r-${k}<br>${n === 999 ? 'píldora' : n + ' px'}</div>`).join('')}</div>
        <div class="ds-row" style="margin-top:16px">${[['--shadow', 'Tarjeta'], ['--shadow-lg', 'Flotante (menú, modal)']].map(([v, l]) => `<div class="ds-box" style="width:180px;height:80px;border-radius:14px;box-shadow:var(${v})">${l}<br><code>${v}</code></div>`).join('')}</div>`)}

      ${sec('Iconografía', 'Un solo estilo: línea de 1,7 px, extremos redondeados, cuadrícula de 24 px. Siempre acompañados de texto en la navegación.', `<div class="ds-icons">${ICONOS.map(i => `<span><svg><use href="#i-${i}"/></svg>${i}</span>`).join('')}</div>`)}

      ${sec('Botones', 'Una acción principal por vista (tinta). El amarillo solo para una acción estratégica. Las destructivas, separadas y con confirmación.', `<div class="ds-row">
        <button class="btn primary">Guardar cambios</button><button class="btn accent">Presentar al comité</button><button class="btn">Secundario</button><button class="btn ghost"><svg><use href="#i-filtro"/></svg>Filtros</button><button class="btn danger">Eliminar</button><button class="btn" disabled>Deshabilitado</button><button class="btn sm">Pequeño</button></div>`)}

      ${sec('Campos y formularios', 'Etiqueta siempre visible encima; ayuda debajo; el error dice qué pasó y cómo corregirlo.', `<div class="ds-grid" style="grid-template-columns:repeat(auto-fill,minmax(240px,1fr))">
        <label style="font-size:12px;font-weight:600;color:var(--muted)">Nombre de la iniciativa<input class="fld" value="Automatización de cotizaciones" style="margin-top:4px"></label>
        <label style="font-size:12px;font-weight:600;color:var(--muted)">Estado<select class="fld" style="margin-top:4px"><option>L2 - Ejecución</option></select></label>
        <label style="font-size:12px;font-weight:600;color:var(--muted)">Tasa de descuento (%)<input class="fld" value="abc" style="margin-top:4px;border-color:var(--crit)" aria-invalid="true"><span style="color:var(--crit-ink);font-weight:500;display:block;margin-top:4px">Escribe un número, por ejemplo 12</span></label>
      </div>`)}

      ${sec('Etiquetas y badges', 'Las etiquetas de estado del proyecto las define cada columna (como en Notion). Los badges semánticos siempre llevan ícono.', `<div class="ds-row">
        ${App.COLORS.map(c => `<span class="pill cl-${c}">${c}</span>`).join('')}</div>
        <div class="ds-row" style="margin-top:10px"><span class="badge good"><svg><use href="#i-check"/></svg>En meta</span><span class="badge warn"><svg><use href="#i-alerta"/></svg>Por debajo</span><span class="badge crit"><svg><use href="#i-x"/></svg>Rezagado</span><span class="badge info"><svg><use href="#i-info"/></svg>Próximo comité</span><span class="badge neutral">Borrador</span></div>`)}

      ${sec('Alertas', 'Título corto con la conclusión; detalle con la acción. Nunca solo color.', `
        <div class="alert good"><svg><use href="#i-check"/></svg><div><b>Cambios guardados</b><span>Todos ven la versión nueva al instante.</span></div></div>
        <div class="alert warning"><svg><use href="#i-alerta"/></svg><div><b>La captura va por debajo</b><span>82% de lo esperado a la fecha. Revisa el caso de negocio.</span></div></div>
        <div class="alert critical"><svg><use href="#i-x"/></svg><div><b>No se pudo guardar</b><span>Revisa tu conexión; lo que escribiste sigue en pantalla.</span></div></div>
        <div class="alert info"><svg><use href="#i-info"/></svg><div><b>Comité el 4 de noviembre</b><span>Dos iniciativas se presentan para decisión.</span></div></div>`)}

      ${sec('Tarjetas e indicadores', 'Una cifra por indicador, con su contexto (de dónde sale y contra qué se compara).', `<div class="dash-card xks" style="grid-template-columns:repeat(3,minmax(0,1fr))">
        <div class="xk"><div class="l">Proyectado 2026</div><div class="v">$755 M</div><div class="s">por captar: $91 M</div></div>
        <div class="xk"><div class="l">VPN del portafolio</div><div class="v">$4,1 mil M</div><div class="s">valor presente neto sumado</div></div>
        <div class="xk alerta"><div class="l">Iniciativas con alertas</div><div class="v">2 <span style="font-size:14px;color:var(--muted)">/ 5</span></div><div class="s">ver «Requiere atención»</div></div></div>`)}

      ${sec('Tablas', 'Encabezados en sobretítulo, cifras alineadas a la derecha con ancho fijo, fila completa como clic.', `<table class="lst"><thead><tr><th>Iniciativa</th><th>Estado</th><th style="text-align:right">Captado</th><th style="text-align:right">Cumplimiento</th></tr></thead><tbody>
        <tr class="clic"><td><b>Analítica de cobranza</b></td><td><span class="pill cl-azul">L3 - Escalamiento</span></td><td class="n" style="text-align:right">$419 M</td><td style="text-align:right"><span class="badge good"><svg><use href="#i-check"/></svg>130%</span></td></tr>
        <tr class="clic"><td><b>Automatización de cotizaciones</b></td><td><span class="pill cl-naranja">L2 - Ejecución</span></td><td class="n" style="text-align:right">$245 M</td><td style="text-align:right"><span class="badge warn"><svg><use href="#i-alerta"/></svg>82%</span></td></tr></tbody></table>`)}

      ${sec('Tooltips, paneles y estados', 'Ayuda al pasar el mouse para el detalle; panel lateral para editar sin perder el contexto; estados vacíos que dicen qué hacer; carga con esqueletos, no con pantallas en blanco.', `
        <div class="ds-row" style="align-items:flex-start;gap:16px">
          <div><div class="tt-demo">Captado: $245 M · Esperado: $297 M</div><div class="muted" style="font-size:11px;margin-top:4px">Tooltip</div></div>
          <div><button class="btn" data-ds="drawer">Abrir panel lateral</button><div class="muted" style="font-size:11px;margin-top:4px">Panel (Esc cierra)</div></div>
          <div class="card-box" style="width:260px;text-align:center;padding:22px"><div style="font-weight:700;margin-bottom:4px">Aún no hay casos de negocio</div><div class="muted" style="font-size:12px;margin-bottom:10px">Crea el primero o impórtalo desde Excel.</div><button class="btn primary sm">+ Nuevo caso</button></div>
          <div class="card-box" style="width:260px;display:flex;flex-direction:column;gap:8px"><div class="skel" style="height:14px;width:60%"></div><div class="skel" style="height:34px;width:80%"></div><div class="skel" style="height:10px;width:90%"></div><div class="skel" style="height:10px;width:70%"></div><div class="muted" style="font-size:11px">Esqueleto de carga</div></div>
        </div>`)}

      ${sec('Interacciones y transiciones', 'Rápidas y sobrias: confirman, no decoran. Se desactivan si la persona pidió menos movimiento en su sistema.', `<table class="lst"><tbody>
        <tr><td><code>--t-fast</code> 120 ms</td><td>Hover, presionar, cambios de color</td></tr>
        <tr><td><code>--t-med</code> 200 ms</td><td>Paneles, menús, aparición de tarjetas</td></tr>
        <tr><td>Gráficas</td><td>Crecen una sola vez al entrar o al cambiar el filtro; la cifra principal cuenta hasta su valor</td></tr>
        <tr><td>Foco del teclado</td><td>Anillo azul de 2 px (visible en claro y oscuro); todo se puede usar con teclado</td></tr>
        <tr><td>Guardado</td><td>Optimista: se ve al instante, «guardando…» discreto y aviso claro si falla</td></tr>
      </tbody></table>`)}`;
    main.querySelector('.burger').onclick = App.toggleSide;
    main.onclick = e => {
      if (e.target.closest('[data-ds=drawer]')) App.openDrawer(`<div class="d-top"><span class="faint" style="font-size:11.5px;font-weight:700">Ejemplo</span><button class="x" data-x title="Cerrar (Esc)">✕</button></div><h2>Panel lateral</h2><p class="muted">Se usa para ver o editar el detalle sin salir de la vista. Se cierra con Esc, con ✕ o haciendo clic afuera.</p>`);
      if (e.target.closest('[data-x]')) App.closeDrawer();
    };
  }
  App.views.sistema = { render };
})();
