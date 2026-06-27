import { getDb } from "@/lib/db/index";
import { getPlaylist, isPlaylistStale, upsertTracks, getTracksByPlaylist } from "@/lib/db/queries/playlists";
import { fetchPlaylistItems } from "@/lib/youtube/client";

export async function GET(
  _req: Request,
  props: { params: Promise<{ id: string }> }
) {
  const { id: playlistId } = await props.params;
  const db = getDb();

  const playlist = getPlaylist(db, playlistId);
  if (!playlist) {
    return Response.json({ error: "Playlist not found" }, { status: 404 });
  }

  if (isPlaylistStale(db, playlistId)) {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      return Response.json({ error: "YouTube API not configured, cannot refresh stale playlist" }, { status: 503 });
    }

    const tracks = await fetchPlaylistItems(playlistId, apiKey);
    upsertTracks(
      db,
      playlist.id,
      tracks.map((t) => ({
        video_id: t.videoId,
        title: t.title,
        duration_seconds: null,
        position: t.position,
      }))
    );

    db.prepare("UPDATE playlists SET cached_at = datetime('now') WHERE playlist_id = ?").run(playlistId);
  }

  return Response.json(getTracksByPlaylist(db, playlistId));
}
