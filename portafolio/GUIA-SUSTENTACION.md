# Guía para sustentar el sitio del Portafolio de Generación de Valor

Para quien ideó y dirige la solución, no para quien la programa. Todo lo que hay aquí sale del código real y de las decisiones tomadas en su construcción. Fecha: 6 de noviembre de 2026.

Convención: 🟢 implementado · 🟡 parcial · 🟠 simulado o demostrativo · 🔵 propuesto · ⚪ no confirmado.

---

## 1. Qué debo saber realmente

### A. DEBO DOMINAR (responder sin ayuda)

1. **El problema.** El portafolio de iniciativas de la Dirección vivía en Notion, con licencia pagada a título personal por el dueño de la compañía, sin roles, sin trazabilidad y sin forma de demostrar el valor capturado. Presidencia no tenía una pantalla que respondiera «¿cuánto valor generamos y qué requiere decisión?». El equipo armaba presentaciones a mano para cada comité.
2. **Por qué una herramienta propia.** Porque la información estratégica no debía depender de una cuenta personal; porque Notion no calcula VPN, ruta crítica ni valor captado; y porque TI exige que los datos vivan en la nube de la empresa (Google Cloud).
3. **Quién la usa.** Tres roles: administrador (la Dirección), editor (equipo y responsables de iniciativa) y lector (presidencia y directivos). Las áreas entran a proponer necesidades.
4. **Qué hace.** Un solo lugar para cada iniciativa: caso de negocio, cronograma, comités, valor captado con su validación. Un inicio que responde cuánto se ha capturado, cuánto está verificado, qué requiere atención, qué decidió el comité y qué viene.
5. **Cómo funciona conceptualmente.** Entra una necesidad → se convierte en iniciativa con caso → se planea y ejecuta → pasa por comité → se captura y valida el valor → el inicio lo muestra con evidencia. Sección 3.
6. **Qué información usa.** La que registra el equipo (iniciativas, casos, cronogramas, sesiones, captado), la que validan las áreas (captado hasta tal mes) y la que vino de Notion (76 iniciativas importadas con sus campos). Nada viene todavía de sistemas fuente.
7. **Qué produce.** La cifra del año dividida en verificado y preliminar, alertas, prioridad ICE, decisiones registradas, vista para preparar el comité, exportaciones.
8. **Las decisiones que defiendo.** Sección 6. Las tres centrales: una sola fuente de verdad; evidencia detrás de cada cifra; validación ágil en una línea.
9. **Qué está funcionando, qué falta y qué es demostración.** Sección 5. En especial: la demostración en Vercel usa datos inventados; los datos reales se importan en la instancia de la empresa.
10. **Qué cuesta y qué viene.** Infraestructura entre 10 y 30 USD al mes, sin licencias por usuario. Próximos pasos: criterio de «captura verificada» y puesta en Google Cloud con TI.

### B. DEBO ENTENDER (conceptualmente)

- **Arquitectura:** una aplicación web (página en el navegador + servidor pequeño) y una base de datos. Sin piezas exóticas. Sección 4.
- **De dónde vienen los datos y cómo se actualizan:** se registran en la interfaz; cada cambio queda con nombre y hora; la pantalla se sincroniza sola cada 20 segundos entre usuarios.
- **Integraciones:** hoy, importación de Notion (CSV), Excel de ida y vuelta para el caso, archivo de calendario para Outlook, exportación por API. No hay conexiones automáticas con otros sistemas.
- **Automatizaciones:** cálculos (VPN, TIR, esperado a la fecha, alertas, ruta crítica, ICE), bitácora automática al cambiar de estado, lista de desactualizados, pruebas automáticas de los cálculos.
- **Permisos:** tres roles; lector no edita; solo administrador maneja usuarios y la configuración.
- **Seguridad:** contraseñas con hash robusto, sesiones firmadas, freno a intentos de acceso, validación de todo lo que llega del navegador, encabezados de seguridad. Sección 8 dice qué puedo afirmar y qué no.
- **Despliegue:** hoy una demostración en Vercel; destino: Google Cloud (Cloud Run + Cloud SQL) con una guía escrita y un archivo de publicación automática.
- **Mantenimiento:** una persona puede mantenerlo; el código está en español y sin frameworks; hay ocho pruebas automáticas de los cálculos.
- **Escalabilidad:** pensado para decenas de usuarios y hasta unas cien iniciativas; probado con 81.

### C. DEBO CONOCER SUPERFICIALMENTE (reconocer si lo mencionan)

- **Node.js:** el lenguaje del servidor; corre en cualquier nube.
- **PostgreSQL / Cloud SQL:** la base de datos; Cloud SQL es la versión administrada por Google.
- **Cloud Run:** donde corre la aplicación en Google; cobra solo cuando se usa.
- **Secret Manager:** donde TI guarda las claves; nunca están en el código.
- **Documento JSON:** cómo se guarda cada registro; por eso agregar un campo no exige cambiar la base.
- **API:** la forma en que la página pide y envía datos al servidor; también la que usan las exportaciones.
- **Vercel:** el servicio gratuito donde corre la demostración con datos inventados.
- **PKCE / cookie HttpOnly / hash:** nombres de mecanismos de seguridad que ya están puestos; basta con saber que existen.
- **Ruta crítica, VPN, TIR, payback, ICE:** glosario al final.

