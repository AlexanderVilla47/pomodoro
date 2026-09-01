# 002 — `client_id`: offline real + arreglo de sesiones duplicadas

**Estado:** 🔨 En progreso
**Bloquea a:** [003 — Informes de progreso](003-informes-progreso.md)

## Por qué

Hoy la identidad de la sesión **la inventa el servidor**. Eso causa dos
problemas, y uno está activo corrompiendo datos.

**1. Bug de duplicados (activo).** Si el servidor inserta la sesión pero la
respuesta se pierde en el camino — señal mala, no hace falta estar offline —
`sendSession` tira excepción, la sesión se encola, y al recuperar conexión **se
inserta de nuevo**. Dos filas para el mismo pomodoro. Cada duplicado infla las
horas y ensucia el min/chunk.

**2. Sin internet el modal nunca aparece.** `sendSession` falla → la sesión se
encola → no vuelve ningún id → `pendingSessionId` queda `null` en
[HomeClient.tsx](../../components/HomeClient.tsx) → el modal no se abre. No es
que se pierdan los chunks: es que nunca se preguntó.

Por eso este plan va **antes** del 003: los informes se calculan sobre estos
datos. Construir gráficos sobre sesiones duplicadas da números prolijos que
mienten, y no hay forma de detectarlo mirando el gráfico.

## Solución

Que la identidad la genere el cliente.

```sql
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS client_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS sessions_client_id_unique
  ON sessions (client_id) WHERE client_id IS NOT NULL;
```

Índice único **parcial**, mismo patrón que `cheers_pending_unique` en
[migrations.ts](../../lib/db/migrations.ts). Las filas viejas quedan con `NULL`
y no molestan. Migración aditiva e idempotente, así que se puede auto-mergear.

### Cambios

| Archivo | Cambio |
|---|---|
| [lib/db/migrations.ts](../../lib/db/migrations.ts) | El `ALTER TABLE` + índice de arriba |
| [context/TimerContext.tsx](../../context/TimerContext.tsx) | `crypto.randomUUID()` al arrancar el foco |
| [hooks/useSessionLogger.ts](../../hooks/useSessionLogger.ts) | `client_id` en el payload |
| [app/api/sessions/route.ts](../../app/api/sessions/route.ts) | Upsert idempotente |
| [lib/db/queries/sessions.ts](../../lib/db/queries/sessions.ts) | `ON CONFLICT` en `insertSession` |
| [components/HomeClient.tsx](../../components/HomeClient.tsx) | `pendingSessionId: number` → `pendingClientId: string`, monta `useOfflineSync` |
| [components/JournalPrompt/index.tsx](../../components/JournalPrompt/index.tsx) | `sessionId: number` → `sessionClientId: string` |
| [app/api/work-logs/route.ts](../../app/api/work-logs/route.ts) | Acepta `sessionClientId` y lo resuelve server-side |
| [hooks/useWorkLogger.ts](../../hooks/useWorkLogger.ts) | `sessionClientId` en el payload + techo de reintentos |
| `hooks/useOfflineSync.ts` *(nuevo)* | Ordena el vaciado de las dos colas |

**El UUID lleva la identidad de su sesión**, igual que `distractionsRef`: atado
a `sessionStartRef` y espejado en `localStorage` para sobrevivir un reload o que
el SO mate la PWA. Así el de una sesión vieja se invalida solo, sin depender de
que algún camino del ciclo de vida se acuerde de limpiarlo.

**El upsert tiene que devolver el id igual**:

```sql
INSERT INTO sessions (...) VALUES (...)
ON CONFLICT (client_id) WHERE client_id IS NOT NULL
DO UPDATE SET client_id = EXCLUDED.client_id
RETURNING id
```

`DO NOTHING` no sirve: no devuelve fila y el cliente se queda sin id.

**El `WHERE client_id IS NOT NULL` del `ON CONFLICT` no es decorativo.** El
índice es parcial, y Postgres sólo lo infiere como conflict target si el
predicado se repite acá. Sin eso el INSERT falla con *"no unique or exclusion
constraint matching the ON CONFLICT specification"* — y falla **en runtime, no
en CI**, porque los tests mockean el tag `sql` y nunca ven un Postgres real.

**`onSessionLogged` dispara con el `client_id` al instante**, sin esperar al
servidor. Ahí está la mitad del arreglo: el modal abre siempre, online u offline.

### Ordenar el vaciado de las dos colas

Un work_log no se puede resolver si su sesión todavía no llegó al servidor. Hoy
las dos colas vacían por su cuenta en el evento `online` → carrera.

