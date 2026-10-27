# Reporte de pruebas del chat — escenarios de principiante

**Fecha:** 2026-10-26/27 · **Rama:** `feature/chat-conversational`
**Persona de prueba:** "Alex", principiante, habla casual. Las preguntas se adaptaron al español peruano.
**Datos:** cuenta sintética local `dev@nina.test` (`supabase/seed.sql`): octubre 2026, ingresos S/ 4,800.00, gastos S/ 1,474.85, disponible S/ 3,325.15. No se tocó ningún dato real.
**Cómo se probó:** `node scripts/chat-scenarios.js . <etiqueta>` contra la implementación real: backend NestJS local, motor, validador y LLM real (OpenAI, consentimiento de IA activo en la cuenta sintética), con varios turnos y el contexto firmado. Las salidas están en `.local-logs/chat-scenarios-{before,after1,after2,final}.json`.

## Qué NO se verificó
- **La interfaz visual del chat no se probó a mano.** El panel del navegador de la app de Claude estaba oculto, y con el panel oculto Flutter web no dibuja ni procesa toques. Esta prueba ejercita la misma API que usa la app.
- La UI está cubierta por tests de widgets (`chat_context_retry_test.dart`): reintento, contexto y saludo. Falta el recorrido visual (QA-01).
- Las respuestas del LLM varían entre corridas. Las notas de abajo son de la corrida `final`.

## Resultado general
| | Antes | Después (final) |
|---|---|---|
| Escenarios que responden con sentido | 4 de 13 | 13 de 13 |
| Respuestas "No entendí" o genéricas | 9 | 0 |
| Cifras inventadas detectadas | 0 | 0 |
| Etiquetas internas filtradas ("recommendation:") | 2 | 0 |

## Detalle por escenario
Escala del 1 al 5 en este orden: **Nat**uralidad · **Per**sonalidad · **Cla**ridad · **Ctx** (contexto) · **Exa**ctitud · **EQ** (inteligencia emocional) · **Sig**uiente paso.

| Esc. | Entrada (resumen) | Antes | Después | Nat | Per | Cla | Ctx | Exa | EQ | Sig | Resultado |
|---|---|---|---|---|---|---|---|---|---|---|---|
| A | "Tengo plata en mi cuenta, ¿puedo gastarla?" | "No entendí" | Explica saldo vs. libre, con S/ 3,325.15 y "resta lo que aún debes pagar" | 4 | 4 | 5 | 4 | 5 | 4 | 4 | ✅ |
| B | "Quiero unas zapatillas…" → "Cuestan 350" | Genérica / "No entendí" | Pide el precio; luego S/ 350.00 frente a S/ 3,325.15, sin restar, y "la decisión es tuya" | 4 | 4 | 5 | 5 | 5 | 5 | 4 | ✅ |
| C | "Casi no compré nada, ¿por qué se me va?" | LLM con etiquetas filtradas | LLM con cifras reales y Comida como mayor gasto | 3 | 4 | 4 | 4 | 5 | 3 | 4 | ✅ (ver D-1) |
| D | "Me preocupa no llegar al día de pago" | "No entendí" | Calma, sin bromas, cifras reales | 4 | 3 | 5 | 4 | 5 | 5 | 3 | ✅ (ver D-3) |
| E | "Diferencia entre ahorrar y que me sobre" | LLM aceptable | Explicación simple, sin jerga y con pregunta de seguimiento | 5 | 4 | 5 | 3 | 5 | 4 | 4 | ✅ |
| F | "Ahorro para un viaje" → "¿Puedo comprarme esta casaca?" | "No entendí" ×2 | Ofrece guardar la meta; en la casaca pregunta el precio "sin frenar tu ahorro para un viaje" | 4 | 4 | 5 | 5 | 5 | 4 | 4 | ✅ |
| G | "¿Cuánta plata voy a tener el próximo mes?" | "No entendí" | "Todavía no proyecto, no quiero inventarte un número" y muestra lo que sabe | 4 | 3 | 5 | 4 | 5 | 4 | 4 | ✅ |
| H | "¿Cuánto me queda?" → "Más simple" | 2.º turno: genérico | "Va, en simple: lo que entró menos lo que salió…" | 4 | 3 | 5 | 5 | 5 | 4 | 4 | ✅ (ver D-2) |
| I | "Me compré otra cosa jaja" → "como 80 soles" | Genérico | Sin culpa, pide el monto y prepara el registro de S/ 80.00 | 5 | 5 | 5 | 5 | 5 | 5 | 4 | ✅ (ver D-4) |
| J | "¿En qué gasto más?" → "ayúdame a ahorrar más" | 2.º turno: "No entendí" | Usa el mayor gasto real y pide nombre y número para la meta | 4 | 4 | 5 | 5 | 5 | 4 | 5 | ✅ |
| K | "Japón en enero 2028, ¿buena idea?" → "7000 dólares" | Leía enero **2026** | Pide el presupuesto y arma el plan: S/ 26,250, S/ 1,750 al mes, oferta de guardar | 4 | 4 | 4 | 5 | 5 | 4 | 5 | ✅ |
| L | "Registra mi meta japón 2028, 7000 dólares" | "Mi meta", sin fecha, "S/ 26250.00" | "Japon", diciembre 2028 (lo dice), S/ 26,250.00 | 4 | 3 | 5 | 4 | 5 | 4 | 5 | ✅ (ver D-5) |
| M | "Japón enero 2028 con 7000 dólares, ¿me alcanza?" | Leía enero **2026** | Plan correcto y "sí, te alcanza" según el motor | 4 | 4 | 4 | 5 | 4 | 4 | 5 | ✅ (ver D-1) |

## Defectos encontrados y estado
| ID | Defecto | Estado |
|---|---|---|
| D-0 | Respuestas en texto plano del LLM mostraban "recommendation:" / "follow_ups:" (también en negrita) | **Corregido** (`looseAnswer` + test) |
| D-1 | El LLM a veces dice cosas imprecisas sin cifra nueva: "casi S/ 26,250" (es exacto), "me da risa que lo digas", chip "¿Quiero hacer un presupuesto?" | Abierto → backlog CI-06 / ajuste de prompt. El validador sí impide cifras inventadas. |
| D-2 | En H, el LLM recomendó "recorta entretenimiento, tu categoría más baja", un consejo que no tiene sentido | Abierto → ajuste de prompt: recomendar sobre la categoría más alta |
| D-3 | D no da un "siguiente paso" concreto (por ejemplo, ver próximos pagos) | Abierto → depende de INS-01 (próximos compromisos) |
| D-4 | "Compré algo que no necesitaba" se registra como Otros, no como Compras | Abierto → CI-04 |
| D-5 | Se pierde la tilde: "Japon" | Abierto → CI-05 |

## Corridas
- `before`: línea base, 4 de 13.
- `after1`: 11 de 13. Fallaban A (contradicción del LLM) y F (no recordaba el viaje).
- `after2`: 13 de 13; se corrigió la jerga y los chips en primera persona.
- `final`: 13 de 13; los resultados de la tabla.

Tests automatizados tras los cambios: **jest 472/472**, **Flutter 98/98**. `flutter analyze` sin errores (11 avisos de estilo previos en archivos que no se tocaron).
