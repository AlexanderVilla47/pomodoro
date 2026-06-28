import type postgres from "postgres";

type Sql = ReturnType<typeof postgres>;

export interface Label {
  id: number;
  name: string;
  color: string;
}

export interface LabelStats extends Label {
  count: number;
  total_seconds: number;
}

export async function getLabels(sql: Sql, userId: string): Promise<Label[]> {
  return sql<Label[]>`SELECT id, name, color FROM labels WHERE user_id = ${userId} ORDER BY name`;
}

export async function createLabel(sql: Sql, userId: string, name: string, color: string): Promise<Label> {
  const [row] = await sql<Label[]>`
    INSERT INTO labels (user_id, name, color) VALUES (${userId}, ${name}, ${color})
    RETURNING id, name, color
  `;
  return row;
}

export async function deleteLabel(sql: Sql, userId: string, id: number): Promise<void> {
  await sql`DELETE FROM labels WHERE id = ${id} AND user_id = ${userId}`;
}

export async function getLabelStats(sql: Sql, userId: string): Promise<LabelStats[]> {
  const rows = await sql<Array<{ id: number; name: string; color: string; count: string; total_seconds: string }>>`
    SELECT
      l.id, l.name, l.color,
      COUNT(s.id)::int AS count,
      COALESCE(SUM(s.actual_duration), 0)::int AS total_seconds
    FROM labels l
    LEFT JOIN sessions s ON s.label_id = l.id AND s.type = 'work' AND s.user_id = ${userId}
    WHERE l.user_id = ${userId}
    GROUP BY l.id
    ORDER BY total_seconds DESC
  `;

  return rows.map((r) => ({
    id: Number(r.id),
    name: r.name,
    color: r.color,
    count: Number(r.count),
    total_seconds: Number(r.total_seconds),
  }));
}
