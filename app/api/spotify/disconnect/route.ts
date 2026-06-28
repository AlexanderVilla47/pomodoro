import { getSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/index";
import { deleteTokens } from "@/lib/spotify/client";

export async function DELETE() {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const sql = getDb();
  await deleteTokens(sql, session.user.id);
  return Response.json({ ok: true });
}
