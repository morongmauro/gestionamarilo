// ============================================================
// CALENDARIO LABORAL · COLOMBIA
// Festivos (Ley Emiliani) y aritmética en días hábiles. El front
// tiene el mismo cálculo en assets/plan.js para pintar al instante.
// ============================================================
function isoUTC(d) { return d.toISOString().slice(0, 10); }
function fechaUTC(y, m, d) { return new Date(Date.UTC(y, m - 1, d, 12)); }
function mas(d, n) { const x = new Date(d); x.setUTCDate(x.getUTCDate() + n); return x; }
function alLunes(d) { const dow = d.getUTCDay(); return dow === 1 ? d : mas(d, (8 - dow) % 7); }

// Domingo de Pascua (algoritmo anónimo gregoriano)
function pascua(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  return fechaUTC(y, Math.floor((h + l - 7 * m + 114) / 31), ((h + l - 7 * m + 114) % 31) + 1);
}

const cacheFestivos = {};
function festivosCO(y) {
  if (cacheFestivos[y]) return cacheFestivos[y];
  const p = pascua(y);
  const lista = [
    fechaUTC(y, 1, 1), fechaUTC(y, 5, 1), fechaUTC(y, 7, 20), fechaUTC(y, 8, 7),
    fechaUTC(y, 12, 8), fechaUTC(y, 12, 25),
    mas(p, -3), mas(p, -2),                          // Jueves y Viernes Santo
    alLunes(fechaUTC(y, 1, 6)), alLunes(fechaUTC(y, 3, 19)), alLunes(fechaUTC(y, 6, 29)),
    alLunes(fechaUTC(y, 8, 15)), alLunes(fechaUTC(y, 10, 12)), alLunes(fechaUTC(y, 11, 1)),
    alLunes(fechaUTC(y, 11, 11)),
    alLunes(mas(p, 39)), alLunes(mas(p, 60)), alLunes(mas(p, 68)), // Ascensión, Corpus, Sagrado Corazón
  ];
  cacheFestivos[y] = new Set(lista.map(isoUTC));
  return cacheFestivos[y];
}

function sumarDias(iso, n) { return isoUTC(mas(new Date(iso + 'T12:00:00Z'), n)); }
function esHabil(iso) {
  const dow = new Date(iso + 'T12:00:00Z').getUTCDay();
  return dow !== 0 && dow !== 6 && !festivosCO(Number(iso.slice(0, 4))).has(iso);
}
// Primer día hábil desde `iso` (incluido)
function habilDesde(iso) { let x = iso; while (!esHabil(x)) x = sumarDias(x, 1); return x; }
// Día hábil número `dur` contando desde `inicio` (inicio = día 1)
function finHabil(inicio, dur) {
  let x = habilDesde(inicio), n = 1;
  while (n < Math.max(1, dur)) { x = sumarDias(x, 1); if (esHabil(x)) n++; }
  return x;
}
// Días hábiles entre dos fechas, ambas incluidas (NETWORKDAYS)
function diasHabiles(ini, fin) {
  if (!ini || !fin || fin < ini) return 0;
  let n = 0;
  for (let x = ini; x <= fin; x = sumarDias(x, 1)) if (esHabil(x)) n++;
  return n;
}
// Avanza (o retrocede, si n < 0) n días hábiles
function sumarHabiles(iso, n) {
  let x = iso, paso = n < 0 ? -1 : 1, falta = Math.abs(n);
  while (falta > 0) { x = sumarDias(x, paso); if (esHabil(x)) falta--; }
  return x;
}
// Diferencia con signo en días hábiles: cuánto se movió `desde` para llegar a `hasta`
function difHabiles(desde, hasta) {
  if (!desde || !hasta || desde === hasta) return 0;
  return hasta > desde
    ? diasHabiles(sumarDias(desde, 1), hasta)
    : -diasHabiles(sumarDias(hasta, 1), desde);
}
// Corre un rango n días hábiles conservando su duración hábil
function moverRango(inicio, fin, n) {
  if (inicio && fin) {
    const dur = Math.max(1, diasHabiles(inicio, fin));
    const nuevoIni = habilDesde(sumarHabiles(habilDesde(inicio), n));
    return { inicio: nuevoIni, fin: finHabil(nuevoIni, dur) };
  }
  const uno = inicio || fin;
  const nuevo = habilDesde(sumarHabiles(habilDesde(uno), n));
  return { inicio: inicio ? nuevo : null, fin: fin ? nuevo : null };
}

module.exports = {
  festivosCO, esHabil, habilDesde, finHabil, diasHabiles, sumarHabiles, difHabiles, moverRango, sumarDias,
};
