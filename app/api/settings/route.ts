import { getDb } from "@/lib/db/index";
import { getSettings, upsertSettings } from "@/lib/db/queries/settings";

export async function GET() {
  const db = getDb();
  return Response.json(await getSettings(db));
}

export async function PUT(req: Request) {
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
  const updated = await upsertSettings(db, body as Parameters<typeof upsertSettings>[1]);
  return Response.json(updated);
}
