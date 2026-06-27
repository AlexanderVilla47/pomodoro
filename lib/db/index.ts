import { DatabaseSync } from "node:sqlite";
import { runMigrations } from "./migrations";

declare global {
  // eslint-disable-next-line no-var
  var __db: DatabaseSync | undefined;
}

export function getDb(): DatabaseSync {
  if (!globalThis.__db) {
    const path = process.env.DB_PATH ?? "/data/pomodoro.db";
    globalThis.__db = new DatabaseSync(path);
    runMigrations(globalThis.__db);
  }
  return globalThis.__db;
}
