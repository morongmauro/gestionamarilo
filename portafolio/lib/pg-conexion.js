// ============================================================
// CONEXIÓN A POSTGRES · la usan la aplicación y el script de migración
// Sirve igual para Supabase (Vercel) y para Cloud SQL (Google Cloud):
// - Cloud SQL desde Cloud Run: por el socket, ...?host=/cloudsql/PROYECTO:REGION:INSTANCIA (sin TLS).
// - Cloud SQL desde un computador o Cloud Shell: por el Cloud SQL Auth Proxy en 127.0.0.1 (sin TLS).
// - Supabase: cadena del pooler (puerto 6543 para la app; 5432 «Session pooler» para migrar), con TLS.
// «sslmode» dentro de la cadena manda sobre la opción ssl del paquete pg y, en sus
// versiones nuevas, exige un certificado verificado que los poolers no siempre dan.
// Por eso se lee aquí, se quita de la cadena y el TLS se decide en un solo lugar.
// ============================================================
function conexion(url) {
  let cadena = String(url || '').trim();
  const m = /[?&]sslmode=([^&#]*)/i.exec(cadena);
  const modo = m ? decodeURIComponent(m[1]).toLowerCase() : '';
  if (m) cadena = cadena.replace(/([?&])sslmode=[^&#]*&?/i, '$1').replace(/[?&]$/, '');
  const local = /@(localhost|127\.0\.0\.1|\[::1\])[:/]|\/cloudsql\//.test(cadena) || /^postgres(ql)?:\/\/(localhost|127\.0\.0\.1)/.test(cadena);
  const sinTLS = local || modo === 'disable' || process.env.PG_SSL === 'false';
  return { connectionString: cadena, ssl: sinTLS ? false : { rejectUnauthorized: false } };
}

// Para mostrar en pantalla sin la contraseña
const ocultar = url => String(url || '').replace(/(:\/\/[^:/@]+:)[^@]*@/, '$1•••@');

module.exports = { conexion, ocultar };
