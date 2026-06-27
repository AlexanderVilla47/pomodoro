import { getDb } from "@/lib/db/index";
import { deleteLabel } from "@/lib/db/queries/labels";

export async function DELETE(
  _req: Request,
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;
  const numId = parseInt(id, 10);
  if (isNaN(numId)) {
    return Response.json({ error: "Invalid id" }, { status: 400 });
  }

  const db = getDb();
  deleteLabel(db, numId);
  return new Response(null, { status: 204 });
}
