# Decisiones de producto e ingeniería

Registro corto de decisiones que cambian cómo se construye Nina. Las más nuevas arriba.

---

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
