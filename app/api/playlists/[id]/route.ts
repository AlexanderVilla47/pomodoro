import { getDb } from "@/lib/db/index";
import { deletePlaylist } from "@/lib/db/queries/playlists";
import { getSession } from "@/lib/auth/session";

export async function DELETE(
  _req: Request,
  props: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await props.params;
  const db = getDb();
  await deletePlaylist(db, session.user.id, id);
  return new Response(null, { status: 204 });
}
