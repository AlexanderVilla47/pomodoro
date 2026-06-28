import { getSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/index";
import { getAccessToken, getPlaylistTracks } from "@/lib/spotify/client";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const sql = getDb();
  const accessToken = await getAccessToken(sql, session.user.id);
  if (!accessToken) return Response.json({ error: "Not connected" }, { status: 401 });

  try {
    const tracks = await getPlaylistTracks(accessToken, id);
    return Response.json(tracks);
  } catch {
    return Response.json({ error: "fetch_failed" }, { status: 502 });
  }
}
