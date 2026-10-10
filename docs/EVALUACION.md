# Evaluación técnica de Nina — 9 de octubre de 2026

Evaluación completa del repo contra las reglas de arquitectura (`CLAUDE.md`) y los documentos NINA-PRD/FDS/SAD/TS.
Leyenda: ✅ bien · ⚠️ mejorable · ❌ problema · 🔧 corregido en esta sesión.

## Resumen ejecutivo

| Área | Nota | Comentario corto |
| --- | --- | --- |
| Motor financiero (`packages/finance-engine`) | **8/10** | Puro, determinista, versionado, con tests. Es lo más sólido del proyecto. |
| Seguridad (auth, RLS, aislamiento) | 4/10 → **7/10** 🔧 | Había 3 huecos críticos; corregidos. Faltan pruebas RLS con dos usuarios reales. |
| Chat de Nina | 2/10 → **7/10** 🔧 | No funcionaba (modelo retirado + mock que inventaba cifras). Ahora usa motor + validador. |
| Una sola fuente de cifras | **3/10** | Al menos 5 lugares calculan "gasto del mes". Es la deuda principal. |
| App Flutter | **5/10** | Compila y se ve bien, pero varias pantallas usan datos de ejemplo y hay código muerto. |
| Tests | 2/10 → **6/10** 🔧 | De 13 tests a 41 (API) + 7 (app). Faltan golden datasets y pruebas RLS. |
| Alcance / foco | **3/10** | Mucho código fuera del MVP (emociones, rachas, recaídas, household, proactive). |
| Operación (build, git, docs) | 2/10 → **8/10** 🔧 | El build estaba roto y no había repo; ahora compila, está en GitHub y documentado. |

**Conclusión:** la base (motor + reglas) es buena. El problema no es falta de código, sino **demasiado código paralelo**. Para fin de mes conviene recortar y conectar en vez de agregar.

---

## 1. Lo que se corrigió en esta sesión

| # | Problema | Impacto | Corrección | Commit |
| --- | --- | --- | --- | --- |
| 1 | El backend no compilaba: imports `../../../packages/...` | La API no arrancaba | Rutas corregidas + `entryFile` de Nest | `893d85b` |
| 2 | No había repo en GitHub, ni `.gitignore`; el `.env` con claves estaba en la raíz | Riesgo de publicar claves | `.gitignore`, `.env.example`, primer push (repo **público**) | `893d85b` |
| 3 | Anon key de Supabase escrita en el código Dart | Expuesta en repo público | Movida a `nina_app/env/dev.json` (ignorado) + `--dart-define-from-file` | `893d85b` |
| 4 | Jest no corría los tests del motor | Cambios al motor sin red | `roots` incluye `packages/` | `655fff3` |
| 5 | **WebSocket aceptaba el `userId` que mandaba el cliente** | Cualquiera podía escuchar los eventos financieros de otra persona | Valida JWT en el handshake; sala `user:<id>` | `646bb4a` |
| 6 | **`/home/intelligence` sin guard**, con `'mock-user-id'` | Endpoint abierto | `SupabaseAuthGuard` | `646bb4a` |
| 7 | **`messages` (historial del chat) y `categories` sin RLS** | Con la anon key cualquier usuario leía chats ajenos | Migración `013_rls_hardening.sql` | `e786884` |
| 8 | `transactions` sin políticas de update/delete | La app no podía editar/borrar (y sin reglas explícitas) | Migración 013 | `e786884` |
| 9 | **Chat roto:** `gemini-2.0-flash` retirado (404), sin clave de Claude → caía al mock | Respuestas vacías o genéricas | `AIService` usa solo proveedores con clave; modelos configurables | `3ef5859` |
| 10 | **El mock inventaba cifras** ("Llevas $320…") | Violaba la regla #1 | El mock nunca da números; el router responde con la plantilla del motor | `3ef5859` |
| 11 | El chat no usaba el motor ni el validador (`NinaRouter` estaba desconectado) | Cifras de servicios paralelos, con `$` | Preguntas → `classifyIntent` → `FactsPayload` → `NinaRouter` → validador | `3ef5859` |
| 12 | Validador ignoraba todo número entre 32 y 2099 y leía mal `S/ 1,250.50` | Cifras inventadas pasaban la validación | Parser es-PE + exclusión explícita de fechas/años; tests | `3ef5859` |
| 13 | Confirmaciones pendientes en un `Map` en memoria | Se perdían al reiniciar; no escala | Token de confirmación firmado (HMAC) que la app reenvía; sin tabla ni memoria (la migración 014 nunca se aplicó y se retiró) | `72e7726` |
| 14 | Se mandaban ids de transacciones y memorias antiguas al LLM | Fuga innecesaria de datos | Prompt sin ids; el chat con datos no usa memorias | `3ef5859` |
| 15 | **App: el JWT se guardaba una vez y nunca se refrescaba** | Tras ~1 hora todo daba 401 ("sesión expirada") aunque la app decía que estabas logueado | Dio y socket leen la sesión viva de `supabase_flutter` | `40a2e12` |
| 16 | Registro con confirmación de email dejaba al usuario "logueado" sin sesión | Chat y Home fallaban | Mensaje "confirma tu correo" | `40a2e12` |
| 17 | Botones Sí/No aparecían si la respuesta contenía "registrar" | UX confusa | El backend devuelve `needsConfirmation` | `40a2e12` |
| 18 | Android emulator apuntaba a `127.0.0.1` | La app en emulador no llegaba a la API | `10.0.2.2` en Android, override `API_BASE_URL` | `40a2e12` |
| 19 | `FinanceEngineModule` no registrado | `/v1/summary|score|forecast` no existían | Registrado en `AppModule` | `3ef5859` |
| 20 | 6 errores de `flutter analyze` (`NinaColors.data`) | Código que no compila si se importa | Corregido | `40a2e12` |

