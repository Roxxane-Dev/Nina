# Backlog de producto (canónico)

Estados: **Done** · **In Progress** · **Todo** · **Blocked** · **Needs Verification** (existe en código pero falta probarlo de verdad).
Prioridad: **P0** crítico · **P1** alto · **P2** medio · **P3** futuro.
"Done" exige evidencia (test o prueba registrada); que exista una pantalla no basta.

Última revisión: 2026-10-27 (rama `feature/chat-conversational`, sin merge).

---

## 1. Capacidades existentes

| ID | Título | Área | Prioridad | Estado | Evidencia / siguiente acción |
|---|---|---|---|---|---|
| EX-01 | Login, registro, código de correo y recuperar contraseña | Auth | P1 | Needs Verification | Tests de widgets y de rutas (`router_redirect_test`, `signup_page_test`). Falta probar en un dispositivo el correo real de confirmación. |
| EX-02 | Consentimiento antes de usar la app | Privacidad | P0 | Done | `consent_test.dart`; `ConsentGate` también protege Primeros pasos. |
| EX-03 | Registro manual de movimientos (con espacio) | Movimientos | P1 | Done | `add_transaction_sheet_test.dart`, smoke API 2026-10-26. |
| EX-04 | Categorización y corrección que Nina recuerda | Movimientos | P1 | Done | Sprint B (11 oct), tests API. |
| EX-05 | Disponible del mes + "Cómo calculé esto" | Motor / Inicio | P0 | Done | `overview-audit.spec.ts`, `audit_test.dart`, smoke API (4,500 − 1,460 = 3,040). |
| EX-06 | Chat con cifras del motor y validador fail-closed | Chat | P0 | Done | `validator.spec.ts`, `chat.regression.spec.ts`. |
| EX-07 | Modo calma (deudas, pérdida de ingresos, angustia) | Chat | P0 | Done | `calm-mode.spec.ts`. |
| EX-08 | Plan de meta en el chat y oferta de guardarla | Chat / Metas | P1 | Done | `goal-plan.spec.ts`, escenarios K y M. |
| EX-09 | Espacios compartidos (crear, invitar, unirse, salir, saldo) | Espacios | P1 | Done | `spaces.spec.ts`, `spaces_test.dart`, RLS `supabase/tests`. |
| EX-10 | Cuentas (banco, efectivo, tarjeta) | Movimientos | P2 | Done | `accounts_test.dart`. |
| EX-11 | Pantalla Metas + `GET /v1/goals` | Metas | P1 | Needs Verification | `goals.spec.ts`, `goals_screen_test.dart`. Falta recorrido en la UI real. |
| EX-12 | Rediseño Nina v2 (tema, 5 pestañas, primeros pasos) | Diseño | P1 | Needs Verification | 88 tests Flutter. Recorrido visual completo pendiente (QA-01). |
| EX-13 | Pantalla de planes detrás de `NINA_PRICING_PREVIEW` | Monetización | P3 | Done | Apagada por defecto; precios de ejemplo. |

## 2. Rediseño del chat

| ID | Título | Prioridad | Estado | Criterios de aceptación | Evidencia / siguiente acción |
|---|---|---|---|---|---|
| CHAT-01 | Nina entiende a un principiante | P1 | Done | Los 13 escenarios de Alex responden con sentido, sin inventar cifras. | `CHAT_TEST_REPORT.md` (corrida final). |
| CHAT-02 | Contexto entre mensajes (token firmado) | P1 | Done | "7000 dólares", "cuestan 350", "más simple" completan el turno anterior. | Escenarios B, H, I, K; tests del subagente. |
| CHAT-03 | Reintentar sin perder la conversación | P1 | Done | Un error muestra "Reintentar", que reenvía el mismo texto. Un 401 no ofrece reintento. | Tests de `ChatBloc`. |
| CHAT-04 | Sugerencias para empezar | P1 | Done | Chips de principiante en el saludo. | `chat_bloc.dart`. |
| CHAT-05 | Sugerencias según los datos del usuario (sin datos → registrar primero) | P2 | Todo | Los chips cambian si no hay movimientos, si hay una meta, etc. | Depende de un endpoint liviano de "estado". |
| CHAT-06 | Respuesta en streaming | P2 | Todo | El texto aparece mientras llega. | Hoy es REST. Se necesita SSE/WebSocket en `/chat` y validar las cifras al final. |
| CHAT-07 | Verificación visual del chat en la app | P1 | Done | Se ven las burbujas, tarjetas, confirmación y chips. | `QA_REPORT.md`. El reintento solo está cubierto por tests. |
| CHAT-08 | Acciones dentro de las tarjetas (ver movimientos, guardar meta) | P2 | Todo | Cada tarjeta trae una acción útil. | Diseño en Figma pendiente (FIG-01). |

