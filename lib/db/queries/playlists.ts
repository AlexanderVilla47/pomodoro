import type { DatabaseSync } from "node:sqlite";

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

type RawPlaylist = {
  id: number | bigint;
  playlist_id: string;
  title: string;
  thumbnail_url: string | null;
  cached_at: string;
  created_at: string;
};

function toPlaylist(row: RawPlaylist): Playlist {
  return { ...row, id: Number(row.id) };
}

export function upsertPlaylist(
  db: DatabaseSync,
  data: { playlist_id: string; title: string; thumbnail_url: string | null }
): Playlist {
  db.prepare(`
    INSERT INTO playlists (playlist_id, title, thumbnail_url, cached_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(playlist_id) DO UPDATE SET
      title = excluded.title,
      thumbnail_url = excluded.thumbnail_url,
      cached_at = datetime('now')
  `).run(data.playlist_id, data.title, data.thumbnail_url ?? null);

  const row = db
    .prepare("SELECT * FROM playlists WHERE playlist_id = ?")
    .get(data.playlist_id) as RawPlaylist;

  return toPlaylist(row);
}

export function getPlaylist(db: DatabaseSync, playlistId: string): Playlist | null {
  const row = db
    .prepare("SELECT * FROM playlists WHERE playlist_id = ?")
    .get(playlistId) as RawPlaylist | undefined;

  return row ? toPlaylist(row) : null;
}

export function isPlaylistStale(db: DatabaseSync, playlistId: string): boolean {
  const row = db
    .prepare(`
      SELECT cached_at FROM playlists
      WHERE playlist_id = ?
        AND cached_at > datetime('now', '-24 hours')
    `)
    .get(playlistId) as { cached_at: string } | undefined;

  return row === undefined;
}

export function upsertTracks(db: DatabaseSync, playlistId: number, tracks: NewTrack[]): void {
  db.prepare("DELETE FROM tracks WHERE playlist_id = ?").run(playlistId);

  const insert = db.prepare(`
    INSERT INTO tracks (playlist_id, video_id, title, duration_seconds, position)
    VALUES (?, ?, ?, ?, ?)
  `);

  for (const track of tracks) {
    insert.run(
      playlistId,
      track.video_id,
      track.title,
      track.duration_seconds ?? null,
      track.position
    );
  }
}

export function deletePlaylist(db: DatabaseSync, playlistId: string): void {
  db.prepare(`DELETE FROM playlists WHERE playlist_id = ?`).run(playlistId);
}

export function getTracksByPlaylist(db: DatabaseSync, playlistId: string): Track[] {
  const playlist = getPlaylist(db, playlistId);
  if (!playlist) return [];

  const rows = db
    .prepare(`
      SELECT * FROM tracks
      WHERE playlist_id = ?
      ORDER BY position ASC
    `)
    .all(playlist.id) as Array<{
      id: number | bigint;
      playlist_id: number | bigint;
      video_id: string;
      title: string;
      duration_seconds: number | null;
      position: number | bigint;
    }>;

  return rows.map((r) => ({
    id: Number(r.id),
    playlist_id: Number(r.playlist_id),
    video_id: r.video_id,
    title: r.title,
    duration_seconds: r.duration_seconds,
    position: Number(r.position),
  }));
}
