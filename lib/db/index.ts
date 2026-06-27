import postgres from "postgres";

declare global {
  // eslint-disable-next-line no-var
  var __sql: ReturnType<typeof postgres> | undefined;
}

export function getDb(): ReturnType<typeof postgres> {
  if (!globalThis.__sql) {
    globalThis.__sql = postgres(process.env.DATABASE_URL!, {
      ssl: process.env.DATABASE_URL?.includes(".supabase.co") ? "require" : false,
    });
  }
  return globalThis.__sql;
}
