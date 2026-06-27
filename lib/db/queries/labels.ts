import type { DatabaseSync } from "node:sqlite";

export interface Label {
  id: number;
  name: string;
  color: string;
}

export interface LabelStats extends Label {
  count: number;
  total_seconds: number;
}

export function getLabels(db: DatabaseSync): Label[] {
  return db
    .prepare(`SELECT id, name, color FROM labels ORDER BY name`)
    .all() as Label[];
}

export function createLabel(db: DatabaseSync, name: string, color: string): Label {
  const result = db
    .prepare(`INSERT INTO labels (name, color) VALUES (?, ?)`)
    .run(name, color) as { lastInsertRowid: number };
  return { id: result.lastInsertRowid, name, color };
}

export function deleteLabel(db: DatabaseSync, id: number): void {
  db.prepare(`DELETE FROM labels WHERE id = ?`).run(id);
}

export function getLabelStats(db: DatabaseSync): LabelStats[] {
  const rows = db
    .prepare(`
      SELECT
        l.id, l.name, l.color,
        COUNT(s.id) AS count,
        COALESCE(SUM(s.actual_duration), 0) AS total_seconds
      FROM labels l
      LEFT JOIN sessions s ON s.label_id = l.id AND s.type = 'work'
      GROUP BY l.id
      ORDER BY total_seconds DESC
    `)
    .all() as Array<{ id: number; name: string; color: string; count: number; total_seconds: number }>;

  return rows.map((r) => ({
    id: Number(r.id),
    name: r.name,
    color: r.color,
    count: Number(r.count),
    total_seconds: Number(r.total_seconds),
  }));
}
