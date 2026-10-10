# Nina — Qué es y cómo funciona

> Documento vivo. Resume NINA-PRD-001, NINA-FDS-001, NINA-SAD-001 y NINA-TS-001 y lo aterriza al **código real** de este repo (octubre 2026).
> Si algo aquí contradice el código, manda el código y hay que actualizar este archivo.

---

## 1. Nina en una frase

**Nina es una capa de inteligencia financiera: entiende tu plata, predice cómo vas a terminar el mes y te dice qué hacer, sin mover dinero.**

No es un banco ni una billetera. Se monta encima de las cuentas, tarjetas y Yape/Plin que la persona ya usa.

| Fase | Nombre | Qué hace | Estado |
| --- | --- | --- | --- |
| 1 | **Nina Intelligence** | Entender → predecir → recomendar. Solo lectura. | **En construcción (MVP)** |
| 2 | Nina Agent | Ejecutar acciones con autorización explícita, vía socio bancario licenciado (BaaS) | Futuro |
| 3 | Nina Wallet | Pagos, ahorro, crédito | Futuro |

**Hipótesis que valida el MVP:** *la gente quiere una IA que conozca su situación financiera y le diga qué hacer con su dinero.*

**Usuario objetivo (Nina Personal):** profesional urbano en Lima, 23–35 años, sueldo formal, 2+ productos financieros. Dolor: "no sé a dónde se va mi plata".
Alternativa en evaluación: Nina Negocio (mypes vía contadores). **No se construye hasta validar el MVP personal.**

---

## 2. Qué debe hacer Nina (funcionalidades)

### 2.1 MVP de este mes (al 31 de octubre de 2026)

| # | Funcionalidad | Qué ve el usuario | Estado en el código |
| --- | --- | --- | --- |
| 1 | Registro e inicio de sesión | Email + contraseña (Supabase Auth) | ✅ Funciona, con sesión que se refresca sola |
| 2 | Registrar movimientos | Escribir "gasté 25 en taxi" en el chat o agregarlo a mano | ✅ Por chat (con confirmación). Formulario manual: pendiente |
| 3 | Categorización | Comida, transporte, hogar, salud, etc. | ✅ Por reglas en español |
| 4 | Resumen (Home) | Cuánto gastaste, en qué, cuánto te queda | ⚠️ Existe, pero parte de las cifras no viene del motor único (ver §6) |
| 5 | Chat con Nina | "¿En qué gasto más?" → respuesta con cifras reales | ✅ Conectado al motor + validador (oct 2026) |
| 6 | **Espacios compartidos** (pareja/familia) | Un fondo común (alquiler, mercado, servicios) que varios ven y categorizan, separado de lo personal | ❌ Pendiente — diseño en §5 |

### 2.2 Después (noviembre en adelante)

Forecast completo de fin de mes, score de salud financiera 0–100 explicable, simulador "¿qué pasa si compro esto en cuotas?", metas, importación de estados de cuenta PDF/CSV por banco, consentimiento granular, exportar/eliminar mis datos, notificaciones.

### 2.3 Lo que Nina **nunca** hace en esta fase

Mover dinero, dar asesoría de inversión/crédito/legal, inventar cifras.

---

## 3. Arquitectura en una imagen

```
┌────────────────────────── App Flutter (nina_app/) ──────────────────────────┐
│  Pantallas: Login · Home · Movimientos · Chat Nina · Análisis · Presupuesto │
│  Estado: BLoC/Cubit · Navegación: go_router · HTTP: Dio · WS: socket.io    │
└───────┬───────────────────────────────┬────────────────────────────┬────────┘
        │ lecturas directas (RLS)       │ HTTPS + JWT                │ WebSocket + JWT
        ▼                               ▼                            ▼
┌───────────────┐        ┌────────────────────── API NestJS "Nina OS" (src/) ─────────────────┐
│   Supabase    │        │ SupabaseAuthGuard → valida el JWT y saca el userId (nunca del cliente)│
│  Postgres     │◄──────►│                                                                      │
│  + Auth       │service │  ChatModule ──► FinanceEngineService ──► packages/finance-engine     │
│  + RLS        │ role   │      │                (lee transactions)    (cálculos puros)         │
└───────────────┘        │      ▼                                                               │
                         │  NinaRouter: redacta PII → arma prompt con FACTS → LLM → validador   │
                         │      │                                                               │
                         │      ▼                                                               │
                         │  AIService: OpenAI / Gemini / Claude (solo los que tienen clave)     │
                         └──────────────────────────────────────────────────────────────────────┘
```

### 3.1 Las 3 piezas

