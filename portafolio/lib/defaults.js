// Estructura inicial (sin datos). Todo se puede cambiar desde la app.
function projectColumns() {
  return [
    { id: 'estado', name: 'Estado', type: 'select', width: 150, options: [
      { name: 'L0 - Idea', color: 'gris' }, { name: 'L1 - Planeación', color: 'verde' },
      { name: 'L2 - Ejecución', color: 'naranja' }, { name: 'L3 - Escalamiento', color: 'azul' },
      { name: 'L4 - Cerrado', color: 'morado' }, { name: 'Pausado', color: 'rojo' }] },
    { id: 'proyecto', name: 'Proyecto', type: 'title', width: 300 },
    { id: 'trazabilidad', name: 'Trazabilidad', type: 'text', width: 380, log: true },
    { id: 'habilitadores', name: 'Habilitadores', type: 'people', width: 200, options: [] },
    { id: 'realizadores', name: 'Realizadores', type: 'people', width: 200, options: [] },
    { id: 'income', name: 'Income', type: 'number', width: 100 },
    { id: 'okrs', name: 'OKRs', type: 'text', width: 240 },
    { id: 'tipo_valor', name: 'Tipo de valor', type: 'select', width: 180, options: [
      { name: 'Ingresos', color: 'azul' }, { name: 'Eficiencia operativa', color: 'verde' },
      { name: 'Riesgo y cumplimiento', color: 'rojo' }, { name: 'Experiencia', color: 'morado' }] },
  ];
}
function committees() {
  return [
    { name: 'Comité de seguimiento', color: 'amarillo', frecuencia: 'Quincenal', descripcion: '', integrantes: '' },
    { name: 'Comité directivo', color: 'azul', frecuencia: 'Mensual', descripcion: '', integrantes: '' },
  ];
}
module.exports = { projectColumns, committees };
