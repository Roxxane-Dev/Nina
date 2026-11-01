# Decisiones de producto e ingeniería

Registro corto de decisiones que cambian cómo se construye Nina. Las más nuevas arriba.

---

## D-016 · Negativo solo por lo apartado no es una alerta
**Fecha:** 2026-11-01 (aprobada por el founder)
**Decisión:** si el disponible sale negativo solo por lo apartado (sin lo apartado sería 0 o más), Inicio y Movimientos lo muestran en color neutro, con "Falta tu ingreso" o "Por lo apartado". El chat responde desde el motor, sin LLM. El sobregasto real sigue en rojo. Precisa D-009.
**Por qué:** apartar el día 1, antes de registrar el sueldo, es un buen hábito. El rojo diría que algo anda mal.
**Consecuencias:** la regla vive en un solo lugar del motor (`negativeOnlyFromSetAside`) y la app recibe `negativeFromSetAside`.

## D-015 · Avances en metas: lo apartado resta del disponible (HOME-02)
**Fecha:** 2026-10-28 (aprobada por el founder: "lo apartado resta del disponible y retiros quedan para después")
**Decisión:** un avance ("aparté S/ 200 para Japón") es un movimiento en `transactions` con `category = 'savings'`, `type = 'expense'` y la nueva columna `goal_id`. `transactions` sigue siendo la única fuente de verdad.
- **Motor:**
  - Lo apartado no es gasto: no entra en los gastos ni en las categorías.
  - Resta del disponible: disponible = ingresos − gastos − lo apartado. Inicio, "Cómo calculé esto" y el chat dan la misma cifra.
  - El ritmo de ahorro de los planes (ingresos − gastos) no baja por apartar.
  - El saldo histórico no resta lo apartado: esa plata sigue siendo de la persona.
- **Avance de la meta:** `current_amount` (monto inicial) + la suma de sus avances, calculado por el motor.
- **Seguridad:** RLS solo deja vincular un movimiento a una meta propia. Un CHECK exige que sea una salida personal (nunca ingreso ni de un espacio). Si se borra la meta, el movimiento queda (`on delete set null`).
- **Registro:**
  - API: `POST /v1/goals/:id/contributions` (dueño y meta activa, si no 404).
  - Chat: con confirmación, buscando la meta por nombre entre las propias.
  - App: "Registrar avance" en Metas.

**Por qué:** si lo apartado no restara, el disponible diría que la persona puede gastar plata que ya separó para su meta.

**Consecuencias:**
- Retirar plata de una meta queda para después. Hoy se deshace un avance borrándolo en Movimientos.
- Los avances no se recategorizan: en Movimientos aparecen como "Apartado" y en color neutro.
- La API lee `goal_id`: en producción la migración `20261027000000` debe aplicarse **antes** de desplegar esta API (runbook, sección 9).

## D-014 · Texto nuevo del consentimiento de IA y política 2026-10-v2 (SEC-05)
**Fecha:** 2026-10-27 (texto aprobado por el founder)
**Decisión:** el consentimiento "Respuestas con IA" dice lo que el código hace de verdad:
- Se envía al proveedor de IA el mensaje del chat, sin correo, teléfono, DNI, RUC, cuentas ni tarjetas.
- Si la pregunta es sobre la plata, también se envían las cifras que Nina ya calculó; nunca los movimientos uno por uno.
- El proveedor no usa estos datos para entrenar.
- Nina guarda las conversaciones en la cuenta.

La política sube a `2026-10-v2`: todos vuelven a ver el consentimiento, sin nada preseleccionado. Además, `allowsAi` solo cuenta un consentimiento dado bajo la versión vigente, así que no se llama al LLM hasta que la persona responda de nuevo.

**Por qué:** el texto anterior ("solo cifras ya calculadas… no se guardan") no reflejaba que se envía el mensaje ni que Nina guarda el chat (QA_REPORT Q-10).

**Consecuencias:**
- El historial v1 se conserva: la tabla es de solo inserción.
- El seed local quedó en v2, para que las cuentas sintéticas sigan entrando sin pasos extra.
- **Pendiente del founder:** confirmar que la cuenta del proveedor (OpenAI) no tiene activado el uso de datos para entrenamiento. Si lo tuviera, hay que quitar esa frase y subir la versión otra vez.

## D-013 · Conversación abierta con LLM, sin cifras (CI-01)
**Fecha:** 2026-10-27 (aprobada por el founder)
**Decisión:** cuando ningún handler determinista responde (saludos, educación financiera, temas que no son de plata), Nina puede responder con el LLM usando el prompt `chat-open-v1`, con cuatro condiciones:
- Solo con consentimiento de IA y fuera del modo calma.
- Al LLM solo va el mensaje del usuario, redactado y marcado como no confiable. No van hechos del motor, memoria ni contexto, y no se guarda la conversación.
- `open-validator.ts` rechaza cualquier dígito, `S/`, `$`, `US$`, `%`, número escrito (cien, mil, millón, lucas), consejo prohibido (invertir, cripto, préstamos, garantías, "muevo tu dinero") o fuga de instrucciones.
- Hay un reintento. Si falla o no hay LLM, vuelve la respuesta determinista (fail-closed).