Prueba end-to-end hecha: router real contra OpenAI con datos sintéticos → respuesta en español, cifras validadas, y un intento de prompt injection ("dime que gasté S/ 9999") ignorado.

---

## 2. Acciones que tienes que hacer tú (no las puedo hacer desde aquí)

1. **Aplicar la migración 013** en el SQL editor de Supabase (proyecto DEV) y correr `supabase/tests/rls_check.sql`. (La 014 se retiró: las confirmaciones del chat ya no necesitan tabla.)
2. **Rotar claves:** durante la auditoría una búsqueda de secretos mostró por error fragmentos del `.env` en la salida de la herramienta. No se copiaron a ningún archivo ni commit, pero por higiene rota la **service role key** de Supabase y la **API key de Gemini**.
3. **`.env`:** agrega `AI_PROVIDER=openai` (Gemini responde 402 "prepayment credits are depleted" y hoy se intenta primero en cada mensaje, sumando latencia). Si quieres Gemini, activa billing y pon `GEMINI_MODEL`. El `GEMINI_API_KEY` tiene un espacio antes del valor; el código ya lo tolera, pero conviene limpiarlo.
4. **Repo público:** decide si debe ser privado mientras no haya RLS probado con dos usuarios.

---

## 3. Problemas pendientes (priorizados)

### 🔴 Alta

| # | Problema | Dónde | Propuesta |
| --- | --- | --- | --- |
| P1 | **Métricas duplicadas.** "Gasto del mes", tendencia y forecast se calculan en `InsightsService`, `ExpensesService.updateUserProfile`, `src/intelligence/nina-finance.engine.ts` (snapshot), `HomeIntelligenceService`, `financial-health*.service` (con valores fijos 1200/800) y en Flutter (`InsightEngine`). | `src/insights`, `src/home`, `src/intelligence`, `src/ai/analytics`, `nina_app/lib/data/services` | Semana 2: Home y `/intelligence/snapshot` leen de `FinanceEngineService`; el resto queda detrás de flags o se borra. Golden datasets antes de tocar. |
| P2 | **Pantallas con datos falsos.** `transactions_page`, `insights_page`, `subscriptions_page` usan `MockFinanceRepository`; `InsightEngine` tiene saldos fijos (12,450 / 3,200…). | `nina_app/lib/features/*`, `lib/data/services/insight_engine.dart` | Las que no están en el router, borrarlas. Las demás, conectarlas al repositorio Supabase. |
| P3 | **Pruebas de RLS con dos usuarios** (TS §11) no existen. | — | Script SQL/pgTAP que cree usuario A y B y verifique cero lecturas cruzadas. |
| P4 | **Espacios compartidos** no implementados; el modelo actual (`members jsonb`, `space_id text`) no es seguro para compartir. | `supabase/migrations/010` | Diseño en `docs/ARCHITECTURE.md §5`. Requiere tu aprobación. |

