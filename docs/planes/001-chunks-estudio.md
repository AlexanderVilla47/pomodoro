# 001 — Registrar chunks de teoría por sesión

**Estado:** ✅ Completado — PR [#18](https://github.com/AlexanderVilla47/pomodoro/pull/18), en producción

## Por qué

El usuario porciona los apuntes en "chunks" (~media página) para hacer estudio
activo. Notó que iba a ~1 página cada 30 minutos y le pareció lento, pero **no
tenía con qué compararlo**. No hay línea de base propia.

El objetivo no es un dashboard: es un **contador de repeticiones para entrenar**
y ver si el ritmo mejora con el tiempo.

Se descartó un prompt generado por IA que pedía niveles de precisión, regresión
lineal y calculadora de factibilidad. La app ya tenía materia (`labels`),
duración (`actual_duration`), cortes (`distraction_marks`) y el modal de cierre:
faltaba **un solo dato**.

## Qué se hizo

```sql
ALTER TABLE work_logs
  ADD COLUMN IF NOT EXISTS is_theory BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS chunks    NUMERIC(5,2)
```

Checkbox "Estudié teoría por chunks" en el modal de cierre y, cuando está
tildado, un stepper de a 0,5. Más `lib/analytics/efficiency.ts` con
`minutesPerChunk` como función pura.

## Lo que se aprendió (esto es lo que importa del plan)

- **`is_theory` no es redundante con `chunks`.** Al saltear el prompt igual se
  inserta una fila para no volver a preguntar, así que `chunks` queda `NULL`.
  Ese `NULL` significa *"no contesté"*, **no** *"hice cero chunks"*: contarlo
  como cero rompe el promedio. El booleano separa las dos cosas sin que nadie
  tenga que adivinar la intención de un campo vacío.
- **postgres.js devuelve `NUMERIC` como string** (`"2.50"`). Sumar sin
  `Number()` concatena y falla en silencio.
- **La cola offline no tolera 4xx nuevos**: el endpoint normaliza la entrada en
  vez de rechazarla. Un `400` sería una poison pill.
- **El cálculo va en `lib/analytics/`, no en SQL**: los tests de queries mockean
  el tag `sql`, así que una fórmula en SQL queda sin cobertura.
- **Se implementó y después se removió** una tarjeta de feedback con el min/chunk
  al guardar. El usuario la rechazó: quiere la estadística histórica cuando él la
  busque, no interrumpiéndolo al terminar de estudiar. Queda anotado para no
  volver a proponerla.

## Verificación pendiente

`instrumentation.ts` atrapa el error de `runMigrations` y sólo tira un
`console.warn` **sin fallar el arranque**. Si la migración falló, la app levantó
igual. Se confirma tildando el checkbox y viendo que el dato se guarde.
