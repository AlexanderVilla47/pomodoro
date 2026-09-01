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