### D. NO NECESITO SABER

- Cómo está escrito el código, qué archivo hace qué, cómo se dibujan las gráficas.
- Cómo se calcula la TIR por bisección o por qué el ICE lleva un factor 1,25 (basta saber que es la fórmula histórica de la Oficina).
- Cómo funciona el intérprete que adapta el cronograma a la política de seguridad del navegador.
- Qué librerías se usan (son dos) ni sus versiones.
- Cómo se configuran las variables de entorno, el contenedor o Cloud Build paso a paso: eso lo hace TI con la guía.

---

## 2. El desarrollo explicado como manager

**¿Qué es?** La herramienta de la Dirección de Generación de Valor para gestionar el portafolio de iniciativas y demostrar, con evidencia, el valor que generan.

**¿Qué problema resuelve?** Información dispersa y sin dueño institucional; cifras de valor sin respaldo; decisiones de comité sin registro; presentaciones repetidas; áreas sin una puerta para proponer.

**¿Para quién?** Presidencia y directivos (decidir con confianza), la Dirección y su equipo (operar), responsables de iniciativa (actualizar), áreas (proponer).

**¿Cómo lo resolvíamos antes?** Notion con licencia personal del dueño, Excel del equipo, correos y PowerPoint para cada comité.

**¿Qué cambia?** Una sola fuente de verdad en la nube de la empresa, con roles e historial. Cada peso del inicio se puede abrir hasta su iniciativa y su validación. Las decisiones quedan donde se toman. El comité se prepara en un clic. Cualquier área puede proponer.

**¿Cómo funciona?** La página en el navegador muestra y edita; un servidor pequeño valida y guarda; una base de datos conserva todo. Los cálculos (esperado a la fecha, VPN, alertas, ICE) se hacen solos con lo registrado.

**¿Qué entra?** Iniciativas y sus campos (importadas de Notion o registradas), casos de negocio (texto y flujo por año), cronogramas, sesiones de comité con decisiones y compromisos, valor captado por mes y su validación, propuestas de necesidades.

**¿Qué hace el sistema?** Calcula, compara contra lo esperado, alerta, prioriza, registra quién cambió qué, sincroniza entre usuarios y arma las vistas de inicio, ficha y comité.

**¿Qué produce?** Cifra del año con verificado y preliminar; lista «Requiere atención»; matriz «¿Qué hacer?»; cumplimiento por iniciativa; decisiones y próximos comités; vista imprimible por sesión; exportaciones CSV/JSON y Excel del caso.

**¿Qué puede hacer el usuario?** Según su rol: consultar; registrar y editar; validar el captado de su área en una línea; registrar decisiones; preparar el comité; proponer una necesidad; importar desde Notion; administrar usuarios.

**¿Qué valor genera?** Credibilidad ante presidencia (evidencia), tiempo del equipo (sin PowerPoint), trazabilidad (decisiones y cambios), gobierno de la información (nube de la empresa, roles), y una entrada ordenada de necesidades.

**¿Qué todavía NO hace?** No se conecta a sistemas fuente (el captado se registra a mano). No envía recordatorios por correo. No tiene tendencia de varios años (un año de datos). No tiene confidencialidad por iniciativa.

**¿Estado actual?** Código completo y probado en local con los 76 proyectos reales; demostración pública en Vercel con datos inventados; pendiente la puesta en Google Cloud por TI; pendiente definir el criterio de «captura verificada» y quién valida en cada área.

**Explicación de 60 segundos:**
«Teníamos el portafolio en una cuenta personal de Notion y las cifras de valor no tenían respaldo. Construimos una herramienta de la empresa donde cada iniciativa tiene su caso de negocio, su cronograma, sus comités y su valor captado. Lo distinto es que cada peso del inicio se puede abrir: se ve qué iniciativa lo generó y qué área lo validó, y lo que no está validado aparece como preliminar. Las decisiones del comité quedan registradas donde se toman y el comité se prepara en un clic. Ya importamos las 76 iniciativas reales. Corre en la nube de la empresa, con roles, y cuesta menos que una licencia. Lo que sigue es acordar quién valida en cada área y que TI la publique en Google Cloud.»

---

## 3. Los flujos principales

**Flujo 1 · Demostrar valor (presidencia)**
Problema: ¿cuánto valor generamos y es creíble? → Usuario: presidente o directivo (lector) → Entrada: el captado mensual registrado por el equipo y la validación del área → Sistema: suma, compara contra lo esperado a la fecha, separa verificado y preliminar → Procesamiento: regla de esperado (proyección del caso prorrateada por meses corridos), semáforo 90 %/70 % → Resultado: cifra del año, anillo de cumplimiento, composición, evidencia por iniciativa → Decisión: confiar, pedir validación donde falta, intervenir donde hay alerta → Valor: credibilidad y decisiones a tiempo.

