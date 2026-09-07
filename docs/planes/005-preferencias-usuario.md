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
| **D** | Generalizar: "bloque" deja de existir por default y pasa a ser la unidad que cada usuario define (o ninguna) |
| **E** | Que los informes sirvan **sin** unidades, y que lo de unidades aparezca solo si hay unidades |
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

## El modelo que ordena todo: dos niveles de estadísticas

Esta es la columna vertebral del plan. Todo lo demás sale de acá.

Pomy mide dos clases de cosas, y hoy están mezcladas en una sola pila detrás del
mismo filtro. Hay que separarlas:

### Nivel 1 — Universal. Sin configurar nada. Todos, siempre.

Sale **sólo de `sessions`**. Existe desde el pomodoro número uno, sin que el
usuario sepa qué es una "unidad":

| Métrica | Cómo se calcula |
|---|---|
| **Horas estudiadas** | suma de `actual_duration` del período |
| **Días trabajados** | días distintos con al menos una sesión de trabajo |
| **Cortes/hora** | `distractions / horas`, con el piso de `MIN_SECONDS_FOR_RATE` |

### Nivel 2 — De ritmo. Sólo si la persona cargó unidades.

Sale de `work_logs.chunks` **más el tiempo de esas sesiones**:

| Métrica | Cómo se calcula |
|---|---|
| **min/{unidad}** | `unit_seconds / 60 / unidades` |
| **{unidades}/día** | unidades ÷ días con avance |
| **Días con avance** | días distintos con `chunks > 0` (era "días estudiados") |

### Las tres reglas que salen de esta separación

**1. El Nivel 2 no reemplaza al 1: se apila arriba.** Hoy las métricas de bloques
*compuertan* el panel entero. Después del plan son una capa extra que aparece
cuando hay con qué calcularla. Nadie ve un panel vacío nunca más.

**2. El Nivel 1 es comparable entre personas. El Nivel 2 es privado por
definición.** El tiempo es tiempo para todos, pero "min/página" de uno y
"min/card" de otro **no son la misma magnitud**: son cantidades distintas con el
mismo nombre de fórmula. Cualquier cosa que compare usuarios — el panel de
amigos, un ranking futuro — usa Nivel 1 y **nada más**. Hoy
[`friends.ts`](../../lib/db/queries/friends.ts) compara `today_seconds` y
`week_seconds`, o sea ya cumple la regla sin saberlo. **Queda escrita para que
nadie agregue un "ranking de bloques" en seis meses.**

**3. Una métrica no se prende: se calcula o no se calcula.** No hay un toggle de
"mostrar métricas de ritmo". Si hay unidades cargadas, aparecen. Si no, no. La
app no le pregunta al usuario si quiere una métrica; mira si la puede calcular.

---

## Qué unidades se permiten (y por qué eso decide las estadísticas)

Si la unidad es texto libre sin reglas, alguien escribe "horas" y Pomy le muestra
orgullosamente **min/hora = 60**, para siempre. Un número perfectamente correcto
y perfectamente inútil.

Entonces: **no toda palabra sirve como unidad.** Para que `min/unidad` signifique
algo, la unidad tiene que ser:

- **algo que se produce**, no una medida del tiempo que se tardó
- **razonablemente parejo en tamaño** entre una y otra, o el promedio es ruido

### La lista guiada (un tap, sin tipear)

`páginas` · `ejercicios` · `cards` · `problemas` · `capítulos` · `temas` ·
`videos` · `prácticos` · `bloques`

Cada preset trae **singular y plural ya escritos**, así que el que elige de la
lista nunca ve un campo de plural ni se topa con `pluralizeEs`.

### Texto libre, con una puerta

El que cuenta katas, commits o partituras tiene que poder escribirlo. Se permite
cualquier texto de 1 a 24 caracteres **menos** las palabras que rompen la
métrica:

```
hora, horas, minuto, minutos, sesión, sesiones,
pomodoro, pomodoros, día, días, semana, semanas
```

Con un mensaje que enseña en vez de sólo negar:

> *Pomy ya mide tu tiempo solo. Elegí algo que **produzcas**: páginas,
> ejercicios, cards…*

Es una función pura, `validateUnit()`, comparando sin tildes ni mayúsculas. La
regla vive en `lib/preferences/` y no en el componente: si mañana el mismo texto
entra por otro lado, la regla viaja con él.

### Cambiar de unidad a mitad de camino

