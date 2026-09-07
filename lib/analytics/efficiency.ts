/**
 * Métricas de eficiencia de estudio.
 *
 * Todo el cálculo vive acá y no en SQL a propósito: los tests de la capa de
 * queries mockean el tag `sql`, así que cualquier fórmula escrita en SQL sería
 * matemática sin cobertura. SQL agrega crudo (sumas), estas funciones dividen.
 */

/** Una fila cruda de `getStudyEfficiencyByDay`: un día, una materia. */
export interface EfficiencyRow {
  day: string;
  label_id: number | null;
  label_name: string | null;
  label_color: string | null;
  /** Todo el tiempo de trabajo del día, se hayan cargado unidades o no. */
  total_seconds: number;
  /**
   * El subconjunto de `total_seconds` que sí produjo unidades.
   *
   * Existe porque la query trae todas las sesiones de trabajo, no sólo las que
   * midieron algo: dividir `total_seconds` por las unidades mezclaría tiempo
   * que no produjo ninguna e inflaría min/unidad en silencio.
   */
  unit_seconds: number;
  total_chunks: number;
  sessions: number;
  distractions: number;
}

/**
 * Las métricas de un conjunto de filas, en dos niveles.
 *
 * **Nivel 1 — universal.** Sale sólo de `sessions` y existe desde el primer
 * pomodoro, sin que el usuario configure nada.
 *
 * **Nivel 2 — de ritmo.** Necesita unidades cargadas. No se prende con un
 * toggle: se calcula si hay con qué, y si no queda en null. La app no pregunta
 * si querés una métrica, mira si la puede calcular.
 */
export interface Summary {
  /** Nivel 1. Horas de trabajo del período. */
  hours: number;
  /** Nivel 1. Días distintos con al menos una sesión de trabajo. */
  workedDays: number;
  /** Nivel 1. Baja = te concentrás mejor. */
  distractionsPerHour: number | null;
  /** Nivel 2. Baja = vas más rápido. */
  minutesPerBlock: number | null;
  /** Nivel 2. Sube = rendís más por día con avance. */
  blocksPerDay: number | null;
  /** Nivel 2. Días distintos con unidades cargadas. */
  studyDays: number;
  /**
   * Nivel 2. Unidades del período.
   *
   * Es lo que le deja preguntar a la UI "¿esta persona mide algo?" con una
   * comparación y no adivinando desde un `null`, que también significa "no
   * alcanza la muestra".
   */
  totalUnits: number;
}

export type Granularity = "week" | "month";

export interface Period extends Summary {
  /** Primer día del período, en ISO. Ordena lexicográficamente. */
  start: string;
}

export interface LabelSummary extends Summary {
  label_id: number | null;
  label_name: string | null;
  label_color: string | null;
}

/**
 * La dirección en la que cada métrica mejora. No es decorativa: min/bloque y
 * bloques/día se mueven al revés entre sí, así que un "verde si sube" pintaría
 * de verde justo cuando min/bloque empeora.
 */
export type Direction = "lower-is-better" | "higher-is-better";