**Flujo 2 · Gestionar una iniciativa (equipo y responsables)**
Problema: cada iniciativa en archivos distintos → Usuario: editor → Entrada: ficha, caso (texto y flujo), cronograma, captado → Sistema: calcula VPN, TIR, payback, ruta crítica, avance, atrasos, ICE → Resultado: ficha con «en una frase, por qué existe, dónde va, qué vale», alertas en el inicio → Decisión: acelerar, replantear, revisar, sostener (sugerencia de la matriz; decide el comité) → Valor: una sola fuente de verdad y priorización con regla visible.

**Flujo 3 · Decidir en comité**
Problema: decisiones en texto libre, compromisos perdidos, PowerPoint repetido → Usuario: la Dirección y el comité → Entrada: sesión con proyectos, temas, decisiones registradas, compromisos → Sistema: «Preparar el comité» arma la vista por iniciativa con estado, alertas, hitos, última decisión y compromisos abiertos → Resultado: página imprimible y decisiones ligadas a cada iniciativa → Decisión: la del comité, registrada con tipo, responsable y fecha → Valor: trazabilidad y menos tiempo de preparación.

**Flujo 4 · Proponer una necesidad (áreas)**
Problema: ideas por pasillo → Usuario: cualquier persona con acceso → Entrada: título, problema, beneficio en una frase, área, urgencia → Sistema: crea una idea en el portafolio con su origen → Resultado: aparece en la tabla y en «desactualizados» si no se responde en 10 días → Decisión: la Dirección la evalúa → Valor: embudo visible y la Dirección como puerta de entrada.

---

## 4. Arquitectura hasta donde debo saber

1. **Usuario y navegador.** Las personas entran con correo y contraseña desde cualquier equipo o celular. Recordar: no hay nada instalado en los equipos; es una dirección web.
2. **Interfaz (la página).** Muestra el inicio, la tabla, las fichas, el cronograma, el caso y la agenda; hace los cálculos de pantalla y se sincroniza cada 20 segundos. Existe para que todo se vea y se edite en un solo lugar. Recordar: tiene dos vistas, la actual y la mejorada, con un botón para cambiar.
3. **Servidor (la lógica).** Un programa pequeño que valida lo que llega, aplica permisos, guarda, registra el historial y expone la exportación. Existe para que nadie escriba datos inválidos ni sin permiso. Recordar: es el único que habla con la base de datos; las claves viven ahí, nunca en el navegador.
4. **Base de datos.** Guarda cada registro como un documento. Hoy un archivo en la demostración; en producción Cloud SQL (PostgreSQL) en Google Cloud. Existe para persistir y respaldar. Recordar: agregar campos nuevos no exige tocar la base.
5. **Integraciones.** Importación de Notion, Excel de ida y vuelta, archivo de calendario, exportación por API y envío a un data lake. Recordar: ninguna integración escribe en sistemas externos.
6. **Infraestructura.** Vercel para la demostración; Google Cloud (Cloud Run, Cloud SQL, Secret Manager, Cloud Build) para producción, administrado por TI. Recordar: el código y las versiones son de la Dirección; la infraestructura es de TI.

**Si en la reunión te preguntan cómo está construido, puedes responder:** «Es una aplicación web sencilla: una página que se abre en el navegador, un servidor pequeño que valida y guarda, y una base de datos PostgreSQL en Google Cloud administrada por TI. Sin plataformas propietarias ni licencias; cualquier desarrollador la entiende y TI puede auditarla. Los cálculos financieros y de cronograma los hace la propia aplicación con lo que el equipo registra.»

---

## 5. Qué está realmente implementado

