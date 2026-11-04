# Auditoría profunda, crítica y accionable · Sitio del Portafolio de Generación de Valor (Amarilo)

Fecha: 4 de noviembre de 2026. Base auditada: carpeta `portafolio/` de la rama `claude/stoic-keller-0cbvvb` (misma base que el repo `portafolio-gestion-de-valor` y la demo en Vercel), más lo discutido en este chat. Convención: **[C]** confirmado en código o contexto · **[I]** inferido · **[ND]** no definido · **[R]** recomendación.

---

## 1. Resumen ejecutivo

**La pregunta central** («¿convierte la gestión de la Dirección en una historia clara, creíble, navegable y accionable, o simplemente muestra información?») tiene hoy esta respuesta: **el sitio es una herramienta de gestión muy competente que muestra información con orden y criterio, pero no cuenta la historia de la Dirección ni demuestra sus resultados con evidencia.** Es un sistema de operación del portafolio (tablero, tabla, cronograma, caso, agenda) construido para quien lo opera, con una capa ejecutiva encima. No es, todavía, el sitio de una Dirección.

Diez hallazgos que lo sustentan:

1. **No existe una página que explique qué es la Dirección de Generación de Valor**, qué problemas resuelve, cómo trabaja ni cómo pedirle apoyo [C: ninguna ruta ni vista lo hace; el menú va de «Tablero» a «Usuarios»]. Un visitante que no conozca la estructura interna no puede responder «¿qué hacen?».
2. **La cifra principal («$664 M · 107 %») es la mejor pieza del sitio y a la vez su mayor riesgo de credibilidad**: el «captado» es un número tecleado a mano por mes [C: tabla de 12 meses en el caso, LEEME.md], sin fuente, sin quién lo validó, sin documento. Si alguien lo discute en un comité, el sitio no tiene con qué respaldarlo.
3. **El sitio mide valor financiero proyectado (VPN, TIR, ICE) con rigor, y resultados reales con ninguno.** Toda la cadena «necesidad → intervención → entregable → resultado → impacto → evidencia» se rompe en «evidencia».
4. **No hay forma de que un área proponga una necesidad ni solicite apoyo.** El estado «L0 - Idea» existe en la taxonomía [C: lib/defaults.js:12] pero no hay ningún camino para que alguien que no es editor la cree.
5. **La arquitectura de información está organizada por tipo de registro (proyectos, cronograma, casos, agenda) y no por la pregunta del visitante.** Funciona para el equipo; para presidencia la segunda pregunta («¿qué decido?») queda a medias: la matriz sugiere, pero no hay registro de decisiones [C: propuesto en DISENO.md #13, no construido].
6. **El menú principal mezcla públicos:** «Sistema de diseño» e «Historial» están al mismo nivel que «Tablero» [C: index.html, nav]. Para un presidente son ruido.
7. **Las decisiones de diseño anteriores son buenas y están documentadas** (DISENO.md: 19 problemas auditados, 12 resueltos; jerarquía de lectura; paleta validada; contraste AA en tintas). Lo construido es de calidad superior a la media de un portal interno. El problema no es la ejecución, es el alcance.
8. **Accesibilidad: se corrigió contraste y hay foco visible, pero no hay prueba de teclado ni lectores de pantalla**, y hay solo ~26 atributos ARIA en toda la interfaz, 18 de ellos en el tablero [C: grep]. Las tablas tipo Notion y la hoja de caso dependen del mouse [I].
9. **Mantenimiento: casi todo lo que importa se actualiza a mano** (captado mensual, trazabilidad como texto libre, ICE, estado). Nada caduca, nada avisa que está viejo, salvo la hora de sincronización global [C: «Sincronizado hh:mm» en la barra]. El riesgo de un sitio desactualizado en tres meses es alto.
10. **No hay analítica de uso** [C: ninguna telemetría en el código]. No sabremos si presidencia entra, qué mira ni cuánto tarda.

**Recomendación principal (Opción B, rediseño estratégico sin reemplazar la base técnica):** mantener la plataforma y el 80 % del código; añadir la capa que falta (página «Qué es la Dirección», ficha de iniciativa con evidencia, registro de decisiones, entrada de necesidades); reorganizar el menú por pregunta («Entender», «Decidir», «Operar»); y poner la evidencia detrás de cada cifra. Primero: evidencia del captado y registro de decisiones, porque son los dos puntos donde el sitio puede perder credibilidad frente al dueño.

---

## 2. Cómo funciona actualmente el sitio

### CONFIRMADO
- **Propósito:** «Aplicación web propia […] para el portafolio de la oficina. Se abre con un link, cada persona entra con su correo y contraseña, y todos ven los mismos datos» [LEEME.md]. En el chat: reemplazar Notion (pagado por el dueño a título personal) con una herramienta en el ecosistema de la empresa (Azure), con roles, y mostrar el portafolio a presidencia.
- **Públicos previstos:** admin (todo), editor (registra y actualiza), lector («consulta: Presidencia y directivos») [DISENO.md fase 1; server.js routes con niveles `publico/usuario/editor/admin/export`].
- **Arquitectura:** Node sin framework (`server.js`, 565 líneas) + SPA vanilla (`public/js/*.js`, ~4 000 líneas) + CSS (`marca.css` 408 líneas + `app.css` + `plan.css`). Almacenamiento intercambiable: archivo JSON, Azure SQL, Postgres o memoria (demo) [lib/store*.js]. Despliegue: Vercel (`vercel.json`, `api/index.js`), Azure App Service (workflow + Bicep en `infra/`), Docker.
- **Páginas (rutas hash):** `#/tablero`, `#/proyectos` (tabla y tablero por estado), `#/proyectos/:id` (ficha con pestañas Información · Cronograma · Caso de negocio · Comités), `#/cronograma/:pid|todos`, `#/casos` y `#/casos/:id`, `#/agenda`, `#/historial`, `#/usuarios`, `#/sistema` [index.html nav; app.js].
- **Navegación:** barra lateral morada con 8 entradas (Tablero, Proyectos, Cronograma, Casos de negocio, Agenda de comités, Historial, Sistema de diseño, Usuarios) + lista de proyectos con % de avance + «Sincronizado hh:mm» + etiqueta «Demostración» + usuario y rol [capturas d-01..d-09]. Vuelta: botón «← Proyectos» en la ficha. Sin migas de pan.
- **Tablero (orden de lectura):** ① Lo esencial: cifra «Valor captado en 2026» con anillo de cumplimiento y frase; «Requiere atención» (una fila por iniciativa, tres severidades); banda de indicadores (Proyectado, Inversión de los casos, VPN del portafolio, ICE promedio, Iniciativas con alertas). ② Valor a captar por año (barras apiladas por tipo + captado). ③ Matriz «¿Qué hacer con cada iniciativa?» (4 cuadrantes: Acelerar, Replantear, Revisar continuidad, Sostener) con «¿Cómo se calcula?»; Cumplimiento por proyecto; Estado del portafolio por etapa. ④ Curva de captura; Mezcla del valor (dona); Prioridad ICE vs valor (dispersión); tabla de proyectos [dash.js:424-430; captura 4-tablero-ejecutivo-completo.png].
- **Cómo se calculan las cifras clave:** esperado a la fecha = suma de lo anual de los casos «en realización» × meses corridos / 12 [dash.js:58]; «en realización» = estado contiene ejecución/escalamiento/implementación/operación/cerrado, o ya tiene captado [core.js:258-262]; alertas = captura < 90 % / atrasos en cronograma / ruta crítica en riesgo / fin después de fecha meta / VPN negativo / compromisos vencidos / comité próximo [dash.js:115-136]; VPN y TIR por bisección con aviso de TIR múltiple [finanzas.js:8-23].
- **Modelo de datos:** proyectos con columnas configurables (estado L0 Idea → L4 Cerrado + Pausado; trazabilidad con bitácora; habilitadores y realizadores; Income; Impacto/Confianza/Facilidad; OKRs; tipo de valor) [lib/defaults.js:9-26]; actividades y secciones del plan; casos (narrativa 1–8, flujo anual, tasa, horizonte, moneda, estado del caso, captado mensual por tipo); sesiones de comité con proyectos, temas, asistentes, decisiones (texto) y compromisos (texto, responsable, fecha, hecho); usuarios; historial [lib/validate.js; LEEME.md].
- **Funcionalidades:** tabla tipo Notion (filtrar, ordenar, agrupar, columnas, buscar en todas las columnas, CSV) [captura d-02]; cronograma completo (precedencias, ruta crítica, línea base, deshacer, comentarios, mesa de trabajo) [plan-host.js]; caso como hoja de cálculo con Excel de ida y vuelta, escenarios y margen de seguridad, imprimir/PDF; agenda mensual y lista con .ics; importar Excel; exportar JSON/CSV; data lake diario; historial de cambios; usuarios y roles; apariencia (tema y estilo).
- **Formularios y llamados a la acción:** «+ Nuevo proyecto», «+ Sesión», «+ Comité», «Subir Excel», «Descargar Excel», «Imprimir / PDF», «Agregar a Outlook», «Ver proyecto →», «Ver tabla», flechas «→» en alertas. **No existe** «Solicitar apoyo», «Proponer una necesidad», «Contactar al responsable» ni «Ver evidencia» [C].
- **Identidad visual:** tokens en `marca.css` (amarillo #FFC900, morado #160B29, grises, semánticos con tinta AA, paleta categórica validada con degradado), Montserrat, íconos de línea en sprite, tres estilos (claro, superior, marco) y tema claro por defecto [DISENO.md fase 6; sistema.js como referencia viva].
- **Responsive:** media queries en marca.css y app.css; menú hamburguesa en celular; tablero legible a 390 px [captura d-11]. Tablas y hoja de caso en celular: desplazamiento horizontal [I].
- **Accesibilidad:** contraste corregido a AA en tintas; anillo de foco; `prefers-reduced-motion` respetado; `aria-label` en el anillo y gráficas del tablero [dash.js:150]; `aria-hidden` en íconos. **No hay** skip link, no hay prueba con lector de pantalla, las celdas de la tabla y la hoja se editan con popovers propios [core.js:193-210] sin roles ARIA [C: grep → 0 ARIA en tabla.js, hoja.js, caso.js, agenda.js].
- **Analítica:** **NO EXISTE** [C].
- **Administración de contenido:** todo desde la interfaz (sin código): columnas configurables, importar Excel, demo cargable por admin. Historial con quién/qué/cuándo [server.js:108]. `updated_at` y `updated_by` en cada registro [server.js:342-418]. Sin aprobación, sin versiones de contenido, sin caducidad.
- **Seguridad:** scrypt + cookie HMAC HttpOnly con versión de sesión [lib/auth.js]; freno de 8 intentos cada 15 min, **solo por correo** (el comentario dice correo+IP, la clave es el correo) [auth.js:70; server.js:146]; comparación contra hash falso para no revelar correos [server.js:150]; **CSRF: las escrituras exigen el encabezado `X-Portafolio: 1`** [server.js:463]; CSP `script-src 'self'` (con shim para el cronograma), nosniff, Referrer-Policy y X-Frame-Options **solo en archivos estáticos**, no en la API [server.js:57-62,72]; sin HSTS; validación por lista blanca con límites y filtro de `__proto__` [lib/validate.js]; roles por ruta [server.js:96-103]; `SESSION_SECRET` se genera y guarda en la base si falta [server.js:505-508].
- **Dependencias:** `exceljs`, `pg`; opcionales `mssql`, `@azure/*`. Sin bundler, sin pruebas unitarias automatizadas en CI (hay scripts e2e con Playwright en el scratchpad, no en el repo) [C: package.json].

### INFERIDO
- El sitio lo mantiene una persona (tú) y lo usan pocas personas (menos de 20) [I: 5 proyectos en demo; un equipo de portafolio].
- Presidencia entrará poco y por enlace directo al tablero [I: perfil «lector» y «Las preguntas de un directivo»].
- El «valor captado» se registra con periodicidad mensual a partir de información de las áreas [I: tabla de 12 meses].

### NO DEFINIDO
- Misión, líneas estratégicas y objetivos escritos de la Dirección [ND: no aparecen en código ni en el chat; solo el nombre y los tipos de valor].
- Cuántas iniciativas reales hay y en qué estados [ND: la demo tiene 5 inventadas].
- Quién valida el captado y con qué fuente [ND].
- Si existe un comité de inversiones o un proceso formal de entrada de ideas [ND].
- Política de TI sobre publicar el sitio y quién puede ver el detalle financiero [ND].

---

## 3. Qué está funcionando bien

- **Jerarquía de lectura del tablero**: cifra → frase → atención → indicadores → detalle [dash.js:427]. Pasa el test de cinco segundos para la pregunta «¿cuánto llevamos?».
- **Alertas con regla a la vista y una fila por iniciativa** [dash.js:115-136]. Evita inflar la sensación de crisis.
- **Matriz con «¿Cómo se calcula?» y la frase «La decisión es del comité»** [dash.js:222]. Honestidad metodológica, rara en tableros.
- **Rigor financiero**: VPN, TIR (con aviso de TIR múltiple), payback, escenarios, margen de seguridad; Excel de ida y vuelta con fórmulas reales [finanzas.js; lib/excel.js].
- **Cronograma de nivel profesional** heredado de la app de gestión (ruta crítica, línea base, cascada, deshacer).
- **Sistema de diseño coherente y documentado**, con tintas semánticas AA y paleta categórica validada. Se percibe cuidado: separadores en vez de cajas, una sola familia tipográfica, un solo motivo gráfico (las escuadras).
- **Roles y auditoría mínimos** que Notion no daba: historial, `updated_by`, usuarios.
- **Arquitectura técnica proporcional**: sin framework, sin compilación, tres almacenamientos, desplegable en Azure. Fácil de auditar por TI.

---

## 4. Los problemas principales

| # | Problema | Evidencia | Consecuencia | Sev. |
|---|---|---|---|---|
| 1 | No hay explicación de la Dirección (qué es, qué resuelve, cómo trabaja, cómo pedir apoyo) | Sin ruta ni vista [app.js, index.html] | El sitio presupone conocimiento interno; no sirve para nuevos ni para otras áreas | **Crítico** para el objetivo del sitio |
| 2 | Resultados sin evidencia | Captado = número por mes sin fuente, validador ni documento [caso: tabla 12 meses] | La cifra principal es refutable en un comité | **Crítico** |
| 3 | Decisiones sin registro estructurado | «decisiones» es texto libre en la sesión [LEEME.md agenda; DISENO.md #13] | No se puede responder «¿qué decidimos y se cumplió?» | **Alto** |
| 4 | No hay entrada de necesidades | Ningún formulario; «L0 - Idea» solo lo crea un editor | El portafolio no crece desde la organización; la Dirección no muestra embudo | **Alto** |
| 5 | Ficha de iniciativa es una tabla de campos, no una historia | Captura d-03: Estado, Trazabilidad, Habilitadores, Income, ICE, OKRs | No responde «¿por qué existe, qué cambió, qué sigue?» | **Alto** |
| 6 | Menú por tipo de registro y con elementos de desarrollo | Nav: Historial y Sistema de diseño al mismo nivel que Tablero | Ruido para presidencia; sin ruta «entender» | **Medio** |
| 7 | Sin próximos hitos ni «qué viene» | Solo % de avance y próximo comité | No se ve el futuro cercano de cada iniciativa | **Medio** |
| 8 | Lenguaje interno sin explicar | «ICE», «VPN», «TIR», «L1–L3», «Income», «Habilitadores/Realizadores», «OKRs» [defaults.js; dash.js] | Dependencia de conocimiento previo | **Medio** |
| 9 | Sin analítica ni medición de uso | Ningún evento | No se puede saber si el sitio cumple | **Medio** |
| 10 | Accesibilidad no probada en teclado/lector; tabla y hoja dependen del mouse | 0 ARIA en tabla.js/hoja.js; popovers propios | Incumplimiento probable de WCAG 2.2 AA en operación | **Medio** |
| 11 | Mantenimiento manual sin caducidad | Sin fecha de vigencia por dato; sin recordatorios | Desactualización silenciosa | **Medio** |
| 12 | «Demostración» con datos inventados que parecen reales | lib/demo.js: nombres y cifras verosímiles | Riesgo de que una captura circule como real | **Bajo**, pero fácil de evitar con marca de agua |

---

## 5a. Trabajos que debe cumplir el sitio

| Trabajo | Problema del usuario → Información necesaria → Experiencia → Acción esperada → Valor para la Dirección | Clasificación | Hoy |
|---|---|---|---|
| Mostrar cuánto valor genera el portafolio y si va en meta | Presidencia no sabe si la inversión rinde → captado vs esperado por año, por tipo, fuente y fecha → una cifra con frase y anillo → abrir lo que está en riesgo → legitimidad de la Dirección | **ESENCIAL** | Resuelto (tablero), pero la credibilidad depende de la calidad del «captado» registrado a mano |
| Hacer visible qué requiere decisión y registrar la decisión | Las decisiones viven en texto libre de sesiones → alertas + regla + registro de decisiones con fecha y responsable → lista «Requiere atención» + matriz + decisión registrada → decidir y dejar rastro → trazabilidad | **ESENCIAL** | Mitad: alertas y matriz existen; el registro de decisiones está propuesto (DISENO.md #13), no construido |
| Organizar el portafolio (una ficha por iniciativa, comparable) | Información dispersa en Excel, Notion y correos → ficha con estado, valor, plan, caso, comités → tabla + ficha con pestañas → abrir, comparar, actualizar → una sola fuente de verdad | **ESENCIAL** | Resuelto en estructura; las fichas de la demo están vacías en alcance, riesgos, beneficios |
| Operar cronogramas, casos y comités | Hojas sueltas y reuniones sin seguimiento → plan con ruta crítica, caso con VPN/TIR, agenda con compromisos → herramientas de edición → actualizar → el portafolio se mantiene solo si se usa a diario | **ESENCIAL** | Resuelto y es lo más maduro del sitio |
| Explicar qué es la Dirección, qué resuelve y cómo trabaja | Nadie fuera del equipo sabe qué hace la Dirección → propósito, líneas de trabajo, método (fases L1–L3, comités, caso de negocio), equipo → una página «Qué es» corta → saber a quién pedir apoyo → reconocimiento | **IMPORTANTE** | **No existe** |
| Recibir necesidades o solicitudes de apoyo | Las ideas llegan por pasillo o correo → formulario mínimo (necesidad, área, quién, urgencia) → entra como «idea» al portafolio → la Dirección la evalúa → embudo visible | **IMPORTANTE** | **No existe** (no hay estado «idea/propuesta» ni formulario) |
| Demostrar resultados con evidencia (no solo cifras) | Las cifras sin respaldo se discuten → por cada captado: fuente, periodo, quién lo validó, documento → ver la evidencia desde la cifra → confiar → credibilidad | **IMPORTANTE** | **No existe** campo de evidencia; el captado es un número por mes sin fuente |
| Comunicar avances y próximos hitos | «¿En qué va?» se responde en reuniones → hitos próximos, último avance, siguiente comité → en la ficha y el tablero → no convocar reuniones de estado → tiempo | **IMPORTANTE** | Parcial: próximo comité y % de avance existen; «próximos hitos» no |
| Ver la evolución en el tiempo | Solo se ve el año en curso → fotos mensuales → gráfica de tendencia → detectar deterioro → anticipación | **COMPLEMENTARIO** | Propuesto (DISENO.md #15), no construido; el envío diario al data lake ya existe |
| Comparar iniciativas lado a lado | Hay que abrir cada caso → VPN, TIR, ICE, avance, captado de 2–4 iniciativas → tabla comparativa → priorizar → mejores decisiones de cartera | **COMPLEMENTARIO** | Propuesto (#14), no construido; la tabla de Proyectos ya compara en filas |
| Reconocer equipos y aliados | Nadie ve quién hace el trabajo → habilitadores y realizadores por iniciativa → en la ficha → — → cultura | **COMPLEMENTARIO** | Existe (columnas de personas); sin página de equipo |
| Evitar presentaciones repetitivas | Cada comité arma su PowerPoint → vista imprimible del tablero y de la ficha → «Imprimir / PDF» → llevar el sitio al comité → tiempo | **IMPORTANTE** | El caso se imprime; el tablero y la ficha no tienen vista de impresión |
| Sistema de diseño dentro del sitio | — | **INNECESARIO PARA ESTA VERSIÓN** (es útil para desarrollo, no para los públicos; debería salir del menú) | Existe en el menú principal |
| Historial de cambios | Saber quién cambió qué → auditoría → lista → — → control | **COMPLEMENTARIO** | Existe; debería vivir dentro de cada ficha, no como sección principal |
| Multi-moneda, 15 años de horizonte, escenarios | — | **COMPLEMENTARIO** | Existe; no quitar, pero no destacar |

## 5. Públicos y necesidades

Los públicos no están escritos en ningún archivo como tales; se reconstruyen de LEEME.md («cada persona entra con su correo», roles admin/editor/lector, «lector: Presidencia y directivos»), de DISENO.md («Las preguntas de un directivo») y de lo discutido en el chat (el sitio existe para que el dueño de la compañía y los directivos vean el portafolio sin depender de Notion).

| Público | Qué necesita entender | Preguntas con las que llega | Detalle | Evidencia que le resulta creíble | Acción que debería poder hacer | Qué no necesita ver | Estado hoy |
|---|---|---|---|---|---|---|---|
| **Presidente / dueño** (rol lector) | Cuánto valor genera el portafolio, si va en meta, qué requiere su decisión | ¿Cuánto llevamos? ¿Qué está en riesgo? ¿Qué decido? | Una pantalla, cifras con contexto | Captado vs esperado con fuente y fecha; decisiones registradas y cumplidas | Ver el detalle de una alerta; registrar o confirmar una decisión | Tablas de trazabilidad, configuración de columnas, sistema de diseño | Tablero resuelve «cuánto» y «qué está en riesgo»; «qué decido» solo como sugerencia (matriz) |
| **Directivos / vicepresidentes** (lector) | Qué iniciativas tocan su área, su estado y su valor | ¿Qué hay en mi área? ¿Cuándo pasa por comité? | Lista filtrable y ficha | Estado, responsable, próximo comité, cronograma | Abrir la ficha; pedir que una necesidad entre al portafolio | Hojas de cálculo del caso | Hay tabla y ficha; **no existe** filtro por área ni «proponer una necesidad» |
| **Líder del portafolio (tú) y equipo** (admin/editor) | Operar: cronogramas, casos, comités, compromisos | ¿Qué actualizo hoy? ¿Qué vence? | Todo el detalle | Historial, sincronizado, captado mensual | Editar, importar, exportar, preparar el comité | Nada: es su herramienta | Es el público mejor servido; el sitio está diseñado para él |
| **Responsables de iniciativa** (editor) | Su proyecto: plan, caso, compromisos, lo que el comité le pidió | ¿Qué me toca entregar y cuándo? | Su ficha y su cronograma | Compromisos con fecha; actividades atrasadas | Actualizar avance y captado de su iniciativa | Las demás iniciativas y el tablero global (puede verlas, no le estorban) | Puede editar todo de todos (no hay propiedad por iniciativa) |
| **Nuevo integrante o área que no conoce la Dirección** | Qué es la Dirección y cómo trabaja | ¿Qué hacen? ¿Cómo entro? | Explicación breve | Lenguaje claro, ejemplos | Saber a quién escribir | Métricas financieras finas | **No existe** ninguna página que explique la Dirección |
| **Audiencias externas** | — | — | — | — | — | — | No previstas: el sitio es privado con login; correcto |

**Riesgo de dar a todos la misma experiencia:** hoy el tablero es el mismo para presidencia y para el editor; la diferencia es solo que el lector no puede editar. Para presidencia sobran controles (filtros, columnas, apariencia) y falta la explicación de qué es cada cosa; para el editor falta la vista «mi trabajo de hoy».

**Recomendación: una experiencia común con dos rutas por necesidad**, no por audiencia ni por capacidad. (1) «Entender y decidir» (tablero + ficha + evidencia) y (2) «Operar» (proyectos, cronograma, casos, agenda). Justificación: hay un solo portafolio y cinco a veinte iniciativas; crear rutas por audiencia multiplica mantenimiento sin cambiar los datos. La diferencia real entre públicos es el nivel de detalle y la acción, y eso se resuelve con la jerarquía dentro de cada página y con los roles que ya existen, no con sitios paralelos.

---

## 6. Propuesta de valor

**Test de cinco segundos sobre la home actual (tablero):** una persona ve «PORTAFOLIO DE GENERACIÓN DE VALOR · Tablero ejecutivo · $664 M · 107 % · En meta». Puede decir: «hay un portafolio que ha capturado $664 M y va bien». **No puede decir** qué es la Dirección, qué hace, para quién, ni qué debería hacer después. El tablero responde «cuánto», no «qué» ni «por qué importa».

| Elemento | ¿Se comunica? | Evidencia |
|---|---|---|
| Quiénes somos | No | Solo el nombre en el sobretítulo; la única frase de propósito está en la pantalla de ingreso: «Las iniciativas, su avance y el valor que capturan, en un solo lugar» [index.html:46], y desaparece al entrar |
| Qué hacemos | Parcial | Se infiere de las secciones: proyectos con caso de negocio, cronograma y comité |
| Para quién | No | — |
| Qué problemas resolvemos | No | — |
| Cómo trabajamos | Parcial e implícito | Etapas L0–L4, comités, caso de negocio, ICE [defaults.js] |
| Qué resultados generamos | Sí (cifra) | Hero del tablero |
| Qué nos diferencia | No | — |
| Qué debería hacer el visitante después | Débil | Flechas «→» en alertas; «Ver tabla» |

**Mensajes claros:** la frase bajo la cifra [dash.js:146], «Requiere atención», «La decisión es del comité».
**Mensajes genéricos o vacíos:** «Tablero ejecutivo» (no dice de qué), «Lo esencial».
**Promesas sin evidencia:** «$664 M capturados» sin fuente; «En meta» sin definir meta (es «esperado a la fecha», que cambia con el calendario).
**Siglas sin explicar:** ICE, VPN, TIR, ROI, OKRs, L0–L4, FC/CC/FF/CF (cronograma).
**Información importante demasiado tarde:** qué tipo de valor es «captado» (ahorro vs ingreso) aparece en la dona, al final del bloque ④.
**Llamados a la acción:** no hay uno primario en la home.

**Jerarquía de mensajes propuesta para la página de inicio** (sin cifras inventadas; las cifras salen de los datos reales cuando existan):

1. **Mensaje principal:** «Generación de Valor convierte ideas de las áreas en iniciativas con caso de negocio, las ejecuta con cronograma y las lleva a comité hasta que el valor se captura y se comprueba.» *(describe lo que el sistema ya hace; validar redacción con la Dirección)*
2. **Explicación breve:** tres líneas: qué entra (necesidades de las áreas), cómo se trabaja (caso → plan → comité → captura), qué sale (ahorros, ingresos, eficiencia, tiempo, riesgo evitado: los seis tipos del sistema).
3. **Evidencia:** la cifra captada del año con su anillo, **y debajo, el enlace «¿De dónde sale esta cifra?»** que lleva a la lista de capturas con fuente y validador. Sin ese enlace, la cifra es afirmación.
4. **Capacidades o líneas de trabajo:** los cuatro tipos de valor que ya existen como «Tipo de valor» [defaults.js:21-24] como líneas, con el conteo de iniciativas en cada una.
5. **Portafolio destacado:** las iniciativas en realización con su estado y próximo hito (no las cinco; las que importan ahora).
6. **Resultados:** cumplimiento por iniciativa (ya existe) + decisiones del último comité (nuevo).
7. **Acción siguiente:** «Proponer una necesidad» (áreas) · «Ver qué requiere decisión» (presidencia) · «Actualizar mi iniciativa» (responsables).

---

## 7. Arquitectura de información

**Diagnóstico:** el menú está organizado conforme a la estructura interna de los datos (un ítem por colección), no a la lógica del visitante. Es la arquitectura natural de una herramienta de operación. Nivel único, orden razonable, sin duplicados. Problemas concretos:

- «Historial» y «Sistema de diseño» son herramientas de administración y de desarrollo en el menú principal [index.html].
- «Cronograma» y «Casos de negocio» como secciones globales duplican lo que ya vive en las pestañas de la ficha de proyecto [captura d-03]. Dos caminos al mismo contenido, sin una regla de cuál usar.
- No hay sección «Qué es la Dirección» ni «Decisiones».
- Sin migas de pan; desde el caso se vuelve a «Casos de negocio» aunque se haya entrado desde la ficha del proyecto [captura d-06: «← Casos de negocio»].
- Páginas sin acción posterior: Historial, Sistema de diseño, Usuarios (correcto en estas), **pero también la ficha** (no propone «preparar comité», «registrar avance», «ver evidencia»).

**Qué debería estar en el menú principal:** Inicio (qué es + cifra + atención), Portafolio (tabla/tablero), Decisiones y comités (agenda + registro de decisiones + compromisos), Resultados (capturas con evidencia, por año y por iniciativa).
**Qué debería salir:** Sistema de diseño (a una URL sin menú, solo para desarrollo), Historial (a «Opciones» de cada ficha y a Administración), Usuarios (a «Administración», visible solo para admin, al pie).
**Qué debería fusionarse:** Cronograma y Casos de negocio como secciones globales → dentro de la ficha (ya están); la vista «todos los cronogramas» se conserva como filtro dentro de Portafolio.
**Qué debería dividirse:** la ficha de proyecto en «historia» (por qué existe, qué cambió, qué sigue) y «operación» (campos, plan, caso).
**En la página inicial:** la jerarquía de la sección 6.
**Página propia:** cada iniciativa; Resultados; Decisiones; Qué es la Dirección.
**Solo en el detalle de una iniciativa:** cronograma, hoja del caso, comentarios, trazabilidad, historial.
**Eliminable:** nada del contenido; sí dos entradas de menú.

**Mapa recomendado (un nivel, cinco entradas):**

```
Inicio            qué es la Dirección · cifra del año con evidencia · requiere atención · próximos comités
Portafolio        tabla / tablero por etapa · ficha de iniciativa (Historia · Plan · Caso · Comités · Evidencia)
Decisiones        agenda de comités · registro de decisiones · compromisos abiertos
Resultados        capturas por año e iniciativa, cada una con fuente y validador · tendencia
Proponer          formulario de necesidad (entra como L0 - Idea)
─────
Administración    usuarios · historial · importar/exportar · data lake · apariencia · sistema de diseño (solo admin, al pie)
```

---

## 8. Auditoría del portafolio

**Taxonomía actual [C]:** una sola entidad, «proyecto», con estado por etapa (L0 Idea, L1 Planeación, L2 Ejecución, L3 Escalamiento, L4 Cerrado, Pausado) y «tipo de valor» (Ingresos, Eficiencia operativa, Riesgo y cumplimiento, Experiencia) [defaults.js]. Aparte, en el caso de negocio los beneficios llevan otro «tipo de valor» de seis opciones (ahorro, nuevos ingresos, eficiencia, tiempo, riesgo evitado, otro) [LEEME.md; dash.js paleta]. **Dos clasificaciones con el mismo nombre y listas distintas**: inconsistencia que confunde al lector del tablero («Tipo de valor: Eficiencia» en la tabla vs «Eficiencia» de la dona no son lo mismo).

**Definiciones que el sitio debería fijar (propuesta):**
- *Iniciativa*: todo lo que está en el portafolio, en cualquier etapa (hoy «proyecto»). Renombrar la entidad a «iniciativa» en la interfaz evita el choque con «proyecto inmobiliario», que en Amarilo significa otra cosa [I].
- *Proyecto*: una iniciativa en L1–L3 con cronograma y caso aprobado.
- *Idea / necesidad*: L0, sin caso.
- *Resultado*: valor captado con evidencia en un periodo.
- *Caso de éxito*: iniciativa L3/L4 con captado ≥ esperado y evidencia validada; se marca, no se inventa.
- *Línea estratégica*: el tipo de valor de la tabla de proyectos, unificado con el de los beneficios del caso (una sola lista de seis).
- *Capacidad*: no existe como entidad y no hace falta crearla; las «capacidades» de la Dirección se explican en la página «Qué es» como método (caso de negocio, cronograma, comité, medición), no como registros.

**Campos de la ficha, evaluados:**

| Campo | ¿Existe? | ¿Qué decisión, comprensión o acción habilita? | Veredicto |
|---|---|---|---|
| Nombre, estado, responsables (habilitadores/realizadores) | Sí | Identificar y saber a quién preguntar | Mantener; explicar los dos roles en el sitio |
| Explicación breve (una frase) | No (hay «Problema u oportunidad» en el caso) | Entender en 5 s | **Crear**: una frase obligatoria |
| Problema u oportunidad, objetivo | Sí, en el caso [captura d-06] | Por qué existe | Subirlo a la ficha (hoy está dos clics abajo) |
| Público beneficiado (área) | No | Filtrar por área, relevancia para directivos | **Crear** (una columna «Área beneficiada») |
| Línea estratégica / tipo de valor | Sí, duplicado | Agrupar y contar | Unificar |
| Valor esperado (anual, VPN, TIR) | Sí | Priorizar | Mantener; mostrar con la unidad y el horizonte |
| Resultados (captado) | Sí, sin evidencia | Demostrar | **Añadir evidencia** (sección 9) |
| Indicadores (OKRs) | Texto libre | Casi ninguna: no es medible | Convertir en «indicador + línea base + meta + valor actual» o quitar |
| Avance (% del plan), atrasadas, ruta crítica | Sí, calculado | Ejecución | Mantener |
| Próximos hitos | **El campo `hito` ya existe en las actividades** [validate.js], pero no se muestra en ficha ni inicio | «Qué sigue» | **Mostrar**: las 3 próximas actividades marcadas como hito; no hace falta un campo nuevo |
| Aliados / proveedores | No | Reconocer y contactar | Complementario; no crear por ahora |
| Recursos relacionados (documentos) | No | Evidencia y profundidad | **Crear**: enlaces a SharePoint (solo URL, no archivos) |
| Fecha de actualización | Sí (`updated_at`), no visible en la cabecera | Confianza | Mostrar «Actualizado el … por …» en la cabecera de la ficha |
| Próxima acción / próximo comité | Sí (próximo comité) | Qué pasa ahora | Mantener |
| Trazabilidad (bitácora de texto) | Sí | Historia | Mantener como «Diario» plegado; no como campo principal |
| Income, ICE (I/C/F) | Sí | Priorización | Mantener, explicar; «Income» renombrar a «Valor anual estimado» con unidad |
| Forma de relacionarse | No | Acción | **Crear**: «Escribir al habilitador» (mailto) |

**Ficha ideal (orden de lectura):**
1. Cabecera: nombre · estado · línea · área beneficiada · responsables · «Actualizado el … por …».
2. **En una frase:** qué es y qué cambia.
3. **Por qué existe:** problema u oportunidad, objetivo (del caso).
4. **Dónde va:** avance, atrasadas, próximos 3 hitos, próximo comité, última decisión del comité sobre esta iniciativa.
5. **Qué vale:** esperado anual, VPN/TIR con horizonte, captado del año con cumplimiento, **y la evidencia** (lista de capturas con fuente).
6. **Operación** (pestañas): Plan · Caso · Comités · Diario · Historial.
7. Acciones: Preparar comité · Registrar captura · Escribir al habilitador.

---

## 9. Actividad, resultado e impacto

**Lo que el sitio comunica hoy, por volumen:** entregables y proyecciones (VPN, TIR, ICE, valor a captar por año: 4 de 9 bloques del tablero), actividad (avance %, atrasadas), y **un** resultado (captado del año). Impacto estratégico: ninguno.

**Cadena NECESIDAD → INTERVENCIÓN → ENTREGABLE → RESULTADO → IMPACTO → EVIDENCIA, dónde se rompe:**
- Necesidad: existe como «Problema u oportunidad» del caso [C], pero escondida.
- Intervención: cronograma [C], bien.
- Entregable: «Entregable» por actividad en el cronograma [LEEME.md], bien.
- Resultado: captado mensual por tipo [C], sin contexto de qué lo produjo.
- Impacto: **no existe** (ni un campo ni un texto por iniciativa).
- Evidencia: **no existe**. La cadena se rompe en los dos últimos eslabones.

**Cada cifra del tablero, interrogada:**

| Cifra | ¿Qué demuestra? | ¿Actividad o resultado? | Contexto | Periodo | Fuente | Línea base | Riesgo de conclusión exagerada |
|---|---|---|---|---|---|---|---|
| Valor captado 2026 ($) | Que alguien registró capturas | Resultado (si es real) | Sí (frase) | Sí (año) | **No** | No aplica | **Alto**: «capturado» sugiere dinero en caja; puede ser ahorro estimado |
| Cumplimiento (107 %) | Captado / esperado prorrateado | Resultado vs plan | Sí («prorrateado por meses corridos») | Sí | Derivado | Sí (esperado) | **Medio**: el denominador depende de qué proyectos cuentan como «en realización» [core.js:258], regla que no se explica en pantalla |
| Proyectado 2026 | Lo que dicen los casos | Proyección | Sí | Sí | Casos | — | Bajo |
| Inversión de los casos | Suma de inversiones del flujo | Insumo | Mínimo | Horizonte completo, no el año | Casos | — | **Medio**: mezcla inversión de todos los años con captado de un año |
| VPN del portafolio | Suma de VPN | Proyección | Sí | Horizonte | Casos | — | **Medio**: sumar VPN de casos con horizontes y tasas distintas es discutible; decirlo |
| ICE promedio (227) | Promedio de un producto 1–10³ | Opinión estructurada | Poco | — | Equipo | — | **Alto**: un número de tres cifras sin escala parece una métrica dura |
| Iniciativas con alertas (3/5) | Reglas de alerta | Actividad | Sí | Hoy | Sistema | — | Bajo |
| Curva de captura | Esperado vs captado acumulado | Resultado | Sí | Mes | Casos + captado | Sí | Bajo |
| Mezcla del valor (dona) | Composición de lo **proyectado** | Proyección | Dice «proyectado» | Año | Casos | — | **Medio**: está al lado de la cifra captada; se lee como composición de lo captado |
| ICE vs valor (dispersión) | Prioridad | Opinión | Sí | — | — | — | Bajo |

**Recomendación para mostrar resultados sin atribuir impactos no demostrables:**
1. Renombrar «captado» por tipo: «Ahorro verificado», «Ingreso registrado», «Estimación de eficiencia». La palabra «captado» solo para lo que tenga evidencia.
2. Cada captura mensual lleva: fuente (documento o sistema), quién la validó (persona del área, no de la Dirección), fecha de validación y nota. Sin eso, la captura se muestra en gris como «preliminar» y **no suma** a la cifra principal, o suma en una barra aparte «preliminar».
3. La cifra principal muestra dos números cuando hay diferencia: «Verificado $X · Preliminar $Y». Es menos espectacular y mucho más creíble.
4. Separar la banda de indicadores en «Resultados» (captado, cumplimiento) y «Proyección» (proyectado, VPN, inversión); hoy conviven en una línea.
5. ICE: mostrarlo como prioridad relativa («Prioridad 2 de 5»), no como número absoluto.
6. Atribución: en cada iniciativa, un campo corto «Qué hizo la Dirección» vs «Qué hizo el área», para no apropiarse del resultado completo. Es lo que más credibilidad da ante los vicepresidentes.

---

## 10. Narrativa de gestión

**Hoy:** no hay historia. El tablero cuenta «cuánto y qué está en riesgo»; la tabla lista; la ficha expone campos. El visitante no puede saber por qué existen las iniciativas, cómo se relacionan entre sí (no hay vínculos entre iniciativas ni con prioridades de la compañía), qué prioridades apoyan (no existen como dato), qué aprende la Dirección (no hay campo de aprendizajes ni cierres documentados) ni qué viene después (no hay hitos ni pipeline de ideas).

**Narrativa recomendada** (para quien no conoce la estructura):

> **Retos:** Amarilo quiere crecer con eficiencia y menos riesgo. Las áreas detectan oportunidades, pero sin método se quedan en ideas.
> **Prioridades:** [las que la compañía defina: ND; el sitio debe tener un lugar para escribirlas y para asociar cada iniciativa a una].
> **Lo que hace la Dirección:** recibe necesidades, las convierte en casos de negocio con cifras comparables, las lleva a comité para decidir, acompaña la ejecución con cronograma y mide lo que se captura.
> **El portafolio:** N iniciativas en curso, por línea de valor, con su estado.
> **Resultados:** lo verificado este año, con evidencia, y lo que falta.
> **Lo que aprendimos:** cierres y pausas documentados (qué funcionó, qué no).
> **Lo que viene:** próximos comités, próximas decisiones, ideas en evaluación.

Para sostenerla hacen falta cuatro datos que hoy no existen: prioridades de la compañía (lista corta), vínculo iniciativa → prioridad, campo «aprendizajes» al cerrar o pausar, y un pipeline de ideas (L0) alimentado desde fuera del equipo.

---

## 11. Credibilidad y evidencia

**Clasificación del contenido actual:**

| Contenido | Tipo |
|---|---|
| «$664 M capturados · 107 % · En meta» | **AFIRMACIÓN** (sin fuente) |
| Alertas con causa («8 actividades atrasadas») | **EVIDENCIA** derivada del plan |
| «Prorrateado por los meses corridos…», «¿Cómo se calcula?» | **CONTEXTO** (bueno) |
| Matriz «Acelerar / Replantear…» | **RECOMENDACIÓN**, etiquetada como sugerencia (bueno) |
| VPN, TIR, ROI | **INTERPRETACIÓN** de supuestos (sin mostrar los supuestos en la ficha) |
| Trazabilidad («28 OCT: Avance revisado en comité») | **CONTEXTO** |
| Historial (quién cambió qué) | **EVIDENCIA** de gestión del sitio, no del resultado |
| Compromisos con responsable y fecha | **EVIDENCIA** de seguimiento |
| Decisiones del comité (texto libre) | **AFIRMACIÓN** no estructurada |

**Faltan pruebas en:** captado (fuente, validador), decisiones (registro), impacto (ninguno), metodología (no se explica el método en el sitio; está en LEEME.md, fuera), limitaciones (ninguna cifra dice «esto es estimado»), aprendizajes (ninguno).
**Hay demasiada información sin conclusión en:** la tabla de Proyectos (columnas de trazabilidad primero, valor al final [DISENO.md #16]) y la dispersión ICE vs valor (responde una pregunta que la matriz ya responde mejor).

---

## 12. Auditoría de la página inicial (tablero), bloque por bloque

| Bloque | Propósito | Público | Mensaje | Problema | Acción esperada | Veredicto |
|---|---|---|---|---|---|---|
| Cabecera «Tablero ejecutivo · Datos al … · 5 iniciativas · pesos» | Orientar | Todos | Contexto | No dice qué es la Dirección | — | **MEJORAR**: «Generación de Valor · lo que el portafolio está generando» + enlace «¿Qué es la Dirección?» |
| Filtros (año, alcance, Filtros, ⚙) | Acotar | Equipo | — | Para presidencia es configuración | — | **MANTENER** plegado por defecto para lectores |
| Hero (cifra, anillo, frase) | Cuánto | Presidencia | Claro | Sin evidencia; «capturado» ambiguo | «¿De dónde sale?» | **MEJORAR**: verificado vs preliminar + enlace a evidencia |
| Requiere atención | Qué decido | Presidencia, líder | Claro | Las flechas llevan a cronograma/caso, no a «decidir» | Abrir, decidir | **MANTENER** + añadir «Registrar decisión» |
| Banda de indicadores (5) | Resumen | Directivos | Mezcla resultado y proyección | ICE promedio sin escala | — | **MEJORAR**: dos bandas (Resultados / Proyección); ICE fuera |
| Valor a captar por año (barras) | Futuro | Directivos | Claro | 6 colores apilados; «captado» como barra negra solo en el año actual | Clic en año | **SIMPLIFICAR**: agrupar en 3 tipos o mostrar total + desglose al pasar |
| Matriz «¿Qué hacer…?» | Decidir | Comité | Claro y honesto | Depende de ICE (opinión) | Decidir | **MANTENER** |
| Cumplimiento por proyecto | Comparar | Comité | Claro | — | Abrir | **MANTENER** |
| Estado del portafolio por etapa | Composición | Directivos | Claro | Chips de casos (Aprobado/En revisión/Borrador) poco legibles | — | **MANTENER**, simplificar chips |
| Curva de captura | Tendencia del año | Presidencia | Claro | Solo el año en curso | — | **MANTENER**; añadir años anteriores cuando existan |
| Mezcla del valor (dona) | Composición proyectada | Directivos | Confunde con captado | Decorativa | — | **FUSIONAR** en el hero como «composición de lo captado» (ya existe `compos()`) y eliminar la dona |
| Prioridad ICE vs valor (dispersión) | Priorizar | Comité | Duplica la matriz | Difícil de leer | — | **ELIMINAR** (la matriz lo cubre) |
| Tabla de proyectos | Detalle | Equipo | — | Al final, sin acción | Abrir | **REUBICAR** a Portafolio; dejar en inicio solo «en realización» con próximo hito |
| — | Explicar la Dirección | Nuevos, áreas | — | No existe | Leer, proponer | **CREAR** (bloque corto arriba del hero, plegable para quien ya lo sabe) |
| — | Decisiones recientes | Presidencia | — | No existe | Confirmar | **CREAR** |
| — | Próximos comités y qué se decide | Todos | — | Existe solo como alerta «Próximo» | Prepararse | **CREAR** (lista de 3) |
| — | Llamado a la acción | Áreas | — | No existe | Proponer | **CREAR** («Proponer una necesidad») |

**Secuencia ideal de la home:**
1. Qué es la Dirección (3 líneas, plegable) + «Proponer una necesidad».
2. Cifra del año: verificado · preliminar · cumplimiento · «¿De dónde sale?».
3. Requiere atención (con «Registrar decisión»).
4. Decisiones del último comité + próximos comités.
5. Iniciativas en realización: estado, avance, próximo hito.
6. Resultados vs proyección (dos bandas) y curva de captura.
7. Matriz «¿Qué hacer?» (solo para roles del comité; plegada para lectores).
8. Valor por año (simplificado).

No se incluye «casos o historias» como bloque aparte: una iniciativa cerrada con evidencia **es** la historia, y vive en Resultados.

---

## 13. Experiencia visual

**Jerarquía y composición:** correctas. Una tarjeta protagonista, bandas en vez de cajas, cuatro bloques numerados. La barra morada y el lienzo lavanda funcionan; el amarillo aparece poco y por eso se nota [decisión de este chat, bien tomada].
**Espaciado y tipografía:** escala definida (11–48 px), Montserrat 400–800, cifras de ancho fijo [DISENO.md]. Densidad adecuada en escritorio; en celular el hero ocupa una pantalla entera (captura d-11), aceptable.
**Color y contraste:** tintas AA documentadas; verificar que el degradado pastel de las gráficas no se use para codificar información sin leyenda (está documentado que sí se añade leyenda). Las barras apiladas de seis colores son el punto más débil: demasiadas categorías para distinguir sin esfuerzo.
**Iconografía:** sprite de línea, consistente. Bien.
**Tarjetas:** sombra suave + borde nítido; consistentes.
**Gráficos:** SVG propios con degradados [dash.js `gdefs()`], tooltips y leyenda. El anillo con número dentro es el mejor elemento. La dispersión ICE vs valor es el peor (puntos grises sin etiqueta).
**Fotografía o ilustración:** ninguna. Para el objetivo «sitio de la Dirección» faltaría una imagen por iniciativa o del equipo; para la herramienta no hace falta. Dejarlo para cuando exista material oficial [DISENO.md pendiente 4].
**Consistencia:** alta en tablero, tabla y agenda; el cronograma usa su propio CSS heredado (plan.css) y se nota [captura 6-cronograma.png]: otra tipografía de tabla, otros radios. Es el precio de la paridad con la app de gestión que tú pediste; aceptable, pero debe decirse.
**Estados interactivos:** hover/focus definidos; estados vacíos con acción [DISENO.md].
**Percepción de calidad:** alta para una herramienta interna. Lo que la haría parecer «de Dirección» y no «de equipo» no es más efecto visual sino **texto**: una frase de propósito, nombres de personas con cara, evidencia enlazada, decisiones con fecha.

**Qué se siente hoy:** una combinación de **dashboard** (inicio) + **herramienta de gestión** (resto). **Qué debería ser principalmente:** un **portafolio estratégico con herramienta de gestión debajo**: la primera pantalla cuenta y demuestra; la operación queda a un clic.

---

## 14. Momentos «wow» (cuatro)

| Momento | Experiencia del visitante | Información necesaria | Funcionalidad | Valor | Complejidad | Riesgo | Métrica de éxito |
|---|---|---|---|---|---|---|---|
| **1. La cifra que se puede abrir** | Hago clic en «$664 M» y veo de qué iniciativas sale, cada captura con su fuente y quién la validó | Capturas con fuente, validador, fecha, documento | Campos de evidencia en el captado + vista «Resultados» | Credibilidad inmediata ante el dueño | Media | Que las áreas no validen a tiempo → la cifra «verificada» baja (es honesto, no es riesgo) | % de capturas con evidencia ≥ 80 % en 60 días |
| **2. «Qué decidimos y qué pasó»** | En la ficha veo las decisiones del comité sobre esta iniciativa, con fecha, y si se cumplieron | Registro de decisiones (tipo, texto, fecha, responsable, estado) ligado a iniciativa y sesión | Entidad «decisión» + bloque en ficha y en inicio | Trazabilidad; termina con «¿qué dijimos la vez pasada?» | Media | Doble registro si el acta sigue en Word | Decisiones registradas por sesión ≥ 1; compromisos vencidos ↓ |
| **3. Preparar el comité en un clic** | Desde la sesión, «Preparar» arma la vista de las iniciativas que se presentan: estado, alertas, decisión pendiente, imprimible | Todo existe ya | Vista imprimible por sesión | Elimina el PowerPoint del comité | Baja | Que la vista no se vea bien impresa | Sesiones preparadas desde el sitio / sesiones totales |
| **4. Proponer y ver qué pasó con mi idea** | Un líder de área envía una necesidad y después ve su estado (recibida, evaluada, en caso, descartada con motivo) | Formulario mínimo + estados L0 | Formulario + bandeja de ideas | La Dirección se vuelve visible como puerta de entrada | Baja–media | Ideas sin respuesta → peor que no tener formulario; exige dueño y plazo (p. ej. 10 días) | Ideas recibidas; % con respuesta en 10 días |

Un quinto candidato, la tendencia multianual, se descarta por ahora: solo hay datos de un año.

---

## 15. Visualizaciones y métricas

| Visual | Pregunta que responde | Público | Interpretable | Denominador/periodo/contexto | Decisión que habilita | Veredicto |
|---|---|---|---|---|---|---|
| Anillo + cifra captada | ¿Vamos en meta? | Presidencia | Sí | Sí | Pedir explicación si < 90 % | **MANTENER** + evidencia |
| Lista «Requiere atención» | ¿Qué está mal? | Todos | Sí | Sí (reglas) | Intervenir | **MANTENER** |
| Banda de 5 indicadores | Resumen | Directivos | Parcial | ICE sin escala; inversión sin periodo | — | **SIMPLIFICAR** (4, en dos grupos) |
| Barras apiladas por año | ¿Cuánto viene y de qué tipo? | Directivos | Medio (6 colores) | Sí | Planear | **SIMPLIFICAR** (total por año + desglose en tooltip o 3 grupos) |
| Matriz 4 cuadrantes | ¿Qué hacer? | Comité | Sí | Regla explicada | Acelerar/replantear | **MANTENER** |
| Barras de cumplimiento por proyecto | ¿Quién va rezagado? | Comité | Sí | Sí | Priorizar seguimiento | **MANTENER** |
| Barra por etapa + chips | ¿Cómo está compuesto? | Directivos | Sí | Sí | — | **MANTENER**, chips de casos a texto |
| Curva de captura | ¿Tendencia del año? | Presidencia | Sí | Sí | Anticipar | **MANTENER** |
| Dona de mezcla | ¿De qué tipo es el valor? | Directivos | Sí, pero ambigua | «proyectado» en letra pequeña | — | **REEMPLAZAR** por la composición dentro del hero |
| Dispersión ICE vs valor | ¿Qué priorizar? | Comité | No (puntos sin nombre) | — | Igual que la matriz | **ELIMINAR** |
| Tabla final de proyectos | Detalle | Equipo | Sí | — | Abrir | **REUBICAR** |
| — | ¿Cuánto está verificado vs preliminar? | Presidencia | — | — | Confiar | **CREAR** (dos números en el hero) |
| — | ¿Qué decidió el último comité? | Presidencia | — | — | Confirmar | **CREAR** (lista, no gráfico) |
| — | ¿Qué hito viene? | Responsables | — | — | Prepararse | **CREAR** (texto en ficha e inicio) |

Principio: ningún gráfico nuevo. Los tres «crear» son texto o listas.

---

## 16. Búsqueda, filtros y descubrimiento

**Existe [C]:** en Proyectos, búsqueda en todas las columnas, filtrar por columna, ordenar, agrupar, elegir columnas, vista tabla/tablero por estado [captura d-02]; en el tablero, año, alcance (todas / en realización), estado y tipo en «Filtros» con chips [DISENO.md #4]; en la agenda, mes/lista y comités. **No existe:** filtro por área beneficiada (no hay el dato), por responsable en el tablero, por línea estratégica unificada, por «tiene evidencia», etiquetas libres, elementos relacionados entre iniciativas, migas de pan, comparación lado a lado (propuesta #14), búsqueda global (fuera de la tabla).

**Conjunto mínimo recomendado para Portafolio:** estado (etapa), línea de valor (unificada), área beneficiada, responsable (habilitador), «con alertas». Cinco filtros; los demás (agrupar, columnas) se quedan para editores. **Búsqueda global** en la cabecera (nombre de iniciativa, persona, comité): barata, muy usada. **Relacionados:** en la ficha, «otras iniciativas de la misma área/línea» (consulta trivial). **Comparación:** posponer; la tabla ordenable ya compara. **Migas de pan:** sí, una línea (Portafolio › Iniciativa › Caso), porque hoy el «← volver» del caso ignora de dónde se vino.

---

## 17. Llamados a la acción

**Hoy:** acciones de operación claras y consistentes (nuevo, sesión, Excel, imprimir, .ics); acciones de relación **inexistentes** (solicitar apoyo, proponer, contactar, ver evidencia, compartir). Las flechas «→» de las alertas son relevantes pero llevan a herramientas (cronograma, caso), no a la decisión.

| Página | Acción primaria | Secundaria |
|---|---|---|
| Inicio | Lector: «Ver qué requiere decisión» · Área: «Proponer una necesidad» · Editor: «Actualizar mis iniciativas» | «¿Qué es la Dirección?» |
| Portafolio | Abrir una iniciativa | Filtrar por área |
| Ficha | Lector: «Ver evidencia» · Editor: «Registrar avance / captura» | «Preparar comité» · «Escribir al habilitador» |
| Decisiones | «Registrar decisión» (sesión) | «Ver compromisos vencidos» |
| Resultados | «Ver la fuente» de cada captura | Exportar |
| Proponer | «Enviar necesidad» | — |

Una acción primaria por página, visible sin desplazarse, en el botón amarillo «estratégico» que el sistema de diseño ya reserva («uno por vista») [DISENO.md fase 6].

---

## 18. Contenido

**Diagnóstico:** los textos del tablero son los mejores (frase explicativa, subtítulos que explican cada tarjeta, «La decisión es del comité»). Los de la tabla y la ficha son etiquetas de campo sin voz («Income», «OKRs», «Habilitadores»). Las siglas no se explican en ningún lugar de la interfaz. Los estados vacíos existen con acción [DISENO.md]. Hay repetición de «Tablero» (sección) y «Tablero» (vista por estado de Proyectos) [captura d-02: botón «Tablero»].

**Frases que suenan importantes y no dicen nada concreto:** «Tablero ejecutivo» (¿de qué?); «Lo esencial»; «ICE promedio 227» (sin escala); «Requiere atención» está bien, pero «Próximo» como severidad no es una severidad.

**Principios editoriales:**
- *Titular:* verbo o pregunta del lector, no nombre de la sección. «¿Qué requiere decisión?» en vez de «Alertas».
- *Explicar una iniciativa:* una frase con el cambio que produce («Clasificar el 90 % de las cotizaciones en menos de una hora») antes de cualquier cifra.
- *Presentar resultados:* cifra + periodo + fuente + grado de certeza («verificado» / «estimado») siempre juntos.
- *Reconocer incertidumbre:* «estimado», «preliminar», «según el caso de negocio» en la misma línea que el número, no en nota al pie.
- *Llamados a la acción:* verbo + objeto («Registrar decisión», «Proponer una necesidad»), nunca «Ver más».
- *Consistencia:* un glosario en el sitio (10 términos) y tooltips en la primera aparición de cada sigla.

**Antes / después con contenido real:**

| Antes (real) | Después |
|---|---|
| «Tablero ejecutivo» | «Generación de Valor · lo que el portafolio está generando en 2026» |
| «Income · 7» (ficha) | «Valor anual estimado · $7 M (del caso de negocio)» |
| «ICE promedio · 227 · 5 de 5 con ICE» | «Prioridad · 5 iniciativas calificadas (impacto × confianza × facilidad)» o fuera del tablero |
| «Habilitadores · Laura Martínez» | «Patrocina (habilitador) · Laura Martínez» con tooltip «quien abre puertas y decide en su área» |
| «Mezcla del valor 2026 · Qué tipo de valor trae el portafolio este año» | «De qué está hecho el valor **proyectado** para 2026» o eliminar |
| «OKRs · Tasa de conversión de cotizaciones» | «Indicador · Tasa de conversión de cotizaciones · hoy 12 % · meta 20 %» (requiere los campos) |
| Alerta «Próximo · Pasa por Comité directivo el 12 nov» | «Comité · 12 nov · se decide: continuidad del caso» (requiere el dato «qué se decide») |

---

## 19. Accesibilidad y experiencia móvil

**Verificado [C]:** contraste de tintas AA documentado; foco visible (anillo 2 px); reducción de movimiento respetada; `aria-label` en anillo y gráficas del tablero; íconos `aria-hidden`; tamaños de botón píldora ≥ 32 px [I]. **No verificado:** navegación completa con teclado, lectores de pantalla, orden de encabezados (h1/h2 por vista), etiquetas en todos los campos (la hoja del caso y los popovers de la tabla usan inputs generados sin `label`) [core.js:193-210].

| Problema | Sev. | Qué validar |
|---|---|---|
| Tabla tipo Notion y hoja del caso editables solo con mouse/atajos propios; sin roles `grid`/`row`/`gridcell` | **CRÍTICO** (para editores con teclado/lector) | Prueba con NVDA y solo teclado |
| Popovers de edición sin `role="dialog"`, sin gestión de foco al abrir/cerrar | **ALTO** | Idem |
| Gráficas SVG: solo el anillo tiene `aria-label`; barras y curva sin tabla alternativa accesible («Ver tabla» existe solo en el bloque de años) | **ALTO** | Añadir «Ver como tabla» en todas |
| Sin «saltar al contenido»; barra lateral de 8 enlaces + lista de proyectos antes del contenido; sin `aria-current` en la pestaña activa (solo clase `.active`, app.js:124) | **MEDIO** | Añadir skip link y `aria-current` |
| Elementos clicables que no son botón ni enlace, sin `tabindex` ni teclado: filas `tr.clic` [dash.js:394; caso.js:273], ítems de agenda [agenda.js:57], valores y título de la ficha [proyecto.js:23-24,40], doble clic en día del calendario [agenda.js:80] | **ALTO** | Convertir en `button` o añadir `tabindex` + Enter/Espacio |
| Cajones y modales sin `role="dialog"`, `aria-modal` ni atrapado de foco; tooltips de gráficas solo con ratón [dash.js:472-491] | **ALTO** | Gestión de foco; datos de tooltip también en «Ver tabla» |
| Objetivos táctiles pequeños: `.btn.sm` ≈ 5×9 px de relleno con letra de 11,5 px [app.css:172]; botón de plegar barra 28 px; sin mínimo de 44 px | **MEDIO** | Mínimo 44×44 en móvil (WCAG 2.2 · 2.5.8 pide 24×24; 44 es la buena práctica) |
| Botones ☰ sin `aria-label` salvo en el tablero [proyecto.js:21 vs dash.js:410] | **BAJO** | Añadir etiqueta |
| Encabezados: títulos de tarjeta como `div` [I] | **MEDIO** | Auditoría de estructura |
| Color + ícono + palabra en estados: bien; el degradado de gráficas no codifica información: bien | BAJO | — |
| Celular: tablas con desplazamiento horizontal, hoja del caso casi inusable [I] | **MEDIO** | Aceptable si la edición es de escritorio; declararlo |
| Rendimiento móvil: ~4 000 líneas de JS sin minificar + fuente externa; sin medición | BAJO | Lighthouse en 3G |

No se puede declarar cumplimiento WCAG 2.2 AA; sí se puede decir que el sistema de diseño lo persigue en contraste, foco y movimiento.

---

## 20. Actualización y gobernanza

**Cómo se actualiza hoy [C]:** todo desde la interfaz por editores y admin: estado, trazabilidad, ICE, plan, caso, captado mensual, sesiones, compromisos. Importación Excel para casos. Sin dependencia de código para contenido; sí para columnas por defecto y textos de la interfaz. `updated_at/updated_by` en cada registro; historial de 200 últimos cambios.
**Manual y propenso a envejecer:** captado mensual, trazabilidad, ICE (nadie lo revisa), fecha meta, estado del caso, compromisos «hecho».
**Qué debería integrarse:** nada todavía; el captado necesita evidencia, no integración.
**Qué necesita historial:** decisiones (no existe), capturas (sí: cambios de cifra con motivo).
**Qué necesita fecha visible:** la ficha (cabecera), cada captura, cada decisión.
**Qué debería expirar:** alertas «Próximo» (ya expiran por fecha); ideas L0 sin respuesta en 30 días → marcar «sin dueño».

**Modelo mínimo de gobernanza:**

- **Propietario del sitio:** líder del portafolio (tú). Decide estructura, columnas, qué entra al inicio.
- **Propietario de cada iniciativa:** el habilitador (ya es un campo). Responde por estado, avance, hitos y por pedir la captura al área.
- **Responsable del dato (captado):** una persona del área beneficiada, nombrada en cada captura. La Dirección registra, el área valida.
- **Responsable de aprobación:** el comité, para decisiones y para el estado del caso (ya existe «Aprobado»); registrar quién y cuándo.
- **Frecuencia:** avance y alertas, semanal (antes del comité de seguimiento, quincenal según defaults.js); captado, mensual; ideas, respuesta en 10 días hábiles; revisión de ICE, trimestral.
- **Control de calidad:** una lista automática «desactualizado» en Administración: iniciativas en realización sin cambio en 21 días, capturas sin evidencia, compromisos vencidos sin comentario. Es una consulta, no una persona.
- **Archivo o cierre:** L4 Cerrado exige «aprendizajes» (campo) y evidencia final; Pausado exige motivo y fecha de revisión.

Carga operativa estimada: 1–2 h/semana del líder, 15 min/mes por responsable de iniciativa.

---

## 21. Manualidad y automatización

| Proceso | Hoy | Veredicto | Justificación |
|---|---|---|---|
| Registrar captado mensual | Manual, por tipo | **ESTANDARIZAR** (plantilla + evidencia obligatoria); **no automatizar** | Las fuentes (ahorros, ingresos) viven en sistemas distintos y en criterios no definidos; automatizar un dato mal definido lo empeora |
| Calcular esperado, cumplimiento, alertas, ruta crítica | Automático | **MANTENER** | Ya hecho y correcto |
| Trazabilidad (bitácora) | Texto manual | **SIMPLIFICAR**: generar entradas automáticas al cambiar estado, aprobar caso o registrar decisión; dejar texto libre solo para lo demás | Reduce escritura repetida |
| Preparar el comité | Fuera del sitio (PowerPoint) [I] | **AUTOMATIZAR**: vista imprimible por sesión | Fuente: datos existentes; valida el líder; si falla, se imprime el tablero |
| Recordatorio de compromisos vencidos | Manual | **AUTOMATIZAR** después: correo semanal al responsable (requiere SMTP o Graph) | Fuente: compromisos; valida nadie (es informativo); si falla, se ve en el tablero; justifica la complejidad solo si hay > 10 compromisos abiertos |
| Foto mensual del portafolio (tendencia) | No existe | **INTEGRAR**: ya hay envío diario al data lake [lib/lake.js]; guardar también una foto en la base | Barato; habilita la tendencia multianual |
| Actualizar ICE | Manual, nadie lo hace | **HACER SOLO POR EXCEPCIÓN**: revisión trimestral en comité | Es una opinión; no automatizable |
| Cargar usuarios | Manual por admin | **MANTENER MANUAL** (pocos usuarios); SSO con Entra cuando TI lo permita | Proporcional |
| Sincronizar plan.js con la app de gestión | `npm run sync-plan` | **MANTENER MANUAL** | Correcto |
| Demo en Vercel | Manual (zip) | **ELIMINAR** cuando exista el entorno de Azure | Dos despliegues duplican trabajo |
| Exportar a CSV/JSON | Botón | **MANTENER** | — |
| Avisos de desactualización | No existe | **AUTOMATIZAR** (consulta en Administración) | Fuente: `updated_at`; sin validación; si falla, no pasa nada |

---

## 22. Código y arquitectura técnica

**Estructura:** clara y proporcional. Un servidor, una carpeta `lib/` por responsabilidad (auth, store×3, validate, excel, export, lake, demo), módulos de interfaz por vista. Sin bundler ni TypeScript: adecuado al tamaño y a un solo mantenedor.

**DEUDA CRÍTICA**
- **Sin pruebas en el repositorio ni en CI** (los e2e con Playwright existen solo en el scratchpad de esta sesión). Cualquier cambio en `dash.js` (500 líneas con todos los cálculos) puede romper la cifra principal sin que nadie lo note. Mínimo: pruebas unitarias de `finanzas.js` (VPN/TIR) y de `senales()`/`esperadoY`.
- **Cálculos de negocio en el navegador** [dash.js:58, core.js:258]: la cifra que ve presidencia se calcula en el cliente a partir de todos los registros. Con 5 iniciativas es instantáneo; con 50 sigue siendo instantáneo. No es rendimiento: es que **no hay una sola definición de «captado» y «esperado»** que compartan el tablero, la exportación y el data lake. Mover el cálculo a `lib/` y exponerlo por API garantiza que el PDF, el CSV y la pantalla digan lo mismo.

**DEUDA IMPORTANTE**
- `innerHTML` en 66 puntos con `App.esc()` manual [grep]: funciona, pero un olvido es un XSS entre usuarios autenticados. **Ya hay dos olvidos confirmados:** el color del comité (texto de hasta 500 caracteres) se interpola sin escapar en atributos `class`/`style` [agenda.js:41,57,90,133], y el color de las opciones de columna (20 caracteres) igual [tabla.js:81,87; app.js:133]. Un editor malintencionado o un error de tipeo pueden romper el HTML de todos. Corregir con una lista blanca de colores.
- **Lógica duplicada que puede divergir:** el semáforo 90 %/70 % está en dash.js:74 y en caso.js:164; los «meses corridos» en dash.js:24 y caso.js:159; `ticks()` en dash.js:78 y grafico.js:11. Si uno cambia y el otro no, la ficha y el tablero se contradicen.
- **Casos en USD se excluyen del tablero en silencio** [dash.js:32] y la categoría «Experiencia» cae en «otro» al inferirla por palabras [core.js:244-255]: dos formas de que la cifra principal no cuadre con la suma de los casos sin que nadie lo vea. Avisarlo en pantalla.
- La exportación de la interfaz lista 7 tablas y omite `captado` [usuarios.js:18 vs lib/export.js:8]: justo la tabla que sustenta la cifra principal no se puede descargar desde la pantalla.
- `dash.js` (499 líneas) mezcla datos, reglas y HTML. Separar `calcular(d)` de `pintar(d)` facilita pruebas y el futuro «Resultados».
- Dos listas de «tipo de valor» (proyecto vs beneficio) [defaults.js:21-24 vs dash.js paleta].
- Estados de proyecto detectados por expresión regular sobre el texto [core.js:262 `/ejecu|escal|…/`]: si alguien renombra «L2 - Ejecución» a «En curso», desaparece de «en realización» sin aviso. Usar un atributo de la opción (`enRealizacion: true`) en vez de texto.
- Freno de fuerza bruta en memoria y solo por correo [auth.js:70-81]: en Vercel con varias instancias no frena; en Azure App Service con una instancia, sí. Sin límite de peticiones en el resto de la API.
- Encabezados de seguridad solo en estáticos, no en la API; sin HSTS [server.js:30-33,57-62].
- Nombre de la organización inconsistente: «Amarilo» por defecto en código [server.js:127; app.js:35] y «Oficina de Generación de Valor» en `.env.example` y el Bicep.
- El shim CSP del cronograma [plan-csp.js] reinterpreta handlers inline: ingenioso y frágil; documentado; aceptable mientras la paridad con la app de gestión sea un requisito.

**MEJORAS DE CALIDAD**
- `updated_at` visible en fichas; glosario; un `CHANGELOG`.
- Minificar y versionar los JS (cache-busting) al desplegar: hoy son 16 `<script>` síncronos, ≈460 KB de JS y ≈137 KB de CSS sin minificar, con `max-age=300` sin hash [index.html:86-101; server.js:72]. `/api/estado` devuelve todo el estado cada 20 s sin paginación [app.js:164-184]: bien hasta ~100 iniciativas, no más.
- Lighthouse y axe en CI (una vez, barato).

**OPTIMIZACIONES PREMATURAS QUE NO HARÍA**
- Migrar a React/Next o a un framework CSS. No hay problema que resuelvan.
- Microservicios, colas, cachés. 20 usuarios y 50 registros.
- SSO antes de que TI lo pida; cuando lo pida, Entra ID con el mismo patrón ya escrito para la oficina de agentes.
- Un CMS aparte para la página «Qué es la Dirección»: una colección más (`paginas`) en el mismo almacenamiento basta.

---

## 23. Privacidad, seguridad y permisos

| Contenido | Clasificación | Hoy | Riesgo |
|---|---|---|---|
| Nombre de la Dirección, propósito, método | PÚBLICO interno (toda la empresa) | Detrás de login | Ninguno; podría abrirse a todos los empleados con SSO |
| Lista de iniciativas, estado, responsables | INTERNO | Login, todos los roles | Correos de responsables: solo nombres hoy (bien) |
| Casos de negocio (flujos, VPN, TIR, inversión) | **RESTRINGIDO** | Visible para todo lector | **Riesgo**: un lector «directivo» ve la inversión y el VPN de iniciativas de otras áreas; definir si está bien |
| Captado y evidencia (documentos) | RESTRINGIDO | Cifra visible; documentos no existen | Enlazar a SharePoint (hereda sus permisos) en vez de subir archivos |
| Decisiones del comité | RESTRINGIDO | Texto en sesión, visible a todos | Un comité directivo puede tratar temas de personas; marcar sesiones «confidencial» (solo comité) |
| Datos de personas (nombres, roles, correos de usuarios) | RESTRINGIDO | Correos solo en Usuarios (admin) | Bien |
| Historial de cambios | INTERNO | Todos los roles | Aceptable |
| Datos de demo inventados | NO DEBERÍA PUBLICARSE sin marca | Etiqueta «Demostración» | Capturas de pantalla sin la etiqueta parecen reales: añadir marca de agua en modo demo |
| Métricas sensibles (ICE, «Revisar continuidad») | RESTRINGIDO | Visible a todos | «Revisar continuidad» sobre la iniciativa de un vicepresidente, a la vista de todos, puede tener costo político; mostrar la matriz solo a roles del comité |

**Riesgos de código y diseño (no probados, señalados):** CSRF cubierto por el encabezado `X-Portafolio` más SameSite=Lax [server.js:463]; sesión 12 h sin renovación deslizante [auth.js]; colores sin escapar en atributos (sección 22); `ADMIN_PASSWORD` como variable de entorno inicial (correcto si se cambia al entrar: `must_change` existe [server.js:181]); el repo `gestionamarilo` sigue público (señalado en este chat): el código del portafolio no contiene secretos, pero sí la estructura completa. **No declaro el sitio seguro**: faltan prueba de penetración básica, revisión de dependencias (`npm audit` en CI) y decisión de TI sobre dónde corre.

---

## 24. Sitio recomendado

**PROPÓSITO:** demostrar, con evidencia, el valor que la Dirección de Generación de Valor está generando para Amarilo, y operar el portafolio que lo produce.
**PÚBLICOS:** presidencia (decidir con confianza), directivos (ver lo de su área y proponer), equipo del portafolio (operar), responsables de iniciativa (actualizar), empleados (entender y proponer).
**PROPUESTA DE VALOR:** «Convertimos necesidades de las áreas en iniciativas con caso de negocio, las ejecutamos y comprobamos el valor que capturan».
**ARQUITECTURA:** Inicio · Portafolio · Decisiones · Resultados · Proponer · (Administración).
**PÁGINA DE INICIO:** los 8 bloques de la sección 12.
**PORTAFOLIO:** tabla con cinco filtros (etapa, línea, área, habilitador, con alertas), vista por etapa, búsqueda global; cada iniciativa con la ficha de la sección 8.
**DETALLE DE INICIATIVA:** cabecera · en una frase · por qué existe · dónde va (avance, hitos, próximo comité, última decisión) · qué vale (esperado, captado verificado/preliminar, evidencia) · operación en pestañas · tres acciones.
**RESULTADOS:** por año y por iniciativa, cada captura con fuente, validador y fecha; dos totales (verificado, preliminar); exportable; tendencia cuando haya más de un año.
**GESTIÓN:** «Requiere atención» + decisiones registradas + compromisos + próximos comités, en Inicio y en Decisiones; vista «Preparar comité» imprimible.
**LLAMADOS A LA ACCIÓN:** los de la sección 17.
**SISTEMA VISUAL:** el actual (Cimiento Amarilo) sin cambios de tokens; añadir un componente «evidencia» (fila con fuente, validador, fecha, estado verificado/preliminar), un componente «decisión» (tipo, fecha, texto, estado) y un bloque de texto editorial para «Qué es». Menos gráficos, más listas con fecha.
**DATOS:** nuevas colecciones `decisiones` (sesión, iniciativa, tipo, texto, responsable, fecha, estado), `ideas` (o estado L0 con origen externo), `paginas` (texto de «Qué es»); nuevos campos en captura (fuente, validador, fecha_validacion, url, estado), en proyecto (frase, area, prioridad_compania, aprendizajes), (el campo `hito` ya existe en actividades); lista `prioridades` de la compañía.
**ADMINISTRACIÓN:** la actual + lista «desactualizado» + marca de agua en demo.
**ANALÍTICA:** eventos propios mínimos (vista, iniciativa abierta, evidencia abierta, decisión registrada, idea enviada, búsqueda) en una colección `uso`, sin terceros; un contador semanal en Administración.

---

## 25. Tres alternativas de evolución

### A · Evolución ligera
- **Alcance:** menú depurado (Historial y Sistema de diseño fuera), «Actualizado el» en fichas, glosario y tooltips de siglas, bloque «Qué es la Dirección» como texto en el inicio, dona y dispersión fuera, tabla de proyectos reordenada (vista «Ejecutiva» ya propuesta), marca de agua en demo.
- **Beneficios:** claridad inmediata; cero riesgo técnico; una semana.
- **Riesgos:** no toca credibilidad (evidencia) ni decisiones. El dueño seguirá pudiendo refutar la cifra.
- **Complejidad:** baja. **Dependencias:** ninguna. **Tiempo relativo:** 1.
- **Resuelve:** ruido y lenguaje. **No resuelve:** evidencia, decisiones, entrada de necesidades, narrativa.
- **Cuándo elegirla:** si el sitio seguirá siendo solo del equipo y presidencia no lo usará.

### B · Rediseño estratégico (sin cambiar la base técnica)
- **Alcance:** todo lo de A + evidencia en capturas (verificado/preliminar) + registro de decisiones + formulario «Proponer» + ficha reorganizada (historia primero, hitos) + Resultados como sección + «Preparar comité» + lista de desactualizados + analítica mínima + pruebas unitarias de cálculos.
- **Beneficios:** el sitio pasa de mostrar a demostrar; cada bloque del inicio lleva a una acción; mantenimiento con alarmas.
- **Riesgos:** exige disciplina de las áreas para validar capturas (riesgo organizacional, no técnico); dos o tres semanas de trabajo; cambios en el modelo de datos (migración simple: campos nuevos opcionales).
- **Complejidad:** media. **Dependencias:** definir con la Dirección las prioridades de la compañía y el criterio de «verificado». **Tiempo relativo:** 3.
- **Resuelve:** credibilidad, trazabilidad, entrada, narrativa. **No resuelve:** tendencia multianual (faltan datos), SSO, integración con sistemas fuente.
- **Cuándo elegirla:** si presidencia y los vicepresidentes van a usar el sitio como fuente para decidir. Es el caso descrito en este chat.

### C · Experiencia avanzada
- **Alcance:** B + SSO con Entra ID + lectura automática de evidencia desde SharePoint + tendencia multianual con fotos mensuales + comparador de iniciativas + asistente de IA (la oficina de agentes) dentro del sitio para preparar actas y estados + recordatorios por correo.
- **Beneficios:** menos manualidad; la Dirección se percibe como de alto desempeño.
- **Riesgos:** depende de TI (Entra, Graph), de presupuesto de tokens y de que B esté sólido; cada pieza nueva es mantenimiento; tentación de añadir lo técnicamente interesante antes que lo útil.
- **Complejidad:** alta. **Dependencias:** TI, un año de datos, B terminado. **Tiempo relativo:** 8.
- **Resuelve:** manualidad y escala. **No resuelve:** nada que B no resuelva en credibilidad; añade conveniencia.
- **Cuándo elegirla:** después de 3–6 meses de uso real de B, con datos y con TI alineada.

## 26. Alternativa recomendada

**B.** Es la única que cambia la respuesta a la pregunta central. A deja el sitio como herramienta de equipo pulida; C añade capas sobre una base que todavía no demuestra resultados. B cuesta semanas, no meses, no cambia la plataforma y deja listo el terreno para C (los campos de evidencia son lo que después se automatiza; el registro de decisiones es lo que después redacta el asistente).

---

## 27. Recorridos de usuario

**Escenario 1 · Un líder quiere entender rápido qué valor genera la Dirección.**
*Hoy:* entra → ve «$664 M · 107 %» → no sabe qué es la Dirección ni de dónde sale la cifra → lee alertas → cierra. Resultado: «va bien, parece».
*Recomendado:* entra → tres líneas «qué hacemos» → cifra con «verificado $X · preliminar $Y» → clic «¿De dónde sale?» → lista de capturas con fuente → decisiones del último comité → cierra. Resultado: «va bien, y sé por qué».

**Escenario 2 · Una persona busca una iniciativa relacionada con una necesidad (p. ej. cobranza).**
*Hoy:* Proyectos → buscar «cobranza» → abre la ficha → campos (ICE, Income) → no ve el problema que resuelve sin ir al caso. 
*Recomendado:* búsqueda global «cobranza» → ficha: frase, problema, estado, próximo hito, habilitador → «Escribir al habilitador» o «otras iniciativas de la misma área».

**Escenario 3 · Un equipo quiere solicitar apoyo.**
*Hoy:* no hay camino; escribe un correo fuera del sitio.
*Recomendado:* Proponer → formulario (necesidad, área, quién, urgencia, beneficio esperado en una frase) → entra como L0 con origen → recibe estado y respuesta en 10 días → si prospera, ve su idea convertida en iniciativa.

**Escenario 4 · Una persona quiere conocer resultados y evidencia.**
*Hoy:* cifra en el tablero; cumplimiento por proyecto; nada más.
*Recomendado:* Resultados → por año e iniciativa → cada captura con fuente y validador → abre el documento en SharePoint → aprendizajes de las cerradas.

**Escenario 5 · Un responsable necesita actualizar una iniciativa.**
*Hoy:* Proyectos → ficha → edita campos en la tabla o va a cronograma/caso; no sabe qué le falta.
*Recomendado:* Inicio (editor) → «Mis iniciativas» con lo pendiente (captura de octubre sin registrar, 2 hitos vencidos) → ficha → «Registrar avance / captura» con evidencia → listo.

**Escenario 6 · Entra por enlace directo a una iniciativa.**
*Hoy:* ficha sin contexto, «← Proyectos» como única orientación; si no tiene sesión, login y luego la ficha [I: la ruta hash se conserva].
*Recomendado:* migas «Portafolio › Automatización de cotizaciones», frase de qué es, estado y próximo hito arriba; sin sesión, login que vuelve a la ficha (confirmar que ya ocurre).

---

## 28. Métricas de éxito (seis)

| Métrica | Qué mide | Por qué importa | Cómo capturarla | Decisión que habilita | Frecuencia |
|---|---|---|---|---|---|
| % de capturas con evidencia validada | Credibilidad de la cifra principal | Es la diferencia entre afirmar y demostrar | Consulta sobre capturas (campo estado) | Qué áreas necesitan acompañamiento | Mensual |
| Decisiones registradas por sesión de comité | Trazabilidad | Sin esto el comité no deja rastro | Conteo en `decisiones` | Si el comité usa el sitio o el Word | Por sesión |
| Ideas recibidas y % respondidas en 10 días | La Dirección como puerta de entrada | Mide relación con las áreas | Conteo en ideas + fecha de respuesta | Capacidad del equipo | Mensual |
| Iniciativas en realización sin actualización en 21 días | Desactualización | Un sitio viejo pierde a presidencia | Consulta sobre `updated_at` | A quién recordar | Semanal (automático) |
| Vistas del inicio por usuarios lectores (presidencia/directivos) y clics en «¿De dónde sale?» | Uso real del público objetivo | Si no entran, nada de lo demás importa | Eventos propios en `uso` | Si el inicio cumple o hay que llevarles el sitio al comité | Mensual |
| Sesiones de comité preparadas desde el sitio / total | Sustitución del PowerPoint | Es el ahorro de tiempo más visible | Evento «preparar comité» | Si vale la pena mejorar la vista imprimible | Mensual |

Se evitan visitas y duración de sesión: no dicen nada con 20 usuarios.

---

## 29. Comparación actual vs. recomendado

| Elemento | Situación actual | Problema | Recomendación | Impacto | Esfuerzo |
|---|---|---|---|---|---|
| Explicación de la Dirección | No existe | El sitio presupone conocimiento interno | Bloque «Qué es» en inicio + página corta editable | Alto | Bajo |
| Cifra principal | Captado sin fuente | Refutable | Verificado/preliminar + evidencia por captura | Muy alto | Medio |
| Decisiones | Texto libre en sesiones | Sin trazabilidad | Entidad «decisión» en ficha, inicio y Decisiones | Alto | Medio |
| Entrada de necesidades | No existe | La Dirección no recibe | Formulario «Proponer» → L0 | Alto | Bajo–medio |
| Ficha | Tabla de campos | No cuenta la historia | Reordenar: frase, por qué, dónde va, qué vale, operación | Alto | Medio |
| Menú | 8 ítems por colección | Ruido, dos caminos al mismo contenido | 5 ítems por pregunta + Administración | Medio | Bajo |
| Tipo de valor | Dos listas distintas | Inconsistencia | Una lista de seis | Medio | Bajo |
| Siglas | Sin explicar | Dependencia de contexto | Glosario + tooltips | Medio | Bajo |
| Dona y dispersión | Duplican o confunden | Ruido | Eliminar / fusionar en hero | Medio | Bajo |
| Próximos hitos | El campo existe, no se muestra | No se ve «qué sigue» | 3 próximos hitos en ficha e inicio | Medio | Muy bajo |
| Preparar comité | Fuera del sitio | PowerPoint repetido | Vista imprimible por sesión | Alto | Bajo |
| Desactualización | Solo «sincronizado» global | Envejece en silencio | Lista automática + fecha en fichas | Medio | Bajo |
| Analítica | No existe | No se sabe si funciona | 6 eventos propios | Medio | Bajo |
| Pruebas | No hay en repo | Riesgo en cálculos | Unitarias de finanzas y señales | Alto (riesgo) | Bajo–medio |
| Accesibilidad de tabla y hoja | Solo mouse | Excluye y es riesgo de cumplimiento | Roles ARIA + foco + «ver como tabla» en gráficas | Medio | Medio |
| Matriz «Revisar continuidad» visible a todos | Político | Costo con vicepresidentes | Solo para roles del comité | Medio | Bajo |
| Demo | Datos verosímiles | Capturas que parecen reales | Marca de agua | Bajo | Muy bajo |

---

## 30. Roadmap

### P0 · Corregir (impiden cumplir el propósito o son riesgo)
| Problema | Cambio | Impacto | Esfuerzo | Riesgo | Dependencia | Validación |
|---|---|---|---|---|---|---|
| Cifra sin evidencia | Campos de evidencia en captura; dos totales en el hero | Muy alto | Medio | Áreas no validan → cifra verificada baja | Criterio de «verificado» (Dirección) | % capturas con evidencia |
| Sin explicación de la Dirección | Bloque «Qué es» (texto editable, colección `paginas`) | Alto | Bajo | Ninguno | Redacción aprobada | Test de 5 s con 3 personas |
| Cálculos sin pruebas | Unitarias de `finanzas.js` y `senales()` en el repo + `npm test` en CI | Alto | Bajo–medio | Ninguno | — | CI verde |
| «Revisar continuidad» a la vista de todos | Matriz solo para admin/editor | Medio | Muy bajo | Ninguno | — | — |
| Demo verosímil | Marca de agua «Demostración» en modo demo | Bajo | Muy bajo | Ninguno | — | — |

### P1 · Mayor impacto
| Problema | Cambio | Impacto | Esfuerzo | Riesgo | Dependencia | Validación |
|---|---|---|---|---|---|---|
| Decisiones sin registro | Entidad `decisiones` + bloque en ficha, inicio y agenda | Alto | Medio | Doble registro con el acta | Que el comité adopte el sitio | Decisiones/sesión |
| Sin entrada de necesidades | Formulario «Proponer» → L0 con origen y respuesta | Alto | Bajo–medio | Ideas sin respuesta | Dueño y plazo de respuesta | % respondidas en 10 días |
| Ficha sin historia | Reordenar ficha; campo «frase»; «área»; hitos | Alto | Medio | Ninguno | — | Escenario 2 y 6 |
| Menú y home | 5 entradas; secuencia de inicio de la sección 12; dona y dispersión fuera | Medio | Bajo | Costumbre del equipo | — | Clics a «¿De dónde sale?» |
| Comité en PowerPoint | Vista «Preparar comité» imprimible | Alto | Bajo | — | — | Sesiones preparadas/total |
| Siglas y lenguaje | Glosario, tooltips, renombrar Income/ICE/Habilitadores | Medio | Bajo | — | — | — |
| Tipo de valor duplicado | Unificar listas | Medio | Bajo | Migración de datos existentes | — | — |

### P2 · Consolidar
Lista de desactualizados; analítica mínima; «Actualizado el» en cabeceras; migas; búsqueda global; relacionados por área; accesibilidad de tabla y hoja (ARIA, foco); «ver como tabla» en gráficas; foto mensual del portafolio; aprendizajes al cerrar; cálculo de captado/esperado movido a `lib/` y expuesto por API; `npm audit` en CI.

### P3 · Experimentar
Tendencia multianual (cuando haya datos); comparador de iniciativas; recordatorios por correo; SSO Entra; evidencia automática desde SharePoint; asistente de IA (oficina de agentes) para actas y estados.

### NO IMPLEMENTAR
Dashboard en tiempo real; animaciones adicionales; carrusel de «casos de éxito»; una app móvil; migración a framework; CMS externo; rutas separadas por audiencia; más gráficos; apertura pública del sitio.

**Próximos 7 días:** P0 completo salvo evidencia (que requiere definir el criterio): «Qué es», pruebas, matriz por rol, marca de agua; definir con la Dirección el criterio de «verificado» y las prioridades de la compañía.
**Próximos 30 días:** evidencia en capturas y hero; decisiones; Proponer; ficha reorganizada; menú y home; Preparar comité; glosario; unificar tipo de valor. Primer comité preparado desde el sitio.
**60–90 días:** P2; primera revisión de métricas (sección 28); decidir sobre C según uso real.

---

## 31. Los 10 cambios de mayor impacto

1. Evidencia por captura y cifra principal dividida en verificado / preliminar.
2. Bloque «Qué es la Dirección» al inicio, en tres líneas, con «Proponer una necesidad».
3. Registro de decisiones del comité ligado a cada iniciativa.
4. Formulario «Proponer» que entra como L0 y recibe respuesta.
5. Ficha reorganizada: frase, por qué, dónde va, qué vale, operación.
6. Vista «Preparar comité» imprimible por sesión.
7. Menú de cinco entradas por pregunta; Historial y Sistema de diseño fuera.
8. Próximos hitos (campo `hito`, que ya existe) en ficha e inicio.
9. Glosario y renombrado de Income, ICE, Habilitadores; una sola lista de tipo de valor.
10. Pruebas de los cálculos y lista automática de desactualizados.

## 32. Qué no implementaría
Más gráficos (incluida la tendencia hasta tener datos), comparador, SSO antes de que TI lo pida, integración automática de evidencia antes de que exista la evidencia manual, rutas por audiencia, framework nuevo, apertura del sitio fuera de la empresa, y cualquier efecto visual que no cambie una decisión.

## 33. Conclusión final

El sitio hoy es una herramienta de gestión seria con un tablero ejecutivo bien pensado. Lo que le falta no es diseño ni tecnología: es la capa que convierte datos en una historia demostrable: quién es la Dirección, por qué existe cada iniciativa, qué se decidió, qué se comprobó y cómo entrar. Todo eso se construye sobre la base actual, en semanas, y la mayor parte son campos y textos, no código complejo. La prioridad absoluta es que la cifra principal pueda abrirse y mostrar de dónde sale.

---

## Si este fuera el sitio de mi Dirección

- **Mantendría:** el tablero (hero, atención, matriz, cumplimiento, curva), el cronograma, el caso como hoja, la agenda, el sistema de diseño Cimiento Amarilo, la arquitectura técnica sin framework.
- **Mejoraría:** la ficha (historia antes que campos), el lenguaje (siglas, Income, ICE), la cabecera del inicio, la banda de indicadores (resultados vs proyección).
- **Reorganizaría:** el menú en cinco entradas por pregunta; cronograma y casos dentro de la ficha; administración al pie.
- **Eliminaría:** la dispersión ICE vs valor, la dona de mezcla, «Sistema de diseño» e «Historial» del menú principal, la vista pública de «Revisar continuidad».
- **Añadiría:** «Qué es la Dirección», evidencia por captura, registro de decisiones, «Proponer una necesidad», próximos hitos, «Preparar comité», glosario, aprendizajes al cerrar.
- **Automatizaría:** la lista de desactualizados, las entradas de trazabilidad por cambios de estado, la foto mensual del portafolio, las pruebas de cálculo en CI.
- **No implementaría:** más gráficos, comparador, SSO prematuro, framework, rutas por audiencia, apertura pública.
- **Haría primero:** definir el criterio de «captura verificada» con la Dirección y construir la evidencia detrás de la cifra principal; en paralelo, el bloque «Qué es» y las pruebas de cálculo.

**«El cambio más importante para que este sitio pase de mostrar información a demostrar y potenciar la generación de valor sería que cada peso de la cifra principal pueda abrirse y mostrar su fuente, quién lo validó y cuándo, y que el inicio explique en tres líneas qué es la Dirección y cómo proponerle una necesidad.»**

---

## 34. Refutación de mi propia propuesta (antes de cerrar)

**Cinco riesgos de lo que acabo de recomendar**

1. **La evidencia puede matar la cifra.** Si las áreas no validan, la cifra «verificada» será pequeña y el dueño verá un portafolio que «rinde menos» que antes. Es la verdad, pero puede costar apoyo político en el primer mes. Mitigación: lanzar verificado/preliminar con un mes de transición en el que se validan las capturas existentes antes de mostrar los dos números.
2. **El registro de decisiones duplica el acta.** Si el comité sigue levantando acta en Word, nadie escribirá la decisión dos veces. Mitigación: el registro sustituye al acta de decisiones (la vista «Preparar comité» + decisiones + compromisos **es** el acta imprimible), o no se hace.
3. **El formulario «Proponer» crea una obligación que la Dirección quizá no pueda cumplir.** Ideas sin respuesta en diez días dañan más que no tener formulario. Mitigación: lanzarlo solo cuando haya un dueño nombrado y un comité que las revise; mientras, un correo.
4. **Reorganizar el menú y la ficha descoloca al equipo que ya usa el sitio a diario**, que es el único usuario real hoy. Mitigación: hacerlo en una sola entrega, con los mismos datos, y una nota de qué cambió.
5. **Todo esto sigue siendo trabajo manual de una persona (tú).** La auditoría añade campos y rituales; si el líder no tiene 2 h/semana, el sitio envejecerá igual que antes, solo con más campos vacíos. Mitigación: la lista automática de desactualizados existe precisamente para eso, y se recorta alcance antes que disciplina.

**Qué está sobrediseñado en mi propuesta**

| Pieza propuesta | Costo | Beneficio real | Decisión |
|---|---|---|---|
| Sección «Resultados» como página aparte | Una vista nueva | La ficha y el hero con evidencia ya responden «¿de dónde sale?» | **Quitar por ahora**: «Resultados» es el hero abierto, no una página |
| Analítica propia (colección `uso`, 6 eventos, contador) | Código, almacenamiento, y nadie lo mira | Con 20 usuarios, preguntar en el comité da la misma información | **Quitar**: dos métricas manuales (capturas con evidencia, decisiones por sesión) bastan |
| Glosario como página | Mantenimiento | Tooltips en la primera aparición hacen lo mismo | **Simplificar** a tooltips |
| Campo «prioridad de la compañía» y lista de prioridades | Dato que no existe y que la Dirección no controla | Narrativa | **Posponer** hasta que la compañía publique sus prioridades; usar «línea de valor» como eje mientras tanto |
| «Aprendizajes» al cerrar | Campo más | Pocas iniciativas se cierran al año | **Mantener** pero como texto libre en el diario, sin campo nuevo |
| Búsqueda global, migas, relacionados | Tres funciones | Con 5–20 iniciativas, la tabla ya lo resuelve | **Posponer** |
| Accesibilidad ARIA completa de tabla y hoja | Esfuerzo alto en componentes propios | Editores con lector de pantalla: ninguno conocido | **Reducir** a foco por teclado y «ver como tabla»; ARIA completo si aparece la necesidad |
| Roles «comité» para la matriz | Rol nuevo | Solo esconder la matriz al lector | **Simplificar**: visible para admin y editor, no para lector; sin rol nuevo |

**Versión final simplificada (lo que de verdad haría)**

Siete cambios, sobre la base actual, en este orden:

1. **Evidencia en cada captura** (fuente, validador, fecha, enlace) y el hero con «verificado · preliminar». *Es el 50 % del valor de toda la auditoría.*
2. **Bloque «Qué es la Dirección»** en el inicio: tres líneas editables desde Administración, y un enlace de correo «Proponer una necesidad» (el formulario, solo cuando haya dueño).
3. **Decisiones del comité** como lista estructurada en la sesión (tipo, texto, iniciativa, responsable, fecha), visibles en la ficha y en el inicio; la vista imprimible de la sesión reemplaza el acta de decisiones.
4. **Ficha reordenada:** frase, por qué existe, avance y próximos hitos, próximo comité y última decisión, valor y evidencia; operación en pestañas. Un campo nuevo («frase»); los hitos salen del campo `hito` que ya existe en las actividades.
5. **Menú de cinco:** Inicio, Portafolio, Comités y decisiones, Administración (al pie: usuarios, historial, importar, sistema de diseño), y nada más. Cronograma y casos viven en la ficha.
6. **Limpieza del tablero:** dona y dispersión fuera; banda en dos grupos; tooltips de siglas; matriz oculta a lectores; marca de agua en demo.
7. **Pruebas de cálculo y lista de desactualizados.**

Lo que queda fuera de la versión simplificada: página Resultados, analítica, glosario, prioridades de la compañía, búsqueda global, migas, comparador, tendencia, SSO, integraciones, y la oficina de agentes dentro del sitio. Todo eso puede venir después, si el uso lo pide.

Esfuerzo estimado: tres semanas de trabajo de una persona sobre el código actual, sin cambiar plataforma ni dependencias.

---

## Información que me falta (avancé con supuestos)

1. Misión, líneas estratégicas y prioridades escritas de la Dirección y de Amarilo.
2. Número real de iniciativas, sus estados y cuántas tienen caso y captado.
3. Quién valida hoy el valor captado y con qué fuente; criterio de «verificado».
4. Si existe acta formal de comité y quién la levanta.
5. Si presidencia y los vicepresidentes han entrado al sitio (o a la demo) y qué dijeron.
6. Política de TI sobre dónde corre el sitio y quién puede ver el detalle financiero.
7. Si Amarilo tiene licencias de Microsoft 365 Copilot (afecta la oficina de agentes).

¿Quieres avanzar con:
**A.** El rediseño detallado de la arquitectura y los wireframes.
**B.** La reescritura de los contenidos.
**C.** El sistema visual y los componentes.
**D.** El plan técnico de cambios por archivo.
**E.** La implementación gradual de P0 y P1 (versión simplificada de siete cambios).
