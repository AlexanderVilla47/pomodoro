import { getDb } from "@/lib/db/index";
import { deleteLabel } from "@/lib/db/queries/labels";
import { getSession } from "@/lib/auth/session";

export async function DELETE(
  _req: Request,
  props: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await props.params;
  const numId = parseInt(id, 10);
  if (isNaN(numId)) {
    return Response.json({ error: "Invalid id" }, { status: 400 });
  }

  const db = getDb();
  await deleteLabel(db, session.user.id, numId);
  return new Response(null, { status: 204 });
}
