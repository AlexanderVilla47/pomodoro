import { getSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/index";
import { getAccessToken, getContextTracks } from "@/lib/spotify/client";

// Expande el contexto en reproducción (playlist/álbum) a su lista completa de
// tracks, para mostrarla clickeable. Si el contexto no es expandible (radio,
// artista, tema suelto) devuelve supported:false y la UI cae a su fallback.
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const uri = searchParams.get("uri")?.trim();
  if (!uri) return Response.json({ error: "uri requerido" }, { status: 400 });

  const sql = getDb();
  const accessToken = await getAccessToken(sql, session.user.id);
  if (!accessToken) return Response.json({ error: "Not connected" }, { status: 401 });

  try {
    const tracks = await getContextTracks(accessToken, uri);
    if (tracks === null) {
      return Response.json({ supported: false, tracks: [] });
    }
    return Response.json({ supported: true, tracks });
  } catch {
    return Response.json({ error: "fetch_failed" }, { status: 502 });
  }
}