## 3. Inteligencia conversacional

| ID | Título | Prioridad | Estado | Siguiente acción |
|---|---|---|---|---|
| CI-01 | Conversación abierta con LLM, sin cifras (validador que rechace números) | P1 | Done | Aprobada (D-013). `open-conversation.spec.ts` (34 tests) y escenarios N–U en `CHAT_TEST_REPORT.md`. Falta verla en la UI (QA-01). |
| CI-02 | Memoria entre sesiones (metas mencionadas, estilo preferido) | P2 | Blocked | Requiere migración, consentimiento y decisión del founder (D-012). |
| CI-03 | Banco de frases reales como tests de regresión | P1 | In Progress | Ya existe `scripts/chat-scenarios.js`. Falta sumar cada fallo nuevo. |
| CI-04 | "Compré algo que no necesitaba" se registra como Otros, no Compras | P2 | Done | La causa era general: en "gasté 80 soles en X" el parser tomaba "soles" como categoría. |
| CI-05 | Nombres con tilde ("Japon" → "Japón") | P3 | Done | Diccionario corto en `goal-plan.ts`. |
| CI-06 | Variedad de respuestas deterministas (no repetir la misma frase) | P2 | Todo | Varias versiones por respuesta, con semilla por turno. |

## 4. Insights e indicadores

| ID | Título | Prioridad | Estado | Siguiente acción |
|---|---|---|---|---|
| INS-01 | Próximos compromisos (pagos recurrentes conocidos) | P1 | Todo | El motor ya detecta recurrencias. Falta decidir cómo exponerlas sin pronóstico. |
| INS-02 | Tendencia de gasto vs. mes anterior en el chat | P2 | Done (parcial) | Ya está en las respuestas de resumen. Falta una tarjeta propia. |
| INS-03 | Saldo proyectado a fin de mes | P2 | Blocked | Pronóstico fuera de octubre (D-007). |
| INS-04 | Componente reutilizable de insight en la app | P2 | Todo | Título, observación, cifras, comparación, confianza y acción. |
| INS-05 | Avance de metas en el chat ("¿cómo voy con Japón?") | P2 | Todo | Reusar `goalPlanView`. |
| INS-06 | "Te quedarían S/ X" después de una compra | P2 | Blocked | Es what-if: noviembre (D-010). |

## 5. Inicio y navegación

| ID | Título | Prioridad | Estado | Evidencia / siguiente acción |
|---|---|---|---|---|
| HOME-01 | Saludo "Hey, <nombre>" | P2 | Done | `home_screen.dart`. |
| HOME-02 | Registrar avances en una meta ("aparté S/ 200 para Japón") | P1 | Done | D-015. Migración aplicada en producción. |
| HOME-04 | Retirar plata de una meta | P2 | Done | D-017. Aplicado en producción. |
| HOME-05 | Retirar de una meta desde el chat ("saqué 200 de Japón") | P3 | Todo | Hoy solo desde Metas. |
| HOME-03 | Editar un movimiento (monto, descripción, fecha) | P1 | Done | `PATCH /v1/transactions/:id` y hoja "Editar movimiento". Un avance no cambia de categoría. Falta revisarlo en pantalla. |
| NAV-01 | Filtros de Movimientos compactos (una fila + hoja) | P1 | Done | `movimientos_screen.dart`; tests del subagente. |
| FIG-01 | Figma: Movimientos, Añadir, Metas, Espacio, Perfil y prototipo | P2 | Needs Verification | Pantallas y prototipo creados el 2026-11-01 (78 enlaces, ninguno faltante). Falta verlos renderizados: el plan Starter cortó antes de la captura. "Editar movimiento" no está en Figma. |

