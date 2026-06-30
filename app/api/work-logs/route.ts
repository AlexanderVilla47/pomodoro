import { getDb } from "@/lib/db/index";
import { getSession } from "@/lib/auth/session";
import {
  insertWorkLog,
  getWorkLogs,
  DuplicateWorkLogError,
} from "@/lib/db/queries/work-logs";

interface WorkLogBody {
  sessionId: number;
  notes?: string | null;
  topics?: string[];
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: Partial<WorkLogBody>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { sessionId, notes, topics } = body;

  if (typeof sessionId !== "number") {
    return Response.json({ error: "sessionId must be a number" }, { status: 400 });
  }

  const cleanTopics = Array.isArray(topics)
    ? Array.from(
        new Set(
          topics
            .map((t) => String(t).trim())
            .filter(Boolean)
        )
      ).slice(0, 20)
    : [];

  const cleanNotes =
    typeof notes === "string" && notes.trim()
      ? notes.trim().slice(0, 2000)
      : null;

  const db = getDb();
  try {
    const id = await insertWorkLog(db, session.user.id, {
      session_id: sessionId,
      notes: cleanNotes,
      topics: cleanTopics,
    });
    return Response.json({ id }, { status: 201 });
  } catch (e) {
    if (e instanceof DuplicateWorkLogError) {
      return Response.json(
        { error: "Work log already exists for this session" },
        { status: 409 }
      );
    }
    throw e;
  }
}

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const limitRaw = Number(url.searchParams.get("limit") ?? "20");
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 50) : 20;
  const cursor = url.searchParams.get("cursor") ?? undefined;
  const date = url.searchParams.get("date") ?? undefined;
  const tzRaw = Number(url.searchParams.get("tz") ?? "0");
  const tz = Number.isFinite(tzRaw) ? Math.max(-720, Math.min(720, tzRaw)) : 0;

  const db = getDb();
  const rows = await getWorkLogs(db, session.user.id, { limit, cursor, date, tz });

  const hasMore = !date && rows.length === limit;
  const nextCursor = hasMore ? rows[rows.length - 1].created_at : null;

  return Response.json({ logs: rows, nextCursor, hasMore });
}
