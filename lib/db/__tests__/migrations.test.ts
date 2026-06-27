import { describe, it, expect, beforeEach } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { runMigrations } from "../migrations";

function freshDb() {
  return new DatabaseSync(":memory:");
}

describe("runMigrations", () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = freshDb();
  });

  it("crea la tabla sessions con las columnas correctas", () => {
    runMigrations(db);
    const cols = db
      .prepare("PRAGMA table_info(sessions)")
      .all() as { name: string }[];
    const names = cols.map((c) => c.name);
    expect(names).toContain("id");
    expect(names).toContain("type");
    expect(names).toContain("started_at");
    expect(names).toContain("ended_at");
    expect(names).toContain("planned_duration");
    expect(names).toContain("actual_duration");
    expect(names).toContain("completed");
  });

  it("crea la tabla settings con las columnas correctas", () => {
    runMigrations(db);
    const cols = db
      .prepare("PRAGMA table_info(settings)")
      .all() as { name: string }[];
    const names = cols.map((c) => c.name);
    expect(names).toContain("id");
    expect(names).toContain("work_duration");
    expect(names).toContain("short_break_duration");
    expect(names).toContain("long_break_duration");
    expect(names).toContain("long_break_interval");
    expect(names).toContain("notification_sound_enabled");
  });

  it("crea la tabla playlists con las columnas correctas", () => {
    runMigrations(db);
    const cols = db
      .prepare("PRAGMA table_info(playlists)")
      .all() as { name: string }[];
    const names = cols.map((c) => c.name);
    expect(names).toContain("id");
    expect(names).toContain("playlist_id");
    expect(names).toContain("title");
    expect(names).toContain("thumbnail_url");
    expect(names).toContain("cached_at");
  });

  it("crea la tabla tracks con las columnas correctas", () => {
    runMigrations(db);
    const cols = db
      .prepare("PRAGMA table_info(tracks)")
      .all() as { name: string }[];
    const names = cols.map((c) => c.name);
    expect(names).toContain("id");
    expect(names).toContain("playlist_id");
    expect(names).toContain("video_id");
    expect(names).toContain("title");
    expect(names).toContain("position");
  });

  it("es idempotente — correr dos veces no lanza error", () => {
    expect(() => {
      runMigrations(db);
      runMigrations(db);
    }).not.toThrow();
  });

  it("inserta la fila de settings por defecto (id=1)", () => {
    runMigrations(db);
    const row = db.prepare("SELECT * FROM settings WHERE id = 1").get() as
      | Record<string, unknown>
      | undefined;
    expect(row).toBeDefined();
    expect(row!.work_duration).toBe(1500);
    expect(row!.short_break_duration).toBe(300);
    expect(row!.long_break_duration).toBe(900);
    expect(row!.long_break_interval).toBe(4);
    expect(row!.notification_sound_enabled).toBe(1);
  });
});
