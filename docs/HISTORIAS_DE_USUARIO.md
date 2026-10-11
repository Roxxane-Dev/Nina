# Nina — Historias de usuario: estado real y plan de construcción

| Campo | Valor |
|---|---|
| Documento | NINA-US-001 (v0.1) + trazabilidad |
| Fecha de auditoría | 2026-10-11 |
| Meta | MVP funcionando el 2026-10-31 |

Leyenda de estado real: ✅ hecho y probado · ⚠️ existe pero incompleto o con cifras que no salen del motor · ❌ no existe.
"Motor" = `packages/finance-engine` (única fuente de cifras).

## Hallazgos de la auditoría que afectan a varias historias

1. **Inicio muestra cifras incorrectas.** Lee de `/intelligence/snapshot`, que usa el motor legado `src/intelligence/nina-finance.engine.ts`. Ese motor compara fechas como texto (`t.date === '2026-10-09'`) y la BD devuelve `2026-10-09T00:00:00+00:00`: es el mismo bug de fechas del chat, así que el resumen sale en cero. Además duplica métricas del motor.
2. **Movimientos y Análisis calculan totales en Dart** sobre las filas crudas (segunda y tercera copia de las métricas).
3. **No hay tablas** para consentimientos, espacios compartidos con membresía, reglas de categoría ni cuentas.

→ La base de las épicas 3–5 es un endpoint de resumen del motor (`GET /v1/summary?period=`) que Inicio, Movimientos y Análisis consumen. Las listas de movimientos siguen leyéndose de Supabase con RLS.

## Trazabilidad

### Épica 1 — Onboarding y cuenta
| ID | Historia (resumen) | Prio | Estado real | Qué falta |
|---|---|---|---|---|
| US-01 | Registro con email o Google | P0 | ⚠️ email ✅ | Google pasa a noviembre (decisión 11 oct) |
| US-02 | Iniciar sesión | P0 | ✅ | Verificar "entro directo a Inicio con datos" cuando Inicio esté arreglado |
| US-03 | Consentimiento explícito (datos, IA, analítica) | P0 | ❌ | Tabla `consents` + RLS, pantalla en onboarding, guard que bloquea IA sin consentimiento |
| US-04 | Guía al primer movimiento | P1 | ❌ | Estado vacío de Inicio con CTA al chat / formulario |
| US-05 | Cerrar sesión | P0 | ✅ | Ya en Más; añadir test |

### Épica 2 — Chat con Nina
| ID | Historia | Prio | Estado real | Qué falta |
|---|---|---|---|---|
| US-06 | Registrar ingreso en lenguaje natural | P0 | ✅ | — |
| US-07 | Registrar gasto con categoría | P0 | ✅ | — |
| US-08 | Confirmar / cancelar | P0 | ✅ | — |
| US-09 | Saldo (acumulado histórico) | P0 | ✅ | — |
| US-10 | Gasto por periodo (hoy… este año) | P0 | ✅ | — |
| US-11 | Gasto por categoría | P1 | ✅ | — |
| US-12 | Últimos movimientos en el chat | P1 | ✅ | — |
| US-13 | Tarjeta visual con cifras | P1 | ✅ (lista/cifra) | Opcional: anillo/barras en la tarjeta |
| US-14 | "Sin movimientos" ≠ error | P0 | ✅ | — |
| US-15 | "No entendí" con ejemplo | P0 | ✅ | — |
| US-16 | Chips sugeridos en chat vacío | P1 | ✅ | — |
| US-17 | Falla de infraestructura distinta | P1 | ✅ | — |

### Épica 3 — Inicio
| ID | Historia | Prio | Estado real | Qué falta |
|---|---|---|---|---|
| US-18 | Resumen del mes al abrir | P0 | ⚠️ cifras en cero (hallazgo 1) | Inicio desde `GET /v1/summary` |
| US-19 | Gasto por categoría | P0 | ⚠️ | Desglose desde el motor |
| US-20 | Selector de periodo | P1 | ❌ | Selector (mes actual / anterior) → `?period=` |
| US-21 | Estado vacío claro | P1 | ❌ | Junto con US-04 |

### Épica 4 — Movimientos
| ID | Historia | Prio | Estado real | Qué falta |
|---|---|---|---|---|
| US-22 | Historial completo | P0 | ✅ | Totales del encabezado desde el motor |
| US-23 | Filtros (categoría, tipo, fecha) | P1 | ⚠️ solo chips | Tipo y rango de fecha |
| US-24 | Corregir categoría y recordar | P0 | ❌ | Edición + tabla `merchant_rules` (RLS) usada por el parser |
| US-25 | Eliminar movimiento | P0 | ⚠️ método sin UI | Botón con confirmación (RLS delete ya en migración 013) |
| US-26 | Formulario de alta | P1 | ❌ | Hoja con monto, tipo, categoría, fecha, nota |

