# Amarilo · Portafolio de Generación de Valor — Diseño

Auditoría, dirección creativa y sistema de diseño de la herramienta. La referencia viva de todo lo que está aquí está dentro de la app, en **Sistema de diseño** (`#/sistema`): muestra los colores, los contrastes, la tipografía y los componentes reales.

> **Sobre la marca.** El manual de marca de Amarilo es interno y no está en este repositorio. La marca se tomó de la **web pública amarilo.com.co** (revisada el 29 de octubre de 2026):
> - **Logo:** los SVG públicos del sitio (`/images/logo-white.svg` y `/images/logo-footer.svg`), guardados como `public/marca/amarilo-blanco.svg` y `amarilo-negro.svg`. El símbolo (`marca.svg`) son las dos escuadras amarillas de ese logo.
> - **Colores:** las variables del sitio (`--am-color-primary` #FFC600, amarillo del logo #FFC900, `--am-color-dark` #160B29, `--am-color-light-1` #F0F0F1, `--am-color-light-2` #D9D9D9, `--am-color-mute` #6C6D6D, `--am-color-success` #0E7D49, `--am-color-error` #D21A3A, `--am-color-primary-3` #FFEDB2).
> - **Tipografía:** Montserrat, que es la del sitio.
> - **Estilo:** botones en píldora; amarillo para la acción principal y morado oscuro para la secundaria; figuras de contorno amarillas (escuadras y círculos).
> - **Propuesto aquí** (la web no lo define): naranja de advertencia, azul de información, escala tipográfica, espaciado, radios y sombras.
>
> Todo hay que validarlo con Mercadeo contra el manual. Si entregan archivos oficiales, se reemplazan en `public/marca/` con el mismo nombre; el nombre de la organización va en `ORG_NAME`.

---

## Fase 1 · Cómo funciona hoy

| | |
|---|---|
| **Stack** | Node 18+ sin frameworks (`server.js`), HTML + CSS + JavaScript sin compilación (`public/`). Base de datos intercambiable: archivo JSON, Azure SQL o Postgres. Excel con `exceljs`. |
| **Estilos** | `css/app.css` (componentes), `css/marca.css` (sistema de diseño, nuevo) y `plan/plan.css` (copia de la app de gestión). |
| **Módulos** | Tablero · Proyectos (tabla tipo Notion y tablero por estado) · Cronograma (plan de trabajo de la app de gestión) · Casos de negocio (hoja tipo Excel, VPN/TIR, escenarios, valor captado) · Agenda de comités (calendario, compromisos, .ics) · Historial · Usuarios (roles, data lake) · Sistema de diseño. |
| **Usuarios y roles** | Administrador (todo), editor (registra y actualiza), lector (consulta: Presidencia y directivos). |
| **Datos** | Reales en Azure SQL. En la demostración de Vercel, datos inventados y un aviso visible. |
| **Integraciones** | Data lake de Azure (CSV diarios), exportación `/api/export`, Outlook (.ics). |

---

## Fase 2 · Auditoría funcional

Severidad: **C** crítica · **A** alta · **M** media · **B** baja. Esfuerzo: bajo, medio o alto.

| # | Problema | Evidencia | Usuario | Consecuencia | Sev. | Recomendación | Esfuerzo | Estado |
|---|---|---|---|---|---|---|---|---|
| 1 | El tablero mostraba datos pero no decía **qué requiere atención** ni **qué hacer** | Solo gráficas y una tabla; para encontrar un problema había que cruzar 4 tarjetas | Presidencia, directivos | Decisiones lentas o sin tomar; riesgos invisibles | A | Lista «Requiere atención» por iniciativa y matriz «¿Qué hacer con cada iniciativa?» con su regla a la vista | Medio | ✅ Hecho |
| 2 | No se veía **cuánto se ha invertido** | Ningún indicador de inversión | Presidencia | Se ve el beneficio sin su costo | A | Indicador «Inversión de los casos» | Bajo | ✅ Hecho |
| 3 | La cifra principal pedía interpretación | «$664 M · 107%» sin contexto en palabras | Directivos | Comprender toma más de 10 s | M | Resumen en una frase debajo de la cifra | Bajo | ✅ Hecho |
| 4 | Los filtros ocupaban la primera pantalla en celular y mezclaban consulta con configuración | 4 controles + «Income en millones» antes del primer dato | Todos (en celular) | Lo importante queda abajo | M | Año y alcance a la vista; estado y tipo en «Filtros» con chips quitables; unidad del Income en ⚙ | Bajo | ✅ Hecho |
| 5 | Contraste insuficiente | Texto terciario 3,05:1, verde 3,38:1, rojo 4,14:1 (mínimo AA: 4,5:1) | Personas con baja visión, pantallas con brillo bajo | Lectura difícil; incumple accesibilidad | A | Tintas de texto propias para cada estado | Bajo | ✅ Hecho |
| 6 | La advertencia era amarilla (`#fab219`), como la marca | Mismo tono para identidad y alerta | Todos | Se confunde marca con problema | M | Advertencia en naranja, siempre con ícono | Bajo | ✅ Hecho |
| 7 | Los íconos eran caracteres de texto | `◔` del Tablero se veía como un punto; estilos mezclados | Todos | Navegación menos reconocible | M | Un solo juego de íconos de línea | Bajo | ✅ Hecho |
| 8 | Sin identidad de Amarilo | Logo «P» y nombre «Portafolio» | Presidencia | Parece una plantilla genérica | A | Logo, colores, tipografía y estilo de la web pública de Amarilo | Bajo | ✅ Hecho · validar con Mercadeo |
| 9 | Pantalla en blanco al cargar; el error de conexión no ofrecía salida | Sin estado de carga ni botón de reintento | Todos | Incertidumbre («¿se dañó?») | M | Pantalla de carga con marca; error con explicación y «Reintentar» | Bajo | ✅ Hecho |
| 10 | No se sabía si la información estaba al día | Solo «En línea» | Directivos | Desconfianza en las cifras | M | «Sincronizado hh:mm» en la barra lateral | Bajo | ✅ Hecho |
| 11 | El aviso «Demostración» flotaba sobre el contenido | Tapaba la leyenda de la dona | Todos | Información oculta | B | Etiqueta fija en la barra lateral | Bajo | ✅ Hecho |
| 12 | El ICE y las prioridades no explicaban su cálculo | Fórmula solo en el eje | Directivos | Desconfianza en la priorización | M | «¿Cómo se calcula?» desplegable junto a la matriz | Bajo | ✅ Hecho |
| 13 | **Trazabilidad de decisiones** dispersa | Las decisiones viven como texto libre en cada sesión de comité | Portafolio, Presidencia | No se puede responder «¿qué decidimos y se cumplió?» | A | Registro de decisiones (acelerar, replantear, detener) con fecha, responsable y vínculo a la iniciativa | Medio | ⏳ Propuesto |
| 14 | No hay **comparación lado a lado** de iniciativas | Hay que abrir cada caso | Comité | Comparar cuesta | M | Seleccionar 2–4 iniciativas y comparar VPN, TIR, payback, ICE, avance y captado | Medio | ⏳ Propuesto |
| 15 | La **evolución en el tiempo** depende de la curva del año en curso | No hay fotos mensuales del portafolio | Presidencia | No se ve la tendencia de un trimestre a otro | M | Foto mensual automática (ya existe el envío diario al data lake) y gráfica de tendencia | Medio | ⏳ Propuesto |
| 16 | La tabla de Proyectos abre en columnas de trazabilidad; las de valor quedan al final | Columnas calculadas a la derecha | Directivos | El valor no se ve sin desplazarse | M | Vista guardada «Ejecutiva» (estado, valor, cumplimiento, ICE, avance) | Bajo | ⏳ Propuesto |
| 17 | La fecha del caso usa el formato del navegador | «mm/dd/yyyy» en un equipo en inglés | Editores | Errores de digitación | B | Selector de fecha propio en formato día-mes-año | Bajo | ⏳ Propuesto |
| 18 | «Eliminar caso» junto a «Imprimir» | Mismo tamaño y fila | Editores | Riesgo de clic equivocado (ya pide confirmación) | B | Llevarlo a «··· Opciones» | Bajo | ⏳ Propuesto |
| 19 | En la agenda, los eventos del mes se cortan | «09:30 Comité…» | Todos | Hay que abrir la sesión para saber cuál es | B | Color por comité + nombre corto + tooltip | Bajo | ⏳ Propuesto |

### Las preguntas de un directivo

| Pregunta | Dónde se responde ahora |
|---|---|
| ¿Cuál es el valor total que está generando el portafolio? | Cifra principal (captado del año) y su frase; «Proyectado» y «VPN del portafolio» |
| ¿Qué iniciativas tienen mayor potencial? | Matriz «¿Qué hacer…?» (eje de potencial) y «Prioridad: ICE vs valor» |
| ¿Cuáles están en riesgo? | «Requiere atención» (crítico, atención, próximo) |
| ¿Dónde hay retrasos o bloqueos? | «Requiere atención» → cronograma (actividades atrasadas, ruta crítica en riesgo, fecha meta) |
| ¿Qué decisiones requieren atención? | «Requiere atención» (próximos comités, compromisos vencidos) y la matriz |
| ¿Cuánto se ha invertido? | Indicador «Inversión de los casos» |
| ¿Qué resultados se han obtenido? | Valor captado vs. esperado, cumplimiento por proyecto |
| ¿Cómo se distribuye el portafolio? | Mezcla por tipo de valor, estado del portafolio por etapa |
| ¿Cuál es la evolución en el tiempo? | Valor por año y curva de captura (tendencia multi-mes: propuesta 15) |
| ¿Qué acelerar, replantear o detener? | Matriz con 4 cuadrantes y su regla explicada |

---

## Fase 3 · UX y psicología cognitiva

- **Comprensión en menos de 10 segundos.** El orden de lectura es: cifra principal → frase que la explica → lo que requiere atención → indicadores → detalle. Antes, lo primero eran cuatro filtros.
- **Carga cognitiva y ley de Hick.** Los filtros pasaron de 5 controles a 3 visibles. Los demás están en un menú y se ven como chips cuando están activos (reconocer en vez de recordar).
- **Divulgación progresiva.** Resumen arriba y detalle abajo. El «¿Cómo se calcula?» queda plegado y los tooltips dan el dato exacto.
- **Gestalt.** Cumplimiento y estado quedan apilados, juntos, porque los dos hablan de ejecución. Los indicadores van en una sola banda con separadores, en vez de cajas sueltas.
- **Percepción del riesgo.** Hay tres niveles (crítico, atención, próximo), cada uno con ícono, palabra y color. Va primero lo más grave y hay una sola fila por iniciativa para no inflar la sensación de crisis.
- **Confianza digital.** Se ve la hora de la última sincronización. Cada cifra dice de dónde sale. El guardado es optimista con «guardando…», y si algo falla se dice claramente.
- **Sesgos y ética.** La matriz es una **sugerencia** con su regla a la vista: «La decisión es del comité». No hay colores alarmistas sin causa, no se esconden datos desfavorables y la tabla completa sigue disponible.
- **Ley de Fitts.** Las acciones frecuentes quedan cerca del contenido (filtros arriba a la derecha, fila completa como clic). Lo destructivo va separado y pide confirmación.

## Fase 4 · Auditoría visual (resumen)

| Elemento | Antes | Ahora |
|---|---|---|
| Identidad | «P» genérica | Logo de Amarilo, morado #160B29 y amarillo #FFC900 de su web |
| Navegación | Píldora negra, íconos de texto | Marco oscuro, indicador amarillo, íconos de línea |
| Tipografía | Montserrat sin escala definida | Montserrat (la de la web de Amarilo) con escala, pesos y cifras de ancho fijo |
| Color | Amarillo también como advertencia; grises claros con bajo contraste | Amarillo solo para identidad y énfasis; semánticos con tinta AA |
| Radios | Sin escala | Escala 6–18 px; píldora en botones (como la web) |
| Tarjetas | Sombra difusa | Sombra suave + borde nítido |
| Estados | Solo color en varios lugares | Ícono + palabra + color |
| Carga y error | Pantalla en blanco | Pantalla de carga, esqueletos, error con acción |

---

## Fase 5 · Dirección creativa: «Amarilo | Portafolio de Generación de Valor»

### Tres conceptos

1. **Cimiento Amarilo** (antes «Cimiento cálido»). El morado oscuro de la marca como marco y tinta, grises fríos como lienzo y el amarillo como firma: aparece poco y por eso se nota. Lenguaje editorial, de informe de junta, con las escuadras del logo como único motivo gráfico.
2. **Horizonte.** Fondos azul noche, degradados y brillos; tarjetas de vidrio. Comunica tecnología y futuro.
3. **Obra viva.** Fotografía de proyectos y comunidades, texturas de plano arquitectónico y tarjetas modulares como bloques constructivos. Muy humano y narrativo.

### Evaluación (1 a 5)

| Criterio | Cimiento Amarilo | Horizonte | Obra viva |
|---|:-:|:-:|:-:|
| Afinidad con Amarilo (amarillo, cercanía, construcción) | 5 | 2 | 5 |
| Legibilidad | 5 | 3 | 3 |
| Seriedad ejecutiva | 5 | 3 | 3 |
| Diferenciación | 4 | 3 | 5 |
| Escalabilidad | 5 | 4 | 3 |
| Accesibilidad | 5 | 2 | 3 |
| Facilidad de implementación | 5 | 3 | 2 |
| **Total** | **34** | 20 | 24 |

**Recomendada: Cimiento Amarilo.**
- Es la que mejor sostiene las tres exigencias a la vez: la confianza de Presidencia, la lectura rápida de cifras y la identidad.
- «Horizonte» se parece a cualquier startup y su contraste es frágil.
- «Obra viva» es la más emotiva, pero necesita fotografía oficial y le resta densidad a los datos. Se puede tomar de ella un toque humano más adelante: una imagen por proyecto en su página, cuando haya material oficial.

---

## Disposición del tablero (orden de lectura)

- **Estilo por defecto:** barra lateral morada + lienzo lavanda muy claro (`#F2F1F6`) + tarjetas blancas. Siempre arranca en tema claro; el oscuro solo si la persona lo elige en «Apariencia».
- **Cuatro bloques numerados**, en el orden en que se deben leer: ① Lo esencial (cifra, alertas, indicadores) · ② El valor en el tiempo · ③ Ejecución y decisiones · ④ Detalle por iniciativa.
- **La tarjeta principal se destaca:** borde y brillo amarillo suave, sombra más profunda y la composición de lo captado. «Requiere atención» lleva un tinte rojo muy suave arriba.

## Fase 6 · Sistema de diseño

Fuente: `public/css/marca.css`. Referencia viva: **Sistema de diseño** dentro de la app.

| Tema | Definición |
|---|---|
| **Colores primarios** | Amarillo `#FFC900` (identidad y énfasis) · Morado oscuro `#160B29` (títulos, texto, marco, botón principal; 18,9:1) |
| **Secundarios** | Amarillo claro `#FFEDB2` · amarillo suave `#FFF3C7` · amarillo tinta `#6E5300` (texto sobre suave) |
| **Neutros** | Lienzo `#F5F5F6` · tarjeta `#FFFFFF` · hundido `#F0F0F1` · texto secundario `#55545E` (7,4:1) · terciario `#6C6D6D` (5,2:1) |
| **Semánticos** (relleno · tinta · fondo) | Éxito `#16935A` · `#0E7D49` · `#E2F3EA` / Advertencia `#E07A12` · `#A84A08` · `#FDEBD7` / Crítico `#D21A3A` · `#D21A3A` · `#FBE3E7` / Información `#3367CD` · `#2752A8` · `#E6EDFA` |
| **Gráficas** | Paleta categórica suave en orden fijo por tipo de valor: ahorro `#5B9BEA`, ingresos `#F08A5D`, eficiencia `#3FC293`, tiempo `#DDA02E`, riesgo `#EE8FB6`, otro `#8E7CE0` (validada: luminosidad, croma, daltonismo y visión normal). Degradado del color firme en la punta del dato a pastel en la base. Como el contraste con el blanco queda bajo 3:1, cada gráfica lleva leyenda, detalle al pasar el mouse y vista en tabla. Secuencia de azules para etapas; gris para pausado. Sin doble eje. |
| **Tipografía** | Montserrat 400–800 en todo (como la web de Amarilo): 800 en títulos y cifras, 600 en etiquetas, 400 en texto. Alternativa: Segoe UI / system-ui |
| **Escala** | 11 · 12 · 13 · 14 · 16 · 20 · 24 · 32 · 48 px; altura de línea 1,5 (texto) y 1,1 (títulos) |
| **Espaciado** | Base 4: 4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 56 |
| **Retícula** | 12 columnas con 16 px entre tarjetas; barra lateral de 236 px (68 px plegada); márgenes de 16 px |
| **Radios** | 6 (etiquetas) · 8 (campos) · 14 (bloques internos) · 18 (tarjetas) · píldora (botones, filtros y chips, como la web) |
| **Bordes** | 1 px `rgba(23,21,15,.08)`; separadores de tabla con la misma línea |
| **Sombras** | Tarjeta: suave + borde nítido · Flotante (menú, panel): profunda |
| **Iconografía** | Línea de 1,7 px, extremos redondeados, 24 px; siempre con texto en la navegación |
| **Botones** | Principal (tinta), estratégico (amarillo, uno por vista), secundario, fantasma, destructivo, deshabilitado |
| **Campos** | Etiqueta arriba; foco azul de 3 px; error con mensaje de corrección |
| **Tarjetas** | Título 15/700, subtítulo explicativo, contenido; indicadores en banda con separadores |
| **Tablas** | Encabezado en sobretítulo; cifras a la derecha con ancho fijo; fila como clic |
| **Etiquetas y badges** | Etiquetas de columna (9 colores, estilo Notion) · badges semánticos con ícono |
| **Alertas** | Título con la conclusión + detalle con la acción; ícono siempre |
| **Modales y paneles** | Panel lateral para detalle y edición; Esc, ✕ o clic afuera cierran |
| **Tooltips** | Fondo tarjeta con borde, dato exacto con su comparación |
| **Vacíos** | Qué falta + acción para resolverlo |
| **Carga** | Pantalla de carga con marca; esqueletos con brillo suave |
| **Estados** | Éxito, advertencia, crítico, información: ícono + palabra + color |
| **Movimiento** | 120 ms (hover, presionar) · 200 ms (paneles) · gráficas que crecen una vez · respeta «reducir movimiento» |
| **Foco** | Anillo azul de 2 px visible en claro y oscuro; todo se puede usar con teclado |

### Pendiente para cerrar con Mercadeo
1. Visto bueno del uso del logo en la herramienta interna (área de protección, tamaño mínimo, versión para fondo oscuro) y nombre exacto del producto.
2. Confirmar el amarillo oficial: la web usa #FFC900 en el logo y #FFC600 en su variable principal.
3. Confirmar si el morado #160B29 es color corporativo o solo de la web.
4. Fotografía oficial de proyectos (para una futura capa de «Obra viva» en la página de cada iniciativa).
