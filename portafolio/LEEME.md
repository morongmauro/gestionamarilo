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

## Dónde vive cada cosa

| Pieza | Dónde |
|---|---|
| Código | Este repositorio, carpeta `portafolio/` |
| Aplicación (el link) | Azure App Service: un servidor Node que sirve la página y la API |
| Base de datos | Azure SQL Database o la *SQL database* de Microsoft Fabric |
| Data lake | Recibe una copia de la base (ver abajo); la app no escribe directo en el lago |

## Publicarla en Microsoft (Azure)

1. **Base de datos**: en el portal de Azure, crea una *Azure SQL Database* (el
   nivel *serverless* sale barato). O, si la empresa usa Fabric, crea una
   *SQL database* dentro del espacio de trabajo de Fabric.
2. **Aplicación**: crea un *App Service* con pila *Node 20 LTS* (Linux).
   Conéctalo a este repositorio en *Centro de implementación* (GitHub). Como
   la app está en una subcarpeta, agrega la variable `PROJECT=portafolio` (o,
   si usas el flujo de GitHub Actions que genera Azure, apunta el paquete a
   `portafolio`). También puedes publicar la imagen del `Dockerfile`.
3. **Variables** (App Service → Configuración → Variables de entorno):

   | Variable | Valor |
   |---|---|
   | `DB` | `sql` |
   | `SQL_SERVER` | `tu-servidor.database.windows.net` |
   | `SQL_DATABASE` | nombre de la base |
   | `SQL_AUTH` | `managed-identity` (recomendado), `service-principal` o `sql` |
   | `SESSION_SECRET` | una cadena larga aleatoria |
   | `ADMIN_EMAIL` / `ADMIN_PASSWORD` | el primer administrador |
   | `ORG_NAME` | nombre que sale en la barra |
   | `NODE_ENV` | `production` |

   Con `managed-identity`, activa la identidad del App Service y dale acceso
   en la base: `CREATE USER [nombre-del-app-service] FROM EXTERNAL PROVIDER;`
   y `ALTER ROLE db_owner ADD MEMBER [nombre-del-app-service];` (db_owner solo
   hace falta la primera vez, para crear las tablas; luego basta
   `db_datareader` y `db_datawriter`). Así no hay contraseñas de base de datos.
4. Abre `https://<tu-app>.azurewebsites.net`. Las tablas `pf_*` se crean solas
   al primer arranque. Después corre `sql/vistas.sql` para tener las vistas
   planas de Power BI.
5. **Dentro de Teams** (opcional): agrega una pestaña *Sitio web* con el link,
   o ábrela desde el navegador.

> Lo probado en este repositorio: la app completa con el almacenamiento en
> archivo, en navegador, con dos usuarios a la vez. El conector de SQL Server
> carga y falla con un mensaje claro si no hay servidor, pero **no se probó
> contra una base Azure SQL real**: la primera conexión puede pedir algún
> ajuste de red o permisos.

## Conectar con el data lake

Un data lake está hecho para analizar grandes volúmenes, no para que una app
edite fila por fila con varias personas al tiempo. Por eso la app escribe en
una base SQL y el lago recibe una copia. Hay tres caminos, del más simple al
más general:

1. **SQL database de Fabric**: si la base se crea dentro de Fabric, Fabric la
   replica sola en OneLake casi en tiempo real. No hay que programar nada.
2. **Azure SQL + replicación de Fabric (*mirroring*) o Data Factory**: Fabric
   puede reflejar una Azure SQL en OneLake, o un *pipeline* de Data Factory la
   copia al lago (ADLS, Databricks, Synapse) cada cierto tiempo. Las vistas de
   `sql/vistas.sql` dejan los datos ya planos.
3. **API de exportación** (sirve para cualquier lago, incluso fuera de
   Microsoft): define `EXPORT_TOKEN` y el lago lee
   `GET /api/export/<tabla>?format=csv` con el encabezado
   `Authorization: Bearer <EXPORT_TOKEN>`. Tablas: `proyectos`,
   `actividades`, `casos`, `flujos`, `sesiones`, `compromisos`, `comites`.
   Los administradores también las descargan desde *Usuarios*.

Si además quieren **leer** datos del lago en la app (por ejemplo, el maestro
de proyectos o el income real), se agrega un conector de lectura a la base o
al *SQL endpoint* del lago; dime cuál usan y lo armamos.

## Agregarle funciones

Todo es HTML, CSS y JavaScript sin compilación:

| Archivo | Qué hace |
|---|---|
| `server.js` | Rutas de la API, permisos por rol e historial |
| `lib/store-file.js`, `lib/store-sql.js` | Almacenamiento (archivo o SQL); ambos con la misma interfaz |
| `lib/validate.js` | Campos permitidos de cada tabla: aquí se agrega un campo nuevo |
| `lib/auth.js` | Contraseñas y sesiones |
| `lib/export.js` | Exportación plana y archivo de Outlook |
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