### 🟢 Implementado (hay código y se probó)
| Elemento | Frase segura |
|---|---|
| Ingreso con correo y contraseña, tres roles, historial de cambios | «Cada persona entra con su usuario; todo cambio queda con nombre y hora.» |
| Tabla del portafolio configurable (columnas, filtros, orden, agrupar, kanban, CSV) | «La tabla se administra sin programar: columnas, filtros y vistas.» |
| Ficha de iniciativa con pestañas y, en la vista mejorada, la historia antes que los campos | «La ficha cuenta qué es, por qué existe, dónde va y qué vale.» |
| Cronograma con días hábiles de Colombia, precedencias, ruta crítica, línea base, deshacer, comentarios | «Es el mismo motor de cronograma que ya usa el equipo.» |
| Caso de negocio con VPN, TIR, payback, ROI, escenarios, margen de seguridad, Excel de ida y vuelta | «El caso se trabaja como en Excel y los indicadores se recalculan al instante.» |
| Valor captado mensual por tipo y validación en una línea (verificado hasta tal mes, por quién) | «El área valida en dos clics; lo validado cuenta como verificado.» |
| Agenda de comités: sesiones, repetir, compromisos, decisiones registradas, archivo para Outlook, «Preparar el comité» imprimible | «La decisión queda registrada donde se toma y el comité se prepara en un clic.» |
| Inicio: cifra verificado/preliminar con evidencia, atención, indicadores en dos grupos, iniciativas en realización con hitos, decisiones y próximos comités, valor por año, curva, cumplimiento, estado, matriz (solo editores) | «Una pantalla responde cuánto, qué está verificado, qué requiere atención y qué viene.» |
| ICE con la fórmula de la Oficina, calculado desde el caso cuando lo hay | «Usamos la misma fórmula de siempre; cuando hay caso de negocio, sale sola.» |
| «Qué es la Dirección» editable y «Proponer una necesidad» | «Cualquier área puede proponer desde el sitio; entra como idea.» |
| Importación del CSV de Notion desde Administración (probado con las 76 iniciativas reales) | «Las 76 iniciativas de Notion ya están importadas con sus campos.» |
| Lista automática de desactualizados; bitácora automática al cambiar de estado | «El sitio avisa qué está viejo; nadie tiene que revisar iniciativa por iniciativa.» |
| Vista actual y vista mejorada con botón de ida y vuelta | «No se perdió nada: se puede volver a la vista anterior.» |
| Gráficas con color plano y transparencia; tarjetas limpias; marca de agua en demostración | «La única color de la pantalla es el de los datos.» |
| Exportación por API (CSV/JSON) y almacenamiento en archivo, PostgreSQL o SQL Server | «Los datos se pueden sacar en cualquier momento.» |
| Ocho pruebas automáticas de los cálculos financieros y la validación | «Los cálculos tienen pruebas que corren antes de publicar.» |
| Guía de despliegue en Google Cloud y archivo de publicación automática (Cloud Build) | «TI tiene la guía y el archivo para publicar; no hay que improvisar.» |

### 🟡 Parcial
| Elemento | Limitación | Frase segura |
|---|---|---|
| Evidencia del captado | Depende de que las áreas validen; hoy casi todo es preliminar | «La cifra verificada crecerá a medida que las áreas validen; preferimos mostrar menos y creíble.» |
| «Valor a crear/capturar» de Notion como proyección | Se reparte en cinco años por supuesto, no por dato | «Para las iniciativas sin caso usamos el valor de Notion como estimado; el caso lo reemplaza.» |
| ICE automático | Los cortes de Income y las reglas de confianza y esfuerzo son una propuesta tomada de la tabla real; conviene ratificarlos | «La regla es visible y ajustable; la ratificamos con el equipo.» |
| Accesibilidad | Contraste y teclado en lo principal; sin prueba con lectores de pantalla | «Cumple contraste y teclado; falta validar con lector de pantalla.» |
| Impresión | Funcional, no diseñada | «Sirve para llevar al comité; no sustituye una presentación de marca.» |
| Casos en dólares | Se excluyen de las sumas del inicio | «El inicio suma solo pesos; los casos en dólares se ven en su ficha.» |
| Envío al data lake | Construido para Azure; en Google Cloud se reemplazaría por la exportación por API | «La exportación por API cubre la salida de datos en Google Cloud.» |

### 🟠 Simulado o demostrativo
| Elemento | Qué es en realidad | Frase segura |
|---|---|---|
| Demostración pública en Vercel | Datos inventados con marca de agua; se reinicia | «Lo que está en Vercel es una demostración con datos inventados; los reales van en la instancia de la empresa.» |
| Publicación en Google Cloud | Guía y archivo escritos; no se ha ejecutado en un proyecto real | «Está documentado y listo para que TI lo ejecute; aún no está publicado allá.» |

### 🔵 Propuesto
Tendencia multianual · Comparador de iniciativas · Recordatorios por correo · Acceso con la cuenta corporativa (SSO) · Confidencialidad por iniciativa · Integración con sistemas fuente para el captado · Retirar la vista anterior.

### ⚪ No confirmado
Si la demostración en Vercel ya tiene la última versión · Si TI acepta Cloud Run y Cloud SQL tal como están propuestos · Validación de Mercadeo sobre logo y colores · Revisión de seguridad por TI · Si las 76 iniciativas ya se importaron en una instancia distinta a la prueba local.

---

## 6. Decisiones que debo poder defender

