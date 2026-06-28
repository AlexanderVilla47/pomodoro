import { getSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/index";
import { getAccessToken, getPlaylists } from "@/lib/spotify/client";

export async function GET() {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const sql = getDb();

  let accessToken: string | null;
  try {
    accessToken = await getAccessToken(sql, session.user.id);
  } catch {
    return Response.json({ connected: false }, { status: 200 });
  }

  if (!accessToken) return Response.json({ connected: false }, { status: 200 });

  try {
    const playlists = await getPlaylists(accessToken);
    return Response.json({ connected: true, playlists });
  } catch {
    return Response.json({ connected: true, playlists: [], error: "fetch_failed" });
  }
}