export interface Delta {
  diff: number | null;
  pct: number | null;
  trend: "better" | "worse" | "same" | null;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Minutos por chunk de una sesión (o de un agregado: pasarle las sumas de
 * segundos y de chunks da el promedio ponderado, que es lo correcto —
 * promediar promedios deja que una sesión corta distorsione el resultado).
 *
 * Devuelve null cuando la división no tiene sentido, en vez de Infinity o NaN:
 * una sesión sin chunks cargados no es "infinitamente lenta", es un dato que no
 * existe y tiene que quedar afuera del análisis.
 */
export function minutesPerChunk(seconds: number, chunks: number): number | null {
  if (!Number.isFinite(seconds) || seconds < 0) return null;
  if (!Number.isFinite(chunks) || chunks <= 0) return null;
  return round1(seconds / 60 / chunks);
}

function totals(rows: EfficiencyRow[]) {
  return rows.reduce(
    (acc, r) => ({
      seconds: acc.seconds + r.total_seconds,
      unitSeconds: acc.unitSeconds + r.unit_seconds,
      chunks: acc.chunks + r.total_chunks,
      distractions: acc.distractions + r.distractions,
    }),
    { seconds: 0, unitSeconds: 0, chunks: 0, distractions: 0 }
  );
}

/**
 * Min/unidad de un conjunto de filas: suma todo primero y divide una sola vez.
 *
 * El orden importa. Promediar los min/unidad de cada día le da el mismo peso a
 * un día de 10 unidades que a uno de 1, y un día corto termina moviendo el
 * número del período entero.
 *
 * Divide por `unitSeconds` y **no** por `seconds`: desde que la query trae
 * también las sesiones sin unidades, el tiempo total incluye trabajo que no
 * produjo ninguna. Usarlo daría un número más alto, plausible y equivocado.
 */
export function weightedAverage(rows: EfficiencyRow[]): number | null {
  const { unitSeconds, chunks } = totals(rows);
  return minutesPerChunk(unitSeconds, chunks);
}

/**
 * Días distintos con unidades cargadas — "días con avance" en la UI.
 *
 * Deduplica por fecha: la query devuelve una fila por día + materia, así que
 * estudiar dos materias el mismo día son dos filas y un solo día.
 *
 * No confundir con `workedDays`, que cuenta los días que te sentaste midieras o
 * no. Convivir en el mismo panel es la razón por la que dejó de llamarse "días
 * estudiados": los dos rótulos eran indistinguibles.
 */
export function studyDays(rows: EfficiencyRow[]): number {
  const days = new Set<string>();
  for (const r of rows) {
    if (r.total_chunks > 0) days.add(r.day);
  }
  return days.size;
}

/**
 * Bloques por día, dividiendo por los días **con estudio** y no por los del
 * calendario. Contesta "cuando me siento a estudiar, ¿cuánto rindo?".
 *
 * Es ciega a la consistencia a propósito: cinco días o dos con el mismo
 * rendimiento diario dan el mismo número. Por eso la UI la muestra al lado de
 * `studyDays`, que es lo que devuelve esa información.
 */
export function blocksPerStudyDay(rows: EfficiencyRow[]): number | null {
  const days = studyDays(rows);
  if (days === 0) return null;
  return round1(totals(rows).chunks / days);
}

/**
 * Horas de trabajo del período. La métrica más obvia de todas, y hasta ahora
 * los informes no la mostraban: vivía detrás del filtro de unidades.
 *
 * Devuelve 0 y no null con una serie vacía: cero horas es un dato cierto, no un
 * dato que falta.
 */
export function hoursStudied(rows: EfficiencyRow[]): number {
  return round1(totals(rows).seconds / 3600);
}

/**
 * Días distintos con al menos una sesión de trabajo, mida unidades o no.
 *
 * Deduplica por fecha igual que `studyDays`, porque la query devuelve una fila
 * por día + materia. Toda fila que llega acá es un día en que hubo trabajo: la
 * query ya filtró por `type = 'work'`.
 */
export function workedDays(rows: EfficiencyRow[]): number {
  return new Set(rows.map((r) => r.day)).size;
}

/**
 * Piso de muestra para `distractionsPerHour`, en segundos.
 *
 * La métrica extrapola a una hora, y ese factor es `3600 / segundos`: con un
 * minuto de estudio multiplica por 60 y convierte el ruido en titular — 2
 * cortes en 1 minuto se leen como "120 cortes/hora".
 *
 * 15 minutos deja el factor en ×4 y, sobre todo, deja pasar cómodo un pomodoro
 * entero: `work_duration` arranca en 1500s (25 min), así que cualquier piso más
 * alto escondería el caso más común de todos.
 */
export const MIN_SECONDS_FOR_RATE = 15 * 60;

/**
 * Distracciones por hora estudiada. Normalizar por tiempo es lo que la vuelve
 * comparable: estudiar más horas produce más cortes en términos absolutos sin
 * que eso signifique estar peor concentrado.
 *
 * Devuelve null bajo el piso de muestra. El piso vive acá y no en la UI porque
 * es una regla de la métrica, no de cómo se dibuja: si el número se usa en otro
 * lado, la regla viaja con él.
 *
 * Es del período completo, no de cada sesión: tres sesiones de 6 minutos suman
 * 18 y sí se muestran.
 *
 * El denominador es TODO el tiempo trabajado, no sólo el que produjo unidades:
 * los cortes se normalizan contra el tiempo real. Usar `unitSeconds` inflaría
 * la tasa justo de quien mide poco.
 */
export function distractionsPerHour(rows: EfficiencyRow[]): number | null {
  const { seconds, distractions } = totals(rows);
  if (seconds < MIN_SECONDS_FOR_RATE) return null;
  return round1(distractions / (seconds / 3600));
}

export function summarize(rows: EfficiencyRow[]): Summary {
  return {
    hours: hoursStudied(rows),
    workedDays: workedDays(rows),
    distractionsPerHour: distractionsPerHour(rows),
    minutesPerBlock: weightedAverage(rows),
    blocksPerDay: blocksPerStudyDay(rows),
    studyDays: studyDays(rows),
    totalUnits: totals(rows).chunks,
  };
}

/**
 * Primer día del período que contiene a `day`.
 *
 * La semana arranca el **domingo**, replicando el `date_trunc('week', … + 1
 * día) - 1 día` de `getStatsForWeek`. Si acá arrancara el lunes, "esta semana"
 * del informe no coincidiría con la tarjeta "Esta semana" que ya existe.
 *
 * Las fechas se parsean al mediodía UTC: `day` ya viene con el offset del
 * usuario aplicado desde SQL, o sea es una fecha local, y el mediodía la deja
 * lejos de cualquier borde por zona horaria.
 */
function periodStart(day: string, granularity: Granularity): string {
  if (granularity === "month") return day.slice(0, 7) + "-01";
  const d = new Date(day + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return d.toISOString().slice(0, 10);
}

/** Agrupa las filas diarias en semanas o meses, ya resumidos y ordenados. */
export function groupByPeriod(rows: EfficiencyRow[], granularity: Granularity): Period[] {
  const buckets = new Map<string, EfficiencyRow[]>();
  for (const r of rows) {
    const start = periodStart(r.day, granularity);
    const bucket = buckets.get(start);
    if (bucket) bucket.push(r);
    else buckets.set(start, [r]);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([start, bucketRows]) => ({ start, ...summarize(bucketRows) }));
}

/**
 * Compara una métrica contra el período anterior.
 *
 * `direction` no es opcional a propósito: sin ella no hay forma de saber si un
 * delta positivo es una buena o una mala noticia, y las dos métricas
 * principales van en sentidos opuestos.
 */
export function compare(
  current: number | null,
  previous: number | null,
  direction: Direction
): Delta {
  if (current === null || previous === null) {
    return { diff: null, pct: null, trend: null };
  }
  const diff = round1(current - previous);
  // Un anterior en cero haría Infinity: el porcentaje no existe, pero el delta
  // absoluto sigue siendo un dato válido.
  const pct = previous === 0 ? null : round1(((current - previous) / previous) * 100);
  const trend =
    diff === 0 ? "same" : direction === "lower-is-better" ? (diff < 0 ? "better" : "worse") : diff > 0 ? "better" : "worse";
  return { diff, pct, trend };
}

/**
 * Desglose por materia, de la más costosa a la menos. Las sesiones sin materia
 * caen en un grupo con `label_id` nulo en vez de descartarse.
 */
export function byLabel(rows: EfficiencyRow[]): LabelSummary[] {
  const buckets = new Map<number | null, EfficiencyRow[]>();
  for (const r of rows) {
    const bucket = buckets.get(r.label_id);
    if (bucket) bucket.push(r);
    else buckets.set(r.label_id, [r]);
  }
  return [...buckets.values()]
    .map((bucketRows) => ({
      label_id: bucketRows[0].label_id,
      label_name: bucketRows[0].label_name,
      label_color: bucketRows[0].label_color,
      ...summarize(bucketRows),
    }))
    .sort((a, b) => (b.minutesPerBlock ?? -1) - (a.minutesPerBlock ?? -1));
}
