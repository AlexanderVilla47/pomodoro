import { getDb } from "@/lib/db/index";
import { getSession } from "@/lib/auth/session";
import {
  findUserByEmail,
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
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : null;

  if (!email) {
    return Response.json({ error: "Email requerido" }, { status: 400 });
  }

  if (email === session.user.email?.toLowerCase()) {
    return Response.json({ error: "No podés agregarte a vos mismo" }, { status: 400 });
  }

  const db = getDb();
  const target = await findUserByEmail(db, email);

  if (!target) {
    return Response.json({ error: "No existe ningún usuario con ese email" }, { status: 404 });
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