Si alguien usó "páginas" un mes y se pasa a "cards", **sus `chunks` históricos
siguen siendo páginas** y el promedio los mezcla en silencio. Es la trampa obvia
de que la unidad viva en `settings` y no en cada fila.

Solución de este plan: **avisar al cambiar**, no impedirlo.

> *Ya cargaste 47 páginas. Si cambiás la unidad, ese historial se va a mezclar
> con las cards nuevas en los promedios.*

La solución exacta sería guardar la unidad **en cada `work_log`** y agrupar los
informes por unidad. Es una columna más y una dimensión más en todo el análisis:
**desproporcionado para un caso que la mayoría hace cero veces.** Queda anotado
como la salida si alguna vez molesta de verdad.

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
[`lib/db/migrations.ts`](../../lib/db/migrations.ts), seguida del **backfill de
unidad** (más abajo), y las dos **antes** del bloque que activa RLS — ese bloque
itera `pg_tables` y tiene que quedar último.

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
  /**
   * Rótulo singular de la unidad de avance. `null` = sin configurar.
   *
   * ⚠️ NO tiene default. "bloque" es media página del apunte de una persona:
   * existe en su cocina, no en el mundo. Un usuario nuevo que lee "medí el
   * avance en bloques" no tiene forma de saber qué le están preguntando.
   */
  unitSingular: string | null;
  /** Plural. Se guarda aparte porque el español no se pluraliza a ciegas. */
  unitPlural: string | null;
  /** ¿Preguntar "¿en qué trabajaste?" al terminar cada pomodoro? */
  journal: boolean;
  /** Presencia + amigos + cheers. Es privacidad, no es gusto. */
  social: boolean;
}

export const DEFAULT_PREFERENCES: Preferences = {
  unitSingular: null,   // ← sin unidad hasta que la persona elija una
  unitPlural: null,
  journal: true,
  social: true,
};

export const MAX_UNIT_LENGTH = 24;

/** Presets de la lista guiada, con las dos formas ya resueltas. */
export const UNIT_PRESETS: Array<{ singular: string; plural: string }>;

/** Palabras que rompen la métrica: son tiempo, no producto. */
export const BLOCKED_UNITS: readonly string[];

/** JSONB crudo → objeto completo. Nunca devuelve nada parcial. */
export function resolvePreferences(raw: unknown): Preferences;

/** `{ ok: true }` | `{ ok: false; reason: "empty" | "too-long" | "is-time" }` */
export function validateUnit(raw: string): UnitValidation;

/** Plural del español, con las reglas que cubren el 95% de lo que alguien tipea. */
export function pluralizeEs(singular: string): string;
```

`validateUnit` compara **sin tildes y sin mayúsculas** contra `BLOCKED_UNITS`
(`"Días"` y `"dias"` son la misma palabra). Una unidad inválida **no se guarda**:
`resolvePreferences` la descarta y cae a `null`, que es lo mismo que no haber
configurado nada.

### El backfill: que el cambio de default no le saque la unidad a nadie

Sacar el default `"bloque"` es correcto para los que vienen — y **le rompe la app
al que ya venía cargando bloques**, porque el default se aplica a toda fila con
`preferences = '{}'`.

Se arregla con un backfill guardado por dato, no por fecha:

```sql
UPDATE settings s
   SET preferences = s.preferences
       || '{"unitSingular":"bloque","unitPlural":"bloques"}'::jsonb
 WHERE s.preferences->>'unitSingular' IS NULL
   AND EXISTS (
     SELECT 1 FROM work_logs w
      WHERE w.user_id = s.user_id AND w.is_theory AND w.chunks > 0
   )