| Decisión | Problema | Razón | Trade-off | Cómo la defiendo | ¿Válida? |
|---|---|---|---|---|---|
| Herramienta propia en vez de Notion | Licencia personal, sin roles ni cálculos | Gobierno de la información y capacidades que Notion no tiene | Hay que mantenerla | «La información estratégica no puede depender de una cuenta personal.» | Sí |
| Google Cloud administrado por TI | ¿Dónde viven los datos? | Es la nube de la empresa; respaldos y políticas de TI; el código no cambia | Depende de TI para publicar | «Los datos quedan dentro del proyecto de la empresa; el código sigue siendo nuestro.» | Sí |
| Evidencia detrás de la cifra (verificado/preliminar) | Cifra refutable en comité | Credibilidad | La cifra verificada arranca pequeña | «Preferimos mostrar menos y poder sostenerlo.» | Sí |
| Validación en una línea | La evidencia campo por campo era un trámite | Agilidad; dos clics al mes | Menos granularidad | «Validar toma dos clics; si no, nadie lo hace.» | Sí |
| ICE con la fórmula histórica, calculado desde el caso | Tres calificaciones manuales de 1 a 10 | Continuidad con los números conocidos; menos subjetividad | Los cortes son una propuesta | «Misma fórmula de siempre; cuando hay caso, sale sola. Los cortes se ratifican.» | Sí, ratificar cortes |
| Decisiones registradas una por una | Texto libre en el acta | «¿Qué decidimos y se cumplió?» | Puede duplicar el acta si se sigue haciendo en Word | «La vista de preparación más las decisiones registradas reemplazan el acta de decisiones.» | Sí, si reemplaza el acta |
| Vista mejorada opcional con vuelta atrás | Miedo a perder lo construido | Comparar y volver sin riesgo | Dos vistas que mantener | «Nada se perdió; cuando el equipo adopte la nueva, retiramos la anterior.» | Parcial: retirar la anterior en 1–2 meses |
| Cronograma idéntico al de la herramienta del equipo | Dos formas de planear | Una sola forma de trabajar | Depende de un adaptador técnico delicado | «El equipo ya lo conoce.» | Debería revisarse a mediano plazo: unificar en una sola herramienta |
| Sin frameworks ni dependencias pesadas | Mantenibilidad | Cualquier desarrollador lo entiende; TI puede auditarlo | Menos «moderno» a los ojos de algunos | «Simple a propósito: se audita y se mantiene fácil.» | Sí |
| Demostración pública con datos inventados | Mostrar sin exponer | Vercel gratis, marca de agua | Alguien puede confundirla | «Los datos reales nunca han estado en la demostración.» | Sí |
| Dos pistas de despliegue (Azure y Google Cloud) en el repositorio | Historia del proyecto | Se decidió Google Cloud después | Confunde | «Los archivos de Azure se retiran cuando TI confirme.» | Debería revisarse: limpiar |

---

## 7. Lo que debo conocer sobre los datos

**Fuente → dato → procesamiento → resultado → decisión**

| Fuente | Dato | Quién lo alimenta | Auto/manual | Procesamiento | Resultado | Decisión |
|---|---|---|---|---|---|---|
| Notion (importación) | 76 iniciativas con estado, gerencia, VP, Income, confianza, esfuerzo, valor a crear, OKRs, trazabilidad, personas | Importación desde Administración | Manual (un clic) | Crea columnas y registros; actualiza si ya existen | Tabla del portafolio | Qué iniciativas existen y en qué etapa |
| Equipo | Caso de negocio (texto y flujo por año) | Editor | Manual | VPN, TIR, payback, ROI, escenarios | Qué vale cada iniciativa | Aprobar, aplazar, rechazar |
| Equipo | Cronograma | Editor | Manual; fechas en cascada automáticas | Ruta crítica, avance, atrasos | Dónde va | Intervenir atrasos |
| Equipo | Captado mensual por tipo | Editor | Manual | Suma, compara con esperado | Cumplimiento | Pedir validación o explicación |
| Área responsable | Validación «hasta tal mes, por quién» | Editor en nombre del área | Manual, una línea | Verificado vs preliminar | Cifra creíble | Confiar |
| Comité | Sesiones, decisiones, compromisos | Editor | Manual | Vencidos, pendientes | Trazabilidad | Cumplir lo decidido |
| Áreas | Propuestas | Cualquier usuario | Manual | Idea con origen | Embudo | Evaluar |
| Sistema | Historial, fechas de actualización, desactualizados | Automático | Automático | Reglas de 21 días, 10 días | Mantenimiento | A quién recordar |

**Riesgos de calidad:** captado registrado tarde o estimado; validaciones que no llegan; iniciativas duplicadas en Notion (ya vi una); «Valor a crear» como proyección es un supuesto; estados fuera del estándar (si alguien renombra «L2 - Ejecución», deja de contar como «en realización»).
**Información sensible:** flujos y VPN de los casos (restringido), nombres de personas, decisiones de comité sobre personas o proveedores, compromisos con nombres. Hoy todo lector lo ve.
**Responsables:** del dato de captado, el área; de la validación, la persona del área; de la ficha, el habilitador; del sitio y la configuración, la Dirección; de la base y respaldos, TI.

