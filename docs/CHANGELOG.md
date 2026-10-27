# Changelog

Cambios con impacto para el usuario o la arquitectura. No registra cada edición.

## 2026-10-27 — Conversación abierta sin cifras (CI-01, rama `feature/chat-conversational`)

**Lo que nota el usuario**
- Saludos, preguntas de educación financiera ("¿qué es el interés?"), temas que no son de plata e intentos de saltarse las reglas reciben una respuesta natural de Nina, en vez de "Eso se me escapa". Solo pasa con consentimiento de IA y nunca en modo calma.
- "¿Quién ganó el partido ayer?" ya no responde "no tengo movimientos ayer".

**Técnico**
- `src/nina-router/open-validator.ts` rechaza cualquier dígito, moneda, %, número escrito, consejo prohibido o fuga de instrucciones.
- Prompt `CHAT_OPEN_PROMPT_V1` (`chat-open-v1`).
- `NinaRouterService.converse()`:
  - Envía solo el mensaje redactado y marcado como no confiable.
  - No usa memoria ni guarda la conversación.
  - Reintenta una vez; si no valida, es fail-closed.
- `GeneralHandler` lo usa para `other` y `unknown_finance`. Sin respuesta validada, vuelve a la respuesta determinista.
- Motor: un periodo dentro de una pregunta larga que no es de plata ya no se convierte en una pregunta de gastos.

**Verificación**
- jest 506/506, incluye `open-conversation.spec.ts` con 34 tests.
- 21 escenarios contra el chat real local (`CHAT_TEST_REPORT.md`).

## 2026-10-26 — Chat conversacional (rama `feature/chat-conversational`)

**Lo que nota el usuario**
- Nina entiende preguntas de principiante que antes caían en "No entendí":
  - "¿puedo gastar lo que tengo en la cuenta?"
  - "me preocupa no llegar a fin de mes"
  - "¿diferencia entre ahorrar y que me sobre?"
  - "me compré otra cosa jaja"
  - "acuérdate que ahorro para un viaje"
  - "ayúdame a ahorrar"
  - "¿me alcanza para unas zapatillas?"
  - "explícamelo más simple"
- "Quiero viajar a Japón en enero 2028" ya no se lee como gastos de enero 2026. Se lee como plan de meta y, si falta el monto, Nina lo pide.
- Las respuestas de seguimiento ("7000 dólares", "cuestan 350") completan la pregunta anterior.
- "Registra mi meta japón 2028…" guarda "Japon" para diciembre 2028 y lo dice. Los montos salen con separador de miles.
- "¿Cuánta plata voy a tener el próximo mes?" dice con honestidad que todavía no proyecta y muestra lo que sí sabe.
- Si falla el envío, aparece "Reintentar" y la conversación se mantiene.
- Saludo "Hey, <nombre>" en Inicio y nuevas sugerencias para empezar en el chat.
- Movimientos: una sola fila de periodo y un botón "Filtros" que abre una hoja con tipo, cuenta y categoría.
- Las tarjetas del chat ya no pintan los gastos de rojo.

**Técnico**
- Motor (`packages/finance-engine`):
  - `PeriodRange.future`.
  - Un año explícito gana en los periodos.
  - `resolveQuestion` envía los planes con fecha futura a `goal_plan` y "próximo mes" a `forecast`.
  - Patrones nuevos en `intent.ts`.
  - `GoalRequest.deadlineYearOnly` y nombre de meta desde "mi meta X".
- Chat (`src/chat`):
  - `conversation-context.ts`: `ContextTokens` (HMAC, 30 min, separado de las confirmaciones).
  - `intents/conversation.handler.ts`.
  - `completeWithContext`.
  - Modo calma `worry`.
  - El controlador acepta `context`.
- Router LLM: `looseAnswer` evita que se filtren las etiquetas del JSON; prompt `chat-v5` sin jerga y con sugerencias en primera persona.
- Metas: el texto de confirmación usa `formatSoles` e indica cuando solo se dio el año.
- App:
  - `ChatBloc` guarda y envía `context`.
  - Evento `ChatRetryRequested` y `ChatMessage.retryText`.
  - `MessageBubble` con botón de reintentar.
  - Hoja de filtros en `MovimientosScreen`.
- Script local `scripts/chat-scenarios.js`: 13 escenarios contra el backend local; se niega a correr contra un Supabase que no sea local.

**Verificación**
- `npm test`: 472/472, con tests nuevos de frases, `ContextTokens`, conversación de varios turnos y `looseAnswer`.
- `flutter test`: 98/98, con tests nuevos de contexto, reintento, hoja de filtros y saludo "Hey".
- `flutter analyze` sin errores.
- Un bug encontrado por los tests: `looseAnswer` dejaba los `**` de una etiqueta en negrita. Corregido en `d066401`.
- Escenarios de principiante contra el chat real local (LLM real, cuenta sintética): ver `CHAT_TEST_REPORT.md`.

## 2026-10-25 — Nina v2 (rama `feature/nina-v2-ui`)
- Tema claro (crema, cacao, durazno, violeta), Epilogue + Inter y componentes compartidos.
- Bienvenida, registro con código, inicio de sesión, recuperar contraseña y primeros pasos (nombre, metas, ingreso, fijos, espacio, primer número).
- Pestañas Inicio · Movimientos · Nina · Metas · Espacio. Pantallas nuevas: Metas y Espacio.
- `GET /v1/goals` con el plan del motor sobre lo que falta ahorrar.
- Se eliminaron Análisis, Presupuesto y el onboarding con cifras inventadas.
- Verificación: 88 tests Flutter y 429 jest. Smoke API del flujo completo contra Supabase local.
