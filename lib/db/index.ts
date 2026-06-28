import postgres from "postgres";

declare global {
  // eslint-disable-next-line no-var
  var __sql: ReturnType<typeof postgres> | undefined;
}

export function getDb(): ReturnType<typeof postgres> {
  if (!globalThis.__sql) {
    const url = process.env.POSTGRES_URL ?? process.env.DATABASE_URL;
    if (!url) throw new Error("No database URL configured (POSTGRES_URL or DATABASE_URL)");
    const isSupabase = url.includes("supabase");
    globalThis.__sql = postgres(url, {
      ssl: isSupabase ? "require" : false,
      prepare: false,
    });
  }
  return globalThis.__sql;
}
