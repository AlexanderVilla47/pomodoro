import { getDb } from "@/lib/db/index";
import { insertSession } from "@/lib/db/queries/sessions";
import { shouldLog } from "@/lib/timer/engine";
import type { SessionType } from "@/lib/db/queries/sessions";

interface SessionBody {
  type: SessionType;
  started_at: string;
  ended_at: string;
  planned_duration: number;
  actual_duration: number;
  completed: boolean;
  label_id?: number | null;
}

const VALID_TYPES = new Set(["work", "short_break", "long_break"]);

export async function POST(req: Request) {
  let body: Partial<SessionBody>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { type, started_at, ended_at, planned_duration, actual_duration, completed, label_id } = body;

  if (!type || !VALID_TYPES.has(type)) {
    return Response.json({ error: "type must be work | short_break | long_break" }, { status: 400 });
  }
  if (!started_at || !ended_at) {
    return Response.json({ error: "started_at and ended_at are required" }, { status: 400 });
  }
  if (typeof planned_duration !== "number" || typeof actual_duration !== "number") {
    return Response.json({ error: "planned_duration and actual_duration must be numbers" }, { status: 400 });
  }

  if (!completed) {
    if (type !== "work") return new Response(null, { status: 204 });
    if (!shouldLog(actual_duration, planned_duration)) return new Response(null, { status: 204 });
  }

  const db = getDb();
  const id = await insertSession(db, {
    type,
    started_at,
    ended_at,
    planned_duration,
    actual_duration,
    completed: !!completed,
    label_id: label_id ?? null,
  });

  return Response.json({ id }, { status: 201 });
}
