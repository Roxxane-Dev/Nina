# Weekly log

## Semana 1 (9–15 oct 2026) — base y auditoría

### Hecho (9 oct)
- Código existente encontrado en `C:\Nina` (la copia de OneDrive es más antigua). Auditado contra CLAUDE.md.
- Repo en GitHub (`Roxxane-Dev/Nina`, público) con `.gitignore`; `.env` y la anon key fuera del repo.
- Build de la API arreglado; jest corre también los tests del motor (41 tests API, 7 app).
- Críticos cerrados: WebSocket autenticado por JWT, `/home` con guard, migración 013 (RLS `messages`, `categories`, update/delete en `transactions`).
- Chat de Nina reparado: motor → FactsPayload → NinaRouter → validador; confirmaciones persistidas (migración 014).
- App: sesión Supabase viva (sin JWT vencido), signup con confirmación de email, Sí/No guiado por el backend.
- Docs: `docs/ARCHITECTURE.md`, `docs/EVALUACION.md`. Grafo de conocimiento con Graphify.

### Pendiente
- Aplicar migraciones 013 y 014 en Supabase DEV y correr `supabase/tests/rls_check.sql`.
- Rotar service role key y Gemini key; `AI_PROVIDER=openai` en `.env`.
- Probar signup/login end-to-end en dispositivo/emulador.
- Aprobar el diseño de espacios compartidos y la regla de "disponible" personal vs. compartido.
- Semana 2: consolidar métricas duplicadas en el motor (EVALUACION P1) y quitar pantallas con datos mock (P2).
