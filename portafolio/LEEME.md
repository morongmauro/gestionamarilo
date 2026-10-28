# Portafolio de proyectos

Aplicación web propia, con el mismo estilo de la app de gestión, para el
portafolio de la oficina. Se abre con un link, cada persona entra con su
correo y contraseña, y todos ven los mismos datos.

## Las cuatro secciones

| Sección | Qué tiene |
|---|---|
| **Tablero** | Lo captado en el año contra lo esperado a la fecha (los meses corridos según el caso de negocio), con anillo de cumplimiento; valor a captar por año apilado por tipo de valor (ahorro, nuevos ingresos, eficiencia, tiempo, riesgo evitado, otro) y lo captado al lado; curva de captura mes a mes; mezcla del valor; cumplimiento por proyecto; ICE contra valor; estado del portafolio; y la tabla de proyectos. Filtros por año, estado, tipo de valor y proyectos en realización. Los proyectos sin caso usan el Income como valor anual. |
| **Proyectos** | Tabla tipo Notion: columnas con tipo (estado con colores, personas, número, fecha, texto, bitácora con fecha), filtros, orden, agrupación, tablero por estado y exportar a Excel. Al final, columnas calculadas con el cronograma, el avance y el caso de negocio. Cada proyecto abre su página con pestañas: Información, Cronograma, Caso de negocio y Comités. |
| **Cronograma** | Gantt de todo el portafolio o de un proyecto. Actividades e hitos; las barras se arrastran para moverlas y por los bordes para cambiar fechas. Zoom por días, semanas o meses. Marca lo atrasado y muestra las sesiones de comité en la línea de tiempo. |
| **Casos de negocio** | Uno por proyecto: problema, objetivo, alcance, beneficios, riesgos, supuestos y decisión solicitada. Flujo financiero por año (inversión, costos, beneficios) con VPN, TIR, payback y ROI calculados al instante. Estado del caso (borrador, en revisión, aprobado…). Se imprime o guarda en PDF. |
| **Agenda de comités** | Calendario mensual y lista. Cada sesión tiene comité, hora, lugar o enlace de Teams, proyectos que se presentan, temas, asistentes, decisiones y compromisos con responsable y fecha. Sesiones repetidas (semanal, quincenal, mensual) y botón «Agregar a Outlook». |

Además: **Historial** (quién cambió qué y cuándo) y **Usuarios** (solo administradores).

## Caso de negocio: se trabaja como en Excel

El flujo año a año (hasta 15 años) es una hoja de cálculo:

| Acción | Cómo |
|---|---|
| Moverse | Flechas, Enter (Shift+Enter sube), Tab |
| Seleccionar un rango | Arrastrar con el mouse o Shift + flechas |
| Copiar y pegar con Excel | Ctrl+C / Ctrl+V; también una tabla completa con títulos |
| Llenar | Cuadrito azul en la esquina (con 2 celdas sigue la serie), Ctrl+D, Ctrl+R |
| Borrar | Supr |
| Deshacer / rehacer | Ctrl+Z / Ctrl+Y |
| Atajos al escribir | `1,2M`, `300k`, `=150*12`, `+5%` (sobre el año anterior), `(1.200)` negativo |
| Por fila (···) | Repetir el primer valor, crecer un % anual, repartir un total |

Las cifras se ven en pesos, miles o millones. Al lado, VPN, TIR, payback y ROI
se recalculan mientras se escribe, junto con un gráfico del flujo y el
acumulado, tres escenarios (pesimista, base, optimista) y el margen de
seguridad (cuánto pueden caer los beneficios antes de que el VPN sea negativo).

**Excel de ida y vuelta**: «Subir Excel» lee un .xlsx o .csv, detecta la fila
de años (Año 0… o 2026…), los conceptos, el tipo de cada fila (por la columna
«Tipo», por los títulos de sección o por las palabras) y descarta los totales;
muestra una vista previa para corregir antes de importar. «Descargar Excel»
entrega el caso con fórmulas reales (SUMA, VNA, TIR) y la narrativa; se puede
editar en Excel y volver a subir. «Plantilla vacía» trae 10 años.

## Valor captado e ICE

- **Valor captado**: en cada caso de negocio, la sección «Valor captado (real)» es una tabla de 12 meses por tipo de valor. Se registra lo que el proyecto ya generó y se compara con lo esperado a la fecha.
- **Tipo de valor**: cada beneficio del flujo lleva su tipo (se cambia con la etiqueta al lado del concepto). Al subir un Excel se deduce de las palabras del concepto.
- **ICE**: la tabla de Proyectos tiene Impacto, Confianza y Facilidad (1 a 10); ICE = Impacto × Confianza × Facilidad.
- **Lago**: la exportación incluye la tabla `captado` y el ICE de cada proyecto.

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

## Mostrarla ya: GitHub + Vercel (demostración con datos de prueba)

Mientras TI monta Azure, se puede publicar una copia de demostración. **Solo
con datos de prueba**: los datos reales van en Azure SQL.

1. **GitHub**: el código ya está en el repositorio. Une la rama de trabajo a
   `main` con un pull request (o deja que Vercel publique la rama como
   vista previa).
2. **Base de prueba**: en [supabase.com](https://supabase.com) crea un
   proyecto nuevo y gratuito, aparte del de tu app personal. En *Connect*
   copia la cadena *Transaction pooler* (puerto 6543): es `DATABASE_URL`.
3. **Vercel** → *Add New → Project* → importa este repositorio.
   *Root Directory*: `portafolio`. *Framework*: Other. Variables:

   | Variable | Valor |
   |---|---|
   | `DB` | `postgres` |
   | `DATABASE_URL` | la cadena del paso 2 |
   | `SESSION_SECRET` | una cadena larga aleatoria |
   | `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` | tu usuario administrador |
   | `ORG_NAME` | nombre de la oficina |
   | `MODO_DEMO` | `true` (muestra «solo datos de prueba») |

4. *Deploy* y abre el link. Las tablas se crean solas en el primer ingreso.

Probado: la app corre como función de Vercel (simulada localmente) sobre
PostgreSQL 16 real, con 20 ediciones simultáneas sin pérdidas. No se publicó
en una cuenta de Vercel real desde aquí.

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
| `public/js/caso.js` + `finanzas.js` | Caso de negocio, escenarios y cálculos |
| `public/js/hoja.js` | Hoja tipo Excel del flujo |
| `public/js/importar.js`, `lib/excel.js` | Subir y descargar Excel |
| `public/js/grafico.js` | Gráfico del flujo año a año |
| `lib/store-pg.js`, `api/index.js`, `vercel.json` | PostgreSQL y Vercel (demostración) |
| `public/js/agenda.js` | Agenda de comités |
| `public/js/usuarios.js` | Usuarios e historial |
| `public/js/dash.js` | Tablero del portafolio |
| `public/js/app.js` | Ingreso, navegación y sincronización |

Una sección nueva es un archivo `public/js/<nombre>.js` que registra
`App.views.<nombre>`, un enlace en la barra de `index.html` y, si guarda
datos, una entrada en `SCHEMAS` de `lib/validate.js`.

## Seguridad de las dependencias

`npm audit` reporta un aviso alto en `@azure/msal-node` (lo trae `mssql`
mediante `@azure/identity`): afecta el flujo de inicio de sesión con código de
autorización, que esta app no usa (entra a Azure con identidad administrada).
El aviso de `uuid` (lo trae `exceljs`) se corrigió forzando `uuid` 11.