**Preguntas sobre datos que debo poder contestar:**
1. ¿De dónde sale el captado y quién lo valida? (Del registro mensual del equipo; valida el área en una línea.)
2. ¿Qué significa «esperado a la fecha»? (Lo que el caso proyectaba para el año, prorrateado por los meses corridos de las iniciativas en ejecución o más adelante.)
3. ¿Los datos de Notion están completos? (Importadas 76 iniciativas con 31 campos; sin casos ni cronogramas, que se construyen aquí.)
4. ¿Quién puede ver las cifras financieras? (Cualquier usuario; no hay confidencialidad por iniciativa todavía.)
5. ¿Cómo sé que está actualizado? (Fecha y persona en cada ficha, hora de sincronización en pantalla y lista de desactualizados.)

---

## 8. Seguridad y privacidad

**Lo que puedo afirmar:** contraseñas guardadas con hash robusto y nunca en claro; sesiones firmadas que caducan en 12 horas y se cierran al cambiar la contraseña; freno a intentos repetidos de acceso; tres roles y el servidor los aplica, no la página; todo lo que llega del navegador se valida contra una lista de campos permitidos; encabezados de seguridad del navegador; claves solo en variables del servidor; historial de cambios; la demostración pública no tiene datos reales.

**Lo que debemos validar técnicamente:** una revisión de seguridad por TI; cifrado en reposo y respaldos en Cloud SQL (lo da Google, hay que confirmarlo); acceso con la cuenta corporativa (SSO) en vez de contraseña propia; encabezados de seguridad también en la API; límite de peticiones en toda la API; confidencialidad por iniciativa; qué se registra en los logs; borrado de la demostración cuando ya no haga falta.

**Preguntas que escalo a TI/seguridad:** ¿Cloud Run público con login propio es aceptable o va detrás de Identity-Aware Proxy? ¿Quién tiene acceso a la base? ¿Política de respaldos y retención? ¿Revisión del código antes de salir? ¿Clasificación de la información de los casos?

**Riesgos importantes:** dependencia de contraseñas propias (mitigable con SSO); todo lector ve todo; el repositorio de código debe ser privado; la demostración pública debe reiniciarse o apagarse al pasar a producción.

---

## 9. Las 15 preguntas más probables

1. **¿Por qué hicieron esto?** El portafolio dependía de una cuenta personal y las cifras no tenían respaldo. *Confianza: alta.* Más técnico: «Notion no calcula ni traza; esto sí». Escalar: nunca.
2. **¿Qué problema resuelve?** Información dispersa, valor sin evidencia, decisiones sin registro. *Alta.*
3. **¿Quién lo necesita?** Presidencia para decidir; el equipo para operar; las áreas para proponer. *Alta.*
4. **¿Cómo funciona?** Sección 2 y 3. *Alta.* Más técnico: sección 4. Escalar: cuando pregunten por código.
5. **¿De dónde vienen los datos?** Del equipo y las áreas; 76 iniciativas importadas de Notion. *Alta.* Escalar: formatos de importación.
6. **¿Qué tan actualizado está?** Hora de sincronización en pantalla, fecha en cada ficha, lista de desactualizados. *Alta.*
7. **¿Qué está terminado?** Sección 5. La operación y el inicio sí; Google Cloud, Microsoft e IA no. *Alta.*
8. **¿Qué falta?** Criterio de validación y publicación en Google Cloud. *Alta.*
9. **¿Cuánto trabajo manual requiere?** Captado mensual y validación en una línea por iniciativa; decisiones en la sesión. 1–2 h/semana del líder. *Media (estimación).*
10. **¿Quién lo mantiene?** La Dirección el código y la configuración; TI la infraestructura. Una persona basta. *Alta.* Escalar: plan de continuidad técnico.
11. **¿Cómo escala?** Probado con 81 iniciativas; pensado para decenas de usuarios. Cloud Run escala solo. *Media.* Escalar: más de 100 usuarios o miles de registros.
12. **¿Qué riesgos tiene?** Validación que no llega; todo lector ve todo; dependencia de TI para publicar. *Alta.*
13. **¿Cómo sabemos si genera valor?** Porcentaje de capturas validadas, decisiones por sesión, propuestas respondidas, comités preparados desde el sitio, uso por presidencia. *Media (métricas definidas, no medidas aún).*
14. **¿Qué necesitamos para continuar?** Que TI publique en Google Cloud y un acuerdo de validación con las áreas. *Alta.*
15. **¿Cuál es el siguiente paso?** Esta semana: criterio de validación y solicitud a TI. 30 días: en producción con datos reales y un comité preparado desde el sitio. *Alta.*

---

## 10. Cómo decir «no sé» correctamente

1. «Puedo explicarte la lógica funcional y por qué tomamos esa decisión. La implementación específica prefiero validarla con el desarrollador antes de darte una respuesta imprecisa.»
2. «Eso es de infraestructura: lo definimos con TI en la guía de Google Cloud. Te traigo la respuesta exacta después de la reunión.»
3. «Lo que sí puedo afirmar es qué controles existen; si es suficiente para la política de seguridad de la compañía lo tiene que decir Seguridad de la información.»
4. «Ese cálculo lo hace el sistema con la regla que está escrita en pantalla; el detalle numérico lo revisamos con Finanzas y el desarrollador.»
5. «No lo voy a improvisar. Anoto la pregunta, la valido técnicamente y respondo por escrito.»

