import { getDb } from "@/lib/db/index";
import { getDailyStatsForYear, getYearsWithData } from "@/lib/db/queries/sessions";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const currentYear = new Date().getFullYear();
  const year = parseInt(searchParams.get("year") ?? String(currentYear), 10);
  const tzParam = searchParams.get("tz");
  const tzOffset = tzParam !== null ? parseInt(tzParam, 10) : 0;
  const offset = isNaN(tzOffset) ? 0 : tzOffset;

  const db = getDb();
  const days = getDailyStatsForYear(db, isNaN(year) ? currentYear : year, offset);
  const years = getYearsWithData(db);

  if (!years.includes(currentYear)) years.unshift(currentYear);

  return Response.json({ days, years });
}