| Pieza | Carpeta | Qué hace |
| --- | --- | --- |
| **App móvil** | `nina_app/` | Interfaz. Lee algunas tablas de Supabase directo (protegidas por RLS) y llama a la API para el chat y la inteligencia. |
| **API "Nina OS"** | `src/` | Valida al usuario, calcula, habla con el LLM, guarda. Usa la llave *service role* (salta RLS), por eso **siempre** saca el `userId` del JWT. |
| **Motor financiero** | `packages/finance-engine/` | Funciones puras (sin base de datos, sin reloj, sin azar): agregados por categoría, anomalías, score, recurrencias, forecast, simulación, `FactsPayload`. **Es la única fuente de cifras.** |
| **Base de datos** | `supabase/migrations/` | Postgres. `transactions` es la fuente de verdad; todo lo demás se puede recalcular desde ahí. |

### 3.2 Módulos de la API que importan para el MVP

| Módulo | Archivos clave | Rol |
| --- | --- | --- |
| Auth | `src/auth/` | `SupabaseAuthGuard` valida el JWT en cada request. |
| Chat | `src/chat/` | Orquesta la conversación: registrar gasto/ingreso/meta con confirmación, o responder preguntas. |
| Confirmaciones | `src/chat/confirmation-token.ts` | Firma (HMAC) el registro pendiente; la app lo reenvía con "sí". Ligado al usuario del JWT, expira en 15 min. |
| Tarjeta de respuesta | `src/chat/answer-card.ts` | Tarjeta con cifras del motor, "Cómo lo calculé" y sugerencias por intención. |
| Finance engine | `src/finance-engine/` | Carga transacciones del usuario y llama al motor puro. Expone `/v1/summary`, `/v1/score`, `/v1/forecast`. |
| Nina Router | `src/nina-router/` | Redacción de PII, prompt con FACTS, validación de números, respuesta de plantilla si el LLM falla. |
| AI | `src/ai/ai.service.ts`, `src/ai/providers/` | Llama al proveedor LLM disponible con fallback. El *mock* nunca da cifras. |
| Expenses / Income / Goals | `src/expenses/`, `src/income/`, `src/goals/` | Parsers en español ("gasté 20 en taxi y 15 en café") e inserción en `transactions`. |
| Home | `src/home/` | Payload del Home (cache → snapshot → cálculo en el momento). |
| Realtime | `src/realtime/` | WebSocket `/intelligence`: empuja eventos solo a la sala `user:<id>` del token validado. |

Hay muchos módulos más en `src/ai/` (behavioral, emotion, streaks, prevention, proactive, household…). **Están fuera del alcance del MVP**: no se extienden y deben quedar detrás de feature flags.

---

## 4. Cómo funciona el chat de Nina (el flujo más importante)

```
Usuario: "¿En qué gasto más?"
   │
   ▼  POST /chat  (Authorization: Bearer <JWT de Supabase>)
1. SupabaseAuthGuard valida el token → userId
   │
2. ¿El usuario dijo "sí"/"no"? → verifica el pendingToken firmado (HMAC, ligado al userId, 15 min)
   │     que la app reenvía → guardar o cancelar. Sin estado en memoria ni tabla.
   │
3. ¿Es un registro? ("gasté 20 en comida", "me pagaron 3000", "quiero ahorrar para…")
   │     → parsear → responder "¿Confirmas…?" con needsConfirmation: true + pendingToken
   │
4. Si es una pregunta:
   a. FinanceEngineService.factsForQuestion(userId, mensaje) — todo determinista:
        - intent: spending_summary | spending_breakdown | category_spend | income | available
                  | recent | help | forecast | score | subscriptions | goal | whatif | other
        - periodo: este mes (por defecto), "el mes pasado", "en julio"…
          Si el mes actual está vacío, usa el último mes con datos y lo dice.
        - categoría: "¿cuánto gasté en taxis?" → transport (categorías canónicas del motor)
        → FactsPayload { figures: {income, expenses, available, prev_*, expenses_change,
                         category_spend…}, items, comparisons, context: {periodLabel…} }
      help, "sin movimientos" y "últimos movimientos" se responden sin LLM.
   c. NinaRouter.explainFacts:
        - la pregunta se redacta (DNI, teléfono, tarjeta, email) y se envuelve en <untrusted>
        - se manda al LLM SOLO el FactsPayload (sin ids ni transacciones crudas) + reglas
        - el LLM responde JSON { message, recommendation, follow_ups }
        - VALIDADOR: cada número del texto debe existir en FACTS (S/ 1,250.50 = 1250.5)
          · si falla → reintenta 1 vez → si vuelve a fallar → respuesta de plantilla con cifras del motor
   │
5. Respuesta: { reply, needsConfirmation, pendingToken?, followUps,
                card: { title, subtitle, highlight, rows, howCalculated, confidence },
                grounded: { intent, validationPassed, usedLlm, engineVersion } }
   La tarjeta se arma con las cifras del motor, nunca con el texto del LLM (FR-11).
```

