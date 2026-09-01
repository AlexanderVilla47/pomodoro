# Pomodoro — convenciones del proyecto

> **Esto aplica a TODO agente que trabaje en este repo**, sesión principal y
> subagentes por igual. Un subagente arranca con contexto vacío: quien lo
> despliega tiene que inyectarle estas reglas en el prompt. Trabajo entregado
> sin rama y sin PR es trabajo mal entregado, sin importar qué tan bueno sea el
> código.

## Flujo de trabajo: GitHub Flow (obligatorio, sin excepciones)

`main` es **producción**: Vercel despliega cada push a main. Por eso main está
protegida y **no se commitea nunca directo**.

Todo cambio — feature, fix, ajuste de config, hasta un typo — sigue este ciclo:

```
main ─┬─ feat/<algo>   nueva funcionalidad
      ├─ fix/<algo>    corrección de bug
      ├─ chore/<algo>  config, deps, CI, refactor sin cambio de comportamiento
      ├─ docs/<algo>   documentación
      └─ test/<algo>   sólo tests
```

1. Rama nueva **desde `main` actualizado**
2. Commits atómicos y convencionales mientras se trabaja
3. `npm test` y `npm run typecheck` en verde **antes** de abrir el PR
4. PR contra `main`, con el cuerpo explicando el **porqué**
5. CI en verde
6. **Rebase merge** (la rama se borra sola)

## Entrega autónoma: el trabajo llega a producción solo

Con el plan aceptado, el ciclo se completa **sin pedir confirmación**: se
trabaja, se abre el PR, y si todo está en verde **se mergea**. El merge dispara
el deploy en Vercel. No se deja trabajo terminado esperando un enter.

Las cuatro compuertas que lo hacen seguro, todas antes del merge:

| Compuerta | Qué corre |
|---|---|
| TDD | El test primero, se lo ve fallar |
| `Tests` (CI, obligatorio) | `tsc --noEmit` + `vitest run` + `npm run build` |
| `Vercel` (obligatorio) | Preview deploy con las variables reales de producción |
| Rama al día con `main` | El PR se valida contra el main que va a recibir |

Si **cualquiera** falla, no se mergea: se arregla o se reporta. Nunca se fuerza
un merge, nunca se saltea un check.

### Lo único que un revert NO deshace: las migraciones

`instrumentation.ts` corre `runMigrations` al arrancar, contra la base de
producción. Revertir el código **no revierte un `ALTER TABLE`**, y los tests
mockean el tag `sql`, así que ninguna migración se probó nunca contra un
Postgres real.

Por eso toda migración es aditiva e idempotente (`ADD COLUMN IF NOT EXISTS`,
`CREATE TABLE IF NOT EXISTS`): revertir el código deja una columna sin usar, que
no rompe nada. **Un `DROP`, un `ALTER ... TYPE` o un rename NO se auto-mergean**
— eso se consulta, porque ahí GitHub Flow ya no te salva.

### Rebasar una rama: `gh pr update-branch --rebase`

Nunca `git push --force` (está en la lista `deny`). Si el PR quedó atrás de
main, se actualiza por la API de GitHub, no con un force push local.

### Reglas que no se negocian

- **Nunca commitear ni pushear a `main`.** Si el trabajo ya arrancó ahí sin
  querer, se crea la rama y se mueven los commits antes de seguir.
- **Un cambio, una rama, un PR.** Si aparecen dos cosas distintas en el árbol
  de trabajo, se separan en dos ramas. No se mezclan un bugfix y una feature.
- **Siempre PR**, aunque sea de una línea. Es el registro de por qué se hizo.

## Merge: rebase, nunca squash

El repo tiene squash y merge commit **deshabilitados** a propósito. El squash
aplasta todos los commits de la rama en uno solo: se pierde la granularidad
real del trabajo y, en un repo público, el historial y el gráfico de
contribuciones reflejan una fracción de lo que se hizo. El rebase preserva cada
commit y deja historial lineal.

Corolario: **hacer commits atómicos mientras se trabaja**, no un commit gigante
al final. Un commit por paso lógico (el test, la implementación, el refactor).

## Commits

Convencionales, en español, sin punto final en el título:

```
feat(estudio): registrar chunks de teoría por sesión
fix(audio): reproducir la alarma de fin de sesión en tablet
chore(ci): sacar el trigger de la rama dev
```

El cuerpo explica **por qué**, no qué — el qué ya está en el diff. Si hubo una
trampa, un comportamiento no obvio de una librería o una decisión con
alternativas descartadas, va en el cuerpo. Ese texto es lo único que va a
quedar cuando nadie se acuerde del contexto.

