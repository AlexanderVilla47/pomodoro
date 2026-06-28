import { getDb } from "@/lib/db/index";
import { getSettings, upsertSettings } from "@/lib/db/queries/settings";
import { getSession } from "@/lib/auth/session";

export async function GET() {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  return Response.json(await getSettings(db, session.user.id));
}

export async function PUT(req: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const numericFields = [
    "work_duration",
    "short_break_duration",
    "long_break_duration",
    "long_break_interval",
  ] as const;

  for (const field of numericFields) {
    if (field in body && typeof body[field] !== "number") {
      return Response.json({ error: `${field} must be a number` }, { status: 400 });
    }
    if (field === "long_break_interval" && typeof body[field] === "number" && (body[field] as number) < 1) {
      return Response.json({ error: "long_break_interval must be >= 1" }, { status: 400 });
    }
  }

  const db = getDb();
  const updated = await upsertSettings(db, session.user.id, body as Parameters<typeof upsertSettings>[2]);
  return Response.json(updated);
}
