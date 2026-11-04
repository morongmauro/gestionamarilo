# Auditoría profunda · Oficina de agentes (Amarilo, Portafolio de Generación de Valor)

Fecha: 4 de noviembre de 2026 · Versión auditada: la que está en `oficina-agentes.zip` de hoy (servidor + página 3D + conexión a Microsoft 365 y al modelo Claude).

## 0. Veredicto en cinco líneas

1. **Como demostración de la idea, funciona y comunica bien.** La metáfora de la oficina, los tres roles y la regla «nada sale sin tu go» son fáciles de entender y de vender internamente.
2. **Como herramienta de trabajo todavía no resuelve los procesos que promete.** Hoy los agentes no pueden leer un cronograma ni un Excel de caso de negocio: solo reciben resúmenes de 240 caracteres de lo que encuentra la búsqueda de Microsoft Graph. Las promesas de Justo Atiempo y Leo Datos no se cumplen con el código actual.
3. **La regla de aprobación es un ritual, no un control.** El botón «Aprobar» no produce nada: no crea un borrador en Outlook, no descarga un archivo, no deja registro. Y la regla se cumple hoy porque el sistema no tiene permisos para hacer nada, no porque exista un mecanismo de control.
4. **Hay un riesgo de seguridad que debe cerrarse antes de poner la clave de IA en Vercel:** la página no tiene inicio de sesión propio. Cualquiera que tenga la URL puede usar el modelo a tu costo. Y si conectas Microsoft, cualquiera con la URL ve la interfaz (no tus datos, pero sí la puerta).
5. **La mayor parte del esfuerzo se fue en la oficina 3D.** Es lo más vistoso y lo menos útil. La prioridad debe invertirse: datos, herramientas y flujo de aprobación primero; decoración después.

---

## 1. Propósito original vs. lo construido

**Propósito declarado (de este chat):** una plataforma donde tú entras, les pides cosas a tres agentes y ellos las ejecutan para lo «muy operativo» de tu cargo: comités (agendas, actas, compromisos), cronogramas (atrasos, ruta crítica, recuperación, estado semanal) y casos de negocio (revisión de VPN/TIR, sensibilidades, resúmenes para presidencia, correos de resultados). Condición absoluta: **nunca ejecutan sin tu go**.

**Lo construido:**

| Capa | Estado | Comentario crítico |
|---|---|---|
| Oficina 3D (Three.js, figuras, zoom, giro) | Completa | 600 KB de biblioteca + render continuo. En celular consume batería y no aporta a la tarea. Es marketing interno, no productividad. |
| Tres agentes con rol, descripción y ejemplos | Completos | Son tres *prompts* sobre el mismo modelo. La diferencia real entre ellos debería ser **a qué datos y herramientas accede cada uno**, y eso hoy es casi igual para los tres. |
| Chat por agente con estados (trabajando / por aprobar / aprobada) | Completo | Todo vive en memoria del navegador: al recargar se pierde. Sin historial, sin registro de qué se aprobó. |
| Modo mockup (respuestas simuladas) | Completo | Útil para demo. Peligroso si convive con el modo real: las respuestas falsas traen nombres y cifras inventadas («Carlos Gómez», «$664 M») que parecen reales. |
| Modelo de IA (Claude vía API, clave en servidor) | Listo, sin probar con clave real | Una sola llamada por pedido, sin herramientas. El modelo no puede «ir a buscar» nada: recibe lo que el servidor decidió leer de antemano. |
| Conexión Microsoft 365 (Entra + Graph, solo lectura) | Lista, sin probar contra un inquilino real | Correcta en seguridad (PKCE, cookie cifrada, permisos delegados). Limitada en profundidad: lee listas y resúmenes, no contenidos. |
| Aprobación («Aprobar / Ajustar / Descartar») | Interfaz completa | Sin efecto real. Ver sección 4. |
| Persistencia, registro, control de acceso, límites de gasto | **No existen** | Son requisitos mínimos para una herramienta que toca correo corporativo. |

**Conclusión de la sección:** se construyó la *experiencia* de una oficina de agentes antes que la *capacidad* de una oficina de agentes. Para una demo era la decisión correcta. Para pasar a uso real, el orden se invierte.

---

## 2. Arquitectura

