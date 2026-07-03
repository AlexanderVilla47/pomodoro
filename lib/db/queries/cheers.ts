import type postgres from "postgres";

type Sql = ReturnType<typeof postgres>;

// Manda un aliento (from → to). Gracias al índice único parcial, si ya hay un
// aliento pendiente (sin ver) de este emisor a este receptor, no inserta otro.
export async function sendCheer(
  sql: Sql,
  fromUserId: string,
  toUserId: string
): Promise<void> {
  await sql`
    INSERT INTO cheers (from_user_id, to_user_id)
    VALUES (${fromUserId}, ${toUserId})
    ON CONFLICT (from_user_id, to_user_id) WHERE seen_at IS NULL DO NOTHING
  `;
}

// Contador en vivo (anónimo) de alientos sin ver del usuario.
export async function getUnseenCheerCount(
  sql: Sql,
  userId: string
): Promise<number> {
  const rows = await sql<{ count: number }[]>`
    SELECT COUNT(*)::int AS count
    FROM cheers
    WHERE to_user_id = ${userId} AND seen_at IS NULL
  `;
  return rows[0]?.count ?? 0;
}

// Revela los nombres de quienes te alentaron (por orden de llegada) y marca todo
// como visto, para que no se repitan en la próxima sesión.
export async function revealCheers(
  sql: Sql,
  userId: string
): Promise<{ names: string[]; count: number }> {
  const rows = await sql<{ name: string }[]>`
    SELECT u.name
    FROM cheers c
    JOIN "user" u ON u.id = c.from_user_id
    WHERE c.to_user_id = ${userId} AND c.seen_at IS NULL
    ORDER BY c.created_at ASC
  `;

  const names = rows.map((r) => r.name);

  if (names.length > 0) {
    await sql`
      UPDATE cheers SET seen_at = NOW()
      WHERE to_user_id = ${userId} AND seen_at IS NULL
    `;
  }

  return { names, count: names.length };
}
