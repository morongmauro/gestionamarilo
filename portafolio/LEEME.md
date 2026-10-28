# Portafolio de proyectos

Aplicación web propia, con el mismo estilo de la app de gestión, para el
portafolio de la oficina. Se abre con un link, cada persona entra con su
correo y contraseña, y todos ven los mismos datos.

## Las cuatro secciones

| Sección | Qué tiene |
|---|---|
| **Proyectos** | Tabla tipo Notion: columnas con tipo (estado con colores, personas, número, fecha, texto, bitácora con fecha), filtros, orden, agrupación, tablero por estado y exportar a Excel. Al final, columnas calculadas con el cronograma, el avance y el caso de negocio. Cada proyecto abre su página con pestañas: Información, Cronograma, Caso de negocio y Comités. |
| **Cronograma** | Gantt de todo el portafolio o de un proyecto. Actividades e hitos; las barras se arrastran para moverlas y por los bordes para cambiar fechas. Zoom por días, semanas o meses. Marca lo atrasado y muestra las sesiones de comité en la línea de tiempo. |
| **Casos de negocio** | Uno por proyecto: problema, objetivo, alcance, beneficios, riesgos, supuestos y decisión solicitada. Flujo financiero por año (inversión, costos, beneficios) con VPN, TIR, payback y ROI calculados al instante. Estado del caso (borrador, en revisión, aprobado…). Se imprime o guarda en PDF. |
| **Agenda de comités** | Calendario mensual y lista. Cada sesión tiene comité, hora, lugar o enlace de Teams, proyectos que se presentan, temas, asistentes, decisiones y compromisos con responsable y fecha. Sesiones repetidas (semanal, quincenal, mensual) y botón «Agregar a Outlook». |

Además: **Historial** (quién cambió qué y cuándo) y **Usuarios** (solo administradores).

## Usuarios y roles

- **Administrador**: todo, incluido crear usuarios, cambiar roles, desactivar acceso y restablecer contraseñas.
- **Editor**: crea y edita proyectos, cronogramas, casos y agenda.
- **Lector**: solo consulta.

El administrador crea a cada persona con una contraseña temporal; al entrar
por primera vez la app le pide cambiarla. Las contraseñas se guardan cifradas
(scrypt), la sesión dura 12 horas y hay freno a intentos repetidos. Cada 20
segundos la app trae los cambios que hicieron los demás.

## Probarla en tu computador

