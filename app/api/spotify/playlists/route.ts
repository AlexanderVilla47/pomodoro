import { getSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/index";
import {
  callSpotify,
  getPlaylists,
  SpotifyApiError,
  SpotifyNotConnectedError,
} from "@/lib/spotify/client";

export async function GET() {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const sql = getDb();

  try {
    const playlists = await callSpotify(sql, session.user.id, (token) =>
      getPlaylists(token)
    );
    return Response.json({ connected: true, playlists });
  } catch (e) {
    if (e instanceof SpotifyNotConnectedError) {
      return Response.json({ connected: false }, { status: 200 });
    }
    const spotifyStatus = e instanceof SpotifyApiError ? e.status : null;
    console.error("[spotify/playlists] fetch failed", spotifyStatus, e);
    return Response.json(
      { connected: true, playlists: [], error: "fetch_failed", spotifyStatus },
      { status: 200 }
    );
  }
}