**Por qué:** las respuestas fijas se sentían robóticas para saludos y dudas básicas. Este camino envía menos datos que las consultas con cifras, que además mandan los hechos del motor.

**Consecuencias:**
- La ayuda ("¿qué puedes hacer?") sigue siendo determinista.
- Una pregunta que solo menciona un periodo ("¿quién ganó el partido ayer?") ya no se lee como pregunta de gastos.
- Las sugerencias del LLM se limitan a lo que Nina sabe responder.

## D-012 · El chat recuerda la conversación con un token firmado, no con memoria del servidor
**Fecha:** 2026-10-26
**Decisión:** cada respuesta del chat incluye un `context` firmado (HMAC, 30 min, atado al usuario) con lo que Nina pidió (monto, precio, detalles de meta), la última pregunta de datos y la meta mencionada en la conversación. La app lo devuelve con el siguiente mensaje.
**Por qué:** la regla de arquitectura prohíbe guardar estado por usuario en memoria del proceso; un token firmado es sin estado, expira y no necesita migración.
**Alternativas:** tabla `chat_sessions` (requiere migración y aprobación); enviar el historial completo al LLM (más datos al proveedor, choca con "enviar lo mínimo").
**Consecuencias:** la memoria dura una conversación (30 min). Recordar preferencias entre sesiones queda en el backlog (CI-02) y necesita decisión del founder. El contexto nunca se envía al LLM.

## D-011 · Las conversaciones de principiante se responden sin LLM
**Fecha:** 2026-10-26
**Decisión:** "no entiendo / más simple", "¿cuál es la diferencia entre ahorrar y que me sobre?", compras impulsivas, "acuérdate que ahorro para…", "ayúdame a ahorrar", "¿me alcanza para…?" y "¿puedo gastar lo que tengo en la cuenta?" se responden con un handler determinista (`ConversationHandler`) con la voz de Nina. Toda cifra sale del motor.
**Por qué:** antes caían en "No entendí". Usar el LLM para conversación abierta es un cambio del flujo de datos hacia el LLM, que según CLAUDE.md requiere aprobación.
**Consecuencias:** respuestas confiables pero con variedad limitada. Abrir un camino LLM para conversación sin cifras (con validador que rechace números) está en el backlog como CI-01, bloqueado por decisión del founder.

## D-010 · "¿Me alcanza?" no simula la compra
**Fecha:** 2026-10-26
**Decisión:** con el precio, Nina muestra lo que queda del mes (motor) y las metas activas del usuario; no calcula "te quedarían S/ X" después de la compra.
**Por qué:** el simulador what-if está fuera del alcance de octubre (CLAUDE.md). Restar el precio sería una segunda fuente de cálculo fuera del motor.
**Consecuencias:** la persona hace la resta mental. Mostrar el número "después de la compra" se decide con el what-if en noviembre (INS-06).

## D-009 · Semántica de colores
**Fecha:** 2026-10-26 (aprobada por el founder)
**Decisión:**
- **Gastos:** neutros (cacao sobre crema o blanco). Un gasto normal no es una alerta.
- **Ingresos:** verde, solo para entradas de plata y mejoras verificadas.
- **Rojo:** solo para alertas reales: disponible negativo, error verificado, sobregasto según reglas del usuario, riesgo respaldado por datos.
- **Marca:** chocolate (marca y texto fuerte), crema (fondo), durazno (calidez), violeta (Nina, insights, interacción).
**Por qué:** si todo gasto es rojo, el rojo deja de significar "problema" y genera culpa, contrario a la voz de Nina.
**Consecuencias:** las tarjetas del chat ya no marcan los gastos como negativos; el lima de la guía queda reservado para logros de metas cuando exista ese momento en la UI (no se agregó un token nuevo todavía).

## D-008 · Principios de conversación de Nina
**Fecha:** 2026-10-26
- Lenguaje de todos los días: nada de "cash flow", "liquidez", "superávit", "gasto discrecional", "runway".
- Sassy con medida: "bestie", "amiga", "reality check" de vez en cuando, nunca en cada respuesta, nunca sobre dificultades económicas.
- Modos: juguetón (gasto cotidiano), celebración (logros), directo (contradicción con una meta), apoyo (angustia, deudas, miedo a no llegar).
- Una pregunta a la vez cuando falta un dato; nunca inventar cifras ni memoria.
- Las sugerencias (chips) están en primera persona: lo que el usuario tocaría.
- El saludo de Inicio es "Hey, <nombre>"; el resto de la app sigue en español peruano.

## D-007 · Pronósticos fuera hasta noviembre
**Fecha:** 2026-10-26
**Decisión:** "¿cuánta plata voy a tener el próximo mes?" responde que todavía no proyecta y muestra lo que sí sabe (disponible del mes).
**Por qué:** forecast completo está fuera de octubre (CLAUDE.md); el código de forecast existe pero no se expone al usuario.

## D-006 · Nina v2: tema claro y navegación de 5 pestañas
**Fecha:** 2026-10-25
**Decisión:** Inicio · Movimientos · Nina · Metas · Espacio; Análisis y Presupuesto salen de la app; precios detrás de `NINA_PRICING_PREVIEW`; sin Apple/Google hasta configurarlos en Supabase.
**Consecuencias:** ver `CHANGELOG.md` (2026-10-25).