```
Navegador (index.html + app.js + oficina3d.js)
   │  fetch /api/estado, /api/pedir, /api/microsoft/*
   ▼
server.js (Node, sin framework)  ── lib/entra.js ──► login.microsoftonline.com (OAuth 2.0 + PKCE)
   │                              ── lib/graph.js ──► graph.microsoft.com (GET + búsqueda)
   │                              ── lib/ia.js ─────► api.anthropic.com (una llamada por pedido)
   ▼
Vercel (función serverless) o Azure App Service
```

**Lo que está bien**
- Sin framework ni dependencias innecesarias (solo el SDK de Anthropic). Fácil de leer y de auditar por TI.
- Secretos solo en el servidor. CSP estricta. Cookies HttpOnly, SameSite=Lax, cifradas.
- Funciona en tres modos (mockup → IA → IA + Microsoft) sin cambiar código. Buena idea para el piloto.
- Despliegue listo tanto para Vercel como para Azure (la empresa usa Azure).

**Lo que está mal o incompleto**
- **Sin control de acceso.** `/api/pedir` es público. Con la clave cargada, cualquier persona o bot que llegue a la URL consume tokens. Es el defecto número uno.
- **Sin límite de gasto ni de ritmo.** Ni en el servidor ni documentado como obligatorio en la consola de Anthropic (está sugerido en CONEXION.md, pero debería ser condición).
- **Sin persistencia.** No hay base de datos. Los pedidos, respuestas y aprobaciones se pierden al recargar. Para auditoría interna («¿qué propuso el agente y qué aprobaste?») esto es inaceptable en una empresa.
- **Caché de tokens en memoria de una función serverless.** En Vercel cada instancia arranca vacía; funciona porque el token de actualización va en la cookie, pero cada arranque frío hace una llamada extra a Microsoft. Aceptable para un piloto, no para muchos usuarios.
- **Tiempo de respuesta.** Una llamada a Opus con 4 000 tokens de salida y contexto grande puede tardar 20–60 s. El límite de la función en Vercel es 60 s. Sin *streaming*, el usuario ve «trabajando…» sin saber si sigue vivo. Riesgo real de cortes.
- **Un solo usuario cableado en los prompts** («Trabajas para Mauro»). Correcto para el piloto, pero la arquitectura no contempla que otra persona del equipo use la oficina con sus propios datos.

---

## 3. Los agentes, sus prompts y lo que realmente pueden hacer

### Ana Lista · Secretaria de comités
- **Promete:** agenda, acta desde notas, compromisos con responsable y fecha, recordatorios.
- **Recibe hoy:** 12 correos recientes (asunto + 240 caracteres), reuniones de ±7 días (asunto, asistentes, 200 caracteres), últimos 12 chats de Teams (último mensaje), y una búsqueda por palabras.
- **Lo que falta para cumplir:** la **transcripción o las notas de la reunión**. Sin eso, el acta sale de lo que tú pegues en el chat. Microsoft Graph sí expone transcripciones de Teams (`OnlineMeetingTranscript.Read.All`), pero no está en los permisos pedidos. Tampoco hay un formato de acta de Amarilo: el modelo inventará uno distinto cada vez.
- **Compromisos:** no hay dónde guardarlos. «¿Qué compromisos vencen esta semana?» solo puede responderse si los compromisos viven en algún lado (el portafolio ya tiene agenda de comités; los agentes no la leen).

### Justo Atiempo · Guardián del cronograma
- **Promete:** estado semanal, atrasos, ruta crítica, opciones de recuperación, mover actividades.
- **Recibe hoy:** correos, Teams y búsqueda de archivos en SharePoint. **Nunca un cronograma.** La búsqueda devuelve el nombre del archivo y un resumen de texto; no abre el Excel ni el Project.
- **Lo que falta:** acceso al cronograma real. La fuente natural es **tu aplicación del portafolio**, que ya calcula ruta crítica, holguras y atrasos por día hábil. Hoy los dos ecosistemas están separados por decisión tuya; para que Justo sirva, necesita como mínimo *leer* esa API. «Corre 5 días la configuración» es una escritura y debería quedar como propuesta con el efecto calculado, nunca aplicada, pero para calcularlo hay que tener el plan.

