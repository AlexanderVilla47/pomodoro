import { describe, it, expect, beforeEach } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { runMigrations } from "../migrations";
import { insertSession, getStatsForToday, getStatsForWeek } from "../queries/sessions";

function freshDb() {
  const db = new DatabaseSync(":memory:");
  runMigrations(db);
  return db;
}

function nowIso() {
  return new Date().toISOString();
}

describe("insertSession", () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = freshDb();
  });

  it("inserta una sesión completada y devuelve el id", () => {
    const id = insertSession(db, {
      type: "work",
      started_at: nowIso(),
      ended_at: nowIso(),
      planned_duration: 1500,
      actual_duration: 1502,
      completed: true,
    });
    expect(typeof id).toBe("number");
    expect(id).toBeGreaterThan(0);
  });

  it("inserta una sesión de descanso corto", () => {
    const id = insertSession(db, {
      type: "short_break",
      started_at: nowIso(),
      ended_at: nowIso(),
      planned_duration: 300,
      actual_duration: 298,
      completed: true,
    });
    const row = db.prepare("SELECT * FROM sessions WHERE id = ?").get(id) as Record<string, unknown>;
    expect(row.type).toBe("short_break");
  });

  it("inserta sesión manual con completed=false", () => {
    const id = insertSession(db, {
      type: "work",
      started_at: nowIso(),
      ended_at: nowIso(),
      planned_duration: 1500,
      actual_duration: 800,
      completed: false,
    });
    const row = db.prepare("SELECT * FROM sessions WHERE id = ?").get(id) as Record<string, unknown>;
    expect(row.completed).toBe(0);
  });
});

describe("getStatsForToday", () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = freshDb();
  });

  it("devuelve cero cuando no hay sesiones", () => {
    const stats = getStatsForToday(db, 0);
    expect(stats.count).toBe(0);
    expect(stats.total_seconds).toBe(0);
  });

  it("cuenta solo sesiones de trabajo de hoy", () => {
    insertSession(db, {
      type: "work",
      started_at: nowIso(),
      ended_at: nowIso(),
      planned_duration: 1500,
      actual_duration: 1500,
      completed: true,
    });
    insertSession(db, {
      type: "short_break",
      started_at: nowIso(),
      ended_at: nowIso(),
      planned_duration: 300,
      actual_duration: 300,
      completed: true,
    });
    const stats = getStatsForToday(db, 0);
    expect(stats.count).toBe(1);
    expect(stats.total_seconds).toBe(1500);
  });

  it("suma duraciones de múltiples sesiones de trabajo", () => {
    for (let i = 0; i < 3; i++) {
      insertSession(db, {
        type: "work",
        started_at: nowIso(),
        ended_at: nowIso(),
        planned_duration: 1500,
        actual_duration: 1500,
        completed: true,
      });
    }
    const stats = getStatsForToday(db, 0);
    expect(stats.count).toBe(3);
    expect(stats.total_seconds).toBe(4500);
  });
});

describe("getStatsForWeek", () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = freshDb();
  });

  it("devuelve cero cuando no hay sesiones", () => {
    const stats = getStatsForWeek(db, 0);
    expect(stats.count).toBe(0);
    expect(stats.total_seconds).toBe(0);
  });

  it("incluye sesiones de la semana actual", () => {
    insertSession(db, {
      type: "work",
      started_at: nowIso(),
      ended_at: nowIso(),
      planned_duration: 1500,
      actual_duration: 1500,
      completed: true,
    });
    const stats = getStatsForWeek(db, 0);
    expect(stats.count).toBe(1);
  });
});
