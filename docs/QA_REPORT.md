# Revisiones visuales

## HOME-02 — Avances en metas (2026-11-01)

**Rama:** `feature/goal-contributions`. **Entorno:** local, app web en el panel a 375×812, cuenta `dev@nina.test`. Se probó el día 1 del mes, sin ingresos registrados en noviembre.

| Flujo | Resultado |
|---|---|
| Metas: monto inválido rechazado, "Registrar avance" de S/ 150 | ✅ el progreso pasó de S/ 300 a S/ 450 |
| Inicio: Apartado y disponible | ✅ |
| "Cómo calculé esto": línea "− Apartado para metas" | ✅ cuadra con el motor |
| Movimientos desde "Ver estos movimientos" | ✅ tras arreglos |
| Chat: "aparté 100 para la bici", confirmar, "¿cuánto me queda?" | ✅ tras arreglos |

| # | Defecto | Estado |
|---|---|---|
| H-1 | **El LLM regañaba:** con disponible negativo solo por lo apartado decía "recorta tus gastos" y "gastaste más de lo que ingresaste", con S/ 0 de gastos | Corregido: ese caso se responde desde el motor, sin LLM (`setAsideCausesNegative`). Una regla en el prompt (`chat-v6`) no bastó: de 3 respuestas, 2 seguían mal |
| H-2 | Movimientos cortaba el nombre del avance ("Apartado · …") | Corregido: el título es la meta y debajo dice "Apartado" |
| H-3 | El resumen de Movimientos no sumaba (0 − 0 = −250) | Corregido: una línea explica lo apartado |
| H-4 | "En positivo" y "Gastos iguales que en octubre" con el mes vacío | Corregido: "Sin movimientos" y "Sin gastos registrados en noviembre 2026" |
| H-5 | El error de monto se cortaba en la hoja | Corregido: mensaje más corto |
| H-6 | "−S/ 0.00" y "+S/ 0.00" en el resumen | Corregido |
| H-7 | **Inicio muestra "En rojo" al apartar antes de registrar el sueldo** | Corregido (D-016): color neutro con "Falta tu ingreso" o "Por lo apartado"; el sobregasto real sigue en rojo |

**No se revisó en pantalla:** la pastilla "Sin movimientos" (cubierta por un test de widget, porque la cuenta ya tenía avances en noviembre).

---

# QA-01 — Revisión visual de la app

**Fecha:** 2026-10-27 · **Rama:** `feature/chat-conversational`
**Entorno:** todo local. App Flutter web (`flutter run -d web-server`, `env/local.json`) en el navegador del panel de Claude, simulando un teléfono de 375×812. Backend NestJS y Supabase local.
**Cuentas:**
- `dev@nina.test`: sintética, de `supabase/seed.sql`.
- `qa.alex.1027@nina.test`: cuenta de prueba creada en este recorrido desde "Crear cuenta". Solo existe en la base local.

## Qué se recorrió de verdad (en pantalla)
| Flujo | Resultado |
|---|---|
| Pantalla de carga → bienvenida | ✅ |
| Iniciar sesión (dev) | ✅ |
| Inicio: disponible, ingresos y gastos, comparación, saldo, "Cómo calculé esto", tarjeta de Nina, acciones rápidas, categorías, últimos movimientos | ✅ tras arreglos |
| Hoja "Cómo calculé esto" | ✅ cuadra con el motor (S/ 4,800.00 − S/ 1,474.85 = S/ 3,325.15) |
| Chat: sugerencia, respuesta con tarjeta, "zapatillas" → "cuestan 350 soles" (contexto), confirmación de gasto, conversación abierta ("¿Qué es el interés?") | ✅ tras arreglos |
| Movimientos: resumen, buscador, periodo, hoja de Filtros | ✅ tras arreglos |
| Añadir movimiento (hoja) | ✅ tras arreglos |
| Metas, Espacio (vacío), Perfil, Cerrar sesión | ✅ |
| Registro (correo, contraseña, medidor, términos) → consentimiento → primeros pasos (nombre, metas, ingreso S/ 3,200, alquiler S/ 900, espacio "no") → primer número **S/ 2,300.00** → Inicio "Hey, Alex" | ✅ |

## Defectos encontrados
| # | Defecto | Estado |
|---|---|---|
| Q-1 | "Movimientos" se cortaba en la barra de pestañas | Corregido: cada pestaña ocupa su parte del ancho y la etiqueta se ajusta |
| Q-2 | Las acciones rápidas de Inicio tenían distinto alto | Corregido (`IntrinsicHeight`) |
| Q-3 | **Las hojas (Cómo calculé, Filtros, Añadir) quedaban debajo de la barra de pestañas; "Guardar" quedaba tapado** | Corregido (`useRootNavigator: true`) |
| Q-4 | Doble borde dentro del campo del chat | Corregido |
| Q-5 | El campo del chat se desactivaba mientras Nina respondía y se perdía lo que el usuario escribía | Corregido: el campo sigue activo y solo el envío espera |
| Q-6 | Al confirmar o cancelar aparecía en el chat "confirmar" / "cancelar" como mensaje del usuario | Corregido: se muestra "Sí, dale" / "No, gracias" |
| Q-7 | Meta sin fecha decía "Sin ritmo todavía" aunque sí hay ahorro real | Corregido: "Sin fecha" |
| Q-8 | El botón "Calculado con N movimientos · ver cómo" del primer número casi no se leía | Corregido: pastilla translúcida sobre cacao |
| Q-9 | Perfil abierto desde un enlace no tenía forma de volver | Corregido: la flecha lleva a Inicio |
| Q-10 | **El texto del consentimiento de IA dice que solo se envían "cifras ya calculadas y anonimizadas", pero el chat también envía el mensaje del usuario (sin datos personales).** Ya pasaba antes de CI-01 | **Corregido (SEC-05, D-014):** texto nuevo aprobado y política `2026-10-v2`; revisado en pantalla |
| Q-11 | En Movimientos, los nombres largos se cortan ("Supermerc…") por el ícono de borrar | Abierto (P3): se puede borrar deslizando, así que el ícono podría quitarse |

## Limitaciones
- Navegador de escritorio simulando un teléfono, no un dispositivo real. Falta probar en Android/iOS: teclado, notch y gestos.
- No se probó el código de verificación por correo: en local la confirmación está apagada (QA-02).
- No se probaron "Unirme con código" ni las invitaciones a un espacio entre dos usuarios en pantalla; están cubiertos por tests.

## Verificación tras los arreglos
- `flutter analyze`: sin errores.
- `flutter test`: 98/98.
- Los defectos Q-1 a Q-9 se volvieron a revisar en pantalla.
