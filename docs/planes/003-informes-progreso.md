# 003 — Informes de progreso de estudio

**Estado:** ✅ Completado — 2026-09-01, PR #24
**Depende de:** [002 — `client_id`](002-client-id.md) — ✅ ya está, desbloqueado

## Por qué esperar al 002

Estos informes se calculan sobre `sessions` y `work_logs`. El plan 002 arregla
un bug **activo** que duplica sesiones cuando se pierde la respuesta del
servidor. Construir los gráficos primero significa mirar min/bloque calculado
sobre datos duplicados: números prolijos, con todo el aparato estadístico
encima, **mintiendo**. Y no hay forma de detectarlo mirando el gráfico.

## Qué tiene que contestar

Cuatro números, y la comparación entre períodos de esos cuatro números. Nada
más. La pregunta de fondo es siempre la misma: **¿esta semana estoy mejor que
la anterior? ¿este mes mejor que el anterior?**

| Métrica | Fórmula | Mejora cuando |
|---|---|---|
| **min/bloque** | `sum(segundos) / sum(bloques)` | **baja** — vas más rápido |
| **bloques/día** | `sum(bloques) / días con estudio` | **sube** — rendís más |
| **días estudiados** | días con al menos un bloque | **sube** |
| **distracciones/hora** | `sum(distracciones) / horas` | **baja** — te concentrás más |

> ⚠️ **Las direcciones son opuestas y la UI tiene que saberlo.** Un "verde si
> sube" naive pinta de verde justo cuando min/bloque empeora. Cada métrica
> declara su dirección.

### La decisión escondida en "bloques/día"

El denominador son los **días con estudio registrado**, no los días del
calendario. Esa fue una decisión explícita: la métrica contesta *"cuando me
siento a estudiar, ¿cuánto rindo?"*.

Lo que esa elección **pierde**: si una semana estudiás 5 días y la siguiente 2
con el mismo rendimiento diario, la métrica dice "igual". Por eso va al lado
**días estudiados** — sin ese tercer número, los otros dos tapan que estudiaste
la mitad.

### Lo que se descartó, y por qué

- **Media móvil de 7 días.** Sirve para alisar el serrucho de una serie
  **diaria**. Pero acá se compara por período, y **agrupar por semana YA es el
  alisado**: el promedio semanal se come solo los días buenos y los malos.
  Ponerle una media móvil encima es suavizar lo suavizado.
- **`bestSustained` como función propia.** "Tu mejor semana" es el máximo de la
  serie de semanas. Sale gratis, no necesita código.
- **Regresión lineal y proyecciones.** Con pocos datos la pendiente es ruido con
  cara de número serio.

## Decisión de arquitectura: la matemática va en TypeScript, no en SQL

Postgres tiene window functions y `regr_slope()`. Tentador, **pero los tests de
la capa de queries mockean el tag `sql`** — `makeSql()` en
[work-logs.test.ts](../../lib/db/queries/__tests__/work-logs.test.ts) devuelve un
`vi.fn()`; nunca corre SQL real. Toda fórmula que viva en SQL es matemática sin
cobertura, en una feature que es 100% fórmulas y con Strict TDD activo.

**SQL agrega crudo. TypeScript divide.**

El corolario práctico apareció al diseñar la UI: como la query devuelve el
dataset crudo por día + materia, **los filtros por materia son gratis** — es
filtrar un array en el cliente, sin queries extra. Si la matemática viviera en
SQL, cada filtro nuevo sería una query nueva.

### La query

Una sola, siguiendo el patrón de `getDailyStatsForYear` en
[sessions.ts](../../lib/db/queries/sessions.ts):

```
getStudyEfficiencyByDay(sql, userId, { from, to, tz })
  → { day, label_id, label_name, label_color,
      total_seconds, total_chunks, sessions, distractions }[]
```

Agrupada por día + materia, filtrada por `is_theory = true AND chunks > 0`.
Ese único dataset crudo contesta las cuatro preguntas, en cualquier
granularidad.

> `chunks` es `NUMERIC` y postgres.js lo devuelve como **string**. Convertir con
> `Number()` en la capa de queries, como ya hace `getWorkLogs`.

> **El join no duplica distracciones.** Las distracciones viven en `sessions` y
> los bloques en `work_logs`. Sumar `s.distraction_count` sobre el join sería
> doble conteo si una sesión tuviera varios work_logs — pero `insertWorkLog`
> atrapa el `23505` y tira `DuplicateWorkLogError`, o sea hay unique sobre
> `session_id`. La relación es 1:1 y la suma es segura.

### Las funciones puras

En `lib/analytics/efficiency.ts`, extendiendo `minutesPerChunk` que ya existe:

| Función | Qué hace |
|---|---|
| `weightedAverage(rows)` | `sum(segundos) / sum(bloques)` → min/bloque |
| `blocksPerStudyDay(rows)` | `sum(bloques)` ÷ días con estudio |
| `distractionsPerHour(rows)` | `sum(distracciones)` ÷ horas |
| `groupByPeriod(rows, "week" \| "month")` | agrupa los días en semanas o meses |
| `compare(actual, anterior)` | el delta y si mejoró, según la dirección |
| `byLabel(rows)` | el desglose por materia |

> ⚠️ **Nunca promediar promedios.** El promedio del período es
> `sum(segundos)/sum(bloques)`, no el promedio de los min/bloque de cada día:
> un día corto distorsiona el período entero.

## Nomenclatura: "bloque", no "chunk"

