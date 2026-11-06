# Guía para sustentar el Portafolio de Generación de Valor

Para quien ideó y dirige la solución, no para quien la programa. Lo que hay aquí sale del código real y de las decisiones tomadas en su construcción. Fecha: 6 de noviembre de 2026.

---

## 1. Qué debo saber realmente

### A. DEBO DOMINAR (responder sin ayuda)

1. **El problema que resuelve.** El portafolio de iniciativas vivía en Notion, pagado a título personal por el dueño de la compañía, sin roles, sin trazabilidad y sin forma de demostrar el valor capturado. Presidencia no tenía una sola pantalla que respondiera «¿cuánto valor estamos generando y qué requiere decisión?».
2. **Qué es, en una frase.** Una aplicación web interna donde cada iniciativa tiene su caso de negocio, su cronograma, sus comités y su valor capturado, y donde el inicio responde cuánto se ha generado, qué está verificado y qué requiere atención.
3. **Qué hace y qué no.** Hace: tablero ejecutivo, tabla del portafolio, cronograma con ruta crítica, caso de negocio con VPN y TIR, agenda de comités con decisiones y compromisos, evidencia del valor captado, propuesta de necesidades, usuarios con roles e historial. No hace: contabilidad, nómina, aprobaciones formales con firma, ni reemplaza los sistemas fuente de la compañía.
4. **Quién la usa y con qué permisos.** Tres roles: administrador (todo), editor (registra y actualiza), lector (solo consulta; presidencia y directivos). Cada persona entra con correo y contraseña propia. Todo cambio queda en el historial con nombre y hora.
5. **De dónde sale la cifra principal.** El «valor captado» lo registra el equipo mes a mes en el caso de negocio de cada iniciativa. Se compara con lo que el caso proyectaba a la fecha. Se divide en **verificado** (el área responsable validó hasta cierto mes) y **preliminar** (registrado, sin validar). La regla es visible en la pantalla con un clic.
6. **Cómo se prioriza (ICE).** ICE = Income × Confianza ÷ Esfuerzo × 1,25, la misma fórmula de la tabla de la Oficina en Notion. Income es un puntaje Fibonacci (1 a 55) según el valor a crear o capturar; confianza y esfuerzo van de 25 % a 100 %. Cuando la iniciativa tiene caso de negocio con beneficios, los tres factores salen del caso automáticamente; si no, se usan los registrados en la tabla. La matriz «¿Qué hacer con cada iniciativa?» es una **sugerencia**: la decisión es del comité, y así lo dice en pantalla.
7. **Dónde viven los datos y quién los controla.** En una base de datos PostgreSQL dentro del proyecto de Google Cloud de la empresa, administrada por TI. El código y las versiones las controla la Dirección. No hay datos en servidores de terceros ajenos a la empresa. La demostración pública usa datos inventados y lo dice con una marca de agua.
8. **Las tres decisiones de diseño que más defenderé.** (a) Una sola fuente de verdad en lugar de Excel, Notion y correos. (b) Mostrar evidencia detrás de cada cifra en vez de solo cifras. (c) Que los agentes de IA, cuando lleguen, solo propongan: nada sale sin aprobación de una persona.
9. **Qué cuesta.** Infraestructura entre 10 y 30 USD al mes (base de datos pequeña y servidor que escala a cero). Sin licencias por usuario. El asistente de IA, si se activa, se paga por uso con una llave con tope mensual.
10. **Las limitaciones honestas.** Sección 6 de esta guía. Las digo yo antes de que me las pregunten.

### B. DEBO ENTENDER (explicar en términos generales, sin detalle)

- Cómo se calcula lo «esperado a la fecha»: lo que proyecta el caso para el año, prorrateado por los meses corridos de las iniciativas que están en ejecución o más adelante.
- Qué dispara una alerta: captura por debajo del 90 % de lo esperado, actividades atrasadas, ruta crítica en riesgo, fin después de la fecha meta, VPN negativo, compromisos de comité vencidos.
- Cómo se registra una decisión de comité y dónde aparece (en la sesión, en la ficha de la iniciativa y en el inicio).
- Que el cronograma calcula fechas en cascada con días hábiles de Colombia, precedencias y ruta crítica, y que es el mismo motor de la herramienta de gestión del equipo.
- Que el caso de negocio se trabaja como en Excel y se puede subir y bajar en Excel con fórmulas reales.
- Que existen dos vistas (la actual y la mejorada) con un botón para cambiar, y que la mejorada es la que se presenta.
- Qué información de Notion se importó y que la importación se repite desde Administración sin ayuda técnica.
- Que la aplicación no tiene dependencias de un proveedor: corre en cualquier servidor con Node y una base PostgreSQL.

