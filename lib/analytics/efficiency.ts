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
  total_seconds: number;
  total_chunks: number;
  sessions: number;
  distractions: number;
}

export interface Summary {
  /** Baja = vas más rápido. */
  minutesPerBlock: number | null;
  /** Sube = rendís más por día que te sentás a estudiar. */
  blocksPerDay: number | null;
  studyDays: number;
  /** Baja = te concentrás mejor. */
  distractionsPerHour: number | null;
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
      chunks: acc.chunks + r.total_chunks,
      distractions: acc.distractions + r.distractions,
    }),
    { seconds: 0, chunks: 0, distractions: 0 }
  );
}

/**
 * Min/bloque de un conjunto de filas: suma todo primero y divide una sola vez.
 *
 * El orden importa. Promediar los min/bloque de cada día le da el mismo peso a
 * un día de 10 bloques que a uno de 1, y un día corto termina moviendo el
 * número del período entero.
 */
export function weightedAverage(rows: EfficiencyRow[]): number | null {
  const { seconds, chunks } = totals(rows);
  return minutesPerChunk(seconds, chunks);
}

/**
 * Días distintos en los que hubo estudio con bloques cargados.
 *
 * Deduplica por fecha: la query devuelve una fila por día + materia, así que
 * estudiar dos materias el mismo día son dos filas y un solo día.
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
 * Distracciones por hora estudiada. Normalizar por tiempo es lo que la vuelve
 * comparable: estudiar más horas produce más cortes en términos absolutos sin
 * que eso signifique estar peor concentrado.
 */
export function distractionsPerHour(rows: EfficiencyRow[]): number | null {
  const { seconds, distractions } = totals(rows);
  if (seconds <= 0) return null;
  return round1(distractions / (seconds / 3600));
}

export function summarize(rows: EfficiencyRow[]): Summary {
  return {
    minutesPerBlock: weightedAverage(rows),
    blocksPerDay: blocksPerStudyDay(rows),
    studyDays: studyDays(rows),
    distractionsPerHour: distractionsPerHour(rows),
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
