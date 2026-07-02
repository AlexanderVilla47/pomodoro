import { getDb } from "@/lib/db/index";
import { getSession } from "@/lib/auth/session";
import { upsertPresence, type PresencePhase } from "@/lib/db/queries/presence";

const VALID_PHASES: PresencePhase[] = ["work", "break", "idle"];

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const phase = body?.phase;

  if (!VALID_PHASES.includes(phase)) {
    return Response.json({ error: "phase inválida" }, { status: 400 });
  }

  const db = getDb();
  await upsertPresence(db, session.user.id, phase);

  return Response.json({ ok: true });
}
