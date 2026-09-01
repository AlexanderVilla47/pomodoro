# 003 — Informes de progreso de estudio

**Estado:** ⬜ Pendiente
**Depende de:** [002 — `client_id`](002-client-id.md) — no arrancar antes

## Por qué esperar al 002

Estos informes se calculan sobre `sessions` y `work_logs`. El plan 002 arregla
un bug **activo** que duplica sesiones cuando se pierde la respuesta del
servidor. Construir los gráficos primero significa mirar min/chunk calculado
sobre datos duplicados: números prolijos, con media móvil y todo, **mintiendo**.
Y no hay forma de detectarlo mirando el gráfico.

## Qué tiene que contestar

- **¿Voy más rápido?** → min/chunk en el tiempo, con media móvil de 7 días
- **¿Me concentro más?** → distracciones por hora y por chunk, tendencia
- **¿Qué materia me cuesta más?** → min/chunk por `label`, ranking
- **¿Hasta dónde puedo llegar?** → el **piso**: mejor promedio *sostenido* en
  una ventana de N días, no un outlier de una sesión suelta

## Decisión de arquitectura: la matemática va en TypeScript, no en SQL

Postgres tiene window functions y `regr_slope()`. Tentador, **pero los tests de
la capa de queries mockean el tag `sql`** — `makeSql()` en
[work-logs.test.ts](../../lib/db/queries/__tests__/work-logs.test.ts) devuelve un
`vi.fn()`; nunca corre SQL real. Toda fórmula que viva en SQL es matemática sin
cobertura, en una feature que es 100% fórmulas y con Strict TDD activo.

**SQL agrega crudo. TypeScript divide.**

### La query

Una sola, siguiendo el patrón de `getDailyStatsForYear` en
[sessions.ts](../../lib/db/queries/sessions.ts):

```
getStudyEfficiencyByDay(sql, userId, { from, to, tz })
  → { day, label_id, label_name, label_color,
      total_seconds, total_chunks, sessions, distractions }[]
```

Agrupada por día + materia, filtrada por `is_theory = true AND chunks > 0`.
Ese único dataset crudo contesta las cuatro preguntas.

> `chunks` es `NUMERIC` y postgres.js lo devuelve como **string**. Convertir con
> `Number()` en la capa de queries, como ya hace `getWorkLogs`.

### Las funciones puras

En `lib/analytics/efficiency.ts`, extendiendo `minutesPerChunk` que ya existe:

| Función | Qué hace |
|---|---|
| `weightedAverage(rows)` | `sum(segundos) / sum(chunks)` |
| `movingAverage(series, 7)` | Media móvil de 7 días |
| `byLabel(rows)` | Agregado y ranking por materia |
| `focusRate(rows)` | Distracciones por hora y por chunk |
| `bestSustained(series, window)` | El piso |

> ⚠️ **Nunca promediar promedios.** El promedio del día es
> `sum(segundos)/sum(chunks)`, no el promedio de los min/chunk de cada sesión:
> una sesión corta distorsiona el día entero.

**Sin regresión lineal ni proyecciones.** Con menos de ~14 días de datos la
pendiente es ruido con cara de número serio. Se agrega después, cuando haya con
qué.

## Endpoint y UI

`GET /api/stats/efficiency?from=&to=&tz=`, con la forma exacta de
[stats/heatmap/route.ts](../../app/api/stats/heatmap/route.ts) — auth, tz,
`Promise.all`.

**Ubicación: sub-vista `"analysis"` dentro de
[Historial](../../components/Historial/index.tsx).** El tab bar de mobile ya
tiene 4 tabs y el panel derecho de desktop 3 con `max-h-[45%]`: no entra otro
sin romper los targets táctiles. Historial ya alterna vistas
(`calendar` / `day`), se extiende ese estado.

Componentes, reusando el estilo de tarjeta de
[StatsCard](../../components/Dashboard/StatsCard.tsx):

- **Ranking de materias** — `RRHH 14,2 min/chunk · Derecho 8,1 min/chunk`
- **Línea de min/chunk por día** con la media móvil superpuesta
- **Tarjeta de concentración** — distracciones/hora vs. la semana anterior
- **Tu piso** — mejor promedio sostenido por materia

**Empty state honesto:** los informes sólo cubren sesiones con el checkbox de
teoría tildado. Si no hay datos tiene que decir eso explícitamente, no mostrar
un gráfico vacío.

## Orden TDD

1. `lib/analytics/__tests__/efficiency.test.ts` → las cinco funciones puras, con
   sus casos borde (series vacías, ventana más grande que la serie, un solo día)
2. `lib/db/queries/__tests__/stats.test.ts` → `getStudyEfficiencyByDay` convierte
   los NUMERIC a number
3. `app/api/__tests__/stats-efficiency.test.ts` → auth, tz, forma de la respuesta
4. Tests de los componentes, incluido el empty state
5. Recién ahí, implementar

## Caveat de producto

La métrica sólo es comparable **mientras el criterio de porcionado no cambie**.
El día que los chunks se agranden, el min/chunk sube y va a parecer un retroceso
cuando en realidad se está haciendo más por chunk. Vale la pena que la UI lo
diga en algún lado.
