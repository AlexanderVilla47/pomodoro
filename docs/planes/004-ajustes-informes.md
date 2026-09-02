# 004 — Ajustes a los informes: el silencio y los números absurdos

**Estado:** ✅ Completado — 2026-09-02, PR #27
**Depende de:** [003 — Informes de progreso](003-informes-progreso.md) — ✅ ya está

> ## ⚠️ Corrección posterior — 2026-09-02, PR #28
>
> **Las leyendas explicativas se sacaron de la UI por decisión del usuario**, que
> las vio en pantalla y las consideró un muro de texto: tres párrafos grises
> apilados en un panel chico.
>
> Qué quedó de cada cosa:
>
> - **Fix 1 (el aviso de "no hay período anterior") — revertido.** Cuando hay un
>   solo período no se muestra nada, como antes de este plan.
> - **Fix 2 — la lógica SIGUE VIVA.** El piso de 15 minutos en
>   `distractionsPerHour` no se tocó: cortes/hora sigue mostrando `—` en vez de
>   un 120 extrapolado. Lo único que se sacó fue el texto que lo explicaba.
> - El caveat de porcionado que venía del [003](003-informes-progreso.md)
>   también se sacó del panel.
>
> El razonamiento de por qué cada aviso existía queda escrito acá abajo: si
> alguna vez el silencio vuelve a confundir, el análisis ya está hecho y sólo
> hay que decidir un formato menos pesado que un párrafo.

## De dónde salen estos dos

De usar el 003 con datos reales por primera vez. Los dos son el mismo tipo de
falla: **la UI muestra algo que el usuario no puede interpretar**, y en los dos
casos la aritmética está bien — el problema es qué se comunica.

## Fix 1 — Cuando no hay período anterior, decirlo

### El síntoma

Con una sola semana de datos, la tarjeta muestra los cuatro números y **ninguna
flecha, ningún "vs la anterior", ninguna explicación**. El usuario se queda
mirando la pantalla sin saber si está esperando datos, si se rompió, o si
tocó mal.

### Por qué pasa

Es deliberado y está fijado por el test *"sin periodo anterior no inventa una
comparacion"*: con un solo período, `previous` es `null`, `compare()` no corre y
no se dibuja nada. Inventar un "↑ 100%" contra la nada sería peor.

**Pero no mostrar nada Y no explicar por qué es el mismo pecado que el empty
state que el 003 se preocupó por evitar.** El 003 insistió en que un informe
vacío tiene que decir *por qué* está vacío; después dejó este caso mudo.

### La solución

Cuando `periods.length === 1`, mostrar una línea con el mismo tono que el empty
state, en lugar del `vs la anterior`:

> *Todavía no hay una semana anterior para comparar.*

Con el texto siguiendo la granularidad activa (semana / mes).

### Archivos

- `components/Dashboard/StudyReports.tsx` — el bloque de la tarjeta de período
- `components/Dashboard/__tests__/StudyReports.test.tsx`

### Orden TDD

1. Test: con un solo período, aparece el aviso de que no hay con qué comparar
2. Test: con dos períodos, el aviso NO aparece y sí aparecen las flechas
   (ya existe, verificar que sigue verde)
3. Implementar

## Fix 2 — Cortes/hora no puede extrapolar una muestra diminuta

### El síntoma

Una sesión de prueba de ~1 minuto con 2 cortes mostró **120 cortes/hora**.

### Por qué pasa

La cuenta es correcta: `2 ÷ (60/3600) = 120`. El problema es que **extrapolar un
minuto a una hora multiplica por 60**, y con eso el ruido se convierte en
titular. Es la métrica más explosiva de las cuatro porque su denominador es el
que más chico puede ponerse.

> Las otras tres no tienen este problema con la misma violencia: min/bloque y
> bloques/día dividen por cosas que crecen con el uso, no por una fracción de
> hora.

### La solución

Un piso de muestra: **si el período tiene menos de 15 minutos de estudio,
`distractionsPerHour` devuelve `null`** y la UI muestra `—` con su explicación
al lado.

Encaja con la convención que ya existe en `lib/analytics/efficiency.ts`: `null`
significa "este dato todavía no existe", y ya se usa para chunks en cero. Un
`—` honesto es mejor que un 120 que miente con cara de dato serio.

**El piso va en la función pura, no en la UI.** Es una regla de la métrica, no
de cómo se dibuja: si mañana el número se usa en otro lado, la regla viaja con
él y queda cubierta por tests.

### De dónde salen los 15 minutos

El plan arrancó proponiendo 30, elegidos a ojo, y anotó que había que mirar
cuánto dura una sesión típica. Se miró: `migrations.ts` pone
`work_duration INTEGER NOT NULL DEFAULT 1500`, o sea **el pomodoro por defecto
es de 25 minutos**.

Un piso de 30 habría escondido cortes/hora para **una sesión completa**, que es
el caso más común de todos. Mal piso.

Lo que se está acotando es el factor de extrapolación, `3600 / segundos`:

| Estudio en el período | Multiplicador |
|---|---|
| 1 min | ×60 — absurdo |
| 5 min | ×12 |
| **15 min** | **×4 — el corte** |
| 25 min (un pomodoro) | ×2,4 |
| 1 hora | ×1 |

A 15 minutos el número sigue siendo una extrapolación, pero deja pasar cómodo un
pomodoro entero y corta los ×60 que convierten el ruido en titular. Va como
**constante nombrada**, no como número suelto en medio de la función.

### Archivos

- `lib/analytics/efficiency.ts` — `distractionsPerHour`
- `lib/analytics/__tests__/efficiency.test.ts`
- `components/Dashboard/StudyReports.tsx` — el `—` ya está resuelto por `fmt()`,
  falta la explicación

### Orden TDD

1. Test: con menos del piso de tiempo, `distractionsPerHour` devuelve `null`
2. Test: justo en el piso, devuelve el número
3. Test: el caso de 2 cortes en 1 minuto NO devuelve 120
4. Implementar
5. Test de la UI: el `—` viene acompañado de por qué

## Lo que NO hay que hacer

**No esconder las otras tres métricas por muestra chica.** Con un solo día de
datos, min/bloque y bloques/día son igual de reales que con treinta: son
promedios de lo que efectivamente pasó, no extrapolaciones. El problema de
cortes/hora es específico de su denominador.
