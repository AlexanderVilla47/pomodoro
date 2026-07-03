import { getDb } from "@/lib/db/index";
import { getSession } from "@/lib/auth/session";
import { searchUsers } from "@/lib/db/queries/friends";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";

  if (!q) return Response.json({ results: [] });

  const db = getDb();
  const results = await searchUsers(db, q, session.user.id);

  return Response.json({ results });
}
