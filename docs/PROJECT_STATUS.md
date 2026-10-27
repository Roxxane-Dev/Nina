# Estado del proyecto — Nina

Actualizado: 2026-10-27. Léelo al empezar una sesión. El detalle está en `PRODUCT_BACKLOG.md`; las decisiones, en `DECISIONS.md`.

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
- Metas con el plan del motor.
- Espacios compartidos, cuentas, perfil y privacidad.

## Hito actual
MVP "Claridad de tu plata", con el chat como prioridad.

## Cambios recientes (detalle en `CHANGELOG.md`)
- **2026-10-25:** rediseño Nina v2 y `GET /v1/goals` (rama `feature/nina-v2-ui`, sin merge).
- **2026-10-26:** chat conversacional, contexto firmado, reintento, "Hey", filtros compactos (rama `feature/chat-conversational`, creada desde la anterior, sin merge).
- **2026-10-27:** conversación abierta con LLM sin cifras (CI-01), en la misma rama.

## En curso
- Nada en curso. La rama `feature/chat-conversational` espera revisión.

## Defectos conocidos
- CI-04: "compré algo que no necesitaba" se registra como Otros, no como Compras.
- CI-05: los nombres de lugares pierden la tilde ("Japon").
- QA-01: el recorrido visual completo no se ha hecho; solo hay tests de widgets y pruebas por API.

## Bloqueos
- **Decisiones del founder:**
  - CI-02: memoria entre sesiones.
  - INS-06: número después de una compra, que es what-if.
- **Figma (FIG-01):** límite del plan Starter; se retoma en noviembre.
- **Producción (SEC-01):** las migraciones las aplica el founder.

## Próximas tareas recomendadas
1. **QA-01:** recorrer la app en el navegador o un emulador con Supabase local y corregir lo visual.
2. **HOME-02:** registrar avances en una meta. Sin esto, el progreso de las metas nunca se mueve.
3. **D-2 del reporte de pruebas:** ajustar el prompt de las respuestas con cifras para que recomiende sobre la categoría más alta y escriba sin errores de gramática.

## Cómo correr todo en local
Ver `docs/LOCAL-DEV.md`. Escenarios del chat: `node scripts/chat-scenarios.js . <etiqueta>`, con el backend local corriendo.
