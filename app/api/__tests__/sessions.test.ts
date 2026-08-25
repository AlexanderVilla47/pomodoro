import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/index", () => ({ getDb: () => ({}) }));
vi.mock("@/lib/db/queries/sessions", () => ({
  insertSession: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({
  getSession: vi.fn().mockResolvedValue({
    user: { id: "test-user-id", email: "test@test.com", name: "Test User" },
    session: { id: "test-session-id" },
  }),
}));

import { POST } from "../sessions/route";
import { insertSession } from "@/lib/db/queries/sessions";

const mockInsert = vi.mocked(insertSession);

function now() {
  return new Date().toISOString();
}

function makeWorkSession(overrides = {}) {
  return {
    type: "work",
    started_at: now(),
    ended_at: now(),
    planned_duration: 1500,
    actual_duration: 1500,
    completed: true,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockInsert.mockResolvedValue(1);
});

describe("POST /api/sessions", () => {
  it("inserta sesión completada y retorna 201 con id", async () => {
    const req = new Request("http://localhost/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(makeWorkSession()),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBeGreaterThan(0);
  });

  it("inserta sesión work manual con elapsed >= 50% y retorna 201", async () => {
    const req = new Request("http://localhost/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(makeWorkSession({ completed: false, actual_duration: 750 })),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
  });

  it("ignora sesión work manual con elapsed < 50% y retorna 204", async () => {
    const req = new Request("http://localhost/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(makeWorkSession({ completed: false, actual_duration: 749 })),
    });
    const res = await POST(req);
    expect(res.status).toBe(204);
  });

  it("ignora short_break con completed=false y retorna 204", async () => {
    const req = new Request("http://localhost/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "short_break",
        started_at: now(),
        ended_at: now(),
        planned_duration: 300,
        actual_duration: 200,
        completed: false,
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(204);
  });

  it("inserta break completado y retorna 201", async () => {
    const req = new Request("http://localhost/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "short_break",
        started_at: now(),
        ended_at: now(),
        planned_duration: 300,
        actual_duration: 300,
        completed: true,
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
  });

  it("retorna 400 si falta el campo type", async () => {
    const req = new Request("http://localhost/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planned_duration: 1500, actual_duration: 1500, completed: true }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

describe("POST /api/sessions — distracciones", () => {
  async function post(overrides = {}) {
    const req = new Request("http://localhost/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(makeWorkSession(overrides)),
    });
    return POST(req);
  }

  function insertedData() {
    return mockInsert.mock.calls[0][2];
  }

  it("persiste marks y deriva el count del array", async () => {
    await post({ distraction_marks: [30, 600, 1200], distraction_count: 3 });
    expect(insertedData()).toMatchObject({
      distraction_count: 3,
      distraction_marks: [30, 600, 1200],
    });
  });

  it("ignora el count que manda el cliente y usa el largo real del array", async () => {
    await post({ distraction_marks: [30, 600], distraction_count: 99 });
    expect(insertedData().distraction_count).toBe(2);
  });

  it("default a 0 y [] cuando no se mandan distracciones", async () => {
    await post();
    expect(insertedData()).toMatchObject({ distraction_count: 0, distraction_marks: [] });
  });

  it("descarta marks negativos y no numéricos", async () => {
    await post({ distraction_marks: [-5, 100, "abc", null, NaN, 200] });
    expect(insertedData().distraction_marks).toEqual([100, 200]);
  });

  it("clampea los marks que exceden la duración real de la sesión", async () => {
    await post({ actual_duration: 1500, distraction_marks: [1501, 99999] });
    expect(insertedData().distraction_marks).toEqual([1500, 1500]);
  });

  it("ordena los marks de menor a mayor", async () => {
    await post({ distraction_marks: [900, 30, 600] });
    expect(insertedData().distraction_marks).toEqual([30, 600, 900]);
  });

  it("corta el array en el máximo permitido", async () => {
    const marks = Array.from({ length: 500 }, (_, i) => i);
    await post({ distraction_marks: marks });
    expect(insertedData().distraction_marks).toHaveLength(200);
    expect(insertedData().distraction_count).toBe(200);
  });

  it("ignora distraction_marks si no es un array", async () => {
    await post({ distraction_marks: "3" });
    expect(insertedData().distraction_marks).toEqual([]);
  });
});
