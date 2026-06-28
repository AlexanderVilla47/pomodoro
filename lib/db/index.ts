import postgres from "postgres";

declare global {
  // eslint-disable-next-line no-var
  var __sql: ReturnType<typeof postgres> | undefined;
}

export function getDb(): ReturnType<typeof postgres> {
  if (!globalThis.__sql) {
    const isSupabase = process.env.DATABASE_URL?.includes("supabase");
    globalThis.__sql = postgres(process.env.DATABASE_URL!, {
      ssl: isSupabase ? "require" : false,
      prepare: false,
    });
  }
  return globalThis.__sql;
}
