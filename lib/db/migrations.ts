import type postgres from "postgres";

type Sql = ReturnType<typeof postgres>;

export async function runMigrations(sql: Sql): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      work_duration INTEGER NOT NULL DEFAULT 1500,
      short_break_duration INTEGER NOT NULL DEFAULT 300,
      long_break_duration INTEGER NOT NULL DEFAULT 900,
      long_break_interval INTEGER NOT NULL DEFAULT 4,
      notification_sound_enabled INTEGER NOT NULL DEFAULT 1,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`INSERT INTO settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING`;

  await sql`
    CREATE TABLE IF NOT EXISTS labels (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL DEFAULT '#5ABFA8'
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS sessions (
      id SERIAL PRIMARY KEY,
      type TEXT NOT NULL CHECK (type IN ('work', 'short_break', 'long_break')),
      started_at TIMESTAMPTZ NOT NULL,
      ended_at TIMESTAMPTZ NOT NULL,
      planned_duration INTEGER NOT NULL,
      actual_duration INTEGER NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      label_id INTEGER REFERENCES labels(id) ON DELETE SET NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS playlists (
      id SERIAL PRIMARY KEY,
      playlist_id TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      thumbnail_url TEXT,
      cached_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS tracks (
      id SERIAL PRIMARY KEY,
      playlist_id INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
      video_id TEXT NOT NULL,
      title TEXT NOT NULL,
      duration_seconds INTEGER,
      position INTEGER NOT NULL
    )
  `;
}
