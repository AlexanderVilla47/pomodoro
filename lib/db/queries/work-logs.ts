import type postgres from "postgres";

type Sql = ReturnType<typeof postgres>;

export interface NewWorkLog {
  session_id: number;
  notes?: string | null;
  topics: string[];
}

export interface WorkLogRow {
  id: number;
  session_id: number;
  notes: string | null;
  topics: string[];
  created_at: string;
  session_type: string;
  started_at: string;
  actual_duration: number;
  label_id: number | null;
  label_name: string | null;
  label_color: string | null;
}

export class DuplicateWorkLogError extends Error {
  constructor() {
    super("Work log already exists for this session");
    this.name = "DuplicateWorkLogError";
  }
}

export async function insertWorkLog(
  sql: Sql,
  userId: string,
  data: NewWorkLog
): Promise<number> {
  try {
    const [row] = await sql<[{ id: number }]>`
      INSERT INTO work_logs (session_id, user_id, notes, topics)
      VALUES (
        ${data.session_id},
        ${userId},
        ${data.notes ?? null},
        ${data.topics}
      )
      RETURNING id
    `;
    return row.id;
  } catch (e: unknown) {
    if (
      typeof e === "object" &&
      e !== null &&
      "code" in e &&
      (e as { code: string }).code === "23505"
    ) {
      throw new DuplicateWorkLogError();
    }
    throw e;
  }
}

export async function getWorkLogs(
  sql: Sql,
  userId: string,
  opts: { limit: number; cursor?: string; date?: string; tz?: number }
): Promise<WorkLogRow[]> {
  const limit = Math.min(Math.max(opts.limit, 1), 50);
  const tzMins = opts.tz ?? 0;
  return sql<WorkLogRow[]>`
    SELECT
      w.id,
      w.session_id,
      w.notes,
      w.topics,
      w.created_at::text AS created_at,
      s.type             AS session_type,
      s.started_at::text AS started_at,
      s.actual_duration,
      l.id               AS label_id,
      l.name             AS label_name,
      l.color            AS label_color
    FROM work_logs w
    JOIN sessions s ON s.id = w.session_id
    LEFT JOIN labels l ON l.id = s.label_id
    WHERE w.user_id = ${userId}
      ${opts.date
        ? sql`AND (s.started_at + (${tzMins} * INTERVAL '1 minute'))::date = ${opts.date}::date`
        : opts.cursor
        ? sql`AND w.created_at < ${opts.cursor}::timestamptz`
        : sql``}
    ORDER BY w.created_at DESC
    LIMIT ${limit}
  `;
}
