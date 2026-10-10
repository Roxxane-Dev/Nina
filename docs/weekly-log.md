# Weekly log

## Semana 1 (9–15 oct 2026) — base y auditoría

### Hecho (9 oct)
- Código existente encontrado en `C:\Nina` (la copia de OneDrive es más antigua). Auditado contra CLAUDE.md.
- Repo en GitHub (`Roxxane-Dev/Nina`, público) con `.gitignore`; `.env` y la anon key fuera del repo.
- Build de la API arreglado; jest corre también los tests del motor (41 tests API, 7 app).
- Críticos cerrados: WebSocket autenticado por JWT, `/home` con guard, migración 013 (RLS `messages`, `categories`, update/delete en `transactions`).
- Chat de Nina reparado: motor → FactsPayload → NinaRouter → validador; confirmaciones con token firmado (sin tabla).
- App: sesión Supabase viva (sin JWT vencido), signup con confirmación de email, Sí/No guiado por el backend.
- Docs: `docs/ARCHITECTURE.md`, `docs/EVALUACION.md`. Grafo de conocimiento con Graphify.

### Hecho (9 oct, tarde) — chat de Nina como agente financiero
- Bug "confirmar → no tengo ningún registro pendiente": la tabla de la migración 014 no existía. Ahora la confirmación viaja firmada (HMAC) y se guarda al decir "sí".
- Motor v1.1: categorías canónicas, periodos ("el mes pasado", "en julio"), intents nuevos (gastos, ingresos, disponible, categoría, últimos movimientos, ayuda), diferencias calculadas por el motor, fallback al último mes con datos. Golden dataset.
- Respuestas con tarjeta de cifras + "Cómo lo calculé" + sugerencias. Prompt chat-v2.
- Proveedores LLM con error permanente (Gemini sin crédito) se saltan 10 min: menos latencia.
- Pruebas: 82 API, 12 app; e2e con LLM real y datos sintéticos: todas las respuestas validadas.

### Hecho (10 oct) — incidente del chat ("Tuve un problema…")
- Causa raíz: fechas `timestamptz` mal parseadas → `Invalid Date` → 500. Arreglada con `timezone.ts` (America/Lima) y mapeo robusto; score/forecast verificados antes/después en DEV.
- Motor v1.2: rangos en español (hoy, semana, mes, último mes, año), saldo histórico, bug de tendencias falsas.
- Chat reestructurado: un handler por intención, errores diferenciados (no_data / unrecognized / 503 / 500 con código), logs `chat_turn` sin datos sensibles.
- Registro usa el día de Lima; 1 fila de DEV corregida con tu autorización.
- Migración 015 (reconciliar `transactions.date`) escrita, **sin aplicar**.
- Tests: 144 API (incluye regresión con formato real), 14 app.

### Pendiente
- Aplicar migraciones 013 y 015 en Supabase DEV y correr `supabase/tests/rls_check.sql`.
- Rotar service role key y Gemini key; `AI_PROVIDER=openai` en `.env`.
- Migración baseline desde el esquema real de Supabase (la BD no coincide con 001–012).
- Probar signup/login end-to-end en dispositivo/emulador.
- Aprobar el diseño de espacios compartidos y la regla de "disponible" personal vs. compartido.
- Semana 2: consolidar métricas duplicadas en el motor (EVALUACION P1) y quitar pantallas con datos mock (P2).
