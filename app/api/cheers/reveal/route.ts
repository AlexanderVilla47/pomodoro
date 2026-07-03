import { getDb } from "@/lib/db/index";
import { getSession } from "@/lib/auth/session";
import { revealCheers } from "@/lib/db/queries/cheers";

// Revela quiénes te alentaron durante la sesión y los marca como vistos.
// Se llama al terminar una sesión de trabajo.
export async function POST() {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const { names, count } = await revealCheers(db, session.user.id);
  return Response.json({ names, count });
}
