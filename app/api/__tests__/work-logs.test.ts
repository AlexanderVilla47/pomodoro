import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/index", () => ({ getDb: () => ({}) }));
vi.mock("@/lib/auth/session", () => ({
  getSession: vi.fn().mockResolvedValue({
    user: { id: "test-user", email: "t@t.com", name: "Test" },
    session: { id: "sess-1" },
  }),
}));
vi.mock("@/lib/db/queries/work-logs", () => ({
  insertWorkLog: vi.fn(),
  getWorkLogs: vi.fn(),
  DuplicateWorkLogError: class DuplicateWorkLogError extends Error {
    constructor() { super("dup"); this.name = "DuplicateWorkLogError"; }
  },
}));

import { POST, GET } from "../work-logs/route";
import { insertWorkLog, getWorkLogs, DuplicateWorkLogError } from "@/lib/db/queries/work-logs";
import { getSession } from "@/lib/auth/session";

const mockInsert = vi.mocked(insertWorkLog);
const mockGet = vi.mocked(getWorkLogs);
const mockSession = vi.mocked(getSession);

/** POST helper — el body va tal cual, para poder mandar basura a propósito. */
function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/work-logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

/** El objeto que efectivamente llegó a insertWorkLog. */
function inserted() {
  return mockInsert.mock.calls[0][2];
}

beforeEach(() => {
  vi.clearAllMocks();
  mockInsert.mockResolvedValue(99);
  mockGet.mockResolvedValue([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockSession.mockResolvedValue({ user: { id: "test-user" }, session: { id: "sess-1" } } as any);
});

describe("POST /api/work-logs", () => {
  it("retorna 401 sin sesión", async () => {
    mockSession.mockResolvedValueOnce(null);
    const req = new Request("http://localhost/api/work-logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: 1 }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("retorna 400 si sessionId no es number", async () => {
    const req = new Request("http://localhost/api/work-logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: "abc" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("retorna 201 con id en caso exitoso", async () => {
    const req = new Request("http://localhost/api/work-logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: 5, notes: "algo", topics: ["BFS"] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe(99);
  });

  it("retorna 409 en DuplicateWorkLogError", async () => {
    mockInsert.mockRejectedValueOnce(new DuplicateWorkLogError());
    const req = new Request("http://localhost/api/work-logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: 5 }),
    });
    const res = await POST(req);
    expect(res.status).toBe(409);
  });
});

describe("POST /api/work-logs — normalización de chunks", () => {
  it("pasa is_theory y chunks cuando son válidos", async () => {
    await post({ sessionId: 5, isTheory: true, chunks: 2.5 });
    expect(inserted()).toMatchObject({ is_theory: true, chunks: 2.5 });
  });

  it("sin isTheory guarda false y chunks null", async () => {
    await post({ sessionId: 5 });
    expect(inserted()).toMatchObject({ is_theory: false, chunks: null });
  });

  it("descarta los chunks si isTheory es false", async () => {
    await post({ sessionId: 5, isTheory: false, chunks: 3 });
    expect(inserted()).toMatchObject({ is_theory: false, chunks: null });
  });

  it("redondea a 2 decimales", async () => {
    await post({ sessionId: 5, isTheory: true, chunks: 2.567 });
    expect(inserted()).toMatchObject({ chunks: 2.57 });
  });

  it("topea los chunks en 100", async () => {
    await post({ sessionId: 5, isTheory: true, chunks: 9999 });
    expect(inserted()).toMatchObject({ chunks: 100 });
  });

  // La cola offline de useWorkLogger solo descarta un item con 201 o 409:
  // cualquier otro status lo reencola y lo reintenta para siempre. Un 400 por
  // un chunk mal formado sería una poison pill. Por eso se normaliza y NUNCA
  // se rechaza: la fila igual sirve para saber que la sesión fue de teoría.
  it.each([
    ["negativos", -5],
    ["cero", 0],
    ["string", "abc"],
    ["null", null],
    ["objeto", { a: 1 }],
  ])("guarda chunks null y responde 201 con chunks %s", async (_label, chunks) => {
    const res = await post({ sessionId: 5, isTheory: true, chunks });
    expect(res.status).toBe(201);
    expect(inserted()).toMatchObject({ is_theory: true, chunks: null });
  });
});

describe("GET /api/work-logs", () => {
  it("retorna 401 sin sesión", async () => {
    mockSession.mockResolvedValueOnce(null);
    const req = new Request("http://localhost/api/work-logs");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("retorna logs con nextCursor y hasMore", async () => {
    const fakeLog = {
      id: 1, session_id: 2, notes: "n", topics: [],
      created_at: "2026-01-01T10:00:00Z", session_type: "work",
      started_at: "2026-01-01T10:00:00Z", actual_duration: 1500,
      distraction_count: 0,
      is_theory: false, chunks: null,
      label_id: null, label_name: null, label_color: null,
    };
    mockGet.mockResolvedValueOnce([fakeLog]);
    const req = new Request("http://localhost/api/work-logs?limit=1");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.logs).toHaveLength(1);
    expect(body.hasMore).toBe(true);
    expect(body.nextCursor).toBe("2026-01-01T10:00:00Z");
  });

  it("clampea limit a máximo 50", async () => {
    const req = new Request("http://localhost/api/work-logs?limit=999");
    await GET(req);
    expect(mockGet).toHaveBeenCalledWith(expect.anything(), "test-user", {
      limit: 50,
      cursor: undefined,
      date: undefined,
      tz: 0,
    });
  });
});