### C. DELEGO (sé a quién preguntar)

| Pregunta | Quién responde |
|---|---|
| Detalles de la base de datos, respaldos, red, dominio, certificados | TI (Google Cloud) |
| Cómo está escrito el código, qué librerías usa, cómo se prueba | Desarrollador |
| Pruebas de penetración, cumplimiento de políticas de seguridad | Seguridad de la información de TI |
| Integración con Outlook, Teams o SharePoint (permisos en Entra ID) | TI, con la solicitud que ya está redactada |
| Costo exacto de tokens del asistente de IA | Desarrollador, con el panel de consumo de la llave |
| Validación de la marca (logo, colores) | Mercadeo |

---

## 2. Cómo funciona, explicado en cinco minutos

1. **Entra la necesidad.** Un área propone una necesidad desde el sitio (formulario de cuatro campos) o el equipo la registra. Entra al portafolio como idea.
2. **Se convierte en iniciativa con caso de negocio.** Problema, objetivo, alcance, riesgos, flujo financiero por año; el sistema calcula VPN, TIR, payback y ROI al instante, con escenarios pesimista y optimista.
3. **Se planea y se ejecuta.** Cronograma con capítulos, responsables, duraciones en días hábiles, precedencias y ruta crítica. El avance y los atrasos se ven en la ficha y en el inicio.
4. **Pasa por comité.** La agenda tiene las sesiones, los proyectos que se presentan, las decisiones registradas una por una (tipo, texto, responsable, fecha) y los compromisos. «Preparar el comité» arma la vista imprimible de la sesión en un clic.
5. **Se captura y se comprueba el valor.** Cada mes se registra lo que la iniciativa ya generó, por tipo de valor. El área responsable lo valida con una sola línea («validado hasta octubre, por fulano»). El inicio muestra verificado y preliminar, y el enlace «¿De dónde sale esta cifra?» abre el detalle por iniciativa.
6. **Se decide con una pantalla.** El inicio responde: cuánto se ha capturado, cuánto está verificado, qué requiere atención, qué decidió el comité, qué viene, y qué hacer con cada iniciativa según su potencial y su salud de ejecución.

---

## 3. El problema que resuelve, con las palabras del negocio

- **Antes:** la información estaba en Notion con licencia personal del dueño, en Excel del equipo y en correos. Para responder «¿cuánto llevamos?» había que cruzar fuentes y armar una presentación. Nadie podía decir qué parte del valor estaba comprobado.
- **Ahora:** una sola herramienta de la empresa, con roles, con historial, con la cifra del año y su evidencia, y con la decisión del comité registrada donde se tomó.
- **Para presidencia:** una pantalla, cinco segundos, y la posibilidad de abrir cualquier número hasta su fuente.
- **Para las áreas:** una puerta de entrada para proponer necesidades y ver qué pasó con ellas.
- **Para el equipo:** menos presentaciones repetidas; el comité se prepara desde el sitio.

---

## 4. Las decisiones principales y por qué

| Decisión | Alternativa descartada | Por qué |
|---|---|---|
| Herramienta propia de la empresa | Seguir en Notion | Notion estaba en una cuenta personal, sin roles ni trazabilidad, y la información estratégica no debía depender de una licencia individual |
| Base de datos en Google Cloud administrada por TI | Supabase administrado por la Dirección | TI confirmó que la empresa usa Google Cloud; los datos quedan dentro del proyecto corporativo con sus respaldos y políticas. El código no cambia entre uno y otro |
| Evidencia detrás de cada cifra (verificado vs preliminar) | Mostrar solo el total captado | Un total sin fuente es refutable en un comité. La división es menos vistosa y mucho más creíble |
| Validación en una línea por iniciativa y año | Evidencia campo por campo y mes por mes | Lo segundo es un trámite que nadie llena. Lo primero son dos clics |
| ICE con la fórmula que ya usaba la Oficina, calculado desde el caso | Tres calificaciones manuales de 1 a 10 | Mantiene la continuidad con los números históricos y quita la subjetividad cuando hay caso de negocio |
| Decisiones registradas una por una | Texto libre en el acta | Permite responder «¿qué decidimos y se cumplió?» |
| Vista mejorada opcional con botón de volver | Reemplazar la vista anterior | Nada se pierde; se puede comparar y volver atrás en cualquier momento |
| Cronograma idéntico al de la herramienta de gestión del equipo | Un cronograma nuevo | El equipo ya lo conoce; una sola forma de trabajar |
| Agentes de IA que solo proponen | Agentes que ejecutan | Control: ningún correo, acta o cambio sale sin una persona que lo apruebe |
| Sin frameworks ni dependencias pesadas | Plataforma de desarrollo moderna | Cualquier desarrollador lo entiende; TI puede auditarlo; sin costos de licencia |

