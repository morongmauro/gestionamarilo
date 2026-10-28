# Iniciativas: tabla tipo Notion y el camino en Microsoft

Este módulo replica la **estructura** de la base de datos de iniciativas de Notion
(vista tabla con columnas Estado · Iniciativa · Trazabilidad · Habilitadores ·
Realizadores · Income · OKRs · Tipo de valor) en una página propia, editable
celda por celda, sin depender de Notion. No trae datos: arranca vacía.

## Qué hay en el repositorio

| Pieza | Archivo | Para qué sirve |
|---|---|---|
| Página (la «vista») | `iniciativas.html` | Tabla y tablero tipo Notion. HTML + CSS + JS, sin build. Funciona sola (guarda en el navegador) o contra una API. |
| API en Vercel | `api/iniciativas.js` + `lib/iniciativas.js` | Lee y escribe en Supabase. Mismo patrón que el resto de la app. |
| Base en Supabase | `supabase/migracion-2026-10-iniciativas.sql` | Crea las tablas `iniciativas` e `iniciativas_config`. |
| API en Azure | `azure/api/iniciativas/` | La misma API, pero como Azure Function contra Azure SQL. |
| Base en Azure SQL | `azure/schema-azure-sql.sql` | Las mismas tablas en T-SQL, más una vista `v_iniciativas` para Power BI / Copilot. |
| Seguridad en Azure | `azure/staticwebapp.config.json` | Solo usuarios de la organización (Entra ID) entran a la página y a la API. |

### Cómo funciona la página

- **Columnas con tipo**, como en Notion: título, texto, selección (pills de color),
  selección múltiple, personas (con iniciales), número, fecha, casilla y enlace.
  Se agregan, renombran, reordenan, ocultan, redimensionan y eliminan desde la
  cabecera de cada columna.
- **Edición en la celda**: un clic abre el editor de ese tipo. En las columnas
  de selección escribes y creas opciones al vuelo, con color editable.
- **Trazabilidad como bitácora**: la columna de texto marcada como «bitácora»
  tiene el botón «+ Entrada de hoy», que antepone `28 OCT: ` (día y mes).
- **Buscar, filtrar, ordenar, agrupar** (por estado, por persona, por tipo…),
  **tablero** (kanban por Estado, arrastrando tarjetas) y **ficha** de cada
  fila (abrir la iniciativa con todas sus propiedades).
- **Exportar CSV** con punto y coma, listo para abrir en Excel.
- La definición de columnas y las filas se guardan como JSON (`props`), igual
  que Notion: crear una columna nueva no exige cambiar el esquema de la base.

### Dónde se guarda (los dos modos)

Al abrir, la página prueba `GET /api/iniciativas`:

- **Responde** → modo «Base de datos» (badge verde). Todo lo que cambies queda
  en Supabase o en Azure SQL, según dónde esté publicada.
- **No responde** → modo «Solo en este navegador» (badge amarillo,
  `localStorage`). Sirve para probar y para diseñar la estructura, pero no se
  comparte con nadie.

Para apuntar la página a otra URL de API: `window.INICIATIVAS_API = 'https://…/api/iniciativas'`
antes del script, o sirve la página desde el mismo dominio que la API.

## Respuesta corta a «¿código en un lado y base de datos en otro?»

Sí. Son tres cosas separadas y así conviene tenerlas:

1. **Código** (la página y la API): vive en GitHub, en este repositorio.
2. **Publicación** (donde la gente abre la página): Vercel hoy, o Azure Static
   Web Apps si va por Microsoft.
3. **Base de datos** (donde viven las filas): Supabase hoy, o Azure SQL /
   Dataverse / una lista de SharePoint si va por Microsoft.

La página no sabe ni le importa cuál base hay detrás; solo habla con
`/api/iniciativas`. Por eso el mismo `iniciativas.html` sirve en los dos mundos.

## El camino en una compañía Microsoft con Copilot

Hay tres opciones realistas. La recomendación depende de una sola pregunta:
**¿la interfaz tiene que ser esta, hecha a la medida, o basta con una tabla
que Copilot entienda?**

### Opción A · Sin código: Microsoft Lists (SharePoint) — recomendada para empezar

Microsoft Lists es, visualmente, lo más parecido a una base de datos de Notion
que ya tienen licenciado: vista cuadrícula editable, columnas de elección con
color, personas (del directorio de la empresa), número, fecha, texto
enriquecido, vistas por tablero, filtros y agrupación.

- **Dónde vive**: en un sitio de SharePoint o Teams del equipo. Nada que
  publicar ni mantener.
- **Copilot**: Microsoft 365 Copilot lee listas de SharePoint de forma nativa
  («¿qué iniciativas están en L2?», «resume la trazabilidad de X»). Un agente
  de Copilot Studio puede usar la lista como fuente de conocimiento o como
  acción (crear o actualizar filas).