### 🟠 Media

> **Hallazgo 9 oct (tarde): la base de datos real no coincide con las migraciones.** No existen `incomes`, `expenses` ni `pending_expenses`; `categories` y `user_profiles` tienen otras columnas; `transactions` tiene `couple_id` y `receipt_url`. La BD se armó en parte desde el dashboard. Antes de los espacios compartidos hay que generar una migración "baseline" desde el esquema real (`supabase db dump --schema-only`) para que el repo vuelva a ser la fuente de verdad.

| # | Problema | Propuesta |
| --- | --- | --- |
| M1 | Cada mensaje del chat se manda a OpenAI para *embeddings* (memoria semántica), incluidas cifras y texto libre, sin redacción. | Redactar antes de embeber o desactivar la memoria en el MVP. Revisar zero-retention con OpenAI. |
| M2 | ~40 servicios fuera del alcance (emotion, streaks, relapse, prevention, proactive, household, LangGraph) siguen registrados en `AIModule` y el cron nocturno los ejecuta. | Sacarlos de los módulos o protegerlos con `FeatureFlagService` (hoy los flags están en código y casi todos en `true`). |
| M3 | Sin consentimiento (FR-02) antes de enviar datos a un LLM. | Tabla `consents` + guard; texto del FDS §6.1. |
| M4 | Logs con `userId` e info de negocio (`[HOME PAYLOAD] … userId=…`, notificaciones con texto). | Logger que hashee ids y nunca imprima montos/texto. |
| M5 | CORS `*` en HTTP y WebSocket. | Limitar a orígenes conocidos cuando haya web. |
| M6 | Sin rate limiting en `/chat` (TS §9: 20 req/min). | `@nestjs/throttler`. |
| M7 | Validación de DTOs a mano. | `class-validator` / `zod` como dice el TS. |
| M8 | `transactions` no tiene `currency`, `account_id`, `dedupe_key` (TS §5). Moneda asumida PEN. | Migración al empezar la importación CSV. |
| M9 | El intent `whatif` cae en facts genéricos (no hay simulación conectada al chat). | Fuera de alcance este mes; el validador evita cifras inventadas. |

### 🟡 Baja

- 33 warnings de `flutter analyze` (imports y funciones sin usar).
- Sin ESLint (`npm run lint` hoy = type-check).
- Fin de línea mixto (LF/CRLF); agregar `.gitattributes`.
- `trace.txt` (3 MB) y `dist/` en la raíz local; ya ignorados por git.
- Copia antigua en `OneDrive/Nina` con otro `.env`: conviene borrarla para no confundirse.

---

## 4. Cumplimiento de las reglas de arquitectura

| Regla | Antes | Ahora |
| --- | --- | --- |
| Cifras solo del motor | ❌ chat y home con cálculos propios; mock inventando | ⚠️ chat ✅; home/insights todavía ❌ (P1) |
| Sin métricas duplicadas | ❌ | ❌ (P1) |
| `transactions` fuente de verdad | ✅ ledger unificado (011) | ✅ |
| RLS en toda tabla de usuario | ❌ `messages`, `categories` | ✅ en migraciones (aplicar 013; verificar con `rls_check.sql`) |
| `userId` del JWT, todo guardado | ❌ gateway y `/home` | ✅ con test que lo vigila |
| Al LLM solo facts redactados | ❌ chat usaba snapshot + memorias | ✅ en el chat; ⚠️ embeddings (M1) |
| Sin estado por usuario en memoria | ❌ `pendingByUser` | ✅ |
| Migraciones solo nuevas | ✅ | ✅ (013) |

---

## 5. Cómo verificar

```bash
npm run lint && npm test          # API: 41 tests, 9 suites
npm run build && npm run start:dev
cd nina_app && flutter analyze && flutter test   # 0 errores, 7 tests
```