### Épica 5 — Análisis
| ID | Historia | Prio | Estado real | Qué falta |
|---|---|---|---|---|
| US-27 | Gráfico por categoría | P0 | ⚠️ calculado en Dart | Datos del motor |
| US-28 | Tendencia mes a mes | P1 | ⚠️ calculado en Dart | Serie mensual del motor |
| US-29–32 | Insights, score, forecast, simulador | P1–P2 | Fase 2 | — |

### Épica 6 — Espacios compartidos
| ID | Historia | Prio | Estado real | Qué falta |
|---|---|---|---|---|
| US-33 | Crear espacio | P0 | ❌ (tabla `spaces` actual no sirve para compartir) | Modelo nuevo (ver ARCHITECTURE §5) |
| US-34 | Invitar por código | P0 | ❌ | `space_invites` + unirse |
| US-35 | Gasto del espacio por chat | P0 | ❌ | Parser: "es de la casa" → espacio |
| US-36 | Balance del espacio separado | P0 | ❌ | Facts del motor por espacio |
| US-37 | Quién aportó qué | P1 | ❌ | Autor por movimiento |
| US-38 | Salir del espacio | P1 | ❌ | Baja de `space_members` |
| US-39 | Privacidad de lo personal | P0 | ❌ | RLS + tests con dos usuarios |

### Épica 7 — Más
| ID | Historia | Prio | Estado real | Qué falta |
|---|---|---|---|---|
| US-40 | Perfil (nombre, moneda) | P1 | ⚠️ | Edición sobre `profiles` |
| US-41 | Cuentas (banco, efectivo, tarjeta) | P1 | ❌ | Tabla `accounts` + asociar movimientos |
| US-42 | Revisar/revocar consentimientos | P0 | ❌ | Junto con US-03 |
| US-43–45 | Exportar, eliminar cuenta, notificaciones | P1–P2 | Fase 2 | — |

### Épica 8 — Metas: Fase 2 (US-46, US-47).

## Decisiones (11 oct)
- **Espacios:** lo que yo pagué en un espacio compartido sí descuenta de mi disponible/saldo personal; la vista del espacio suma lo de todos.
- **Login:** solo email este mes; Google pasa a noviembre.
- **Cuentas (US-41):** se incluye este mes, después del Sprint D (sprint E). Si falta tiempo se recortan US-37/US-38 antes que cualquier P0.
- Se arranca por el Sprint A. Los sprints con migraciones (B, C, D, E) se presentan con su plan antes de aplicarse.

## Plan de construcción (aprobado)

| Sprint | Fechas | Historias | Entregable verificable |
|---|---|---|---|
| A — Una sola fuente de cifras | 11–15 oct | US-18, 19, 20, 21, 04, 22, 25, 26, 27, 28, 23 | `GET /v1/summary?period=` y `GET /v1/trends` (motor). Inicio, Movimientos y Análisis sin cálculos en Dart; estado vacío; borrar y agregar movimiento. Se apaga `/intelligence/snapshot` para Inicio. |
| B — Corrección de categorías | 16–17 oct | US-24 | Migración `merchant_rules` + RLS; el parser consulta reglas del usuario antes de las globales. |
| C — Espacios compartidos | 18–25 oct | US-33 a US-39 | Migración `spaces` v2 + `space_members` + `space_invites` + `transactions.shared_space_id`, RLS con `is_space_member()`, test SQL de dos usuarios, pantallas y chat ("es de la casa"). |
| D — Confianza y cuenta | 26–29 oct | US-03, 42, 40, 05, 01 (Google si hay credenciales) | Tabla `consents`, pantalla de onboarding y Más → Privacidad, guard de IA, perfil editable. |
| E — Cuentas | 29–30 oct | US-41 | Tabla `accounts` + RLS, alta/edición en Más, asociar movimientos a una cuenta. |
| Pulido y demo | 30–31 oct | — | Solo arreglos. Demo: registrar gasto, ver Inicio, preguntar a Nina, ver gasto compartido. |


**Riesgo honesto:** C es el sprint más grande y toca RLS. Si se atrasa, se recorta US-37/US-38 (P1) antes que cualquier P0.
