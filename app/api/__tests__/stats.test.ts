import { describe, it, expect, vi, beforeEach } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { runMigrations } from "@/lib/db/migrations";
import { insertSession } from "@/lib/db/queries/sessions";

let mockDb: DatabaseSync;

vi.mock("@/lib/db/index", () => ({
  getDb: () => mockDb,
}));

import { GET } from "../stats/route";

beforeEach(() => {
  mockDb = new DatabaseSync(":memory:");
  runMigrations(mockDb);
});

function now() {
  return new Date().toISOString();
}

describe("GET /api/stats", () => {
  it("retorna { today, week } con ceros cuando no hay sesiones", async () => {
    const req = new Request("http://localhost/api/stats");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      today: { count: 0, total_seconds: 0 },
      week: { count: 0, total_seconds: 0 },
    });
  });

  it("sin parámetro tz usa UTC (offset 0)", async () => {
    insertSession(mockDb, {
      type: "work",
      started_at: now(),
      ended_at: now(),
      planned_duration: 1500,
      actual_duration: 1500,
      completed: true,
    });
    const req = new Request("http://localhost/api/stats");
    const res = await GET(req);
    const body = await res.json();
    expect(body.today.count).toBe(1);
    expect(body.today.total_seconds).toBe(1500);
  });

  it("acepta parámetro tz=-180", async () => {
    const req = new Request("http://localhost/api/stats?tz=-180");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("today");
    expect(body).toHaveProperty("week");
  });

  it("ignora tz inválido y usa 0", async () => {
    const req = new Request("http://localhost/api/stats?tz=abc");
    const res = await GET(req);
    expect(res.status).toBe(200);
  });

  it("week incluye sesiones de hoy", async () => {
    for (let i = 0; i < 3; i++) {
      insertSession(mockDb, {
        type: "work",
        started_at: now(),
        ended_at: now(),
        planned_duration: 1500,
        actual_duration: 1500,
        completed: true,
      });
    }
    const req = new Request("http://localhost/api/stats");
    const res = await GET(req);
    const body = await res.json();
    expect(body.week.count).toBe(3);
  });
});
