import { describe, it, expect, beforeEach } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { runMigrations } from "../migrations";
import { getSettings, upsertSettings } from "../queries/settings";

function freshDb() {
  const db = new DatabaseSync(":memory:");
  runMigrations(db);
  return db;
}

describe("getSettings", () => {
  it("devuelve valores por defecto cuando la fila existe (seed en migrations)", () => {
    const db = freshDb();
    const s = getSettings(db);
    expect(s.work_duration).toBe(1500);
    expect(s.short_break_duration).toBe(300);
    expect(s.long_break_duration).toBe(900);
    expect(s.long_break_interval).toBe(4);
    expect(s.notification_sound_enabled).toBe(true);
  });
});

describe("upsertSettings", () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = freshDb();
  });

  it("actualiza work_duration y lo persiste", () => {
    upsertSettings(db, { work_duration: 1800 });
    const s = getSettings(db);
    expect(s.work_duration).toBe(1800);
  });

  it("actualiza múltiples campos a la vez", () => {
    upsertSettings(db, { short_break_duration: 600, long_break_interval: 6 });
    const s = getSettings(db);
    expect(s.short_break_duration).toBe(600);
    expect(s.long_break_interval).toBe(6);
    expect(s.work_duration).toBe(1500);
  });

  it("deshabilitar sonido guarda false", () => {
    upsertSettings(db, { notification_sound_enabled: false });
    const s = getSettings(db);
    expect(s.notification_sound_enabled).toBe(false);
  });

  it("retorna la configuración actualizada", () => {
    const updated = upsertSettings(db, { work_duration: 3000 });
    expect(updated.work_duration).toBe(3000);
  });
});
