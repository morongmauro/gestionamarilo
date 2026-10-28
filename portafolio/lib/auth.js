// ============================================================
// USUARIOS · contraseñas y sesiones
// - Contraseñas con scrypt (sal aleatoria por usuario), nunca en claro.
// - Sesión en una cookie HttpOnly firmada con HMAC (SESSION_SECRET).
//   Lleva la «versión de sesión» del usuario: al cambiar o restablecer la
//   contraseña, o al desactivarlo, todas sus sesiones abiertas se cierran.
// ============================================================
const crypto = require('crypto');

const COOKIE = 'pf_sesion';
const DURACION_MS = 12 * 60 * 60 * 1000; // 12 horas
const ROLES = ['admin', 'editor', 'lector'];

function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(pw), salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}
function verifyPassword(pw, stored) {
  if (!stored || !stored.startsWith('scrypt$')) return false;
  const [, s, h] = stored.split('$');
  const expected = Buffer.from(h, 'base64');
  const got = crypto.scryptSync(String(pw), Buffer.from(s, 'base64'), expected.length, { N: 16384, r: 8, p: 1 });
  return crypto.timingSafeEqual(expected, got);
}
function checkPasswordRules(pw) {
  if (typeof pw !== 'string' || pw.length < 8) return 'La contraseña debe tener al menos 8 caracteres';
  if (pw.length > 200) return 'La contraseña es demasiado larga';
  if (!/[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(pw) || !/\d/.test(pw)) return 'La contraseña debe tener letras y números';
  return null;
}

let SECRET = null;
function setSecret(s) { SECRET = Buffer.from(s); }
const b64u = b => Buffer.from(b).toString('base64url');
const sign = data => crypto.createHmac('sha256', SECRET).update(data).digest('base64url');

function makeToken(user) {
  const payload = b64u(JSON.stringify({ u: user.id, v: user.sv || 0, e: Date.now() + DURACION_MS }));
  return `${payload}.${sign(payload)}`;
}
function readToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [payload, mac] = token.split('.');
  const expected = sign(payload);
  if (mac.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;
  try {
    const p = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (!p.e || p.e < Date.now()) return null;
    return p;
  } catch { return null; }
}

function parseCookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach(p => {
    const i = p.indexOf('=');
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}
function isHttps(req) {
  return process.env.COOKIE_SECURE === 'true' || req.headers['x-forwarded-proto'] === 'https' || !!(req.socket && req.socket.encrypted);
}
function sessionCookie(req, token) {
  return `${COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${DURACION_MS / 1000}${isHttps(req) ? '; Secure' : ''}`;
}
function clearCookie(req) {
  return `${COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${isHttps(req) ? '; Secure' : ''}`;
}

// Freno a la fuerza bruta: 8 intentos fallidos por correo+IP cada 15 minutos
const intentos = new Map();
function loginBloqueado(key) {
  const x = intentos.get(key);
  if (!x) return false;
  if (Date.now() - x.t > 15 * 60 * 1000) { intentos.delete(key); return false; }
  return x.n >= 8;
}
function loginFallido(key) {
  if (intentos.size > 5000) for (const [k, v] of intentos) if (Date.now() - v.t > 15 * 60 * 1000) intentos.delete(k);
  const x = intentos.get(key);
  if (!x || Date.now() - x.t > 15 * 60 * 1000) intentos.set(key, { n: 1, t: Date.now() });
  else x.n++;
}
function loginOk(key) { intentos.delete(key); }

const publicUser = u => u && ({ id: u.id, name: u.name, email: u.email, role: u.role, active: u.active !== false, must_change: !!u.must_change, created_at: u.created_at, last_login: u.last_login || null });

module.exports = {
  COOKIE, ROLES, hashPassword, verifyPassword, checkPasswordRules, setSecret, makeToken, readToken,
  parseCookies, sessionCookie, clearCookie, loginBloqueado, loginFallido, loginOk, publicUser,
};
