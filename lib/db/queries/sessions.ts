import type postgres from "postgres";

type Sql = ReturnType<typeof postgres>;

export type SessionType = "work" | "short_break" | "long_break";

export interface NewSession {
  type: SessionType;
  started_at: string;
  ended_at: string;
  planned_duration: number;
  actual_duration: number;
  completed: boolean;
  label_id?: number | null;
  distraction_count?: number;
  distraction_marks?: number[];
  /** UUID generado por el cliente. Ausente en items encolados antes del deploy. */
  client_id?: string | null;
}

export interface SessionStats {
  count: number;
  total_seconds: number;
  distraction_count: number;
}

export interface DayStats {
  date: string;
  total_seconds: number;
}

/**
 * Upsert idempotente sobre `client_id`.
 *
 * El cliente puede reintentar la misma sesión: si el INSERT entró pero la
 * respuesta se perdió en el camino, `sendSession` encola y reenvía. Con la
 * identidad generada en el cliente, ese reenvío colisiona con la fila que ya
 * está y devuelve su id en vez de crear un duplicado.
 *
 * Dos detalles que no se pueden tocar:
 *
 * - El `WHERE client_id IS NOT NULL` del ON CONFLICT **no es decorativo**:
 *   `sessions_client_id_unique` es un índice PARCIAL y Postgres sólo lo infiere
 *   como conflict target si el predicado se repite acá. Sin eso, el INSERT
 *   revienta con "no unique or exclusion constraint matching".
 * - Tiene que ser `DO UPDATE`, no `DO NOTHING`: `DO NOTHING` no produce fila y
 *   `RETURNING` volvería vacío, dejando al cliente sin id.
 */
export async function insertSession(sql: Sql, userId: string, data: NewSession): Promise<number> {
  const [row] = await sql<[{ id: number }]>`
    INSERT INTO sessions (user_id, type, started_at, ended_at, planned_duration, actual_duration, completed, label_id, distraction_count, distraction_marks, client_id)
    VALUES (
      ${userId},
      ${data.type},
      ${data.started_at},
      ${data.ended_at},
      ${data.planned_duration},
      ${data.actual_duration},
      ${data.completed ? 1 : 0},
      ${data.label_id ?? null},
      ${data.distraction_count ?? 0},
      ${data.distraction_marks ?? []},
      ${data.client_id ?? null}
    )
    ON CONFLICT (client_id) WHERE client_id IS NOT NULL
    DO UPDATE SET client_id = EXCLUDED.client_id
    RETURNING id
  `;
  return row.id;
}

/**
 * Resuelve el id real de una sesión a partir del UUID del cliente. Filtra por
 * usuario: un client_id ajeno no puede resolver a la sesión de otro.
 *
 * Devuelve null si la sesión todavía no llegó al servidor — el caso normal
 * cuando un work_log de la cola se adelanta a su sesión.
 */
export async function getSessionIdByClientId(
  sql: Sql,
  userId: string,
  clientId: string
): Promise<number | null> {
  const [row] = await sql<Array<{ id: number }>>`
    SELECT id
    FROM sessions
    WHERE user_id = ${userId}
      AND client_id = ${clientId}
  `;
  return row ? row.id : null;
}

type StatsRow = { count: number; total_seconds: number; distraction_count: number };

function toStats(row: StatsRow): SessionStats {
  return {
    count: Number(row.count),
    total_seconds: Number(row.total_seconds),
    distraction_count: Number(row.distraction_count),
  };
}

export async function getStatsForToday(sql: Sql, userId: string, tzOffsetMinutes: number): Promise<SessionStats> {
  const [row] = await sql<[StatsRow]>`
    SELECT
      COUNT(*)::int AS count,
      COALESCE(SUM(actual_duration), 0)::int AS total_seconds,
      COALESCE(SUM(distraction_count), 0)::int AS distraction_count
    FROM sessions
    WHERE user_id = ${userId}
      AND type = 'work'
      AND (started_at + make_interval(mins => ${tzOffsetMinutes}))::date
          = (NOW() + make_interval(mins => ${tzOffsetMinutes}))::date
  `;
  return toStats(row);
}

export async function getStatsForWeek(sql: Sql, userId: string, tzOffsetMinutes: number): Promise<SessionStats> {
  const [row] = await sql<[StatsRow]>`
    SELECT
      COUNT(*)::int AS count,
      COALESCE(SUM(actual_duration), 0)::int AS total_seconds,
      COALESCE(SUM(distraction_count), 0)::int AS distraction_count
    FROM sessions
    WHERE user_id = ${userId}
      AND type = 'work'
      AND (started_at + make_interval(mins => ${tzOffsetMinutes}))::date
          >= (date_trunc('week', (NOW() + make_interval(mins => ${tzOffsetMinutes}))::date + interval '1 day') - interval '1 day')::date
  `;
  return toStats(row);
}

export async function getDailyStatsForYear(
  sql: Sql,
  userId: string,
  year: number,
  tzOffsetMinutes: number
): Promise<DayStats[]> {
  const rows = await sql<Array<{ day: string; total_seconds: number }>>`
    SELECT
      (started_at + make_interval(mins => ${tzOffsetMinutes}))::date::text AS day,
      COALESCE(SUM(actual_duration), 0)::int AS total_seconds
    FROM sessions
    WHERE user_id = ${userId}
      AND type = 'work'
      AND EXTRACT(YEAR FROM (started_at + make_interval(mins => ${tzOffsetMinutes}))) = ${year}
    GROUP BY day
    ORDER BY day
  `;
  return rows.map((r) => ({ date: r.day, total_seconds: Number(r.total_seconds) }));
}

export async function getYearsWithData(sql: Sql, userId: string): Promise<number[]> {
  const rows = await sql<Array<{ year: number }>>`
    SELECT DISTINCT EXTRACT(YEAR FROM started_at)::int AS year
    FROM sessions
    WHERE user_id = ${userId}
      AND type = 'work'
    ORDER BY year DESC
  `;
  return rows.map((r) => Number(r.year));
}
