import { getDb } from "@/lib/db/index";
import { upsertPlaylist, upsertTracks, getPlaylists } from "@/lib/db/queries/playlists";
import { extractPlaylistId } from "@/lib/youtube/parseUrl";
import { fetchPlaylistItems, fetchPlaylistInfo } from "@/lib/youtube/client";

export async function POST(req: Request) {
  let body: { url?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.url) {
    return Response.json({ error: "url is required" }, { status: 400 });
  }

  const playlistId = extractPlaylistId(body.url);
  if (!playlistId) {
    return Response.json({ error: "Invalid YouTube playlist URL" }, { status: 400 });
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "YouTube API not configured" }, { status: 503 });
  }

  const [info, tracks] = await Promise.all([
    fetchPlaylistInfo(playlistId, apiKey),
    fetchPlaylistItems(playlistId, apiKey),
  ]);

  const db = getDb();
  const playlist = await upsertPlaylist(db, {
    playlist_id: playlistId,
    title: info.title,
    thumbnail_url: info.thumbnailUrl,
  });

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

  return Response.json({ playlist, tracks }, { status: 201 });
}

export async function GET() {
  const db = getDb();
  return Response.json(await getPlaylists(db));
}