---

## 11. Mi límite como manager

| Tema | ¿Debo saberlo? | Profundidad | Quién domina el detalle |
|---|---|---|---|
| Problema | Sí | Total | Yo |
| Usuario | Sí | Total | Yo |
| Propuesta de valor | Sí | Total | Yo |
| Casos de uso | Sí | Total | Yo |
| Funcionalidades | Sí | Qué hace cada una, no cómo | Yo |
| Datos | Sí | Fuente, dueño, manual/auto, riesgos | Yo; el desarrollador el modelo |
| Arquitectura | Sí | Seis componentes conceptuales | Desarrollador |
| Frontend | Reconocer | «La página en el navegador» | Desarrollador |
| Backend | Reconocer | «El servidor que valida y guarda» | Desarrollador |
| Base de datos | Entender | PostgreSQL en Cloud SQL, documentos, sin SQL para campos nuevos | TI y desarrollador |
| APIs | Reconocer | Exportación y futura conexión Microsoft | Desarrollador |
| Hosting/despliegue | Entender | Vercel demo; Google Cloud producción; quién hace qué | TI |
| Seguridad | Entender | Qué controles hay y qué falta validar | TI/Seguridad |
| Permisos | Sí | Tres roles y qué puede cada uno | Yo |
| Código | No | — | Desarrollador |
| Frameworks | No | «No usa frameworks» | Desarrollador |
| Dependencias | Reconocer | «Dos librerías: Excel y PostgreSQL» | Desarrollador |
| Pruebas | Reconocer | «Ocho pruebas automáticas de cálculos» | Desarrollador |
| Mantenimiento | Entender | Quién y cuánto | Yo y desarrollador |
| Costos | Sí | 10–30 USD/mes; IA por uso | Yo |
| Escalabilidad | Entender | Decenas de usuarios, cien iniciativas | Desarrollador |
| Roadmap | Sí | Total | Yo |
| Métricas de éxito | Sí | Las cinco de la auditoría | Yo |

---

## 12. Guion de sustentación (7 minutos)

1. **Contexto (30 s).** *Digo:* «La Dirección administra un portafolio de 76 iniciativas que generan ahorros, ingresos y eficiencia.» *Muestro:* nada aún. *Evito:* hablar de Notion con reproche.
2. **Problema (40 s).** *Digo:* «La información vivía en una cuenta personal de Notion y en Excel; las cifras de valor no tenían respaldo; las decisiones de comité quedaban en texto libre.» *Muestro:* nada. *Evito:* culpar a personas.
3. **Oportunidad (30 s).** *Digo:* «Si cada peso se puede abrir hasta su evidencia, presidencia decide con confianza y el equipo deja de armar presentaciones.» *Evito:* prometer integraciones.
4. **Solución (30 s).** *Digo:* «Una herramienta de la empresa, en su nube, con roles: caso de negocio, cronograma, comités y valor captado por iniciativa.» *Muestro:* el inicio en la vista mejorada, sin tocar nada.
5. **Cómo funciona (40 s).** *Digo:* «Entra la necesidad, se vuelve iniciativa con caso, se ejecuta, pasa por comité, se captura y se valida el valor.» *Muestro:* el bloque «Qué es la Dirección» y los pasos del inicio.
6. **Demostración (2 min).** *Momento wow:* clic en **«¿De dónde sale esta cifra?»**: la cifra se abre por iniciativa, con verificado y preliminar y quién validó. Luego abrir una alerta → ficha → «Última decisión» → «Preparar el comité» → página imprimible. *Evito:* el tour pantalla por pantalla y el cronograma completo.
7. **Valor (30 s).** *Digo:* «Credibilidad, tiempo, trazabilidad y una puerta de entrada para las áreas.» *Muestro:* el formulario «Proponer una necesidad».
8. **Estado actual (30 s).** *Digo:* «Código completo y probado con las 76 iniciativas reales; demostración pública con datos inventados; pendiente publicarlo en Google Cloud con TI.» *Evito:* decir que ya está en producción.
9. **Qué aprendimos (20 s).** *Digo:* «Menos es más: la validación mes a mes era un trámite; la dejamos en una línea. Y la evidencia vale más que la cifra.»
10. **Qué falta (20 s).** *Digo:* «Acordar quién valida en cada área y publicarlo con TI.»
11. **Próximo paso (20 s).** *Digo:* «En 30 días: en producción con datos reales y el primer comité preparado desde el sitio.»
12. **Decisión o apoyo (20 s).** *Digo:* «Necesito dos cosas: que TI publique en Google Cloud y que los vicepresidentes nombren quién valida en su área.»

---

## 13. Chuleta de una página

