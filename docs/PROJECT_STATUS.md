# Estado del proyecto — Nina

Actualizado: 2026-11-01. Léelo al empezar una sesión. El detalle está en `PRODUCT_BACKLOG.md`; las decisiones, en `DECISIONS.md`.

## Visión
Nina es una compañera de inteligencia financiera personal para Perú (es-PE, S/). Entiende tu plata, te la explica en simple y te dice el siguiente paso. Fase actual: **Nina Intelligence**, que nunca mueve dinero. El MVP vence el **2026-10-31**.

## Arquitectura (verificada en el repo)
- **App:** Flutter + BLoC + go_router (`nina_app/`), tema Nina v2 (`core/theme`), componentes en `shared/widgets/nina_ui.dart`.
- **API:** NestJS (`src/`), todo protegido con `SupabaseAuthGuard`.
- **Motor:** paquete puro `packages/finance-engine`. Es la única fuente de cifras.
- **Chat:**
  - Un handler determinista por intención: confirmación → conversación → plan de meta → registros → consultas → general.
  - El LLM (OpenAI vía `AIService`) solo explica hechos del motor. El validador rechaza cifras que no salen del motor.
  - Contexto de conversación en un token firmado (D-012).
  - Conversación abierta sin cifras con el LLM, solo con consentimiento y fuera del modo calma (D-013).
- **Datos:** Supabase con RLS. Las migraciones van solo en `supabase/migrations/`, y se desarrolla con Supabase local.

## Qué hace hoy la app
Registro e inicio de sesión, consentimiento y primeros pasos. Además:
- Inicio con el disponible del mes y "Cómo calculé esto".
- Movimientos con filtros compactos, y añadir movimiento a Personal o al espacio.
- Chat con contexto, modo calma y planes de meta.
- Metas con el plan del motor, avances ("Registrar avance" o desde el chat) y retiros.
- Espacios compartidos, cuentas, perfil y privacidad.

## Hito actual
MVP "Claridad de tu plata", con el chat como prioridad.

## Cambios recientes (detalle en `CHANGELOG.md`)
- **2026-10-25:** rediseño Nina v2 y `GET /v1/goals` (rama `feature/nina-v2-ui`, sin merge).
- **2026-10-26:** chat conversacional, contexto firmado, reintento, "Hey", filtros compactos (rama `feature/chat-conversational`, creada desde la anterior, sin merge).
- **2026-10-27:** conversación abierta con LLM sin cifras (CI-01), en la misma rama.
- **2026-10-28:** avances en metas (HOME-02); lo apartado resta del disponible (rama `feature/goal-contributions`, creada desde la anterior, sin merge).

## En curso
- Nada en curso. Esperan revisión `feature/chat-conversational` y `feature/goal-contributions` (esta va encima de la anterior).

## Defectos conocidos
- Q-11: en Movimientos, los nombres largos se cortan.

## Bloqueos
- **Decisiones del founder:**
  - CI-02: memoria entre sesiones.
  - INS-06: número después de una compra, que es what-if.
  - Confirmar que la cuenta de OpenAI no usa los datos para entrenar (D-014).
- **Figma (FIG-01):** pantallas y prototipo creados; falta revisarlos a ojo en Figma (el plan Starter cortó antes de la captura).
- **Producción (SEC-01):** las migraciones las aplica el founder. `20261027000000` va antes del despliegue de la API (runbook §9).

## Próximas tareas recomendadas
1. **D-2 del reporte de pruebas:** ajustar el prompt de las respuestas con cifras (recomendar sobre la categoría más alta, sin errores de gramática).
2. **QA-02:** probar en un teléfono real, con el correo de confirmación activo.

## Cómo correr todo en local
Ver `docs/LOCAL-DEV.md`. Escenarios del chat: `node scripts/chat-scenarios.js . <etiqueta>`, con el backend local corriendo.
