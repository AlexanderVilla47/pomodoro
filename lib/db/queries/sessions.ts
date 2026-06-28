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
}

export interface SessionStats {
  count: number;
  total_seconds: number;
}

export interface DayStats {
  date: string;
  total_seconds: number;
}

export async function insertSession(sql: Sql, userId: string, data: NewSession): Promise<number> {
  const [row] = await sql<[{ id: number }]>`
    INSERT INTO sessions (user_id, type, started_at, ended_at, planned_duration, actual_duration, completed, label_id)
    VALUES (
      ${userId},
      ${data.type},
      ${data.started_at},
      ${data.ended_at},
      ${data.planned_duration},
      ${data.actual_duration},
      ${data.completed ? 1 : 0},
      ${data.label_id ?? null}
    )
    RETURNING id
  `;
  return row.id;
}

export async function getStatsForToday(sql: Sql, userId: string, tzOffsetMinutes: number): Promise<SessionStats> {
  const [row] = await sql<[{ count: number; total_seconds: number }]>`
    SELECT
      COUNT(*)::int AS count,
      COALESCE(SUM(actual_duration), 0)::int AS total_seconds
    FROM sessions
    WHERE user_id = ${userId}
      AND type = 'work'
      AND (started_at + make_interval(mins => ${tzOffsetMinutes}))::date
          = (NOW() + make_interval(mins => ${tzOffsetMinutes}))::date
  `;
  return { count: Number(row.count), total_seconds: Number(row.total_seconds) };
}

export async function getStatsForWeek(sql: Sql, userId: string, tzOffsetMinutes: number): Promise<SessionStats> {
  const [row] = await sql<[{ count: number; total_seconds: number }]>`
    SELECT
      COUNT(*)::int AS count,
      COALESCE(SUM(actual_duration), 0)::int AS total_seconds
    FROM sessions
    WHERE user_id = ${userId}
      AND type = 'work'
      AND (started_at + make_interval(mins => ${tzOffsetMinutes}))::date
          >= (NOW() + make_interval(mins => ${tzOffsetMinutes}) - interval '6 days')::date
  `;
  return { count: Number(row.count), total_seconds: Number(row.total_seconds) };
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