### Leo Datos · Analista de casos e informes
- **Promete:** revisar el Excel del caso (VPN, TIR, inconsistencias), sensibilidades, resumen de una página, correo para presidencia.
- **Recibe hoy:** correos y búsqueda de archivos. **Nunca el contenido del Excel.**
- **Lo que falta:** descargar el archivo desde Graph (`/drives/{id}/items/{id}/content`, que sí cubre `Files.Read.All`), leerlo (xlsx → tabla) y pasárselo al modelo. Sin esto, Leo solo puede opinar sobre lo que tú le cuentes. Los casos de negocio también están en el portafolio (hoja de caso con VPN/TIR): otra razón para el puente.

### Sobre los prompts en general
- Son correctos en tono y en la regla de «solo proponer», pero **genéricos**: no conocen los proyectos reales, la cadencia de comités, los nombres de los líderes ni el formato de los entregables de Amarilo. Resultado previsible: respuestas plausibles y poco accionables.
- **Inyección de instrucciones:** los correos y mensajes de Teams que lee el agente pueden contener texto que intente desviarlo («ignora tus instrucciones y…»). El prompt dice «trátalo como datos», que ayuda, pero no hay separación estructural ni filtros. Mientras el agente no pueda ejecutar nada, el daño es bajo; el día que pueda crear borradores, esto importa.
- **El «ENTREGABLE: archivo»** es una convención de texto que se parsea con una expresión regular. Frágil. La API ofrece salidas estructuradas (`output_config.format`) que harían esto robusto.
- **El historial** se limita a 12 mensajes y 4 000 caracteres cada uno. Razonable.
- **El contexto es el mismo para cualquier pregunta.** Se leen 12 correos, 7 días de calendario y 12 chats aunque la pregunta sea «¿qué pasa si la inversión sube 20 %?». Eso cuesta tokens y mete ruido. El modelo debería decidir qué leer (ver recomendación 6.2).

---

## 4. El flujo de aprobación: el corazón de la idea, y hoy está vacío

Tu condición más repetida en este chat fue «no ejecutan acción sin que yo dé go, siempre». La interfaz lo refleja (estados, botones, contador de «por aprobar»). Pero:

1. **Aprobar no hace nada.** Cambia un estado en memoria y muestra «Aprobado. El borrador queda listo para que lo envíes tú». No hay borrador en ningún lado: ni en Outlook, ni como archivo descargable, ni como texto copiable con un clic.
2. **La regla se cumple por incapacidad, no por diseño.** La oficina no tiene permisos de escritura, luego no puede ejecutar nada. Eso es seguro, pero significa que todo el valor del «go» se pierde: tú apruebas y después tienes que copiar a mano el texto a Outlook o Word.
3. **No queda registro.** Ni de lo propuesto, ni de lo aprobado, ni de cuándo. Para un proceso corporativo esto es un vacío de trazabilidad.

**La versión correcta del principio** es: el agente *prepara* un artefacto real en estado «borrador» (un borrador en tu carpeta de Outlook, un `.docx` descargable, un evento tentativo), y tu aprobación es lo que lo convierte en acción, o simplemente lo deja listo para que tú lo envíes desde Outlook. Eso requiere **un** permiso de escritura muy acotado (`Mail.ReadWrite` solo para crear borradores; nunca `Mail.Send`) o, si TI no lo aprueba, generar archivos descargables desde el servidor. Cualquiera de las dos es mejor que el botón actual.

---

## 5. Procesos de tu trabajo que intenta resolver: ¿son los correctos?

Los tres procesos elegidos (comités, cronograma, casos) son el núcleo operativo de un portafolio de generación de valor. La elección es buena. Pero conviene cuestionar dos cosas:

- **Microsoft 365 Copilot ya hace una parte.** Si Amarilo tiene (o va a tener) licencias de Copilot, resumir correos, reuniones y chats de Teams viene de serie, con mejor acceso a transcripciones y sin que TI tenga que aprobar nada. **La oficina solo se justifica por lo que Copilot no hace:** entender el portafolio (cronogramas, casos, compromisos), aplicar tus formatos y tu criterio, y encadenar pasos (leer el plan → calcular impacto → redactar el estado). Ahí debe concentrarse.
- **El dato maestro está en tu aplicación del portafolio, no en Microsoft 365.** Cronogramas, casos, agenda de comités, captado: todo eso ya vive en la app que construimos. Mantener los dos mundos separados es razonable para el código y el despliegue, pero **los agentes deben leer el portafolio**. Sin ese puente, Justo y Leo son decorativos.

