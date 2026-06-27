import { getDb } from "@/lib/db/index";
import { getLabels, createLabel, getLabelStats } from "@/lib/db/queries/labels";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const db = getDb();

  if (searchParams.get("stats") === "1") {
    return Response.json(getLabelStats(db));
  }

  return Response.json(getLabels(db));
}

export async function POST(req: Request) {
  let body: { name?: string; color?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { name, color = "#5ABFA8" } = body;
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return Response.json({ error: "name is required" }, { status: 400 });
  }

  const db = getDb();
  try {
    const label = createLabel(db, name.trim(), color);
    return Response.json(label, { status: 201 });
  } catch {
    return Response.json({ error: "Label name already exists" }, { status: 409 });
  }
}
