export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { getDb } = await import("./lib/db/index");
    const { runMigrations } = await import("./lib/db/migrations");
    await runMigrations(getDb());
  }
}