En la UI la unidad se llama **bloque** (min/bloque). "Chunk" es vocabulario de
programador en una app de estudio.

**El rename es SÓLO de copy.** La columna `chunks` y el campo de la API no se
tocan: un `ALTER ... RENAME` es una migración no auto-mergeable según el
CLAUDE.md, y revertir el código no la revierte.

Se aceptó a sabiendas un choque conceptual: en una app de Pomodoro "bloque"
también evoca un bloque de tiempo. Verificado por grep que no hay colisión
literal en el copy actual — todos los usos de "bloque" en el repo son el verbo
"bloquear/desbloquear".

## Endpoint

`GET /api/stats/efficiency?from=&to=&tz=`, con la forma de
[stats/heatmap/route.ts](../../app/api/stats/heatmap/route.ts) — auth primero, tz
con fallback defensivo. Sin `Promise.all`: heatmap corre dos queries, acá hay
una sola.

## UI

**Ubicación: dentro de [Dashboard](../../components/Dashboard/index.tsx), en el
tab "Estadísticas".**

> Corrección sobre la versión anterior de este plan, que la ubicaba en
> Historial. El botón de entrada vive en la fila de tarjetas, que es Dashboard.
> En **mobile** Dashboard e Historial están en el mismo panel
> ([HomeClient.tsx:318-320](../../components/HomeClient.tsx)), pero en
> **desktop están en tabs separados** (261-264): con la vista en Historial,
> tocar el botón te saltaría de tab. La razón original para elegir Historial era
> no agregar un tab nuevo, y Dashboard respeta esa misma restricción.

### La entrada: un botón fino en la fila de tarjetas

`grid-cols-2` pasa a `grid-cols-[1fr_1fr_auto]` en
[Dashboard/index.tsx](../../components/Dashboard/index.tsx). Las tarjetas bajan
de ~164px a ~140px y el botón se lleva ~48px.

**Una tercera tarjeta no entra**: en 360px cada una quedaría en ~106px (82px
útiles) y el `text-2xl` más "sesiones" necesita ~84px. Rompe el wrap.

El ícono es un gráfico con flecha, **no un `+`** — `+` significa "agregar", y
acá estás entrando a un lugar, no creando nada.

### Al abrirse, el panel se estira

El bloque de stats está capado en `max-h-[45%]`
([HomeClient.tsx:239](../../components/HomeClient.tsx)), que deja ~320px de alto
útil. Cuatro tarjetas son ~480px: scrollear ahí es miserable.

Con los informes abiertos, en **desktop** el MusicPanel sale del layout y el
bloque de stats pasa a `flex-1`, llegando a ~760px. En **mobile** no hace falta:
el panel de historial ya es `absolute inset-0` a pantalla completa; sólo se
esconde el Historial de abajo.

> 🚨 **El MusicPanel se esconde con `hidden` (`display:none`), NUNCA
> desmontándolo.** El player de Spotify vive en un `playerRef` dentro de
> [useSpotifyPlayer.ts](../../hooks/useSpotifyPlayer.ts) y el hook **no tiene
> cleanup de unmount** — `disconnect()` sólo se llama desde `handleDisconnect`.
> Al desmontar, el player queda **huérfano**: el audio sigue sonando pero la app
> pierde el control. Y al volver a montar,
> [SpotifyPanel.tsx:52-54](../../components/MusicPanel/SpotifyPanel.tsx) corre
> `initSDK()` otra vez y registra un **segundo** dispositivo "Pomodoro".
>
> El repo ya resuelve esto en los tabs de mobile con `opacity-0
> pointer-events-none` (HomeClient.tsx:314). En desktop no alcanza con opacity:
> el MusicPanel está en flujo flex normal y seguiría ocupando su espacio, así
> que va `hidden`.

### Contenido de la vista

Header con back, filtros arriba, y las tarjetas en **scroll vertical** (no
carrusel: el panel ya tiene `overflow-y-auto` y el scroll deja ver la siguiente
tarjeta asomando, igual en mobile y desktop).

- **Selector de granularidad** — Semana / Mes
- **Chips de materia** — una por `label`, se prenden y apagan; filtran en el
  cliente
- **Tarjeta de período actual** — los cuatro números con su delta contra el
  período anterior y la flecha en la dirección correcta
- **Series por período** — barras de min/bloque y de bloques/día
- **Desglose por materia** — del período actual

**Empty state honesto:** los informes sólo cubren sesiones con el checkbox de
teoría tildado y bloques cargados. Si no hay datos tiene que decir eso
explícitamente, no mostrar un gráfico vacío que parece un bug.

## Orden TDD

1. `lib/analytics/__tests__/efficiency.test.ts` → las funciones puras, con sus
   casos borde (series vacías, un solo período, división por cero, días sin
   estudio)
2. `lib/db/queries/__tests__/stats.test.ts` → `getStudyEfficiencyByDay` convierte
   los NUMERIC a number
3. `app/api/__tests__/stats-efficiency.test.ts` → auth, tz, forma de la respuesta
4. Tests de los componentes, incluido el empty state y que el MusicPanel no se
   desmonte al abrir los informes
5. Recién ahí, implementar

## Caveat de producto

La métrica sólo es comparable **mientras el criterio de porcionado no cambie**.
El día que los bloques se agranden, el min/bloque sube y va a parecer un
retroceso cuando en realidad se está haciendo más por bloque. Vale la pena que
la UI lo diga en algún lado.