---

## 5. Cómo demuestro el valor (guion de demostración de diez minutos)

1. **Inicio (2 min).** Leer la cifra del año y su frase. Abrir «¿De dónde sale esta cifra?» y mostrar verificado vs preliminar por iniciativa. Mensaje: «cada peso tiene una iniciativa, un responsable y una validación detrás».
2. **Requiere atención (1 min).** Señalar una alerta y abrirla. Mensaje: «no hay que buscar los problemas; el sistema los trae».
3. **Una iniciativa (2 min).** Ficha: en una frase, por qué existe, dónde va, próximos hitos, última decisión del comité, qué vale, prioridad ICE con su explicación.
4. **Caso de negocio (2 min).** Cambiar un número del flujo y ver cómo se mueven VPN y TIR. Mostrar la validación del captado en una línea.
5. **Comité (2 min).** Abrir una sesión, registrar una decisión, dar clic en «Preparar el comité» y mostrar la vista imprimible. Mensaje: «el comité se prepara en un clic y la decisión queda registrada donde se tomó».
6. **Proponer (1 min).** Enviar una necesidad desde el formulario y verla entrar como idea. Mensaje: «la Dirección es una puerta de entrada, no un cuello de botella».

Consejo: hacerlo con los datos reales ya importados, no con la demostración, salvo que la reunión tenga personas que no deban ver cifras.

---

## 6. Limitaciones que debo reconocer antes de que me las pregunten

1. **La evidencia es tan buena como la disciplina de validar.** Si las áreas no validan, la cifra verificada será pequeña. Es lo honesto; el plan es un mes de transición validando lo existente.
2. **No está conectado a los sistemas fuente** (ERP, nómina, cartera). El captado se registra a mano. La integración automática vendría después y depende de TI.
3. **Un año de datos.** La tendencia multianual aparecerá cuando haya más de un año registrado.
4. **Está pensado para decenas de usuarios y decenas de iniciativas**, no para miles. Es suficiente para el portafolio y no hace falta más.
5. **Las vistas de impresión son funcionales, no diseñadas**. Sirven para llevar al comité; no sustituyen una presentación de marca.
6. **El asistente de IA no existe todavía**; está diseñado y presupuestado, pendiente de aprobación.
7. **Falta la validación formal de Mercadeo** sobre el uso del logo y los colores, tomados de la web pública de Amarilo.
8. **Accesibilidad:** cumple contraste y teclado en lo principal, pero no se ha probado con lectores de pantalla.

---

## 7. Preguntas probables y cómo responderlas

### De presidencia
- **«¿Puedo confiar en los $X millones?»** Puede confiar en la parte verificada; la preliminar está registrada pero no validada. Con un clic ve quién validó cada iniciativa y hasta qué mes.
- **«¿Qué decido hoy?»** La lista «Requiere atención» y la matriz de la sección «Qué hacer» muestran dónde hace falta una decisión; la decisión queda registrada en la sesión del comité.
- **«¿Cuánto nos cuesta esto?»** Entre 10 y 30 USD al mes de infraestructura, sin licencias por usuario. Menos que una licencia de Notion para el equipo.
- **«¿Y si se va la persona que lo construyó?»** El código está en el repositorio de la empresa, documentado en español, sin tecnologías exóticas, y los datos en Google Cloud bajo TI.

### De TI
- **«¿Dónde corre y quién lo administra?»** En Google Cloud: Cloud Run para la aplicación, Cloud SQL para los datos, Secret Manager para las claves. TI administra la infraestructura; la Dirección el código. Hay una guía escrita con los pasos.
- **«¿Es seguro?»** Contraseñas con hash robusto, sesiones firmadas, freno a fuerza bruta, validación de todo lo que llega del navegador, encabezados de seguridad. No declaro que esté certificado: pido que Seguridad lo revise, y el código está disponible para eso.
- **«¿Qué pasa cuando agregan un campo nuevo?»** Nada en la base de datos. Cada registro se guarda como documento; los campos nuevos viven en el código. TI no corre scripts.
- **«¿Se conecta a Outlook o Teams?»** No todavía. Está diseñado con permisos de solo lectura y la solicitud para Entra ID está redactada; se activa cuando TI la apruebe.

