import type { DatabaseSync } from "node:sqlite";

export type SessionType = "work" | "short_break" | "long_break";

export interface NewSession {
  type: SessionType;
  started_at: string;
  ended_at: string;
  planned_duration: number;
  actual_duration: number;
  completed: boolean;
}

export interface SessionStats {
  count: number;
  total_seconds: number;
}

export function insertSession(db: DatabaseSync, data: NewSession): number {
  const result = db
    .prepare(`
      INSERT INTO sessions (type, started_at, ended_at, planned_duration, actual_duration, completed)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    .run(
      data.type,
      data.started_at,
      data.ended_at,
      data.planned_duration,
      data.actual_duration,
      data.completed ? 1 : 0
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
