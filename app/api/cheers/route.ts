import { getDb } from "@/lib/db/index";
import { getSession } from "@/lib/auth/session";
import { sendCheer, getUnseenCheerCount } from "@/lib/db/queries/cheers";
import { areFriends } from "@/lib/db/queries/friends";

// Mandar un aliento a un amigo que está trabajando.
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const toUserId = typeof body?.toUserId === "string" ? body.toUserId.trim() : null;

  if (!toUserId) {
    return Response.json({ error: "toUserId requerido" }, { status: 400 });
  }
  if (toUserId === session.user.id) {
    return Response.json({ error: "No podés alentarte a vos mismo" }, { status: 400 });
  }

  const db = getDb();
  const friends = await areFriends(db, session.user.id, toUserId);
  if (!friends) {
    return Response.json({ error: "Solo podés alentar a tus amigos" }, { status: 403 });
  }

  await sendCheer(db, session.user.id, toUserId);
  return Response.json({ ok: true }, { status: 201 });
}

// Contador en vivo (anónimo) de alientos sin ver.
export async function GET() {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const count = await getUnseenCheerCount(db, session.user.id);
  return Response.json({ count });
}
