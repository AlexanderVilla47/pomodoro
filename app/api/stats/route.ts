import { getDb } from "@/lib/db/index";
import { getStatsForToday, getStatsForWeek } from "@/lib/db/queries/sessions";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tzParam = searchParams.get("tz");
  const tzOffset = tzParam !== null ? parseInt(tzParam, 10) : 0;
  const offset = isNaN(tzOffset) ? 0 : tzOffset;

  const db = getDb();
  const today = getStatsForToday(db, offset);
  const week = getStatsForWeek(db, offset);

  return Response.json({ today, week });
}
