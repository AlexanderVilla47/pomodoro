export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NODE_ENV === "development") {
    const { getDb } = await import("./lib/db/index");
    const { runMigrations } = await import("./lib/db/migrations");
    await runMigrations(getDb());
  }
}
