# Registro de planes

Acá viven los planes de trabajo del proyecto, versionados con el código. Un
agente escribe el plan, otro lo toma y lo implementa, y el que lo termina lo
marca completado. Nada se pierde entre sesiones.

## Índice

| # | Plan | Estado |
|---|------|--------|
| [001](001-chunks-estudio.md) | Registrar chunks de teoría por sesión | ✅ Completado |
| [002](002-client-id.md) | `client_id`: offline real + arreglo de duplicados | ⬜ Pendiente |
| [003](003-informes-progreso.md) | Informes de progreso de estudio | ⬜ Pendiente (depende de 002) |

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
