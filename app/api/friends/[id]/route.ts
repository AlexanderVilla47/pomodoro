import { getDb } from "@/lib/db/index";
import { getSession } from "@/lib/auth/session";
import { respondToFriendRequest, removeFriend } from "@/lib/db/queries/friends";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const friendshipId = parseInt(id, 10);
  if (isNaN(friendshipId)) return Response.json({ error: "ID inválido" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const action = body?.action;

  if (action !== "accept" && action !== "decline") {
    return Response.json({ error: "action debe ser 'accept' o 'decline'" }, { status: 400 });
  }

  const db = getDb();
  const ok = await respondToFriendRequest(db, friendshipId, session.user.id, action);

  if (!ok) return Response.json({ error: "Solicitud no encontrada" }, { status: 404 });

  return Response.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const friendshipId = parseInt(id, 10);
  if (isNaN(friendshipId)) return Response.json({ error: "ID inválido" }, { status: 400 });

  const db = getDb();
  const ok = await removeFriend(db, friendshipId, session.user.id);

  if (!ok) return Response.json({ error: "Amistad no encontrada" }, { status: 404 });

  return Response.json({ ok: true });
}
