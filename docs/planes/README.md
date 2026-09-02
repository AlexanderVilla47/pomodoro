# Registro de planes

Acá viven los planes de trabajo del proyecto, versionados con el código. Un
agente escribe el plan, otro lo toma y lo implementa, y el que lo termina lo
marca completado. Nada se pierde entre sesiones.

## Índice

| # | Plan | Estado |
|---|------|--------|
| [001](001-chunks-estudio.md) | Registrar chunks de teoría por sesión | ✅ Completado |
| [002](002-client-id.md) | `client_id`: offline real + arreglo de duplicados | ✅ Completado — 2026-09-01, PR #23 |
| [003](003-informes-progreso.md) | Informes de progreso de estudio | ✅ Completado — 2026-09-01, PR #24 |
| [004](004-ajustes-informes.md) | Ajustes a los informes: el silencio y los números absurdos | ⬜ Pendiente |

## Cómo se usa

**Tomar un plan pendiente**: leerlo entero, marcarlo `🔨 En progreso` en este
índice y en el encabezado del plan, y arrancar. Ese cambio de estado va en el
primer commit de la rama, no en uno aparte.

**Terminarlo**: marcarlo `✅ Completado` en el índice y en el plan, con la fecha
y el número de PR. Si durante la implementación se descubrió algo que cambió el
enfoque, se corrige el plan — un plan que miente sobre lo que se hizo es peor
que no tener plan.

**Crear uno nuevo**: numerarlo con el siguiente correlativo, agregarlo al índice
como `⬜ Pendiente` y seguir la estructura de los que ya están: por qué, la
solución con el detalle técnico, los archivos a tocar, el orden TDD y cómo se
verifica.

## Formato: lo verifica un test, no la buena voluntad

El estado vive en **dos** lugares — la tabla de acá arriba y el encabezado de
cada plan — para que se lea de un vistazo sin abrir tres archivos. Dos copias
divergen solas, así que
[`__tests__/indice.test.ts`](__tests__/indice.test.ts) las mantiene atadas: si
no coinciden, CI se pone en rojo **antes** del merge.

Para que el test pueda leerlos, los dos respetan una forma fija:

```markdown
| # | Plan | Estado |                        <- fila del índice
| [002](002-client-id.md) | Título | ⬜ Pendiente |

**Estado:** ⬜ Pendiente                       <- encabezado del plan
```

- El archivo se llama `NNN-slug.md`, con `NNN` de tres dígitos.
- El marcador es **uno de tres**: `⬜ Pendiente`, `🔨 En progreso`,
  `✅ Completado`. El texto que va después es libre (`— PR #18`, `(depende del
  002)`); lo que tiene que coincidir es el marcador.
- El número de la fila tiene que ser el del archivo al que apunta.

El test también cuida la puerta de entrada: **`CLAUDE.md` no puede enlazar
planes sueltos ni repetir un estado.** Se carga sola en cada sesión, así que una
copia desactualizada ahí es la que un agente nuevo lee primero.

## Reglas

- **Un plan pendiente no se implementa a medias.** Si hay que cortar, se anota
  en el plan qué quedó hecho y qué falta, con el mismo nivel de detalle.
- **El nivel de detalle importa**: el plan tiene que alcanzar para que un agente
  sin contexto previo lo ejecute sin rehacer el análisis. Si al implementarlo
  hubo que investigar algo que el plan no decía, eso va al plan.
- **Las dependencias entre planes se declaran.** El 003 no se puede hacer antes
  del 002 y está escrito en ambos.
- Los planes viven en el repo a propósito: `~/.claude/plans/` tiene nombres
  autogenerados, no se versiona y ningún agente nuevo sabe que existe.
