// ============================================================
// FASES DE LAS INICIATIVAS (se usa en el navegador y en el servidor)
// Tres fases con criterios, y tres situaciones fuera de fase:
//   Fase 1 · Planeación ............................ estructurar y validar viabilidad
//      para avanzar: caso de negocio e ICE sobre el umbral
//   Fase 2 · Ejecución, piloto y seguimiento ...... probar con aval del Comité
//      para avanzar: PMV en marcha y resultados validados
//   Fase 3 · Escalamiento y captura de valor ...... implementada y capturando valor
//      resultado esperado: valor en P&G
//   Cerrada · En pausa · Cancelada (fuera de fase)
// clasificar() traduce los estados antiguos de Notion (L0 … L4, Standby, etc.).
// ============================================================
(function (root) {
  const FASES = [
    { id: 1, nombre: 'Fase 1 · Planeación', corto: 'F1', color: 'azul', criterio: 'Para avanzar: caso de negocio e ICE sobre el umbral' },
    { id: 2, nombre: 'Fase 2 · Ejecución, piloto y seguimiento', corto: 'F2', color: 'naranja', criterio: 'Para avanzar: PMV en marcha y resultados validados' },
    { id: 3, nombre: 'Fase 3 · Escalamiento y captura de valor', corto: 'F3', color: 'verde', criterio: 'Resultado esperado: valor en P&G' },
    { id: 'cerrada', nombre: 'Cerrada', corto: 'Cerrada', color: 'morado', fuera: true },
    { id: 'pausa', nombre: 'En pausa', corto: 'En pausa', color: 'gris', fuera: true },
    { id: 'cancelada', nombre: 'Cancelada', corto: 'Cancelada', color: 'rojo', fuera: true },
  ];
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  // Estado (nuevo o antiguo) → id de fase; null si no se reconoce
  function clasificar(estado) {
    const n = norm(estado); if (!n) return null;
    if (/cancel|descart/.test(n)) return 'cancelada';
    if (/standby|stand by|paus|suspend|detenid/.test(n)) return 'pausa';
    if (/cerrad/.test(n)) return 'cerrada';
    if (/^fase\s*3|escal|realiza|captura de valor/.test(n)) return 3;
    if (/^fase\s*2|seguim|ejecuc|piloto|^l2\b/.test(n)) return 2;
    if (/^fase\s*1|planea|idea|propuest|^l[01]\b/.test(n)) return 1;
    return null;
  }
  const deId = id => FASES.find(f => f.id === id) || null;
  const de = estado => deId(clasificar(estado));
  // Nombre nuevo para un estado; si no se reconoce, queda igual
  const mapear = estado => { const f = de(estado); return f ? f.nombre : estado; };
  const opciones = () => FASES.map(f => ({ name: f.nombre, color: f.color }));

  const api = { FASES, clasificar, de, deId, mapear, opciones };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Fases = api;
})(this);