**EN UNA FRASE:** La herramienta de la Dirección para gestionar el portafolio y demostrar, con evidencia, el valor que genera.
**PROBLEMA:** Información en una cuenta personal, cifras sin respaldo, decisiones sin registro, presentaciones repetidas.
**USUARIO:** Presidencia y directivos (ver y decidir); Dirección y responsables (operar); áreas (proponer).
**VALOR:** Credibilidad, tiempo, trazabilidad, gobierno de la información, puerta de entrada.
**CÓMO FUNCIONA:** 1 necesidad → 2 iniciativa con caso → 3 cronograma y ejecución → 4 comité con decisiones → 5 captado validado y visible en el inicio.
**IMPLEMENTADO:** inicio con evidencia · ficha, caso y cronograma · comités con decisiones y preparación · importación de Notion (76) · ICE automático · roles e historial.
**FALTA:** publicar en Google Cloud (TI) · criterio y responsables de validación · confidencialidad por iniciativa · tendencia multianual · recordatorios.
**DATOS:** del equipo y las áreas, e importados de Notion; nada automático de sistemas fuente todavía.
**RIESGOS:** validaciones que no llegan · todo lector ve todo · dependencia de TI para publicar.
**PRÓXIMO PASO:** producción con datos reales en 30 días y un comité preparado desde el sitio.
**DECISIÓN QUE NECESITO:** publicación por TI; responsables de validación por área.
**PREGUNTAS DIFÍCILES:** ¿Es confiable la cifra? → «La verificada sí; la preliminar está marcada como tal.» · ¿Está en producción? → «Probado con datos reales; falta que TI lo publique.» · ¿Cuánto cuesta? → «10 a 30 USD al mes, sin licencias.» · ¿Es seguro? → «Tiene los controles básicos; pido revisión de TI.» · ¿Y si te vas? → «Código en el repositorio de la empresa, datos en Google Cloud, documentado.»

---

## 14. Qué estudiar y qué no

### Las 10 cosas que debo saber
1. **El problema y por qué una herramienta propia.** Nivel: total. Prueba: ¿puedo explicarlo en 30 segundos sin mencionar tecnología?
2. **Qué significa verificado vs preliminar y quién valida.** Total. Prueba: ¿puedo decir qué pasa si un área no valida?
3. **Qué es «esperado a la fecha» y qué dispara una alerta.** Conceptual. Prueba: ¿por qué una iniciativa puede estar al 104 % y otra rezagada?
4. **El flujo de una iniciativa de idea a valor validado.** Total. Prueba: ¿puedo dibujarlo en cinco cajas?
5. **Qué hace la matriz «¿Qué hacer?» y por qué es una sugerencia.** Conceptual. Prueba: ¿quién decide?
6. **Qué está implementado, qué es demostración y qué es propuesta.** Total. Prueba: ¿qué contesto si preguntan si ya está en producción?
7. **Dónde viven los datos y quién controla qué (Dirección vs TI).** Conceptual. Prueba: ¿qué cambia en la base cuando agregamos un campo?
8. **Las tres decisiones centrales y su trade-off.** Total. Prueba: ¿qué sacrificamos con la validación en una línea?
9. **Qué puedo afirmar de seguridad y qué no.** Conceptual. Prueba: ¿digo «es seguro» o «tiene estos controles»?
10. **Costos, próximos pasos y lo que necesito de la reunión.** Total. Prueba: ¿puedo pedir dos cosas concretas?

### 5 cosas que no necesito estudiar
1. Cómo se calcula la TIR o la ruta crítica por dentro: basta con saber que lo hace el sistema con reglas visibles.
2. Cómo se adapta el cronograma a la política de seguridad del navegador: detalle técnico delicado que no cambia el producto.
3. La estructura de archivos y módulos del código: para eso está el repositorio y el desarrollador.
4. La configuración de Cloud Run, Cloud SQL y Secret Manager: la ejecuta TI con la guía.
5. El envío al data lake de Azure: quedó de la versión anterior y en Google Cloud lo reemplaza la exportación por API.

### 5 cosas que debo validar con un perfil técnico
1. Revisión de seguridad del código y de la configuración en Google Cloud (no hay evidencia de una revisión formal).
2. Que la publicación en Cloud Run funciona en el proyecto real (la guía está escrita; no se ha ejecutado allá).
3. Comportamiento con más de 100 iniciativas o 50 usuarios simultáneos (probado con 81 iniciativas y un usuario).
4. Qué logs y datos personales quedan registrados en el servidor y por cuánto tiempo.
5. Que la importación de Notion deja intactas las iniciativas ya editadas a mano (actualiza por nombre; conviene probar con una copia).

---

## 15. Glosario mínimo

Iniciativa (todo lo que está en el portafolio, de L0 Idea a L4 Realización, Standby, Cancelado) · Caso de negocio · VPN (valor presente neto) · TIR (rentabilidad anual) · Payback (años para recuperar la inversión) · Valor captado (lo que ya generó, por mes y tipo) · Verificado / preliminar · Esperado a la fecha · ICE = Income × Confianza ÷ Esfuerzo × 1,25 · Ruta crítica · Habilitador (patrocina) / Realizador (ejecuta).