- `useOfflineSync` expone los `flushQueue` de ambos loggers y los corre **en
  orden**: sesiones primero, work logs después.
- Si aun así un work_log llega antes que su sesión, el route responde
  **`202 Accepted`** y `sendWorkLog` lo trata como reintentable.

> ⚠️ **`202`, NO `400`.** [useWorkLogger.ts](../../hooks/useWorkLogger.ts) sólo
> da por entregado un item con `201` o `409`: cualquier otro status lo reencola
> y lo reintenta en cada evento `online` y en cada montaje del hook. Un `400`
> sería una poison pill que no se va nunca. Hay que agregar `202` a la lista de
> "reintentable a propósito" y dejarlo comentado, o el próximo que lea el código
> lo va a "simplificar".

## Orden TDD

1. `lib/db/queries/__tests__/sessions.test.ts` → reenviar el mismo `client_id`
   no duplica; el upsert devuelve el id existente
2. `app/api/__tests__/sessions.test.ts` → el route pasa el `client_id`; sin
   `client_id` (payload viejo en cola) sigue funcionando
3. `hooks/__tests__/useSessionLogger.test.tsx` → el `client_id` viaja en el body;
   reintentar un item encolado no genera una sesión nueva
4. `context/__tests__/TimerContext.test.tsx` → se genera un UUID por sesión de
   foco; sobrevive un reload; el de la sesión anterior no se reusa
5. `hooks/__tests__/useOfflineSync.test.ts` *(nuevo)* → las colas vacían en orden
6. `app/api/__tests__/work-logs.test.ts` → `202` cuando la sesión no existe
   todavía, y que **no** sea `400`
7. Recién ahí, implementar

## Lo que apareció al implementarlo

Cosas que el plan no decía y que hay que saber para leer el código.

**El techo de reintentos de la cola de work logs.** El plan pedía agregar el
`202` a la lista de "reintentable a propósito". Pero la verificación de más
abajo pide confirmar que la cola no queda en loop *en ningún caso*, y un `202`
sin techo **es** ese loop, sólo que con otro status. La trampa documentada de
este repo no es el `400` puntual: es que la cola no tenía freno. Por eso
`useWorkLogger` ahora distingue cuatro resultados en vez de un booleano
(`done` / `pending` / `rejected` / `offline`) y descarta un item después de
`MAX_ATTEMPTS` intentos **con respuesta del servidor**. Estar sin internet no
gasta intentos: una semana offline se comería la cola entera.

**Un solo `Date.now()` al arrancar la sesión.** `beginSession(startedAt)` recibe
el origen en vez de leer el reloj, porque quien la llama también se lo asigna a
`sessionStartRef`. Si cada uno llamara a `Date.now()` por su cuenta podrían
diferir por un milisegundo, y la guarda de `currentClientId`
(`identity.startedAt === sessionStartRef.current`) no reconocería la identidad
recién creada: la sesión viajaría sin `client_id` y el modal no abriría. El bug
que este plan viene a arreglar, reintroducido por un milisegundo.

**`crypto.randomUUID` sólo existe en contexto seguro.** En producción la app va
por HTTPS, pero un `http://` de LAN para probar en la tablet no lo es. Sin
fallback la sesión se quedaría sin identidad justo en el escenario de prueba.

**Compatibilidad con lo que ya está encolado en el navegador de la gente.** Son
tres formas viejas distintas, y las tres se siguen aceptando: una sesión sin
`client_id` (se inserta con NULL), un work log con `sessionId` numérico (el
route lo usa tal cual) y un item de la cola de work logs sin el envoltorio de
reintentos (`getQueue` lo adapta al leerlo).

**El vaciado ya no dispara `onSessionLogged`.** Antes reabría el modal de una
sesión vieja al recuperar conexión. Ahora `useOfflineSync` recibe un `onSynced`
y `HomeClient` lo usa para refrescar stats e historial, sólo si algo
efectivamente se entregó.

## Verificación

1. `npm test` y `npm run typecheck` en verde
2. DevTools → Network → Offline: correr un pomodoro completo. **El modal tiene
   que aparecer igual.** Cargar chunks, volver online, confirmar que la sesión y
   el work log se sincronizan y quedan asociados.
3. Simular respuesta perdida (throttling extremo o matar la request después del
   INSERT): al recuperar conexión **no puede haber dos filas** para el mismo
   pomodoro.
4. Confirmar que la cola no queda reintentando en loop en ningún caso.