```

Lee: *"al que ya cargó bloques alguna vez, dejale 'bloque' como unidad; al resto,
no le inventes ninguna."*

Es idempotente: el `IS NULL` hace que la segunda corrida no toque nada, y el `||`
mergea sin pisar el resto del objeto. **Y es un `UPDATE` de datos, no un `ALTER`
de esquema**: revertir el código deja a lo sumo una unidad configurada que la
persona igual habría elegido. No entra en la categoría de migración irreversible
de [`CLAUDE.md`](../../CLAUDE.md).

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
   - `resolvePreferences({})` → `DEFAULT_PREFERENCES`, con **`unitSingular` en `null`**
   - `resolvePreferences(null | "texto" | 42)` → `DEFAULT_PREFERENCES`
   - respeta un valor parcial y completa el resto con defaults
   - recorta espacios, capea a `MAX_UNIT_LENGTH`, cae a `null` si queda vacío
   - **descarta una unidad bloqueada guardada en la base** (`"horas"` → `null`)
   - ignora un `journal: "sí"` (no booleano) y usa el default
   - `validateUnit`: acepta `"kata"`; rechaza `""`, 25 caracteres, `"horas"`,
     `"Días"` y `"SESIONES"` (sin tildes ni mayúsculas)
   - `pluralizeEs`: los cuatro casos de la tabla
   - los `UNIT_PRESETS` pasan todos `validateUnit`
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

[`components/JournalPrompt/index.tsx`](../../components/JournalPrompt/index.tsx)
tiene **dos estados ahora**, según haya unidad configurada o no.

#### Sin unidad configurada (el usuario nuevo): no hay casilla

Hoy un recién llegado se come `☐ Estudié teoría por bloques` sin tener idea de
qué es un bloque. **Esa casilla desaparece.** En su lugar, una línea discreta al
pie del modal:

```
+ Medir mi avance
```

Al tocarla, la configuración se abre **ahí mismo, adentro del modal** — no manda
a Configuración y no interrumpe el flujo:

```
¿En qué medís tu avance?
[páginas] [ejercicios] [cards] [problemas]
[capítulos] [temas] [videos] [prácticos] [bloques]
o escribí la tuya:  [________]
```

Elige un chip → queda guardado en preferencias, la casilla aparece con **su**
unidad, y desde el pomodoro siguiente ya está.

**Por qué inline y no en Configuración**: el momento en que a alguien se le ocurre
que quiere medir su avance es **justo cuando terminó de trabajar y le preguntan
qué hizo**. Mandarlo a otra pantalla en ese momento es perder la intención. Y
esconderlo sólo en Configuración lo vuelve invisible: nadie entra a Configuración
a ver qué hay.

⚠️ **La línea tiene que ser discreta, no un cartel.** Es una invitación, no un
pedido: la app funciona perfecta sin que nadie la toque nunca.

#### Con unidad configurada: como hoy, con su rótulo

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

Sección nueva, arriba del botón de guardar. **Mismo selector que el del journal**
— un componente compartido, `UnitPicker`, para que no haya dos UIs de lo mismo
que se desincronizan:

```
Cómo medís tu avance                    [ Sin unidad ▾ ]
  [páginas] [ejercicios] [cards] [problemas] …
  o escribí la tuya:  [__________]  plural: [__________]

  ☐ No medir mi avance      ← vuelve a null, saca la casilla del journal
```

- **El plural sólo aparece en el camino de texto libre.** Los presets ya lo traen
  resuelto: el que elige un chip nunca ve ese campo. Es el 90% de los casos.
- En texto libre, el plural se autocompleta con `pluralizeEs(singular)` **mientras
  no se lo edite a mano**; una vez tocado, deja de seguirlo (`pluralTouched`).
- Validación con `validateUnit`, mostrando el mensaje que enseña cuando alguien
  escribe "horas". Reusa el patrón de `error` que el panel ya tiene.

#### El aviso al cambiar de unidad

Si ya hay `chunks` cargados y se cambia la unidad, antes de guardar:

> *Ya cargaste 47 páginas. Si cambiás la unidad, ese historial se va a mezclar
> con las cards nuevas en los promedios.*

El conteo sale de un `GET /api/stats/efficiency` que el panel ya sabe pedir; si
falla, el aviso se muestra sin el número. **Avisa, no impide** — es información
del usuario, la decisión es suya.

### Tests del PR 2

1. `JournalPrompt.test.tsx`
   - **sin unidad**: no existe la casilla; existe `"+ Medir mi avance"`
   - tocar esa línea abre el selector; elegir `"cards"` guarda las preferencias
   - **con unidad**: el stepper dice `"páginas"` en plural y `"página"` en 1, y
     el `aria-label` acompaña
2. `StudyReports.test.tsx`: los rótulos salen `min/página`, `páginas/día`
3. `UnitPicker.test.tsx` (nuevo)
   - elegir un preset guarda singular **y** plural sin mostrar campo de plural
   - texto libre: `"ejercicio"` prellena `"ejercicios"`; editar el plural a mano y
     volver a tocar el singular **no** pisa lo editado
   - `"horas"` muestra el mensaje y no guarda
   - "No medir mi avance" manda `unitSingular: null`

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
- `studyDays` no cambia de cálculo (días con `total_chunks > 0`), pero **cambia de
  rótulo a "días con avance"**: ahora convive con "días trabajados" y confundirlos
  sería peor que no tenerlos

**Y las dos métricas nuevas del Nivel 1**, que son las que vuelven útil el panel
para quien no mide unidades:

```ts
/** Horas de trabajo del período. El dato más obvio, y hoy los informes no lo muestran. */
export function hoursStudied(rows: EfficiencyRow[]): number;