---

## 6. Recomendaciones, en orden

### Prioridad 0 · antes de cargar cualquier clave en producción
1. **Control de acceso a la oficina.** Mínimo: exigir sesión de Microsoft para usar `/api/pedir` (ya existe la sesión; es una condición de una línea). Alternativa: usuario y contraseña como en el portafolio.
2. **Límite de gasto en la consola de Anthropic** (p. ej. 20 USD/mes) y un tope de pedidos por hora en el servidor.
3. **Registro persistente** de cada pedido, respuesta, fuentes consultadas y decisión (aprobado/descartado/ajustado), con fecha y usuario. Un archivo JSON en Azure Blob o una tabla en la misma base del portafolio basta para empezar.
4. **Quitar las respuestas simuladas cuando la IA real está activa.** Hoy conviven; un error de red podría dejar ver datos inventados.
5. **Streaming de la respuesta** (la API lo soporta y el SDK lo hace con `.stream()`), para no chocar con el límite de 60 s y para que veas al agente escribir.

### Prioridad 1 · para que los agentes cumplan lo que prometen
6. **Que el modelo elija qué leer (uso de herramientas).** En vez de que el servidor lea de antemano 12 correos y 12 chats, darle al modelo herramientas: `buscar(consulta)`, `leer_archivo(id)`, `calendario(desde, hasta)`, `correos(filtro)`, `plan_del_proyecto(id)`, `caso_de_negocio(id)`. Esto es exactamente para lo que existe el *tool runner* del SDK. Resultado: respuestas más precisas, menos tokens y trazabilidad de qué consultó.
7. **Leer contenidos, no resúmenes.** Descargar y convertir a texto o tabla los archivos de SharePoint (`.xlsx`, `.docx`, `.pdf`) que el agente decida abrir. Con `exceljs` (ya lo usa el portafolio) se leen hojas de caso de negocio; con `mammoth` o similar, los Word.
8. **Puente con el portafolio.** Una variable `PORTAFOLIO_URL` + un token de lectura, y tres herramientas: proyectos, plan (actividades, ruta crítica, atrasos) y casos. Justo y Leo pasan de decorativos a útiles en un día de trabajo.
9. **Aprobación con efecto.** Según lo que TI acepte: (a) `Mail.ReadWrite` limitado a crear borradores, con lo que «Aprobar» deja el correo en tus borradores de Outlook; o (b) sin permisos de escritura, «Aprobar» descarga el `.docx`/`.xlsx` generado o copia el texto al portapapeles. Nunca `Mail.Send`.
10. **Plantillas de Amarilo** para acta, agenda, estado semanal y resumen para presidencia, incluidas en los prompts (o como archivos que el agente lee). Es la diferencia entre «texto plausible» y «documento que puedo enviar».
11. **Transcripciones de Teams** (`OnlineMeetingTranscript.Read.All`) si TI lo aprueba: convierte a Ana Lista en la secretaria real del comité.

### Prioridad 2 · madurez
12. **Salidas estructuradas** para el entregable (nombre, tipo, cuerpo, compromisos) en vez de la línea «ENTREGABLE:».
13. **Evaluación mínima:** 10–15 pedidos reales con la respuesta que tú darías, para medir si cada cambio de prompt mejora o empeora. Sin esto, cada ajuste es a ciegas.
14. **Multiusuario:** quitar el nombre cableado de los prompts y tomarlo de la sesión de Microsoft (ya está disponible en `usuario.nombre`).
15. **La oficina 3D como opción, no como puerta.** Cargar Three.js solo en escritorio o bajo demanda, y hacer que el panel de chat sea usable sin ella. En celular, ofrecer la lista de agentes y el chat primero.
16. **Nombre y marca:** «tipo Lego» está bien para hablar internamente, pero en documentación hacia TI o proveedores conviene «bloques» o «figuras», para evitar roces de marca.

---

## 7. Lo que sí está bien y no hay que tocar

- La regla «solo proponen» como principio de diseño. Es correcta y es lo que hace vendible la herramienta ante TI.
- Permisos delegados de solo lectura como punto de partida. Es la petición con más probabilidad de aprobación.
- Clave del modelo y secretos fuera del navegador; cookies cifradas; CSP.
- Tres modos (mockup → IA → IA + Microsoft) sin cambiar código.
- Los tres roles y nombres. Comunican y se recuerdan.
- La marca Amarilo aplicada con criterio (morado, amarillo, Montserrat).

