#!/usr/bin/env bash
# ============================================================
# PORTAFOLIO · pasar los datos de Supabase a Cloud SQL (Google Cloud)
# Se corre una vez, después de scripts/gcp/configurar.sh, desde Cloud Shell
# (o un computador con gcloud y Node 18+), dentro de la carpeta portafolio.
#
#   ORIGEN_URL='postgresql://postgres.xxxx:CLAVE@aws-0-sa-east-1.pooler.supabase.com:5432/postgres' \
#     bash scripts/gcp/migrar-desde-supabase.sh            # copia, verifica y confirma
#   … bash scripts/gcp/migrar-desde-supabase.sh --simular  # ensayo completo sin cambiar nada
#   … bash scripts/gcp/migrar-desde-supabase.sh --verificar # solo compara las dos bases
#
# ORIGEN_URL: en Supabase → Connect → «Session pooler» (puerto 5432). Si la clave tiene
# símbolos (@ / # ?), escríbelos codificados (%40 %2F %23 %3F).
# Qué hace: abre el Cloud SQL Auth Proxy en 127.0.0.1, toma usuario y clave de la base
# del secreto DATABASE_URL (Secret Manager) y llama a scripts/migrar-postgres.js, que
# respalda, copia en una transacción y verifica antes de confirmar. Supabase no se toca.
# ============================================================
set -euo pipefail

PROYECTO="${PROYECTO:-amarilo-portafolio}"
INSTANCIA="${INSTANCIA:-portafolio-sql}"
PUERTO="${PUERTO:-5433}"
: "${ORIGEN_URL:?Define ORIGEN_URL con la cadena de Supabase (Session pooler, puerto 5432)}"

cd "$(dirname "$0")/../.."   # carpeta portafolio
gcloud config set project "$PROYECTO" >/dev/null
CONEXION="$(gcloud sql instances describe "$INSTANCIA" --format='value(connectionName)')"
SECRETO="$(gcloud secrets versions access latest --secret=DATABASE_URL)"   # postgresql://USUARIO:CLAVE@/BASE?host=/cloudsql/…
CRED="${SECRETO#postgresql://}"; CRED="${CRED%%@*}"
BASE="${SECRETO#*@/}"; BASE="${BASE%%\?*}"
export DESTINO_URL="postgresql://${CRED}@127.0.0.1:${PUERTO}/${BASE}"

# Cloud SQL Auth Proxy (Cloud Shell ya lo trae; si no, se descarga la versión 2)
PROXY="$(command -v cloud-sql-proxy || true)"
if [ -z "$PROXY" ]; then
  PROXY="./cloud-sql-proxy"
  [ -x "$PROXY" ] || { curl -fsSL -o "$PROXY" https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.11.0/cloud-sql-proxy.linux.amd64; chmod +x "$PROXY"; }
fi
"$PROXY" --port "$PUERTO" "$CONEXION" >/tmp/cloud-sql-proxy.log 2>&1 &
PID=$!
trap 'kill $PID 2>/dev/null || true' EXIT
for _ in $(seq 1 30); do (echo >/dev/tcp/127.0.0.1/"$PUERTO") 2>/dev/null && break; sleep 1; done
if ! (echo >/dev/tcp/127.0.0.1/"$PUERTO") 2>/dev/null || ! kill -0 "$PID" 2>/dev/null; then
  echo "❌ El Cloud SQL Auth Proxy no arrancó. Esto dijo:"; cat /tmp/cloud-sql-proxy.log
  echo "   Si habla de credenciales, corre «gcloud auth application-default login» y vuelve a intentar."; exit 1
fi

[ -d node_modules/pg ] || npm install --omit=dev --no-audit --no-fund >/dev/null
# La aplicación ya arrancó una vez en Cloud Run y creó su administrador y comités iniciales:
# por eso se reemplaza (con respaldo previo del destino). En --verificar no se copia nada.
EXTRA="--reemplazar"; for a in "$@"; do [ "$a" = "--verificar" ] && EXTRA=""; done
node scripts/migrar-postgres.js $EXTRA "$@"
