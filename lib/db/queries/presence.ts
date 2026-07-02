import type postgres from "postgres";

type Sql = ReturnType<typeof postgres>;

export type PresencePhase = "work" | "break" | "idle";

export async function upsertPresence(
  sql: Sql,
  userId: string,
  phase: PresencePhase
): Promise<void> {
  await sql`
    INSERT INTO presence (user_id, phase, updated_at)
    VALUES (${userId}, ${phase}, NOW())
    ON CONFLICT (user_id) DO UPDATE
      SET phase = ${phase}, updated_at = NOW()
  `;
}
