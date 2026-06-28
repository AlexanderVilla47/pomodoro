import { getDb } from "@/lib/db/index";
import { getDailyStatsForYear, getYearsWithData } from "@/lib/db/queries/sessions";
import { getSession } from "@/lib/auth/session";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const currentYear = new Date().getFullYear();
  const year = parseInt(searchParams.get("year") ?? String(currentYear), 10);
  const tzParam = searchParams.get("tz");
  const tzOffset = tzParam !== null ? parseInt(tzParam, 10) : 0;
  const offset = isNaN(tzOffset) ? 0 : tzOffset;

  const db = getDb();
  const [days, years] = await Promise.all([
    getDailyStatsForYear(db, session.user.id, isNaN(year) ? currentYear : year, offset),
    getYearsWithData(db, session.user.id),
  ]);

  if (!years.includes(currentYear)) years.unshift(currentYear);

  return Response.json({ days, years });
}
