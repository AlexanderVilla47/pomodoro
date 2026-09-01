import { getDb } from "@/lib/db/index";
import { getSession } from "@/lib/auth/session";
import {
  insertWorkLog,
  getWorkLogs,
  DuplicateWorkLogError,
} from "@/lib/db/queries/work-logs";
import { getSessionIdByClientId } from "@/lib/db/queries/sessions";

interface WorkLogBody {
  /** UUID de la sesión, puesto por el cliente. La referencia buena. */
  sessionClientId?: string;
  /** Id numérico. Sólo lo traen los items encolados antes de este deploy. */
  sessionId?: number;
  notes?: string | null;
  topics?: string[];
  isTheory?: boolean;
  chunks?: number | null;
}

const MAX_CHUNKS = 100;

/**
 * Normaliza los chunks en vez de rechazarlos.
 *
 * La cola offline de useWorkLogger solo da por entregado un item con 201 o 409;
 * cualquier otro status lo reencola y lo reintenta en cada evento `online`. Un
 * 400 por un número mal formado sería una poison pill que no se va nunca. Un
 * chunk inválido se guarda como NULL: la fila igual sirve para saber que la
 * sesión fue de teoría, y el análisis la filtra con `chunks > 0`.
 */
function normalizeChunks(value: unknown, isTheory: boolean): number | null {
  if (!isTheory) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  return Math.round(Math.min(value, MAX_CHUNKS) * 100) / 100;
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

  const { sessionClientId, sessionId, notes, topics, isTheory, chunks } = body;

  const db = getDb();
  const clientRef =
    typeof sessionClientId === "string" && sessionClientId.trim()
      ? sessionClientId.trim()
      : null;

  let resolvedSessionId: number;
  if (clientRef) {
    const found = await getSessionIdByClientId(db, session.user.id, clientRef);
    if (found === null) {
      // ⚠️ 202, NO 400 — y esto no se "simplifica".
      //
      // useWorkLogger sólo da por entregado un item con 201 o 409; cualquier
      // otro status lo reencola y lo reintenta en cada evento `online` y en
      // cada montaje del hook. Un 400 acá sería una poison pill que no se va
      // nunca.
      //
      // Y el caso es legítimo: el work log salió de la cola antes que su
      // sesión. useOfflineSync ordena el vaciado (sesiones primero) justamente
      // para que esto sea raro, pero "raro" no es "imposible". El 202 dice
      // "todavía no, volvé a intentar", que es exactamente la verdad.
      return Response.json({ pending: true }, { status: 202 });
    }
    resolvedSessionId = found;
  } else if (typeof sessionId === "number") {
    resolvedSessionId = sessionId;
  } else {
    return Response.json(
      { error: "sessionClientId (or legacy sessionId) is required" },
      { status: 400 }
    );
  }

  const cleanIsTheory = isTheory === true;
  const cleanChunks = normalizeChunks(chunks, cleanIsTheory);

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

  try {
    const id = await insertWorkLog(db, session.user.id, {
      session_id: resolvedSessionId,
      notes: cleanNotes,
      topics: cleanTopics,
      is_theory: cleanIsTheory,
      chunks: cleanChunks,
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
