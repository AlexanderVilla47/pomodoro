# 005 — Desacoplar Pomy de su autor: unidad configurable, informes universales y preferencias

**Estado:** ⬜ Pendiente
**Depende de:** [001 — Chunks de estudio](001-chunks-estudio.md), [003 — Informes de progreso](003-informes-progreso.md) y [004 — Ajustes a los informes](004-ajustes-informes.md) — ✅ los tres están

## Por qué

Pomy se construyó para un usuario. Eso no fue un error: fue lo correcto mientras
hubo un usuario. Pero ahora hay otros, y el diagnóstico es incómodo de leer:

**La tabla `settings` tiene cinco columnas y las cinco son del temporizador.** No
hay una sola preferencia que diga qué features quiere este usuario. La noción no
existe — no está mal implementada, no está.

Y en [`components/HomeClient.tsx`](../../components/HomeClient.tsx) todo se monta
incondicionalmente: el modal del journal, la presencia, los cheers, el panel de
amigos, los informes. Nadie puede decir que no a nada.

### Lo que se encontró al leer el código

Dos hallazgos cambian el enfoque respecto de la intuición inicial ("los bloques
molestan a quien no los usa"):

**1. Los bloques ya son opt-in por sesión.** El checkbox de
[`JournalPrompt`](../../components/JournalPrompt/index.tsx) arranca en `false`;
si no se tilda, `chunks` va `NULL` y la sesión queda explícitamente fuera del
análisis. Eso ya está bien diseñado y no hay que tocarlo.

**2. El problema real es al revés, y es más grave.** La query
`getStudyEfficiencyByDay` en
[`lib/db/queries/stats.ts:56-62`](../../lib/db/queries/stats.ts) filtra:

```sql
FROM work_logs w
JOIN sessions s ON s.id = w.session_id
WHERE w.user_id = ${userId}
  AND s.type = 'work'
  AND w.is_theory = true
  AND w.chunks > 0
```

O sea: **el panel entero de informes está compuertado por bloques.** Un usuario
que hace 200 pomodoros y nunca tilda "teoría" no ve métricas de bloques mezcladas
con las suyas — no ve **nada**, para siempre. Le queda el empty state
*"Todavía no hay nada para medir"* como estado permanente.

Y sin embargo dos de las cuatro métricas (`distractionsPerHour`, y el tiempo que
la alimenta) **no necesitan un solo bloque para calcularse**: salen de `sessions`
sola. Están escondidas detrás de un filtro que no les corresponde.

Entonces el trabajo no es "esconderle los bloques al que no los usa". Es:

| Parte | Qué hace |
|---|---|
| **D** | Generalizar: "bloque" pasa a ser la unidad que el usuario define |
| **E** | Que los informes sirvan **sin** bloques, y que lo de bloques aparezca solo si hay bloques |
| **C** | Una capa flaca de preferencias para lo único que ningún dato puede contestar |

### La regla que decide qué va en cada parte

> **Si el dato ya responde la pregunta, no hagas un setting.**
> **Si es intrusivo o es privacidad, no lo infieras del dato: preguntá.**

Por eso la lista de flags es corta a propósito:

| Feature | ¿Flag? | Por qué |
|---|---|---|
| Bloques | ❌ | **D** los generaliza; dejan de ser idiosincráticos |
| Métricas de unidades | ❌ | **E**: hay dato → se muestran; no hay → se callan |
| Música / Spotify | ❌ | Es un tab. No lo abrís y ya. No empuja nada |
| Modal del journal | ✅ | Ningún dato dice si querés que te pregunten después de cada pomodoro |
| Presencia + amigos + cheers | ✅ | Es privacidad. No se infiere jamás |

**Dos flags.** Si esta lista crece a seis, el diseño falló: seis flags son 64
combinaciones de UI y se van a testear tres.

---

## Se entrega en cuatro PRs

Un cambio, una rama, un PR — y acá hay cuatro cambios distintos. En este orden,
porque el 1 habilita a los demás:

| PR | Rama | Qué entrega | Visible al usuario |
|---|---|---|---|
| 1 | `feat/preferencias-capa` | Migración + módulo puro + API | No |
| 2 | `feat/unidad-configurable` | **D** — la unidad en la UI | Sí |
| 3 | `feat/informes-sin-bloques` | **E** — informes universales | Sí |
| 4 | `feat/preferencias-journal-social` | **C** — los dos toggles | Sí |

El PR 3 (**E**) sólo depende del 2 para los rótulos. Si hay que cortar, ese es el
punto de corte: los PRs 1–2 dejan el sistema consistente.

---

## PR 1 — La capa de preferencias

### La migración: aditiva, idempotente, una sola columna

```sql
ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS preferences JSONB NOT NULL DEFAULT '{}'::jsonb
```

Va al final de `runMigrations` en
[`lib/db/migrations.ts`](../../lib/db/migrations.ts), **antes** del bloque que
activa RLS (ese bloque itera `pg_tables` y tiene que quedar último).

**Una columna JSONB y no una columna por flag.** Con columnas sueltas, cada
feature nueva es un `ALTER TABLE` más un campo en cuatro archivos. Con JSONB, es
una entrada en un objeto tipado. La contra honesta: Postgres deja de validar la
forma. Por eso la forma la valida el resolver, y por eso el resolver es una
función pura con tests.

⚠️ **La columna `chunks` NO se renombra.** Un rename no es aditivo: revertir el
código no revierte un `ALTER`, y [`CLAUDE.md`](../../CLAUDE.md) lo marca como algo
que no se auto-mergea. `chunks` es un nombre interno y ahí se queda; lo
configurable es el **rótulo**, no la columna.

### `lib/preferences/index.ts` — el resolver, función pura

```ts
export interface Preferences {
  /** Rótulo singular de la unidad de avance. "bloque", "página", "ejercicio". */
  unitSingular: string;
  /** Plural. Se guarda aparte porque el español no se pluraliza a ciegas. */
  unitPlural: string;
  /** ¿Preguntar "¿en qué trabajaste?" al terminar cada pomodoro? */
  journal: boolean;
  /** Presencia + amigos + cheers. Es privacidad, no es gusto. */
  social: boolean;
}

export const DEFAULT_PREFERENCES: Preferences = {
  unitSingular: "bloque",
  unitPlural: "bloques",
  journal: true,
  social: true,
};

export const MAX_UNIT_LENGTH = 24;

/** JSONB crudo → objeto completo. Nunca devuelve nada parcial. */
export function resolvePreferences(raw: unknown): Preferences;

/** Plural del español, con las reglas que cubren el 95% de lo que alguien tipea. */
export function pluralizeEs(singular: string): string;
```

**Los defaults viven acá y no en la base.** Es la decisión de diseño central de
este PR: si el default fuera `DEFAULT true` en Postgres, el día que quieras
cambiar de opinión ya tenés N filas con el valor viejo grabado y **no hay forma
de distinguir "el usuario eligió `true`" de "el usuario nunca eligió"**. Con
`'{}'` y defaults en código, esa distinción se conserva para siempre.

`resolvePreferences` normaliza, no rechaza: recorta strings, capea a
`MAX_UNIT_LENGTH`, cae al default si el valor está vacío o no es del tipo
esperado. Una fila con basura adentro tiene que resolver a algo usable.

Reglas de `pluralizeEs`:

| Termina en | Regla | Ejemplo |
|---|---|---|
| vocal (incl. tildada) | `+s` | bloque → bloques, página → páginas |
| `z` | `z → ces` | lápiz → lápices |
| `s` | sin cambio | tesis → tesis |
| otra consonante | `+es` | nivel → niveles, unidad → unidades |

No es perfecta — "card" da "cardes". **Por eso el plural se guarda aparte y la UI
lo muestra prellenado y editable**: la app admite que adivina, muestra su
adivinanza, y deja corregirla. Un `pluralize()` que se aplique en silencio en el
render sería peor: nadie puede arreglarlo.

### `getSettings` resuelve; `upsertSettings` mergea

En [`lib/db/queries/settings.ts`](../../lib/db/queries/settings.ts):

- `Settings` gana `preferences: Preferences` (el tipo resuelto, **no** `unknown`).
- `getSettings` corre `resolvePreferences(row.preferences)` antes de devolver.
  **Ningún componente ve JSONB crudo, nunca.** Misma jugada que el
  `notification_sound_enabled === 1` que ya está ahí: la capa de queries traduce.
- `upsertSettings` hace **merge superficial**, no reemplazo:

  ```ts
  const nextPrefs = { ...current.preferences, ...(patch.preferences ?? {}) };
  ```

  ⚠️ Si esto reemplazara en vez de mergear, apagar `journal` te borraría la
  unidad configurada. El merge es superficial porque la forma es plana; si algún
  día se anida, este comentario deja de ser cierto y hay que revisarlo.

### La API valida — y acá sí se puede devolver 400

En [`app/api/settings/route.ts`](../../app/api/settings/route.ts), el `PUT`
rechaza `preferences` si no es un objeto plano (`400`), y deja el resto al
resolver.

**Por qué acá un 400 es seguro y en `/api/work-logs` sería una bomba:**
`SettingsContext.updateSettings` hace un `fetch` directo y evalúa `res.ok` — no
hay cola, no hay reintento, un error se descarta y listo. `useWorkLogger`, en
cambio, sólo da por entregado un item con `201` o `409` y reencola todo lo demás
para siempre: ahí un 400 es una poison pill. **Son contratos opuestos y hay que
tenerlo presente al tocar cualquiera de los dos.**

### `hooks/usePreferences.ts`

```ts
export function usePreferences(): Preferences
```

Wrapper flaco sobre `useSettingsContext`. Existe para que los componentes
pregunten *"¿estoy prendido?"* y no *"¿qué dice la columna?"* — el día que la
decisión dependa de dos cosas, se cambia en un archivo y no en quince.

### Tests del PR 1 (TDD, en este orden)

1. `lib/preferences/__tests__/preferences.test.ts`
   - `resolvePreferences({})` → `DEFAULT_PREFERENCES`
   - `resolvePreferences(null | "texto" | 42)` → `DEFAULT_PREFERENCES`
   - respeta un valor parcial y completa el resto con defaults
   - recorta espacios, capea a `MAX_UNIT_LENGTH`, cae al default si queda vacío
   - ignora un `journal: "sí"` (no booleano) y usa el default
   - `pluralizeEs`: los cuatro casos de la tabla
2. `lib/db/queries/__tests__/settings.test.ts` (nuevo)
   - `getSettings` devuelve preferencias resueltas con la columna en `{}`
   - `upsertSettings` **mergea**: patchear `{ journal: false }` conserva `unitSingular`
3. `app/api/__tests__/settings.test.ts` (existente)
   - `PUT` con `preferences: "no-soy-objeto"` → `400`
   - `PUT` con preferencias parciales las pasa al upsert
4. `context/__tests__/SettingsContext.test.tsx` — `DEFAULT_SETTINGS` del fixture
   gana `preferences`

---

## PR 2 — D: la unidad de avance configurable

### La idea

"Bloque" no es idiosincrático. **El nombre lo es.** El concepto —*una unidad de
avance que el usuario define*— le sirve a cualquiera que estudie o produzca algo
contable: páginas, ejercicios, problemas, cards, capítulos, tickets.

Y el modelo de datos ya lo soporta: `chunks NUMERIC(5,2)` es agnóstico. Esto es
casi todo renombrar en la capa de presentación.

### Dónde está "bloque" hardcodeado

[`components/JournalPrompt/index.tsx`](../../components/JournalPrompt/index.tsx):

- `"Estudié teoría por bloques"` → `Medí el avance en ${unitPlural}`
- `{chunks === 1 ? "bloque" : "bloques"}` → `unitSingular` / `unitPlural`
- `aria-label="Restar medio bloque"` / `"Sumar medio bloque"` → con `unitSingular`
- `data-testid="bloques-value"` → **renombrar a `unit-value`**; el testid no puede
  depender del rótulo que el usuario elige

[`components/Dashboard/StudyReports.tsx`](../../components/Dashboard/StudyReports.tsx):

- `METRICS`: `label` pasa de string a `(u: Preferences) => string`
  → `min/${u.unitSingular}`, `${u.unitPlural}/día`
- Títulos de las series (`"min/bloque"` / `"bloques/día"`) — misma función
- Desglose por materia: el `"min/bloque"` de la última columna
- Empty state: `"marcadas como teoría con bloques cargados"`
- ⚠️ `m.id` (`"minutes-per-block"`, `"blocks-per-day"`) **no se toca**: alimenta
  `data-testid` y es identidad, no rótulo. Mismo criterio que `chunks` en la base.

Los nombres internos de `Summary` (`minutesPerBlock`, `blocksPerDay`) tampoco se
tocan. Son código, no UI.

### SettingsPanel

Sección nueva, arriba del botón de guardar:

```
Cómo medís tu avance
  [ bloque      ]  [ bloques     ]
   singular         plural
```

El campo plural se autocompleta con `pluralizeEs(singular)` **mientras el usuario
no lo haya editado a mano**; una vez tocado, deja de seguirlo. Un flag local
`pluralTouched` alcanza.

Validación: 1–24 caracteres, no vacío tras `trim()`. Reusa el patrón de `error`
que el panel ya tiene.

### Tests del PR 2

1. `JournalPrompt.test.tsx`: con `preferences.unitSingular = "página"` el stepper
   dice `"páginas"` en plural y `"página"` en 1; el aria-label acompaña
2. `StudyReports.test.tsx`: los rótulos de métrica salen `min/página`, `páginas/día`
3. `SettingsPanel.test.tsx`: tipear `"ejercicio"` prellena `"ejercicios"`;
   editar el plural a mano y volver a tocar el singular **no** pisa lo editado;
   guardar manda `preferences: { unitSingular, unitPlural }`

---

## PR 3 — E: informes que sirven sin una sola unidad

### El cambio de query

En [`lib/db/queries/stats.ts`](../../lib/db/queries/stats.ts), `getStudyEfficiencyByDay`
**invierte el FROM**: hoy arranca en `work_logs` y ata sesiones; tiene que
arrancar en `sessions` y atar work logs opcionalmente.

```sql
SELECT
  (s.started_at + make_interval(mins => ${opts.tz}))::date::text AS day,
  l.id AS label_id, l.name AS label_name, l.color AS label_color,
  COALESCE(SUM(s.actual_duration), 0)::int                       AS total_seconds,
  COALESCE(SUM(s.actual_duration)
    FILTER (WHERE w.is_theory AND w.chunks > 0), 0)::int          AS unit_seconds,
  COALESCE(SUM(w.chunks)
    FILTER (WHERE w.is_theory AND w.chunks > 0), 0)               AS total_chunks,
  COUNT(*)::int                                                   AS sessions,
  COALESCE(SUM(s.distraction_count), 0)::int                      AS distractions
FROM sessions s
LEFT JOIN work_logs w ON w.session_id = s.id
LEFT JOIN labels l ON l.id = s.label_id
WHERE s.user_id = ${userId}
  AND s.type = 'work'
  AND (s.started_at + make_interval(mins => ${opts.tz}))::date >= ${opts.from}::date
  AND (s.started_at + make_interval(mins => ${opts.tz}))::date <= ${opts.to}::date
GROUP BY day, l.id, l.name, l.color
ORDER BY day
```

Ojo con dos cosas:

- **El filtro de usuario se mueve de `w.user_id` a `s.user_id`.** Con `LEFT JOIN`,
  filtrar por `w.user_id` en el `WHERE` anularía el LEFT y volvería a dejar afuera
  las sesiones sin log. `sessions.user_id` existe y es la fuente correcta acá.
- **`unit_seconds` es columna nueva y es lo que vuelve correcto a min/unidad.**
  Si `weightedAverage` siguiera dividiendo `total_seconds / total_chunks`, ahora
  que `total_seconds` incluye sesiones sin unidades, el número se inflaría en
  silencio. Esta es la trampa principal del PR.

### `lib/analytics/efficiency.ts`

- `EfficiencyRow` gana `unit_seconds: number`
- `totals()` acumula `unitSeconds`
- `weightedAverage` divide **`unitSeconds`** / `chunks` (era `seconds`)
- `distractionsPerHour` sigue con `seconds` — que ahora es *todo* el trabajo, y
  eso es **más** correcto que antes: los cortes se normalizan contra el tiempo
  real, no contra el subconjunto de teoría
- `Summary` gana `totalUnits: number`, para que la UI pueda preguntar "¿este
  usuario mide algo?" sin adivinar desde un `null`
- `studyDays` no cambia: sigue contando días con `total_chunks > 0`

### `StudyReports.tsx`

`METRICS` gana un campo declarativo:

```ts
requires: "units" | "always"
```

`min/unidad`, `unidades/día` y `días estudiados` son `"units"`;
`cortes/hora` es `"always"`.

Luego:

```ts
const hasUnits = periods.some((p) => p.totalUnits > 0);
const visibleMetrics = METRICS.filter((m) => m.requires === "always" || hasUnits);
```

Y con el mismo `hasUnits` se compuertan las dos series de barras y el desglose
"Por materia" (que muestra `min/unidad` y sin unidades no dice nada).

**Declarativo y no un `if` por métrica**: el `METRICS` de hoy ya es un registro,
sólo le faltaba una columna. Agregar una métrica nueva sigue siendo agregar una
entrada al array.

### El empty state

Ya no puede decir *"los informes miran sólo las sesiones marcadas como teoría"*:
deja de ser verdad. Queda para el caso real de "no hay ninguna sesión de trabajo
todavía". Texto sugerido:

> Todavía no hay sesiones para medir.
> Terminá un pomodoro y acá vas a ver tu tiempo y tus cortes.

Y cuando hay sesiones pero no unidades, **no se muestra ningún aviso**: se ven las
métricas que aplican y nada más. El [004](004-ajustes-informes.md) ya cerró esta
discusión — las leyendas explicativas se sacaron por muro de texto. Que el panel
muestre menos cosas es la respuesta, no un párrafo que lo explique.

### Tests del PR 3

1. `lib/analytics/__tests__/efficiency.test.ts`
   - `weightedAverage` usa `unit_seconds`: una fila con `total_seconds: 6000`,
     `unit_seconds: 3000`, `total_chunks: 2` da **25**, no 50 ← el test clave
   - `distractionsPerHour` cuenta el tiempo total, incluidas sesiones sin unidades
   - `summarize` devuelve `totalUnits`
   - filas sin unidades: `minutesPerBlock`/`blocksPerDay` en `null`, `studyDays` 0,
     `distractionsPerHour` con número
2. `lib/db/queries/__tests__/stats.test.ts`: la query incluye sesiones sin
   `work_log` (sobre el tag `sql` mockeado, verificando la forma del fragmento)
3. `StudyReports.test.tsx`
   - sin unidades: se ve `metric-distractions-per-hour`, **no** se ven
     `metric-minutes-per-block` ni las series ni `label-breakdown`
   - con unidades: se ven las cuatro
   - sin sesiones: `reports-empty`

---

## PR 4 — C: los dos toggles

### `journal: false`

En [`HomeClient.tsx`](../../components/HomeClient.tsx):

- `handleSessionComplete` no setea `pendingClientId`
- `JournalPrompt` y `JournalBridge` no se montan (ni desktop ni mobile)
- No se guarda la fila vacía de `handleJournalClose`: sin pregunta no hay
  "no contesté" que registrar

Default `true`: es opt-**out**. El journal es lo que alimenta los informes y hoy
es el comportamiento existente; arrancarlo apagado sería una regresión silenciosa
para quien ya lo usa.

### `social: false`

- No se montan `PresenceHeartbeat` ni `CheerPulse`
- No se dispara el `fetch("/api/cheers/reveal")` de `handleSessionComplete`
- Se saca el tab "Amigos" de los dos layouts (mobile y desktop)
- ⚠️ Si el tab activo era `friends` cuando se apaga, hay que caer a `timer`
  (mobile) y `stats` (desktop), o el panel queda en blanco

✅ **No hace falta ningún endpoint de limpieza de presencia.** La query de amigos
([`lib/db/queries/friends.ts`](../../lib/db/queries/friends.ts)) ya resuelve
`'offline'` cuando `p.updated_at < NOW() - INTERVAL '120 seconds'`: dejar de
mandar el heartbeat te apaga solo en dos minutos. **No agregar un DELETE
/api/presence** — se verificó y no es necesario.

### La decisión incómoda: `social` arranca en `true`

Lo correcto para un producto público es que la privacidad sea opt-in: default
`false`. **No se hace acá, a propósito**, porque el default vive en código y se
aplica a toda fila con `preferences = '{}'`: el deploy dejaría a todos los que ya
tienen amigos desconectados de golpe, sin haber pedido nada.

Queda anotado como lo que es — deuda consciente, no olvido: **cuando exista un
onboarding que pregunte, `social` pasa a default `false` y el onboarding se
encarga de los que ya están.** Ahí, y no antes.

### SettingsPanel

```
Qué querés usar
  [x] Preguntarme en qué trabajé al terminar cada pomodoro
  [x] Amigos y presencia — otros pueden ver cuándo estás estudiando
```

El segundo rótulo dice qué implica, no sólo cómo se llama. Un toggle de privacidad
que no explica qué comparte no es un consentimiento.

### Tests del PR 4

1. `HomeClient.preferences.test.tsx` (nuevo)
   - `journal: false` → al terminar una sesión no aparece el prompt
   - `journal: false` → no se llama a `saveWorkLog`
   - `social: false` → no hay tab "Amigos"; no se pega a `/api/presence` ni a
     `/api/cheers`
   - `social: false` con el tab en `friends` → cae a `timer`
2. `SettingsPanel.test.tsx`: destildar manda `preferences: { journal: false }` y
   **no** pisa `unitSingular` (el merge del PR 1, verificado de punta a punta)

---

## Archivos

| Archivo | PR | Qué pasa |
|---|---|---|
| `lib/db/migrations.ts` | 1 | `+ preferences JSONB` (antes del bloque RLS) |
| `lib/preferences/index.ts` | 1 | **nuevo** — resolver + `pluralizeEs` |
| `lib/preferences/__tests__/preferences.test.ts` | 1 | **nuevo** |
| `lib/db/queries/settings.ts` | 1 | `Settings.preferences`, resolver al leer, merge al escribir |
| `lib/db/queries/__tests__/settings.test.ts` | 1 | **nuevo** |
| `app/api/settings/route.ts` | 1 | valida `preferences` |
| `app/api/__tests__/settings.test.ts` | 1 | casos nuevos |
| `hooks/usePreferences.ts` | 1 | **nuevo** |
| `context/__tests__/SettingsContext.test.tsx` | 1 | fixture |
| `components/JournalPrompt/index.tsx` | 2 | rótulos + `testid` renombrado |
| `components/Settings/SettingsPanel.tsx` | 2, 4 | unidad; después los toggles |
| `lib/db/queries/stats.ts` | 3 | query invertida + `unit_seconds` |
| `lib/analytics/efficiency.ts` | 3 | `unit_seconds`, `totalUnits`, `weightedAverage` |
| `components/Dashboard/StudyReports.tsx` | 2, 3 | rótulos; después `requires` |
| `components/HomeClient.tsx` | 4 | montaje condicional |
| `components/__tests__/HomeClient.preferences.test.tsx` | 4 | **nuevo** |

## Cómo se verifica

`npm test` y `npm run typecheck` en verde en cada PR (**nunca `npm run build`**).
Y a mano, después del PR 4:

1. **Usuario nuevo, sin tocar nada**: hace un pomodoro, le aparece el journal, no
   tilda la unidad. Entra a informes → **ve cortes/hora y su tiempo**, no un
   panel vacío. ← es el bug que motivó todo el plan
2. **Cambiar la unidad a "página"**: el stepper del journal y los rótulos de los
   informes dicen "página"/"páginas" en todos lados
3. **Apagar el journal**: termina un pomodoro y no aparece nada. Los informes
   siguen mostrando tiempo y cortes
4. **Apagar lo social**: desaparece el tab Amigos. Desde otra cuenta amiga,
   confirmar que a los ~2 minutos figurás `offline` — sin endpoint de limpieza
5. **Merge de preferencias**: configurar la unidad, después apagar el journal,
   recargar → la unidad sigue ahí

## Decisiones tomadas (y las descartadas)

- **Una columna JSONB, no una por flag.** La opción obvia era
  `journal_enabled BOOLEAN`, `social_enabled BOOLEAN`, etc. Es más barata hoy y
  peor a seis meses: una columna por feature para siempre, `if (settings.x)`
  desparramado, y componentes que conocen la forma de la tabla. Se descartó.
- **Defaults en código, nunca en la base.** Un `DEFAULT true` en Postgres borra
  la diferencia entre "eligió" y "nunca eligió", y esa diferencia no se recupera.
- **`chunks` y los `m.id` de las métricas no se renombran.** Identidad, no rótulo.
  Además, un rename en la base no se auto-mergea por [`CLAUDE.md`](../../CLAUDE.md).
- **El plural se guarda, no se calcula en el render.** `pluralizeEs` adivina y
  falla con préstamos ("card" → "cardes"); mostrando la adivinanza en un campo
  editable, el usuario la corrige una vez. Calculándola en silencio, no la puede
  corregir nunca.
- **`social` arranca en `true` aunque lo correcto sea `false`.** Documentado
  arriba, con la condición exacta para cambiarlo.
- **Sin presets ni perfiles ("modo simple / estudio / trabajo").** Con dos flags
  no hay nada que agrupar; un preset acá sería ceremonia sobre dos checkboxes.
  Si la lista crece, se reconsidera — pero que crezca ya es la señal de alarma.