Necesitas [Node.js 20](https://nodejs.org) o superior.

```bash
cd portafolio
npm install
ADMIN_EMAIL=tu@correo.com ADMIN_PASSWORD=Clave2026 npm start
```

Abre `http://localhost:8080` y entra con ese correo. Los datos quedan en
`portafolio/data/portafolio.json`. En Windows, copia `.env.example` como
`.env`, llena `ADMIN_EMAIL` y `ADMIN_PASSWORD`, y corre `npm start`.

## Dónde vive cada cosa (todo en Azure)

| Pieza | Servicio de Azure | Para qué |
|---|---|---|
| Código | GitHub (este repositorio, carpeta `portafolio/`) | Versiones y despliegue automático |
| Aplicación (el link) | Azure App Service (Linux, Node 20) | Sirve la página y la API |
| Base de datos | Azure SQL Database *serverless* | Donde viven los datos y se editan |
| Data lake | Azure Data Lake Storage Gen2 | Copia diaria para análisis y Power BI |
| Identidad | Microsoft Entra ID | La app entra a SQL y al lago sin contraseñas |

## Publicarla en Azure

Todo está descrito en `infra/main.bicep` (infraestructura como código).

1. **Pedir a TI** un grupo de recursos y un grupo de Entra ID que administre
   la base (su nombre y su *Object ID*).
2. **Crear los recursos** (Azure CLI o Cloud Shell):

   ```bash
   az deployment group create -g <grupo-de-recursos> -f portafolio/infra/main.bicep \
     -p sqlAdminLogin="<grupo-entra>" sqlAdminObjectId="<object-id>" \
        adminEmail="<tu-correo>" adminPassword="<clave-temporal>" \
        sessionSecret="$(openssl rand -base64 48)"
   ```

   Crea el App Service con identidad administrada, la Azure SQL (solo acceso
   por Entra ID, se pausa sola cuando nadie la usa) y una cuenta de Data Lake
   Gen2 con el contenedor `portafolio`. Si la empresa ya tiene un lago, agrega
   `crearLago=false lagoCuentaExistente=<cuenta>` y pide a TI el rol
   *Storage Blob Data Contributor* para la identidad de la app.
3. **Permisos en la base**: conectado como administrador de Entra, corre
   `sql/permisos-app.sql` con el nombre del App Service (sale al final del
   paso 2). Después corre `sql/vistas.sql` para las vistas de Power BI.
4. **Publicar el código**: en GitHub, *Settings → Secrets and variables →
   Actions*, crea la variable `AZURE_WEBAPP_NAME` y los secretos
   `AZURE_CLIENT_ID`, `AZURE_TENANT_ID` y `AZURE_SUBSCRIPTION_ID` (una
   identidad de Entra con credencial federada, sin contraseñas). Cada cambio
   en `portafolio/` que llegue a `main` se publica solo
   (`.github/workflows/portafolio-azure.yml`).
5. Abre la URL del paso 2 y entra con el correo del administrador.
6. **Dentro de Teams** (opcional): pestaña *Sitio web* con el link.

Variables que usa la app (el Bicep ya las pone):

| Variable | Valor |
|---|---|
| `DB` | `sql` |
| `SQL_SERVER`, `SQL_DATABASE` | servidor y base |
| `SQL_AUTH` | `managed-identity` |
| `SESSION_SECRET` | cadena larga aleatoria |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | primer administrador |
| `LAKE_ACCOUNT`, `LAKE_CONTAINER` | cuenta y contenedor del lago |
| `LAKE_HOUR` | hora del envío diario (`2` = 2 a. m.; `off` lo apaga) |
| `LAKE_FORMAT` | `csv` (por defecto) o `jsonl` |
| `EXPORT_TOKEN` | opcional, para la API de exportación |

> Qué está probado y qué no: la app completa se probó en navegador con dos
> usuarios a la vez; el envío al lago se probó contra Azurite, el emulador
> oficial de Azure Storage. **No se probó contra una suscripción de Azure
> real**: ni la plantilla Bicep (no se pudo compilar aquí) ni la conexión a
> Azure SQL. El primer despliegue puede pedir ajustes de red o permisos.

## Conexión con el data lake

Un data lake está hecho para analizar grandes volúmenes, no para que varias
personas editen fila por fila. Por eso la app trabaja sobre Azure SQL y el
lago recibe una copia:

1. **Envío directo (incluido)**: cada noche, y cuando un administrador pulsa
   *Usuarios → Enviar ahora*, la app escribe cada tabla en el lago con su
   identidad administrada:

   ```
   portafolio/<tabla>/fecha=AAAA-MM-DD/<tabla>.csv   ← histórico, una carpeta por día
   portafolio/<tabla>/actual/<tabla>.csv             ← última foto
   ```

   Tablas: `proyectos`, `actividades`, `casos`, `flujos` (caso de negocio
   por año), `sesiones`, `compromisos`, `comites`. Synapse, Databricks,
   Fabric o Power BI leen esas carpetas directamente.
2. **Data Factory o Fabric** (si TI prefiere que el lago jale los datos): un
   *pipeline* copia las vistas de `sql/vistas.sql` desde Azure SQL al lago, o
   Fabric refleja la base completa con *mirroring*.
3. **API de exportación**: `GET /api/export/<tabla>?format=csv` con el
   encabezado `Authorization: Bearer <EXPORT_TOKEN>`, para cualquier otra
   herramienta.

Si además quieren **leer** datos del lago en la app (por ejemplo, el income
real de cada proyecto), se agrega un conector de lectura al *SQL endpoint* de
Synapse o Fabric.

## Agregarle funciones

Todo es HTML, CSS y JavaScript sin compilación:

| Archivo | Qué hace |
|---|---|
| `server.js` | Rutas de la API, permisos por rol e historial |
| `lib/store-file.js`, `lib/store-sql.js` | Almacenamiento (archivo o SQL); ambos con la misma interfaz |
| `lib/validate.js` | Campos permitidos de cada tabla: aquí se agrega un campo nuevo |
| `lib/auth.js` | Contraseñas y sesiones |
| `lib/export.js` | Exportación plana y archivo de Outlook |
| `lib/lake.js` | Envío al Data Lake de Azure |
| `infra/main.bicep` | Infraestructura en Azure |
| `sql/permisos-app.sql`, `sql/vistas.sql` | Permisos de la app y vistas para Power BI |
| `public/js/core.js` | Estado compartido, API, fechas, editores |
| `public/js/tabla.js` | Sección Proyectos |
| `public/js/proyecto.js` | Página de cada proyecto |
| `public/js/cronograma.js` | Gantt |
| `public/js/caso.js` + `finanzas.js` | Caso de negocio y sus cálculos |
| `public/js/agenda.js` | Agenda de comités |
| `public/js/usuarios.js` | Usuarios e historial |
| `public/js/app.js` | Ingreso, navegación y sincronización |

Una sección nueva es un archivo `public/js/<nombre>.js` que registra
`App.views.<nombre>`, un enlace en la barra de `index.html` y, si guarda
datos, una entrada en `SCHEMAS` de `lib/validate.js`.
