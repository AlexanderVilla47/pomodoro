import { getDb } from "@/lib/db/index";
import { getStudyEfficiencyByDay } from "@/lib/db/queries/stats";
import { getSession } from "@/lib/auth/session";

/** Ventana por defecto: alcanza para la vista mensual sin pedir nada. */
const DEFAULT_DAYS = 365;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parseDate(value: string | null): string | null {
  if (value === null || !ISO_DATE.test(value)) return null;
  return Number.isNaN(new Date(value + "T12:00:00Z").getTime()) ? null : value;
}

/**
 * Rango pedido, normalizado.
 *
 * Se normaliza en vez de rechazar, igual que el resto de los endpoints: un
 * informe con la ventana por defecto se lee, un 400 no. Y un rango invertido
 * se da vuelta en lugar de devolver vacío, porque vacío se confunde con "no
 * estudiaste nada" y manda a buscar un bug que no existe.
 */
function resolveRange(params: URLSearchParams): { from: string; to: string } {
  const today = new Date();
  const from = parseDate(params.get("from"));
  const to = parseDate(params.get("to"));

  const resolvedTo = to ?? isoDate(today);
  const resolvedFrom =
    from ?? isoDate(new Date(today.getTime() - DEFAULT_DAYS * 24 * 60 * 60 * 1000));

  return resolvedFrom <= resolvedTo
    ? { from: resolvedFrom, to: resolvedTo }
    : { from: resolvedTo, to: resolvedFrom };
}

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const tzParam = searchParams.get("tz");
  const parsedTz = tzParam !== null ? parseInt(tzParam, 10) : 0;
  const tz = Number.isNaN(parsedTz) ? 0 : parsedTz;

  const { from, to } = resolveRange(searchParams);

  const rows = await getStudyEfficiencyByDay(getDb(), session.user.id, { from, to, tz });

  return Response.json({ rows, from, to });
}
