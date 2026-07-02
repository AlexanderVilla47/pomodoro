export async function register() {
  // Corre en nodejs runtime (dev y prod). runMigrations es idempotente
  // (CREATE TABLE IF NOT EXISTS), así que es seguro ejecutarlo en cada arranque.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { getDb } = await import("./lib/db/index");
    const { runMigrations } = await import("./lib/db/migrations");
    await runMigrations(getDb());
  }
}
