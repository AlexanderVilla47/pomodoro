import { getDb } from "@/lib/db/index";
import { getStatsForToday, getStatsForWeek } from "@/lib/db/queries/sessions";
import { getSession } from "@/lib/auth/session";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const tzParam = searchParams.get("tz");
  const tzOffset = tzParam !== null ? parseInt(tzParam, 10) : 0;
  const offset = isNaN(tzOffset) ? 0 : tzOffset;

  const db = getDb();
  const [today, week] = await Promise.all([
    getStatsForToday(db, session.user.id, offset),
    getStatsForWeek(db, session.user.id, offset),
  ]);

  return Response.json({ today, week }, {
    headers: {
      "Cache-Control": "private, max-age=30, stale-while-revalidate=300",
    },
  });
}