**Regla de oro:** el LLM **explica**, el motor **calcula**. Si el LLM escribe un número que no está en FACTS, la respuesta se descarta.

### Proveedores LLM

`AIService` prueba solo los proveedores con clave configurada en `.env` (`OPENAI_API_KEY`, `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`), en orden de preferencia, y como último recurso el *mock* (que dice "no puedo generar una explicación" y el router responde con la plantilla del motor).
Fija el proveedor principal con `AI_PROVIDER=openai|gemini|claude`.

---

## 5. Espacios compartidos (pareja / familia) — diseño propuesto, pendiente de aprobación

**Objetivo:** varios usuarios ven y categorizan los gastos de un fondo común, sin que nadie vea las finanzas personales de los demás.

**Estado actual:** existe una tabla `spaces` con `members jsonb` y RLS solo para el dueño, y `transactions.space_id` es `text default 'personal'`. No sirve para compartir de forma segura.

**Propuesta (nueva migración, no se edita lo aplicado):**

```
spaces          (id uuid, owner_id, name, type 'pareja'|'familia')
space_members   (space_id, user_id, role 'owner'|'member', joined_at)   ← membresía real
space_invites   (code, space_id, expires_at)                           ← unirse por código
transactions.shared_space_id uuid null  → null = 100% personal
```

- **Lectura (RLS):** `user_id = auth.uid() OR is_space_member(shared_space_id)`, con `is_space_member()` como función `security definer` para evitar recursión de políticas.
- **Escritura:** cada quien inserta solo con su propio `user_id` y en espacios donde es miembro.
- **Recategorizar** un gasto común de otro miembro: vía API (RLS no puede limitar columnas; si no, un miembro podría editar montos ajenos).
- **Motor:** la vista del espacio suma el fondo común; la vista personal incluye solo lo que *tú* pagaste. *(Decisión abierta: confirmar esta regla.)*

---

## 6. Reglas de arquitectura (no negociables)

1. Todas las cifras salen de **un** motor determinista (`packages/finance-engine`). La IA solo explica.
2. No duplicar cálculos: si dos servicios calculan lo mismo, se consolida en el motor.
3. `transactions` es la fuente de verdad.
4. Toda tabla con datos de usuario tiene RLS (`user_id = auth.uid()`), porque la app lee Supabase directo.
5. La API deriva el `userId` del JWT validado. Nunca de un parámetro del cliente. Todo controller y gateway con guard.
6. Al LLM solo van hechos calculados por el motor, con PII redactada y el texto del usuario tratado como no confiable.
7. Nada de estado por usuario en memoria del proceso: va a la base de datos.
8. Cambios de esquema solo con migraciones nuevas.

---

## 7. Cómo correrlo en local

```bash
# 1. API
cp .env.example .env            # llenar con el proyecto DEV de Supabase
npm install
npm run start:dev               # http://localhost:3000

# 2. Base de datos: aplicar en orden las migraciones de supabase/migrations/
#    (SQL editor del proyecto DEV). Verificar con supabase/tests/rls_check.sql

# 3. App
cd nina_app
cp env/dev.example.json env/dev.json   # SUPABASE_URL y SUPABASE_ANON_KEY
flutter run --dart-define-from-file=env/dev.json
# En VS Code: Run → "Nina app (dev)"
```

Comandos de calidad: `npm run lint && npm test` (API) · `flutter analyze && flutter test` (app).

---

## 8. Mapa de carpetas

```
Nina/
├── CLAUDE.md                     reglas para trabajar con Claude Code
├── docs/                         este documento, evaluación, log semanal
├── packages/finance-engine/      motor puro (aggregates, anomaly, score, forecast, recurrence, simulation, facts)
├── src/                          API NestJS
│   ├── auth/  chat/  nina-router/  finance-engine/  ai/  expenses/  income/  goals/
│   ├── home/  realtime/  jobs/  memory/  insights/  intelligence/ …
├── supabase/migrations/          001 … 013 (013 = RLS). Ojo: la BD real no coincide 100% con 001–012 (ver EVALUACION)
├── supabase/tests/rls_check.sql  auditoría de RLS
└── nina_app/                     Flutter (lib/core, lib/data, lib/domain, lib/features, lib/shared)
```
