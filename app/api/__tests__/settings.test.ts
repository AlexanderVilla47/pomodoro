import { describe, it, expect, vi, beforeEach } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { runMigrations } from "@/lib/db/migrations";

let mockDb: DatabaseSync;

vi.mock("@/lib/db/index", () => ({
  getDb: () => mockDb,
}));

import { GET, PUT } from "../settings/route";

beforeEach(() => {
  mockDb = new DatabaseSync(":memory:");
  runMigrations(mockDb);
});

describe("GET /api/settings", () => {
  it("retorna la configuración por defecto", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.work_duration).toBe(1500);
    expect(body.short_break_duration).toBe(300);
    expect(body.long_break_duration).toBe(900);
    expect(body.long_break_interval).toBe(4);
    expect(body.notification_sound_enabled).toBe(true);
  });
});

describe("PUT /api/settings", () => {
  it("actualiza work_duration y retorna la config actualizada", async () => {
    const req = new Request("http://localhost/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ work_duration: 1800 }),
    });
    const res = await PUT(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.work_duration).toBe(1800);
    expect(body.short_break_duration).toBe(300);
  });

  it("actualiza múltiples campos a la vez", async () => {
    const req = new Request("http://localhost/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ short_break_duration: 600, long_break_interval: 6 }),
    });
    const res = await PUT(req);
    const body = await res.json();
    expect(body.short_break_duration).toBe(600);
    expect(body.long_break_interval).toBe(6);
  });

  it("retorna 400 si work_duration no es número", async () => {
    const req = new Request("http://localhost/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ work_duration: "veinte minutos" }),
    });
    const res = await PUT(req);
    expect(res.status).toBe(400);
  });

  it("retorna 400 si long_break_interval es menor a 1", async () => {
    const req = new Request("http://localhost/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ long_break_interval: 0 }),
    });
    const res = await PUT(req);
    expect(res.status).toBe(400);
  });
});
