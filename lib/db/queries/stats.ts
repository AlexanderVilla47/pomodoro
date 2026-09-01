import type postgres from "postgres";
import type { EfficiencyRow } from "@/lib/analytics/efficiency";

type Sql = ReturnType<typeof postgres>;

export interface EfficiencyOpts {
  /** Fecha ISO inclusive, ya en la zona del usuario. */
  from: string;
  /** Fecha ISO inclusive, ya en la zona del usuario. */
  to: string;
  tz: number;
}

/**
 * postgres.js mapea NUMERIC a string para no perder precisión, y `SUM()` sobre
 * un NUMERIC devuelve NUMERIC. Sin convertir, sumar concatena en vez de sumar
 * y falla en silencio.
 *
 * A diferencia del `toNumberOrNull` de work-logs, acá un nulo cae en 0: un día
 * sin bloques suma cero al agregado, no "dato faltante".
 */
function toNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Un dataset crudo por día y materia, del que salen las cuatro métricas en
 * cualquier granularidad.
 *
 * Sólo suma y agrupa: toda la división vive en `lib/analytics/efficiency.ts`.
 * Los tests de esta capa mockean el tag `sql`, así que una fórmula escrita acá
 * sería matemática sin cobertura.
 *
 * El JOIN no infla las distracciones. Viven en `sessions` mientras que los
 * bloques viven en `work_logs`, así que sumarlas sobre el join sería doble
 * conteo si una sesión tuviera varios work_logs — pero hay un unique sobre
 * `session_id` (`insertWorkLog` atrapa el 23505), o sea la relación es 1:1.
 */
export async function getStudyEfficiencyByDay(
  sql: Sql,
  userId: string,
  opts: EfficiencyOpts
): Promise<EfficiencyRow[]> {
  const rows = await sql<Array<Record<string, unknown>>>`
    SELECT
      (s.started_at + make_interval(mins => ${opts.tz}))::date::text AS day,
      l.id    AS label_id,
      l.name  AS label_name,
      l.color AS label_color,
      COALESCE(SUM(s.actual_duration), 0)::int   AS total_seconds,
      COALESCE(SUM(w.chunks), 0)                 AS total_chunks,
      COUNT(*)::int                              AS sessions,
      COALESCE(SUM(s.distraction_count), 0)::int AS distractions
    FROM work_logs w
    JOIN sessions s ON s.id = w.session_id
    LEFT JOIN labels l ON l.id = s.label_id
    WHERE w.user_id = ${userId}
      AND s.type = 'work'
      AND w.is_theory = true
      AND w.chunks > 0
      AND (s.started_at + make_interval(mins => ${opts.tz}))::date >= ${opts.from}::date
      AND (s.started_at + make_interval(mins => ${opts.tz}))::date <= ${opts.to}::date
    GROUP BY day, l.id, l.name, l.color
    ORDER BY day
  `;
  return rows.map((r) => ({
    day: r.day as string,
    label_id: r.label_id === null || r.label_id === undefined ? null : Number(r.label_id),
    label_name: (r.label_name as string | null) ?? null,
    label_color: (r.label_color as string | null) ?? null,
    total_seconds: toNumber(r.total_seconds),
    total_chunks: toNumber(r.total_chunks),
    sessions: toNumber(r.sessions),
    distractions: toNumber(r.distractions),
  }));
}
