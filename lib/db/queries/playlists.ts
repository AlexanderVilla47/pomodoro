import type postgres from "postgres";

type Sql = ReturnType<typeof postgres>;

export interface Playlist {
  id: number;
  playlist_id: string;
  title: string;
  thumbnail_url: string | null;
  cached_at: string;
  created_at: string;
}

export interface Track {
  id: number;
  playlist_id: number;
  video_id: string;
  title: string;
  duration_seconds: number | null;
  position: number;
}

type NewTrack = Omit<Track, "id" | "playlist_id">;

export async function upsertPlaylist(
  sql: Sql,
  userId: string,
  data: { playlist_id: string; title: string; thumbnail_url: string | null }
): Promise<Playlist> {
  const [row] = await sql<Playlist[]>`
    INSERT INTO playlists (user_id, playlist_id, title, thumbnail_url, cached_at)
    VALUES (${userId}, ${data.playlist_id}, ${data.title}, ${data.thumbnail_url}, NOW())
    ON CONFLICT (user_id, playlist_id) DO UPDATE SET
      title = EXCLUDED.title,
      thumbnail_url = EXCLUDED.thumbnail_url,
      cached_at = NOW()
    RETURNING
      id, playlist_id, title, thumbnail_url,
      cached_at::text AS cached_at,
      created_at::text AS created_at
  `;
  return row;
}

export async function getPlaylist(sql: Sql, userId: string, playlistId: string): Promise<Playlist | null> {
  const rows = await sql<Playlist[]>`
    SELECT id, playlist_id, title, thumbnail_url,
           cached_at::text AS cached_at,
           created_at::text AS created_at
    FROM playlists WHERE user_id = ${userId} AND playlist_id = ${playlistId}
  `;
  return rows[0] ?? null;
}

export async function getPlaylists(sql: Sql, userId: string): Promise<Playlist[]> {
  return sql<Playlist[]>`
    SELECT id, playlist_id, title, thumbnail_url,
           cached_at::text AS cached_at,
           created_at::text AS created_at
    FROM playlists WHERE user_id = ${userId} ORDER BY created_at DESC
  `;
}

export async function isPlaylistStale(sql: Sql, userId: string, playlistId: string): Promise<boolean> {
  const rows = await sql`
    SELECT 1 FROM playlists
    WHERE user_id = ${userId}
      AND playlist_id = ${playlistId}
      AND cached_at > NOW() - interval '24 hours'
  `;
  return rows.length === 0;
}

export async function upsertTracks(sql: Sql, playlistId: number, tracks: NewTrack[]): Promise<void> {
  await sql`DELETE FROM tracks WHERE playlist_id = ${playlistId}`;

  if (tracks.length === 0) return;

  await sql`
    INSERT INTO tracks ${sql(
      tracks.map((t) => ({
        playlist_id: playlistId,
        video_id: t.video_id,
        title: t.title,
        duration_seconds: t.duration_seconds,
        position: t.position,
      }))
    )}
  `;
}

export async function deletePlaylist(sql: Sql, userId: string, playlistId: string): Promise<void> {
  await sql`DELETE FROM playlists WHERE playlist_id = ${playlistId} AND user_id = ${userId}`;
}

export async function updatePlaylistCachedAt(sql: Sql, userId: string, playlistId: string): Promise<void> {
  await sql`UPDATE playlists SET cached_at = NOW() WHERE playlist_id = ${playlistId} AND user_id = ${userId}`;
}

export async function getTracksByPlaylist(sql: Sql, userId: string, playlistId: string): Promise<Track[]> {
  const playlist = await getPlaylist(sql, userId, playlistId);
  if (!playlist) return [];

  return sql<Track[]>`
    SELECT id, playlist_id, video_id, title, duration_seconds, position
    FROM tracks
    WHERE playlist_id = ${playlist.id}
    ORDER BY position ASC
  `;
}
