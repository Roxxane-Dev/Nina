# Changelog

Cambios con impacto para el usuario o la arquitectura. No registra cada edición.

## 2026-11-01 — Importar CSV (DATA-01)
- Movimientos e Inicio de primeros pasos permiten subir el CSV del banco. Nina muestra lo que leyó antes de guardar.
- Entiende `;` o `,`, títulos sobre la cabecera, `1.234,56` o `1,234.56`, y columnas de monto o de cargo y abono.
- Subir el mismo archivo dos veces no duplica. Las filas en dólares no se importan por ahora.
- El archivo no pasa por IA ni se guarda. No requiere migración.
- **Bug corregido:** el motor solo leía 1,000 movimientos por usuario o espacio, porque Supabase corta cada respuesta sin avisar. Con un CSV grande, Inicio y el chat habrían calculado mal. Ahora lee todo el historial por páginas.

## 2026-11-01 — Producción migrada (Finzenn)
- Se aplicaron las 12 migraciones pendientes en una transacción: 7 tablas nuevas, 3 columnas en `transactions` y 4 categorías del sistema.
- Se conservaron 3 usuarios, 7 movimientos, 1 meta y 44 mensajes.
- Se cerró la entrada legada que dejaba insertar movimientos en espacios o cuentas ajenas.
- `GET /v1/me/export` y "Exportar mis datos" en Privacidad.

## 2026-11-01 — Avisos de Nina (NOTIF-01)
- Campana en Inicio con avisos: fin de semana, suscripciones, Navidad, ingreso faltante, pagos que se vienen, categoría movida y metas.
- Los textos usan cifras del motor, sin LLM. Con sobregasto real, Nina no bromea.
- `render.yaml` para publicar la API en Render.
- **Base de datos (solo local):** `20261102000000_nudge_dismissals.sql`.

## 2026-11-01 — Editar movimientos y retirar de una meta (HOME-03, HOME-04)
- **Movimientos:** tocar un movimiento abre "Editar movimiento": monto, descripción, fecha y categoría. Un avance de meta no cambia de categoría.
- **Metas:** "Retirar" devuelve plata al disponible, baja el avance y nunca cuenta como ingreso (D-017).
- **Inicio:** si el disponible sale negativo solo por lo apartado, va en color neutro (D-016).
- **Chat:** "gasté 80 soles en X" ya no toma "soles" como categoría (CI-04), y los lugares comunes llevan tilde (CI-05).
- **Base de datos (solo local):** `20261101000000_goal_withdrawals.sql`.

## 2026-10-28 — Avances en metas (HOME-02, rama `feature/goal-contributions`)
- **Metas:** cada meta tiene "Registrar avance". El progreso ya se mueve: monto inicial + avances.
- **Chat:** "aparté 200 para Japón", "le puse 150 a mi meta laptop" piden confirmación y anotan el avance. Sin metas, con un nombre que no existe o con varias metas posibles, Nina pregunta en vez de adivinar.
- **Disponible:** lo apartado resta del disponible y no cuenta como gasto (D-015).
  - "¿Cuánto me queda?" dice cuánto apartaste.
  - Inicio muestra "Apartado".
  - "Cómo calculé esto" muestra "− Apartado para metas".
- **Movimientos:** los avances se ven como "Apartado · <meta>" en color neutro.
- **Base de datos (solo local):** `transactions.goal_id` con RLS y CHECK (`20261027000000_goal_contributions.sql`).
- **Mes sin movimientos (recorrido del 2026-11-01):** Inicio dice "Sin movimientos" y "Sin gastos registrados en <mes>". Si el disponible sale negativo solo por lo apartado, Nina responde desde el motor, sin LLM (prompt `chat-v6`).
- **Verificación:**
  - RLS local: 5/5.
  - jest 548/548.
  - Flutter 104/104.
  - API local probada: 400 / 404 / 401 / 201.
  - Recorrido en pantalla (`QA_REPORT.md`).

## 2026-10-27 — Consentimiento de IA, política 2026-10-v2 (SEC-05)
- "Explicaciones con IA" pasa a ser **"Respuestas con IA"**, con un texto que dice lo que de verdad se envía (el mensaje sin datos personales y, si aplica, las cifras del motor) y que Nina guarda las conversaciones.
- `POLICY_VERSION` sube a `2026-10-v2`: todos vuelven a decidir, sin nada preseleccionado.
- `allowsAi` exige un consentimiento de la versión vigente.
- El seed local pasa a v2.
- **Verificación:**
  - jest 507/507 (nuevo test de cambio de versión).
  - Flutter 99/99 (nuevo test del texto).
  - En pantalla, la cuenta de prueba que aceptó la v1 vuelve a ver el consentimiento con el texto nuevo.

## 2026-10-27 — Revisión visual QA-01 (rama `feature/chat-conversational`)

**Arreglos visibles**
- "Movimientos" ya no se corta en la barra.
- Las acciones rápidas de Inicio tienen el mismo alto.
- Las hojas (Cómo calculé, Filtros, Añadir) quedan encima de la barra, y "Guardar" se ve.
- El campo del chat tiene un solo borde y sigue activo mientras Nina responde.
- Al confirmar se muestra "Sí, dale" / "No, gracias".
- Una meta sin fecha dice "Sin fecha".
- El botón "ver cómo" del primer número se lee bien.
- Perfil abierto desde un enlace tiene flecha a Inicio.

**Verificación:** recorrido en pantalla (ver `QA_REPORT.md`) y `flutter test` 98/98.

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
