import { getDb } from "@/lib/db/index";
import { deletePlaylist } from "@/lib/db/queries/playlists";

export async function DELETE(
  _req: Request,
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;
  const db = getDb();
  await deletePlaylist(db, id);
  return new Response(null, { status: 204 });
}
