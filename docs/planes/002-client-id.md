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
| [components/HomeClient.tsx](../../components/HomeClient.tsx) | `pendingSessionId: number` → `pendingClientId: string` |
| [app/api/work-logs/route.ts](../../app/api/work-logs/route.ts) | Acepta `sessionClientId` y lo resuelve server-side |
| `hooks/useOfflineSync.ts` *(nuevo)* | Ordena el vaciado de las dos colas |

**El UUID lleva la identidad de su sesión**, igual que `distractionsRef`: atado
a `sessionStartRef` y espejado en `localStorage` para sobrevivir un reload o que
el SO mate la PWA. Así el de una sesión vieja se invalida solo, sin depender de
que algún camino del ciclo de vida se acuerde de limpiarlo.

**El upsert tiene que devolver el id igual**:

```sql
INSERT INTO sessions (...) VALUES (...)
ON CONFLICT (client_id) DO UPDATE SET client_id = EXCLUDED.client_id
RETURNING id
```

`DO NOTHING` no sirve: no devuelve fila y el cliente se queda sin id.

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

## Verificación

1. `npm test` y `npm run typecheck` en verde
2. DevTools → Network → Offline: correr un pomodoro completo. **El modal tiene
   que aparecer igual.** Cargar chunks, volver online, confirmar que la sesión y
   el work log se sincronizan y quedan asociados.
3. Simular respuesta perdida (throttling extremo o matar la request después del
   INSERT): al recuperar conexión **no puede haber dos filas** para el mismo
   pomodoro.
4. Confirmar que la cola no queda reintentando en loop en ningún caso.
