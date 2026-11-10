#!/usr/bin/env bash
# ============================================================
# PORTAFOLIO DE GENERACIÓN DE VALOR · puesta en Google Cloud
# Lo corre TI una sola vez, con permisos de Owner o Editor en el proyecto.
# Crea: Cloud SQL (PostgreSQL), base y usuario, secretos, repositorio de
# imágenes y el primer despliegue en Cloud Run. Idempotente: se puede repetir.
# Requisitos: gcloud instalado y autenticado (gcloud auth login).
# ============================================================
set -euo pipefail

# ---------- Ajusta estos valores ----------
PROYECTO="${PROYECTO:-amarilo-portafolio}"          # ID del proyecto de Google Cloud
REGION="${REGION:-us-east1}"                         # Región (us-east1 o southamerica-east1)
INSTANCIA="${INSTANCIA:-portafolio-sql}"             # Nombre de la instancia de Cloud SQL
BASE="${BASE:-portafolio}"                           # Nombre de la base de datos
USUARIO_DB="${USUARIO_DB:-portafolio}"               # Usuario de la base
SERVICIO="${SERVICIO:-portafolio}"                   # Nombre del servicio en Cloud Run
ADMIN_EMAIL="${ADMIN_EMAIL:-mauro.moron@amarilo.com}" # Primer administrador de la aplicación
ORG_NAME="${ORG_NAME:-Amarilo}"
# ------------------------------------------

echo "▶ Proyecto $PROYECTO · región $REGION"
gcloud config set project "$PROYECTO" >/dev/null

echo "▶ Activando APIs (Cloud Run, Cloud SQL, Secret Manager, Cloud Build, Artifact Registry)"
gcloud services enable run.googleapis.com sqladmin.googleapis.com secretmanager.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com --quiet

echo "▶ Cloud SQL para PostgreSQL (instancia pequeña, respaldos diarios)"
if ! gcloud sql instances describe "$INSTANCIA" >/dev/null 2>&1; then
  gcloud sql instances create "$INSTANCIA" --database-version=POSTGRES_16 --tier=db-g1-small --region="$REGION" \
    --storage-size=10GB --storage-auto-increase --backup-start-time=03:00 --availability-type=zonal --quiet
fi
gcloud sql databases describe "$BASE" --instance="$INSTANCIA" >/dev/null 2>&1 || gcloud sql databases create "$BASE" --instance="$INSTANCIA" --quiet
CLAVE_DB="$(openssl rand -base64 24 | tr -d '/+=' | cut -c1-28)"
if gcloud sql users list --instance="$INSTANCIA" --format='value(name)' | grep -qx "$USUARIO_DB"; then
  gcloud sql users set-password "$USUARIO_DB" --instance="$INSTANCIA" --password="$CLAVE_DB" --quiet
else
  gcloud sql users create "$USUARIO_DB" --instance="$INSTANCIA" --password="$CLAVE_DB" --quiet
fi
CONEXION="$(gcloud sql instances describe "$INSTANCIA" --format='value(connectionName)')"   # PROYECTO:REGION:INSTANCIA

echo "▶ Secretos en Secret Manager (nunca en el código ni en el repositorio)"
poner_secreto() { # nombre valor
  if gcloud secrets describe "$1" >/dev/null 2>&1; then printf '%s' "$2" | gcloud secrets versions add "$1" --data-file=- --quiet >/dev/null
  else printf '%s' "$2" | gcloud secrets create "$1" --data-file=- --replication-policy=automatic --quiet >/dev/null; fi
}
poner_secreto DATABASE_URL   "postgresql://${USUARIO_DB}:${CLAVE_DB}@/${BASE}?host=/cloudsql/${CONEXION}"
poner_secreto SESSION_SECRET "$(openssl rand -hex 32)"
poner_secreto ADMIN_EMAIL    "$ADMIN_EMAIL"
ADMIN_PASSWORD_TEMP="Pf-$(openssl rand -hex 3)-$(openssl rand -hex 3)a1"
poner_secreto ADMIN_PASSWORD "$ADMIN_PASSWORD_TEMP"

echo "▶ Repositorio de imágenes"
gcloud artifacts repositories describe portafolio --location="$REGION" >/dev/null 2>&1 || \
  gcloud artifacts repositories create portafolio --repository-format=docker --location="$REGION" --quiet

echo "▶ Permisos: la cuenta de Cloud Run lee los secretos y se conecta a Cloud SQL"
NUM="$(gcloud projects describe "$PROYECTO" --format='value(projectNumber)')"
SA="${NUM}-compute@developer.gserviceaccount.com"
for S in DATABASE_URL SESSION_SECRET ADMIN_EMAIL ADMIN_PASSWORD; do
  gcloud secrets add-iam-policy-binding "$S" --member="serviceAccount:${SA}" --role=roles/secretmanager.secretAccessor --quiet >/dev/null
done
gcloud projects add-iam-policy-binding "$PROYECTO" --member="serviceAccount:${SA}" --role=roles/cloudsql.client --quiet >/dev/null

echo "▶ Primer despliegue en Cloud Run (desde la carpeta del repositorio)"
gcloud run deploy "$SERVICIO" --source . --region="$REGION" --platform=managed --allow-unauthenticated \
  --add-cloudsql-instances="$CONEXION" \
  --set-secrets=DATABASE_URL=DATABASE_URL:latest,SESSION_SECRET=SESSION_SECRET:latest,ADMIN_EMAIL=ADMIN_EMAIL:latest,ADMIN_PASSWORD=ADMIN_PASSWORD:latest \
  --set-env-vars="ORG_NAME=${ORG_NAME},NODE_ENV=production" --min-instances=0 --max-instances=3 --memory=512Mi --quiet

URL="$(gcloud run services describe "$SERVICIO" --region="$REGION" --format='value(status.url)')"
cat <<FIN

✅ Listo.
   Dirección de la aplicación: $URL
   Primer administrador: $ADMIN_EMAIL
   Contraseña temporal:  $ADMIN_PASSWORD_TEMP   (la aplicación obliga a cambiarla al entrar)
   Instancia Cloud SQL:  $CONEXION

Siguiente paso (TI): conectar Cloud Build al repositorio de GitHub (Cloud Build → Activadores → rama main →
archivo cloudbuild.yaml, sustituciones _REGION=$REGION y _CLOUDSQL=$CONEXION) para que cada cambio se publique solo.
Opcional: dominio propio (Cloud Run → Administrar dominios personalizados) e Identity-Aware Proxy.

¿Ya trabajaron con datos reales en Supabase? Pásalos aquí (respaldo + copia exacta + verificación):
   ORIGEN_URL='postgresql://…supabase… (Session pooler, puerto 5432)' bash scripts/gcp/migrar-desde-supabase.sh --simular
   ORIGEN_URL='…' bash scripts/gcp/migrar-desde-supabase.sh
Después de migrar, entran los usuarios de Supabase con sus contraseñas (el administrador temporal de arriba se reemplaza).
FIN