## 6. Motor y pronósticos

| ID | Título | Prioridad | Estado |
|---|---|---|---|
| ENG-01 | Pronóstico completo | P2 | Todo (noviembre) |
| ENG-02 | Puntaje explicable | P2 | Todo (noviembre) |
| ENG-03 | Simulador what-if | P2 | Todo (noviembre) |

## 7. Conexiones de datos

| ID | Título | Prioridad | Estado |
|---|---|---|---|
| DATA-01 | Importar CSV | P2 | Done (sin verlo en pantalla ni probarlo con un archivo real de banco) |
| DATA-02 | Importar EECC en PDF | P2 | Needs Verification | Tarjeta BCP (D-020). Falta probar con el PDF real: el formato salió de una imagen de la página 1. |
| DATA-03 | Conexiones bancarias | P3 | Todo (V2) |

## 8. Seguridad y privacidad

| ID | Título | Prioridad | Estado | Siguiente acción |
|---|---|---|---|---|
| SEC-01 | Aplicar las migraciones pendientes en producción | P0 | Done | Aplicadas en Finzenn el 2026-11-01 (D-019): 20 tablas, 147 columnas, RLS activa en todas y datos intactos. |
| SEC-02 | Revisar y hacer merge de las ramas pendientes (calm-mode-final, log-hygiene, remove-unwired-behavioral, prod-runbook, local-seed-verify) | P1 | Needs Verification | Revisión del founder. |
| SEC-03 | Rotar las claves pendientes (weekly-log) | P0 | Needs Verification | Confirmar con el founder. |
| SEC-04 | Exportar mis datos | P2 | Done | D-019: `GET /v1/me/export` y botón en Privacidad. Falta verlo en pantalla. |
| SEC-06 | Borrar mi cuenta | P2 | Blocked | Sin aprobar (D-019). Antes hay que definir qué pasa con espacios compartidos y dar cascada a `budgets`. |
| SEC-07 | Trigger de registro también en local | P3 | Todo | `on_auth_user_created` solo existe en producción. |
| SEC-05 | El texto del consentimiento de IA debe decir que también se envía el mensaje del usuario (sin datos personales), no solo cifras | P0 | Done | D-014: texto aprobado, política `2026-10-v2` e IA solo con consentimiento vigente. Tests en `consents.spec.ts` y `consent_test.dart`; revisado en pantalla. Falta que el founder confirme la configuración de entrenamiento en OpenAI. |

## 9. Pruebas y confiabilidad

| ID | Título | Prioridad | Estado | Siguiente acción |
|---|---|---|---|---|
| QA-01 | Recorrido visual completo de la app en el navegador o dispositivo | P1 | Done | `docs/QA_REPORT.md`: 9 defectos corregidos y 2 abiertos (Q-10, Q-11). Falta un dispositivo real. |
| NOTIF-01 | Avisos de Nina dentro de la app | P1 | Done | D-018. Falta verlos en pantalla. |
| NOTIF-02 | Notificaciones push con la app cerrada | P2 | Todo | Requiere un proyecto de Firebase del founder y una tarea programada. |
| QA-02 | Correo de confirmación real en el dispositivo | P1 | Todo | Supabase de desarrollo con confirmación activa. |
| QA-03 | Escenarios de principiante automatizados | P1 | Done | `scripts/chat-scenarios.js` + `CHAT_TEST_REPORT.md`. |

## 10. Futuro

| ID | Título | Prioridad | Estado |
|---|---|---|---|
| FUT-01 | Nina Agent (acciones autorizadas vía BaaS) | P3 | Todo |
| FUT-02 | Nina Wallet | P3 | Todo |
| FUT-03 | Nina Negocio (mypes) | P3 | Blocked (decisión del founder) |
