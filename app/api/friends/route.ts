import { getDb } from "@/lib/db/index";
import { getSession } from "@/lib/auth/session";
import {
  findUserById,
  sendFriendRequest,
  getFriendsWithStats,
  getPendingRequests,
  areFriends,
} from "@/lib/db/queries/friends";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const tzParam = searchParams.get("tz");
  const tzOffset = tzParam !== null ? parseInt(tzParam, 10) : 0;
  const offset = isNaN(tzOffset) ? 0 : tzOffset;

  const db = getDb();
  const [friends, pending] = await Promise.all([
    getFriendsWithStats(db, session.user.id, offset),
    getPendingRequests(db, session.user.id),
  ]);

  return Response.json({ friends, pending });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const userId = typeof body?.userId === "string" ? body.userId.trim() : null;

  if (!userId) {
    return Response.json({ error: "userId requerido" }, { status: 400 });
  }

  if (userId === session.user.id) {
    return Response.json({ error: "No podés agregarte a vos mismo" }, { status: 400 });
  }

  const db = getDb();
  const target = await findUserById(db, userId);

  if (!target) {
    return Response.json({ error: "No existe ese usuario" }, { status: 404 });
  }

  const already = await areFriends(db, session.user.id, target.id);
  if (already) {
    return Response.json({ error: "Ya son amigos" }, { status: 409 });
  }

  const result = await sendFriendRequest(db, session.user.id, target.id);

  if (!result) {
    return Response.json({ error: "Ya existe una solicitud pendiente" }, { status: 409 });
  }

  return Response.json({ id: result.id }, { status: 201 });
}