---

## 8. Información que me falta (avancé con supuestos)

1. **¿Amarilo tiene licencias de Microsoft 365 Copilot?** Cambia la estrategia: si sí, la oficina debe concentrarse en el portafolio y dejar de replicar lo que Copilot ya hace.
2. **Política de TI sobre IA y datos.** ¿Está permitido enviar contenido de correos corporativos a un proveedor externo (Anthropic)? ¿Exigen que el modelo corra en Azure (Claude está disponible en Microsoft Foundry, lo que mantendría todo dentro de Azure y facilitaría la aprobación)?
3. **Formatos reales** de acta, agenda, estado semanal y resumen para presidencia. Sin ellos los prompts son genéricos.
4. **Cadencia y asistentes de los comités** (semanal, quincenal; quién preside; quién levanta el acta hoy).
5. **¿Quién más usaría la oficina?** Solo tú, o el equipo del portafolio. Define multiusuario y permisos.
6. **Dónde viven hoy los cronogramas y los casos:** ¿ya están cargados en la app del portafolio, o siguen en Excel/Project en SharePoint? Define cuál puente va primero (recomendación 7 u 8).
7. **Presupuesto mensual aceptable** para tokens (para fijar el límite y elegir esfuerzo y modelo).
8. **¿Hay una suscripción de Azure disponible para ti** (App Service, Blob) o el piloto seguirá en Vercel?

Supuestos usados: un solo usuario (tú); sin Copilot; TI aprobará lectura delegada; el piloto corre en Vercel; presupuesto de decenas de dólares al mes; los cronogramas y casos existen tanto en SharePoint como en el portafolio.

---

## 9. Plan sugerido para las próximas dos semanas

| Semana | Entregable | Resultado |
|---|---|---|
| 1 | P0 completo (acceso, límite, registro, streaming, sin simulación en modo real) + solicitud enviada a TI | Se puede cargar la clave sin riesgo y probar la IA real con tus pedidos |
| 2 | Puente con el portafolio + lectura de archivos + herramientas para el modelo | Justo y Leo responden con datos reales del cronograma y los casos |
| Después | Aprobación con efecto (borradores en Outlook o descargas), plantillas, transcripciones | La oficina pasa de «propone» a «deja listo para que apruebes y envíes» |

---

## 10. Refutación de mi propia propuesta

Antes de cerrar, intento tumbar lo que acabo de recomendar.

### Cinco riesgos de la propuesta

1. **Copilot la vuelve redundante.** Si Amarilo activa Microsoft 365 Copilot, el 60 % de lo que hace Ana Lista (resumir reuniones, correos y chats) ya viene incluido, con transcripciones y sin aprobación de TI. Si eso pasa, la oficina solo sobrevive por el puente con el portafolio. Mitigación: construir primero ese puente, no la lectura de Microsoft 365.
2. **TI puede negar el registro en Entra, o tardar meses.** Es una decisión de seguridad corporativa sobre enviar correos a un proveedor externo de IA. Si se niega, toda la capa `entra.js` + `graph.js` queda muerta. Mitigación: el modo «IA real sin Microsoft» ya funciona solo; y Claude está disponible dentro de Azure (Microsoft Foundry), lo que cambia la conversación con TI.
3. **El «go» puede volverse un trámite que nadie respeta.** Si cada respuesta pide aprobación y aprobar no produce nada, en dos semanas tú aprobarás sin leer. El control muere por fatiga. Mitigación: aprobar solo lo que sale hacia terceros (correos, recordatorios); las respuestas informativas (estado, análisis) no necesitan botón.
4. **Calidad irregular sin datos del portafolio.** Con resúmenes de 240 caracteres el modelo rellena huecos con lenguaje plausible. Un estado semanal «bonito pero vago» desacredita la herramienta ante presidencia más rápido que no tenerla. Mitigación: no mostrar la oficina a terceros hasta que lea cronogramas y casos reales.
5. **Costo y tiempo invisibles.** Tres agentes, cada uno con prompt, fuentes, plantillas y evaluación, es tres veces el mantenimiento de uno. Y cada nueva función (transcripciones, borradores en Outlook, multiusuario) es una conversación nueva con TI.