### De Finanzas
- **«¿Cómo calculan el VPN?»** Flujo neto por año (beneficios menos costos menos inversión) descontado a la tasa del caso; la TIR por el mismo método que Excel; payback interpolado; ROI sobre egresos. El Excel del caso se puede descargar con fórmulas reales para auditarlo.
- **«¿Por qué suman VPN de casos con tasas distintas?»** Es una suma indicativa y así se rotula; cada caso conserva su tasa. Si Finanzas define una tasa única, se configura.

### De los líderes de área
- **«¿Yo tengo que llenar algo?»** Validar el captado de su iniciativa una vez al mes, en una línea. Nada más.
- **«¿Puedo proponer algo?»** Sí, desde «Proponer una necesidad»; entra como idea y recibe respuesta.
- **«¿Quién ve mis cifras?»** Quien tenga usuario; los lectores no editan. Si una iniciativa debe ser confidencial, se define con el administrador.

### Preguntas que debo pasar a un técnico
- Detalles de rendimiento, arquitectura interna, librerías, pruebas automatizadas, cifrado en reposo, configuración de red. Respuesta correcta: «eso lo responde el desarrollador o TI; lo que puedo asegurar es que está documentado y en el repositorio de la empresa».

---

## 8. Decisiones de evolución que son mías

1. **Activar o no el asistente de IA** dentro del sitio (una llave con tope mensual; solo propone, una persona aplica).
2. **Pedir a TI la conexión con Microsoft 365** (solo lectura) cuando el uso del portafolio lo justifique.
3. **Cuándo integrar sistemas fuente** para el captado (cuando el proceso manual sea estable, no antes).
4. **Qué iniciativas deben ser confidenciales** y para quién.
5. **El criterio de «captura verificada»** y quién valida en cada área. Es la decisión más importante de todas.
6. **Cuándo retirar la vista anterior** y dejar solo la mejorada.

---

## 9. Qué no decir

- No decir «es como Notion». Es una herramienta de gestión de valor con evidencia; Notion era un repositorio de texto.
- No prometer integraciones automáticas sin la aprobación de TI.
- No decir que el sitio está «certificado» en seguridad o accesibilidad. Decir qué se hizo y que está abierto a revisión.
- No presentar la matriz «¿Qué hacer?» como decisión del sistema. Es una sugerencia con la regla a la vista.
- No usar las palabras «SAP», «Power BI» ni ningún sistema que no esté en uso en la compañía.

---

## 10. Glosario mínimo

- **Iniciativa:** todo lo que está en el portafolio, en cualquier etapa (L0 Idea a L4 Realización, Standby, Cancelado).
- **Caso de negocio:** justificación de la iniciativa con su flujo financiero por año.
- **VPN:** valor presente neto; lo que vale hoy el flujo del caso descontado a la tasa. **TIR:** rentabilidad anual del caso. **Payback:** años para recuperar la inversión.
- **Valor captado:** lo que la iniciativa ya generó, registrado por mes y tipo (ahorro, nuevos ingresos, eficiencia, tiempo, riesgo evitado).
- **Verificado / preliminar:** captado validado por el área hasta cierto mes, o registrado sin validar.
- **Esperado a la fecha:** lo que el caso proyectaba para el año, prorrateado por los meses corridos.
- **ICE:** Income × Confianza ÷ Esfuerzo × 1,25; prioridad relativa.
- **Ruta crítica:** las actividades del cronograma que, si se atrasan, atrasan el final.
- **Habilitador / Realizador:** quien patrocina la iniciativa en su área / quien la ejecuta.

---

## 11. Frase de cierre para la reunión

«Pasamos de mostrar un portafolio a demostrarlo: cada peso del inicio se puede abrir hasta su iniciativa, su responsable y su validación; cada decisión del comité queda registrada donde se tomó; y cualquier área puede proponer una necesidad desde la misma puerta. Corre en la nube de la empresa, con los permisos de la empresa, y cuesta menos que una licencia personal.»
