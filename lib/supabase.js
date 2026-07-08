const { createClient } = require('@supabase/supabase-js');

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

const supabase = url && key
  ? createClient(url, key, { auth: { persistSession: false } })
  : null;

function getClient() {
  if (!supabase) {
    throw new Error('SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY no configurados. Crea el proyecto en supabase.com, ejecuta supabase/schema.sql y agrega las variables de entorno en Vercel.');
  }
  return supabase;
}

module.exports = { getClient };
