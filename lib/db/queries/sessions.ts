import type { DatabaseSync } from "node:sqlite";

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

export function insertSession(db: DatabaseSync, data: NewSession): number {
  const result = db
    .prepare(`
      INSERT INTO sessions (type, started_at, ended_at, planned_duration, actual_duration, completed, label_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      data.type,
      data.started_at,
      data.ended_at,
      data.planned_duration,
      data.actual_duration,
      data.completed ? 1 : 0,
      data.label_id ?? null
    ) as { lastInsertRowid: number };

  return result.lastInsertRowid;
}

export function getStatsForToday(db: DatabaseSync, tzOffsetMinutes: number): SessionStats {
  const offsetSign = tzOffsetMinutes >= 0 ? "+" : "-";
  const absMinutes = Math.abs(tzOffsetMinutes);
  const hours = String(Math.floor(absMinutes / 60)).padStart(2, "0");
  const mins = String(absMinutes % 60).padStart(2, "0");
  const offset = `${offsetSign}${hours}:${mins}`;

  const row = db
    .prepare(`
      SELECT
        COUNT(*) as count,
        COALESCE(SUM(actual_duration), 0) as total_seconds
      FROM sessions
      WHERE type = 'work'
        AND date(started_at, ?) = date('now', ?)
    `)
    .get(offset, offset) as { count: number; total_seconds: number };

  return { count: Number(row.count), total_seconds: Number(row.total_seconds) };
}

export interface DayStats {
  date: string;
  total_seconds: number;
}

export function getDailyStatsForYear(db: DatabaseSync, year: number, tzOffsetMinutes: number): DayStats[] {
  const offsetSign = tzOffsetMinutes >= 0 ? "+" : "-";
  const absMinutes = Math.abs(tzOffsetMinutes);
  const h = String(Math.floor(absMinutes / 60)).padStart(2, "0");
  const m = String(absMinutes % 60).padStart(2, "0");
  const offset = `${offsetSign}${h}:${m}`;

  const rows = db
    .prepare(`
      SELECT
        date(started_at, ?) AS day,
        COALESCE(SUM(actual_duration), 0) AS total_seconds
      FROM sessions
      WHERE type = 'work'
        AND strftime('%Y', started_at, ?) = ?
      GROUP BY day
      ORDER BY day
    `)
    .all(offset, offset, String(year)) as Array<{ day: string; total_seconds: number }>;

  return rows.map((r) => ({ date: r.day, total_seconds: Number(r.total_seconds) }));
}

export function getYearsWithData(db: DatabaseSync): number[] {
  const rows = db
    .prepare(`
      SELECT DISTINCT strftime('%Y', started_at) AS year
      FROM sessions
      WHERE type = 'work'
      ORDER BY year DESC
    `)
    .all() as Array<{ year: string }>;
  return rows.map((r) => Number(r.year));
}

export function getStatsForWeek(db: DatabaseSync, tzOffsetMinutes: number): SessionStats {
  const offsetSign = tzOffsetMinutes >= 0 ? "+" : "-";
  const absMinutes = Math.abs(tzOffsetMinutes);
  const hours = String(Math.floor(absMinutes / 60)).padStart(2, "0");
  const mins = String(absMinutes % 60).padStart(2, "0");
  const offset = `${offsetSign}${hours}:${mins}`;

  const row = db
    .prepare(`
      SELECT
        COUNT(*) as count,
        COALESCE(SUM(actual_duration), 0) as total_seconds
      FROM sessions
      WHERE type = 'work'
        AND date(started_at, ?) >= date('now', '-6 days', ?)
    `)
    .get(offset, offset) as { count: number; total_seconds: number };

  return { count: Number(row.count), total_seconds: Number(row.total_seconds) };
}
