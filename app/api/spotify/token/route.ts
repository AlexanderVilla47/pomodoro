import { getSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/index";
import { getAccessToken } from "@/lib/spotify/client";

export async function GET() {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const sql = getDb();
  let accessToken: string | null;
  try {
    accessToken = await getAccessToken(sql, session.user.id);
  } catch {
    return Response.json({ error: "Token refresh failed" }, { status: 401 });
  }
  if (!accessToken) return Response.json({ error: "Not connected" }, { status: 404 });

  return Response.json({ accessToken });
}
