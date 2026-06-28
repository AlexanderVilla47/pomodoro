import { getDb } from "@/lib/db/index";
import {
  getPlaylist,
  isPlaylistStale,
  upsertTracks,
  getTracksByPlaylist,
  updatePlaylistCachedAt,
} from "@/lib/db/queries/playlists";
import { fetchPlaylistItems } from "@/lib/youtube/client";
import { getSession } from "@/lib/auth/session";

export async function GET(
  _req: Request,
  props: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id: playlistId } = await props.params;
  const db = getDb();
  const userId = session.user.id;

  const playlist = await getPlaylist(db, userId, playlistId);
  if (!playlist) {
    return Response.json({ error: "Playlist not found" }, { status: 404 });
  }

  if (await isPlaylistStale(db, userId, playlistId)) {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      return Response.json({ error: "YouTube API not configured, cannot refresh stale playlist" }, { status: 503 });
    }

    const tracks = await fetchPlaylistItems(playlistId, apiKey);
    await upsertTracks(
      db,
      playlist.id,
      tracks.map((t) => ({
        video_id: t.videoId,
        title: t.title,
        duration_seconds: null,
        position: t.position,
      }))
    );

    await updatePlaylistCachedAt(db, userId, playlistId);
  }

  return Response.json(await getTracksByPlaylist(db, userId, playlistId));
}
