# Desplegar el portafolio en Google Cloud

La aplicación no necesita cambios para correr en Google Cloud: ya habla Postgres
(`lib/store-pg.js`) y ya tiene `Dockerfile`. Lo que cambia es **dónde** corre y
**quién** configura cada pieza.

## Qué se usa de Google Cloud

| Pieza | Servicio | Para qué | Quién lo crea |
|---|---|---|---|
| Base de datos | **Cloud SQL para PostgreSQL** (instancia pequeña, `db-f1-micro` o `db-g1-small`) | Guarda todo: proyectos, cronogramas, casos, sesiones, usuarios | TI (una vez) |
| La aplicación | **Cloud Run** (contenedor desde el `Dockerfile`) | Sirve la página y la API; escala a cero cuando nadie la usa | TI la primera vez; después se publica sola desde GitHub |
| Secretos | **Secret Manager** | `DATABASE_URL`, `SESSION_SECRET`, `ADMIN_PASSWORD`, `EXPORT_TOKEN` | TI |
| Dominio | Cloud Run + dominio de la empresa | `portafolio.amarilo.com.co` o similar | TI |
| Identidad (opcional) | **Identity-Aware Proxy** | Que solo entren cuentas de la empresa antes del login de la app | TI, si lo quieren |

## Lo importante: no hay SQL que mantener

La base guarda **un documento JSON por registro** en una sola tabla (`pf_docs`), más una tabla de configuración (`pf_config`). Las dos se crean solas la primera vez que arranca la aplicación.

Cuando se agrega algo nuevo al sitio (por ejemplo la validación del captado o las decisiones del comité que se agregaron esta semana):

- **No se toca la base de datos.** Ni en Google Cloud, ni en Supabase, ni en Azure Postgres.
- Lo único que cambia es el código: `lib/validate.js` dice qué campos acepta cada colección, y la interfaz los muestra.
- TI no tiene que correr ningún script. Se publica la nueva versión y listo.

Esto vale igual para Supabase y para Google Cloud: la diferencia entre los dos no es el código, es quién administra la instancia y dónde queda la información (en Google Cloud, dentro del proyecto de la empresa).

Si algún día alguien necesita sacar la información para otro sistema, ya existen la exportación por API (`/api/export/...`) y el envío diario al data lake, sin SQL.

## Pasos (una sola vez)

1. **TI crea el proyecto** en Google Cloud (o usa uno existente) y activa Cloud SQL, Cloud Run y Secret Manager.
2. **TI crea la instancia de Cloud SQL para PostgreSQL**, una base `portafolio` y un usuario. Entrega la cadena de conexión en uno de estos formatos:
   - Por el socket de Cloud SQL (recomendado desde Cloud Run):
     `postgresql://USUARIO:CLAVE@/portafolio?host=/cloudsql/PROYECTO:REGION:INSTANCIA`
   - Por IP con TLS: `postgresql://USUARIO:CLAVE@IP:5432/portafolio`
3. **TI guarda los secretos** en Secret Manager: `DATABASE_URL` (la cadena), `SESSION_SECRET` (cadena aleatoria larga), `ADMIN_EMAIL`, `ADMIN_PASSWORD` (mínimo 8 caracteres con letras y números), `ORG_NAME=Amarilo`.
4. **Publicar en Cloud Run** desde la carpeta del repositorio (TI o quien tenga permiso):
   ```
   gcloud run deploy portafolio --source . --region us-east1 \
     --add-cloudsql-instances PROYECTO:REGION:INSTANCIA \
     --set-secrets DATABASE_URL=DATABASE_URL:latest,SESSION_SECRET=SESSION_SECRET:latest,ADMIN_EMAIL=ADMIN_EMAIL:latest,ADMIN_PASSWORD=ADMIN_PASSWORD:latest \
     --set-env-vars ORG_NAME=Amarilo,NODE_ENV=production --allow-unauthenticated
   ```
   La primera vez la aplicación crea las tablas y el administrador.
5. **Dominio y acceso**: TI apunta el dominio y, si quieren, pone Identity-Aware Proxy delante para que solo entren cuentas de Amarilo.

## Cada vez que hay una versión nueva

Dos opciones; se elige una y se deja:

- **Manual:** quien tenga permiso corre el mismo `gcloud run deploy` del paso 4.
- **Automática:** Cloud Build conectado al repositorio de GitHub (rama `main`) publica solo cada vez que hay cambios. TI lo configura una vez en Cloud Build → Activadores.

En ninguno de los dos casos hay que tocar la base de datos.

## Qué controlas tú y qué controla TI

| | Tú | TI |
|---|---|---|
| Código y versiones | Sí (GitHub) | — |
| Qué campos existen y qué se muestra | Sí | — |
| Usuarios y roles del portafolio | Sí (desde Administración) | — |
| Instancia de base de datos, respaldos, red, secretos | — | Sí |
| Publicar en Cloud Run | Tú si te dan el rol `run.developer`; si no, TI | Sí |
| Dominio, certificado, acceso corporativo | — | Sí |
| Copias de la información | Exportación por API y data lake (tú) | Respaldos automáticos de Cloud SQL (TI) |

## Costo aproximado

Para menos de 50 usuarios: Cloud SQL pequeña entre 10 y 30 USD al mes; Cloud Run casi siempre dentro de la capa gratuita; Secret Manager centavos. Es comparable con Supabase Pro y queda dentro del proyecto de la empresa.

## Probarlo antes de pedirle nada a TI

En tu computador, con cualquier Postgres (local o de prueba):
```
DATABASE_URL=postgresql://usuario:clave@localhost:5432/portafolio npm start
```
Si arranca y crea las tablas, en Google Cloud funciona igual.