**Nunca** agregar `Co-Authored-By` ni ninguna atribución de IA.

## Protección de `main`

Configurada en GitHub, no es sólo una convención:

- Entra únicamente por Pull Request
- El check `Tests` tiene que pasar
- La rama tiene que estar al día con main
- Historial lineal obligatorio
- Sin force push ni borrado

`enforce_admins` está en `false`: hay escape para una urgencia real, pero usarlo
es la excepción, no el atajo.

## Tests

- **Strict TDD**: el test primero, se lo ve fallar, después la implementación.
- `npm test` y `npm run typecheck` antes de cada PR.
- **Nunca correr `npm run build`.**
- Los tests de la capa de queries mockean el tag `sql` — nunca corre SQL real.
  Por eso la lógica de cálculo va en funciones puras (`lib/analytics/`) y no en
  SQL: una fórmula escrita en SQL queda sin cobertura.

## Modo autónomo

Este proyecto trabaja sin pedir aprobación de permisos: `defaultMode` está en
`bypassPermissions` (en `.claude/settings.local.json`, que no se commitea —
`bypass` es una decisión de riesgo personal y el repo es público).

La red de contención es la lista `deny` de `.claude/settings.json`, que **sí**
se commitea porque protege a cualquiera que clone. Las reglas `deny` ganan
siempre, incluso en modo bypass. Bloquea lo irreversible: force push, `reset
--hard`, `clean -f`, `rm -rf`, borrado de repo o secretos, `DROP`/`TRUNCATE`,
deploys manuales a Vercel y escritura sobre archivos `.env`.

**Es un guardarraíl, no una jaula.** Las reglas matchean por prefijo de
comando: `rm -rf x` se bloquea, pero `cd dir && rm -rf x` puede colarse. Trabajar
en modo autónomo obliga a pensar antes de correr un comando destructivo, no
menos.

Consecuencia del modo autónomo: **al terminar hay que dejar todo asentado** —
commits, PR abierto y un resumen de qué se hizo. Si nadie estuvo mirando
mientras trabajabas, el PR es el único registro de lo que pasó.

## Planes: **empezá acá**

Los planes de trabajo viven en **[`docs/planes/`](docs/planes/README.md)**,
versionados con el código. Un agente escribe el plan, otro lo toma y lo
implementa, y el que lo termina lo marca completado.

**Al arrancar una sesión: leer [`docs/planes/README.md`](docs/planes/README.md).**
Ahí está el índice con el estado de cada uno. Si hay planes pendientes y el
usuario pide trabajar, ese es el trabajo — no hace falta rearmar el análisis, ya
está hecho y con el nivel de detalle para ejecutarlo.

| Plan | Estado |
|---|---|
| [001 — Chunks de estudio](docs/planes/001-chunks-estudio.md) | ✅ Completado |
| [002 — `client_id`](docs/planes/002-client-id.md) | ⬜ Pendiente — **arregla un bug activo** |
| [003 — Informes de progreso](docs/planes/003-informes-progreso.md) | ⬜ Pendiente (depende del 002) |

Al terminar un plan hay que **marcarlo completado** en el índice y en el plan, y
corregirlo si la implementación cambió el enfoque. Un plan nuevo se guarda ahí
con el siguiente número correlativo.

### Contexto adicional en engram

```
mem_search("convenciones" | "bugfix" | "feature", project: "pomodoro")
```

Topic keys: `convenciones/github-flow-y-modo-autonomo`,
`convenciones/entrega-autonoma-produccion`,
`feature/chunks-eficiencia-estudio`, `bugfix/audio-alertas-mobile`.

### Verificaciones pendientes

- **Las alarmas en la tablet.** jsdom no tiene política de autoplay: el fix de
  `unlockChime()` no está probado en dispositivo real. Falta saber si la tablet
  es Android o iPad (en Android pegaban los dos bugs; en iPad fuera de modo PWA,
  probablemente sólo el de autoplay).
- `public/favicon.zip` sigue sin trackear, ensuciando `git status`.

## Trampas conocidas de este repo

- **`postgres.js` devuelve `NUMERIC` como string** (`"2.50"`). Sumar sin
  `Number()` concatena y falla en silencio.
- **La cola offline no tolera 4xx nuevos.** `useSessionLogger` y
  `useWorkLogger` sólo dan por entregado un item con `201` o `409`: cualquier
  otro status lo reencolan y lo reintentan para siempre. Los endpoints con cola
  **normalizan la entrada en vez de rechazarla**.
- **Desbloquear un `AudioContext` no desbloquea los `HTMLAudioElement`.** Son
  dominios de activación distintos. Todo lo que tenga que sonar sin un gesto del
  usuario necesita su propio desbloqueo previo.
