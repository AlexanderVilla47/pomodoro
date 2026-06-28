import type postgres from "postgres";

type Sql = ReturnType<typeof postgres>;

export async function runMigrations(sql: Sql): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS settings (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE,
      work_duration INTEGER NOT NULL DEFAULT 1500,
      short_break_duration INTEGER NOT NULL DEFAULT 300,
      long_break_duration INTEGER NOT NULL DEFAULT 900,
      long_break_interval INTEGER NOT NULL DEFAULT 4,
      notification_sound_enabled INTEGER NOT NULL DEFAULT 1,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS labels (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#5ABFA8',
      UNIQUE (user_id, name)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS sessions (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
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
      user_id TEXT NOT NULL,
      playlist_id TEXT NOT NULL,
      title TEXT NOT NULL,
      thumbnail_url TEXT,
      cached_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, playlist_id)
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

  await sql`
    CREATE TABLE IF NOT EXISTS spotify_tokens (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE,
      access_token TEXT NOT NULL,
      refresh_token TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL
    )
  `;
}