- **Cómo replicar esta estructura**: crear una lista en blanco con estas
  columnas: Estado (Elección: L0 - Idea, L1 - Planeación, L2 - Ejecución,
  L3 - Escalamiento, L4 - Cerrada, Pausada), Iniciativa (Título), Trazabilidad
  (Varias líneas de texto, con «Anexar cambios» activado para que funcione
  como bitácora con fecha y autor), Habilitadores y Realizadores (Persona,
  selección múltiple), Income (Número), OKRs (Texto), Tipo de valor (Elección).
- **Límite**: la interfaz es la de Microsoft, no esta. Si eso basta, es la
  opción más barata y la que mejor conversa con Copilot.
- **Migración desde esta página**: el botón «⇩ CSV» produce el archivo que
  Lists importa con «Crear lista → desde CSV».

### Opción B · Este código, publicado en Azure — si quieren la interfaz propia

Mantiene exactamente esta página y la hace oficial dentro de Microsoft:

| Capa | Servicio | Nota |
|---|---|---|
| Página | **Azure Static Web Apps** (plan Free) | Se conecta al repositorio de GitHub y publica solo. `app_location: /`, `api_location: azure/api`. |
| Login | **Microsoft Entra ID** (integrado en Static Web Apps) | `azure/staticwebapp.config.json` ya exige usuario autenticado para la página y la API. Hay que registrar la app en Entra y poner `AAD_CLIENT_ID` y `AAD_CLIENT_SECRET` en la configuración. |
| API | **Azure Functions** (las «managed functions» de Static Web Apps) | `azure/api/iniciativas/index.js`, mismo contrato que la de Vercel. Variable `SQL_CONNECTION_STRING`. |
| Base | **Azure SQL Database** (nivel Basic o serverless) | Correr `azure/schema-azure-sql.sql`. La vista `v_iniciativas` expone una columna por propiedad. |
| Copilot | **Copilot Studio** con el conector de Azure SQL, o **Power BI** sobre `v_iniciativas` | Copilot pregunta sobre la tabla y Power BI arma el «Dashboard» que hoy tiene la base de Notion. |
| Dentro de Teams | Pestaña «Sitio web» apuntando a la URL de Static Web Apps | Así queda al lado del chat del equipo. |

Pasos, en orden:

1. Azure → **Static Web Apps → Crear**, origen GitHub, este repositorio y rama,
   `app_location` = `/`, `api_location` = `azure/api`, `output_location` vacío.
2. Azure → **SQL Database → Crear** (servidor nuevo, autenticación SQL o Entra),
   abrir *Query editor* y correr `azure/schema-azure-sql.sql`.
3. En la Static Web App → **Configuración → Variables de entorno**:
   `SQL_CONNECTION_STRING`, `AAD_CLIENT_ID`, `AAD_CLIENT_SECRET`.
   En el servidor SQL → *Redes*: permitir servicios de Azure.
4. Entra ID → **Registros de aplicaciones → Nuevo**, URI de redirección
   `https://<tu-app>.azurestaticapps.net/.auth/login/aad/callback`; copiar id y
   secreto. Reemplazar `<TENANT_ID>` en `azure/staticwebapp.config.json`.
5. Abrir `https://<tu-app>.azurestaticapps.net/`: pide login corporativo y el
   badge debe decir «● Base de datos».

> Estas piezas de Azure están escritas siguiendo la documentación de Static
> Web Apps, Functions (modelo con `function.json`) y el paquete `mssql`, pero
> no se ejecutaron aquí: no hay suscripción de Azure en este entorno. La
> primera publicación puede pedir ajustes menores.

### Opción C · Dataverse + Power Apps — si va a crecer a muchas tablas

Dataverse es la base «de la casa» para Power Platform y Copilot. Una app
basada en modelo da la cuadrícula editable, vistas, formularios y Copilot
dentro de la app sin escribir código. Es la opción más potente y la más cara
(licencias Power Apps por usuario). Tiene sentido si la base de iniciativas va
a convivir con otras tablas (riesgos, OKRs, presupuesto) y flujos de
aprobación.

### Cómo decidir

- Quieren la tabla «ya» y que Copilot la lea → **A (Lists)**.
- Quieren esta interfaz, con tablero, bitácora y ficha, bajo login corporativo → **B (Azure)**.
- Van a construir un sistema de gestión completo sobre Microsoft → **C (Dataverse)**.

Lo razonable es arrancar por **A** para validar la estructura con el equipo (una
tarde de trabajo), y pasar a **B** si la interfaz de Lists se queda corta; el CSV
que exporta esta página pasa de un lado al otro sin perder nada.

## Vercel + Supabase (lo que ya tiene la app)

Si de momento siguen con la plataforma actual:

1. Supabase → SQL Editor → correr `supabase/migracion-2026-10-iniciativas.sql`.
2. Hacer push: Vercel publica `iniciativas.html` y `api/iniciativas.js` solos.
3. Abrir `https://<tu-app>.vercel.app/iniciativas`.

Ojo con el plan Hobby de Vercel: con `api/iniciativas.js` la app queda con
12 funciones, que es el máximo. La próxima función nueva habrá que fusionarla
con una existente, como ya se hizo con `api/sections.js`.
