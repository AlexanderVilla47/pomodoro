export async function register() {
  // Corre en nodejs runtime (dev y prod). runMigrations es idempotente
  // (CREATE TABLE IF NOT EXISTS), así que es seguro ejecutarlo en cada arranque.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const { getDb } = await import("./lib/db/index");
      const { runMigrations } = await import("./lib/db/migrations");
      await runMigrations(getDb());
    } catch (err) {
      // Si la base está caída o inalcanzable (p. ej. incidente del pooler de
      // Supabase → CONNECT_TIMEOUT), NO tiramos abajo el arranque. La app
      // levanta igual y las rutas que usan DB fallan por su cuenta cuando
      // corresponda. Warning claro y no-fatal en vez de reventar el boot.
      console.warn(
        "[instrumentation] runMigrations falló al arrancar; la app sigue funcionando:",
        err instanceof Error ? err.message : err
      );
    }
  }
}