/**
 * Días distintos con al menos una sesión de trabajo.
 *
 * NO es `studyDays`: ese cuenta días con unidades cargadas. Éste cuenta días que
 * te sentaste, midas o no midas algo. Deduplica por fecha igual que studyDays,
 * porque la query devuelve una fila por día + materia.
 */
export function workedDays(rows: EfficiencyRow[]): number;
```

Las dos entran a `Summary` como `hours` y `workedDays`. **Ninguna necesita una
columna nueva**: salen de `total_seconds` y de `day`, que ya vienen en la fila.

### `StudyReports.tsx`

`METRICS` gana un campo declarativo que **es el Nivel de la métrica**:

```ts
tier: "always" | "units"
```

| Métrica | `id` | tier | dirección |
|---|---|---|---|
| horas estudiadas | `hours` | `always` | más es mejor |
| días trabajados | `worked-days` | `always` | más es mejor |
| cortes/hora | `distractions-per-hour` | `always` | menos es mejor |
| min/{unidad} | `minutes-per-block` | `units` | menos es mejor |
| {unidades}/día | `blocks-per-day` | `units` | más es mejor |
| días con avance | `study-days` | `units` | más es mejor |

Luego:

```ts
const hasUnits = periods.some((p) => p.totalUnits > 0);
const visibleMetrics = METRICS.filter((m) => m.tier === "always" || hasUnits);
```

**Tres métricas de Nivel 1, no una.** Este es el arreglo que faltaba: con sólo
`cortes/hora` visible, el usuario sin unidades entraba a informes y veía **un
número solo flotando** — mejor que el panel vacío de hoy, pero muy lejos de "acá
está tu mes".

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
> Terminá un pomodoro y acá vas a ver tus horas, tus días y tus cortes.

Y cuando hay sesiones pero no unidades, **no se muestra ningún aviso**: se ven las
métricas que aplican y nada más. El [004](004-ajustes-informes.md) ya cerró esta
discusión — las leyendas explicativas se sacaron por muro de texto. Que el panel
muestre menos cosas es la respuesta, no un párrafo que lo explique.

### Tests del PR 3

1. `lib/analytics/__tests__/efficiency.test.ts`
   - `weightedAverage` usa `unit_seconds`: una fila con `total_seconds: 6000`,
     `unit_seconds: 3000`, `total_chunks: 2` da **25**, no 50 ← el test clave
   - `distractionsPerHour` cuenta el tiempo total, incluidas sesiones sin unidades
   - `hoursStudied` suma `total_seconds` y convierte
   - `workedDays` **deduplica por día** (dos materias el mismo día = un día) y
     **cuenta días sin unidades**, a diferencia de `studyDays` — el mismo set de
     filas tiene que dar `workedDays: 3` y `studyDays: 1`
   - `summarize` devuelve `totalUnits`, `hours` y `workedDays`
   - filas sin unidades: `minutesPerBlock`/`blocksPerDay` en `null`, `studyDays` 0,
     y `hours`/`workedDays`/`distractionsPerHour` **con número**
2. `lib/db/queries/__tests__/stats.test.ts`: la query incluye sesiones sin
   `work_log` (sobre el tag `sql` mockeado, verificando la forma del fragmento)
3. `StudyReports.test.tsx`
   - sin unidades: se ven `metric-hours`, `metric-worked-days` y
     `metric-distractions-per-hour`; **no** se ven `metric-minutes-per-block`,
     `metric-blocks-per-day`, `metric-study-days`, las series ni `label-breakdown`
   - con unidades: se ven las seis
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
| `lib/db/migrations.ts` | 1 | `+ preferences JSONB` + backfill de unidad (antes del bloque RLS) |
| `lib/preferences/index.ts` | 1 | **nuevo** — resolver, `validateUnit`, presets, `pluralizeEs` |
| `lib/preferences/__tests__/preferences.test.ts` | 1 | **nuevo** |
| `lib/db/queries/settings.ts` | 1 | `Settings.preferences`, resolver al leer, merge al escribir |
| `lib/db/queries/__tests__/settings.test.ts` | 1 | **nuevo** |
| `app/api/settings/route.ts` | 1 | valida `preferences` |
| `app/api/__tests__/settings.test.ts` | 1 | casos nuevos |
| `hooks/usePreferences.ts` | 1 | **nuevo** |
| `context/__tests__/SettingsContext.test.tsx` | 1 | fixture |
| `components/Settings/UnitPicker.tsx` | 2 | **nuevo** — compartido journal + settings |
| `components/Settings/__tests__/UnitPicker.test.tsx` | 2 | **nuevo** |
| `components/JournalPrompt/index.tsx` | 2 | dos estados (con/sin unidad) + `testid` renombrado |
| `components/Settings/SettingsPanel.tsx` | 2, 4 | `UnitPicker` + aviso de cambio; después los toggles |
| `lib/db/queries/stats.ts` | 3 | query invertida + `unit_seconds` |
| `lib/analytics/efficiency.ts` | 3 | `unit_seconds`, `totalUnits`, `hoursStudied`, `workedDays` |
| `components/Dashboard/StudyReports.tsx` | 2, 3 | rótulos; después `tier` + 2 métricas nuevas |
| `components/HomeClient.tsx` | 4 | montaje condicional |
| `components/__tests__/HomeClient.preferences.test.tsx` | 4 | **nuevo** |

## Cómo se verifica

`npm test` y `npm run typecheck` en verde en cada PR (**nunca `npm run build`**).
Y a mano, después del PR 4:

1. **Usuario nuevo, sin tocar nada**: hace un pomodoro. En el journal **no hay
   ninguna casilla de bloques** — sólo la línea discreta "Medir mi avance".
   Entra a informes → **ve horas, días trabajados y cortes/hora**, no un panel
   vacío. ← es el bug que motivó todo el plan
2. **Configurar la unidad desde el journal**: tocar "Medir mi avance", elegir
   "cards", guardar. El pomodoro siguiente ya muestra la casilla con "cards"
3. **Escribir "horas" como unidad**: sale el mensaje y no se guarda
4. **Los informes crecen solos**: después de cargar la primera unidad, entrar a
   informes y ver que aparecieron min/card, cards/día y días con avance — sin
   haber prendido nada
5. **Apagar el journal**: termina un pomodoro y no aparece nada. Los informes
   siguen mostrando horas, días y cortes
6. **Apagar lo social**: desaparece el tab Amigos. Desde otra cuenta amiga,
   confirmar que a los ~2 minutos figurás `offline` — sin endpoint de limpieza
7. **Merge de preferencias**: configurar la unidad, después apagar el journal,
   recargar → la unidad sigue ahí
8. **El backfill**: con la cuenta que ya venía cargando bloques, confirmar que
   **después del deploy la unidad sigue siendo "bloque"** y no quedó en blanco

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
  corregir nunca. Y los presets lo traen resuelto, así que el 90% no lo ve.
- **La unidad NO tiene default.** Es la corrección más importante de esta versión
  del plan: `"bloque"` como default seguía siendo la app de una persona hablándole
  a todo el mundo en su idioma privado. Sin unidad, Pomy funciona entero; con
  unidad, suma una capa. El costo es descubribilidad, y se paga con la invitación
  inline en el journal — **no** escondiéndola sólo en Configuración.
- **Se permiten unidades libres, pero no cualquiera.** Texto libre sin reglas deja
  escribir "horas" y produce `min/hora = 60`: correcto y basura. La blocklist es
  chica y el mensaje enseña en vez de sólo negar.
- **Cambiar de unidad avisa, no impide, y no reescribe el historial.** Guardar la
  unidad en cada `work_log` sería exacto y es una columna más y una dimensión más
  en todo el análisis, para un caso que la mayoría hace cero veces.
- **`social` arranca en `true` aunque lo correcto sea `false`.** Documentado
  arriba, con la condición exacta para cambiarlo.
- **Sin presets ni perfiles ("modo simple / estudio / trabajo").** Con dos flags
  no hay nada que agrupar; un preset acá sería ceremonia sobre dos checkboxes.
  Si la lista crece, se reconsidera — pero que crezca ya es la señal de alarma.
- **Las métricas de unidad nunca se comparan entre personas.** Regla del modelo de
  dos niveles: el Nivel 1 es comparable, el Nivel 2 es privado. No es una decisión
  de UI, es una propiedad de la magnitud — "min/página" y "min/card" tienen el
  mismo nombre de fórmula y miden cosas distintas.