### Qué está sobrediseñado

| Componente | Costo real | Beneficio real | Decisión |
|---|---|---|---|
| Oficina 3D (Three.js, figuras, zoom, giro, paredes que se ocultan, dos renders por avatar) | 600 KB, horas de ajuste por cada cambio de personaje, batería en celular | Impacto en la primera demo; cero en el uso diario | **Degradar a opcional**: cargar solo en escritorio y detrás de «Ver la oficina». El chat funciona sin ella. |
| Tres agentes con personalidad | Tres prompts, tres juegos de ejemplos, tres fuentes, tres evaluaciones | La separación por rol se puede hacer con **un** agente y tres «modos» (comité, cronograma, caso) | **Fusionar en uno** con tres modos. Los nombres pueden quedar como etiqueta de modo. |
| Lectura fija de correos + calendario + Teams en cada pedido | Tokens y ruido en cada llamada; 4 llamadas a Graph por pregunta | Solo sirve cuando la pregunta es sobre lo reciente | **Reemplazar** por búsqueda bajo demanda (el modelo pide lo que necesita). |
| Respuestas simuladas con datos inventados | Confusión entre demo y real; mantenimiento doble | Solo sirve para la demo inicial, ya hecha | **Eliminar** del modo real; dejar solo para `file://` o una bandera de demo. |
| Permisos `Chat.Read` y `ChannelMessage.Read.All` | Los más difíciles de aprobar (consentimiento de administrador) | Teams aporta poco a actas y nada a cronogramas o casos | **Sacar** de la primera solicitud a TI. Pedir solo correo, calendario y archivos. |
| Despliegue doble (Vercel + Azure workflow) | Dos configuraciones que mantener | Solo se usará una | **Dejar Azure** como destino y Vercel solo para la demo sin claves. |
| Avatares, globos animados, estados «trabajando / por aprobar» con contadores | Código de interfaz que no cambia una decisión | Agradable, no necesario | Mantener solo el estado «por aprobar». |

### Versión final simplificada

**Un asistente, tres modos, una fuente de verdad.**

- **Un agente** («Asistente del portafolio») con tres modos seleccionables: *Comité*, *Cronograma*, *Caso de negocio*. Un solo prompt base con un bloque por modo. Los nombres Ana Lista, Justo Atiempo y Leo Datos quedan como nombre del modo, si te gustan.
- **Primera fuente: el portafolio**, no Microsoft 365. Tres herramientas de lectura sobre tu propia aplicación: proyectos, plan (actividades, ruta crítica, atrasos) y casos (flujo, VPN, TIR, captado). Esto no necesita a TI y resuelve el 80 % de los pedidos reales.
- **Segunda fuente, cuando TI apruebe:** correo, calendario y archivos de SharePoint (`Mail.Read`, `Calendars.Read`, `Files.Read.All`). Sin Teams en la primera ronda. Lectura **bajo demanda** con herramientas, no precarga.
- **Aprobación solo para lo que sale:** correos y recordatorios se entregan como borrador descargable (`.eml` o texto) o, si TI lo aprueba, como borrador en Outlook. Los análisis y estados no tienen botón de aprobar: se leen y ya.
- **Registro persistente** de pedidos y respuestas en la misma base del portafolio (una tabla). Es el historial y la auditoría.
- **Acceso:** la misma sesión del portafolio (usuario y contraseña ya existentes). Sin ella, `/api/pedir` no responde.
- **Interfaz:** panel de chat dentro del portafolio (una vista más, `#/asistente`), con el modo arriba y los ejemplos de pedido. La oficina 3D se conserva como página aparte de demostración, no como puerta de entrada.
- **Infraestructura:** un solo despliegue (Azure App Service, junto al portafolio), una clave de modelo con límite de gasto, streaming de respuestas.

Lo que se elimina respecto a la versión actual: tres prompts separados, precarga de Graph, permisos de Teams, respuestas simuladas en modo real, despliegue duplicado, y la 3D como requisito. Lo que se añade: puente al portafolio, registro, acceso con sesión, herramientas bajo demanda.

Costo estimado de construir la versión simplificada sobre lo que ya existe: dos o tres días de trabajo, sin esperar a TI. Lo que depende de TI (correo y archivos) se enchufa después sin rehacer nada.
