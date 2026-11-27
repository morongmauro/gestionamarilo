/* Vista compartida de solo lectura: /ver.html?t=<enlace> */
'use strict';
(async function () {
  const box = document.getElementById('ver'), t = new URLSearchParams(location.search).get('t') || '';
  document.getElementById('verPdf').onclick = () => window.print();
  try {
    const r = await fetch('/api/ver/' + encodeURIComponent(t), { headers: { Accept: 'application/json' } });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'No se pudo abrir el enlace');
    const o = d.opciones || {};
    document.title = `${d.proyecto.nombre} · vista compartida`;
    document.getElementById('verVence').textContent = d.vence ? 'El enlace vence el ' + Estatica.fecha(d.vence) : '';
    box.innerHTML = Estatica.documento(d, { tipo: d.tipo, responsables: o.responsables !== false, cifras: o.cifras !== false, meta: `Datos al ${Estatica.fecha(d.hoy)}` });
  } catch (e) {
    document.querySelector('.ver-barra button').hidden = true;
    box.className = 'ver-error'; box.innerHTML = `<img src="/marca/amarilo-negro.svg" alt="Amarilo" width="60"><h2>No se puede mostrar</h2><p>${Estatica.esc(e.message)}</p>`;
  }
})();
