import { getDb } from "@/lib/db/index";
import { insertSession } from "@/lib/db/queries/sessions";
import { shouldLog } from "@/lib/timer/engine";
import { MAX_DISTRACTION_MARKS } from "@/lib/timer/constants";
import type { SessionType } from "@/lib/db/queries/sessions";
import { getSession } from "@/lib/auth/session";

interface SessionBody {
  type: SessionType;
  started_at: string;
  ended_at: string;
  planned_duration: number;
  actual_duration: number;
  completed: boolean;
  label_id?: number | null;
  distraction_marks?: number[];
}

const VALID_TYPES = new Set(["work", "short_break", "long_break"]);

/**
 * Los marks llegan como segundos desde el inicio de la sesión. Descartamos
 * basura, clampeamos al final real de la sesión (el borde puede correrse un
 * segundo por redondeo entre el reloj del tap y la duración loggeada) y
 * cortamos en el tope. El count NO se toma del cliente: se deriva del array,
 * que es el único dato que podemos validar.
 */
function sanitizeMarks(raw: unknown, actualDuration: number): number[] {
  if (!Array.isArray(raw)) return [];
  const max = Math.max(0, Math.round(actualDuration));
  return raw
    .filter((m): m is number => typeof m === "number" && Number.isFinite(m) && m >= 0)
    .map((m) => Math.min(Math.round(m), max))
    .sort((a, b) => a - b)
    .slice(0, MAX_DISTRACTION_MARKS);
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: Partial<SessionBody>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { type, started_at, ended_at, planned_duration, actual_duration, completed, label_id, distraction_marks } = body;

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

  const marks = sanitizeMarks(distraction_marks, actual_duration);

  const db = getDb();
  const id = await insertSession(db, session.user.id, {
    type,
    started_at,
    ended_at,
    planned_duration,
    actual_duration,
    completed: !!completed,
    label_id: label_id ?? null,
    distraction_count: marks.length,
    distraction_marks: marks,
  });

  return Response.json({ id }, { status: 201 });
}
