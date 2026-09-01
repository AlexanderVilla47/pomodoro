import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/index", () => ({ getDb: () => ({}) }));
vi.mock("@/lib/db/queries/stats", () => ({
  getStudyEfficiencyByDay: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({
  getSession: vi.fn().mockResolvedValue({
    user: { id: "test-user-id", email: "test@test.com", name: "Test User" },
    session: { id: "test-session-id" },
  }),
}));

import { GET } from "../stats/efficiency/route";
import { getStudyEfficiencyByDay } from "@/lib/db/queries/stats";
import { getSession } from "@/lib/auth/session";

const mockQuery = vi.mocked(getStudyEfficiencyByDay);
const mockSession = vi.mocked(getSession);

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function optsOf(call: number = 0) {
  return mockQuery.mock.calls[call][2];
}

beforeEach(() => {
  vi.clearAllMocks();
  mockQuery.mockResolvedValue([]);
  mockSession.mockResolvedValue({
    user: { id: "test-user-id", email: "test@test.com", name: "Test User" },
    session: { id: "test-session-id" },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
});

describe("GET /api/stats/efficiency", () => {
  it("rechaza sin sesion", async () => {
    mockSession.mockResolvedValue(null);
    const res = await GET(new Request("http://localhost/api/stats/efficiency"));
    expect(res.status).toBe(401);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("devuelve las filas crudas que da la query", async () => {
    mockQuery.mockResolvedValue([
      {
        day: "2026-08-17",
        label_id: 1,
        label_name: "RRHH",
        label_color: "#5ABFA8",
        total_seconds: 3600,
        total_chunks: 4,
        sessions: 2,
        distractions: 1,
      },
    ]);
    const res = await GET(new Request("http://localhost/api/stats/efficiency"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rows).toHaveLength(1);
    expect(body.rows[0]).toMatchObject({ day: "2026-08-17", total_chunks: 4 });
  });

  it("sin datos devuelve una lista vacia, no un error", async () => {
    const res = await GET(new Request("http://localhost/api/stats/efficiency"));
    expect(res.status).toBe(200);
    expect((await res.json()).rows).toEqual([]);
  });

  it("pasa el rango de fechas tal cual", async () => {
    await GET(
      new Request("http://localhost/api/stats/efficiency?from=2026-08-01&to=2026-08-31")
    );
    expect(optsOf()).toMatchObject({ from: "2026-08-01", to: "2026-08-31" });
  });

  it("pasa el offset horario", async () => {
    await GET(new Request("http://localhost/api/stats/efficiency?tz=-180"));
    expect(optsOf()).toMatchObject({ tz: -180 });
  });

  it("sin tz usa 0", async () => {
    await GET(new Request("http://localhost/api/stats/efficiency"));
    expect(optsOf()).toMatchObject({ tz: 0 });
  });

  it("ignora un tz invalido y usa 0", async () => {
    await GET(new Request("http://localhost/api/stats/efficiency?tz=abc"));
    expect(optsOf()).toMatchObject({ tz: 0 });
  });

  it("sin rango cae en una ventana por defecto en vez de fallar", async () => {
    const res = await GET(new Request("http://localhost/api/stats/efficiency"));
    expect(res.status).toBe(200);
    const opts = optsOf();
    expect(opts.from).toMatch(ISO_DATE);
    expect(opts.to).toMatch(ISO_DATE);
    expect(opts.from < opts.to).toBe(true);
  });

  it("normaliza un rango invalido en vez de rechazarlo", async () => {
    // Mismo criterio que el resto de los endpoints: normalizar la entrada
    // antes que devolver un 4xx. Un informe vacio se lee; un error, no.
    const res = await GET(
      new Request("http://localhost/api/stats/efficiency?from=ayer&to=17/08/2026")
    );
    expect(res.status).toBe(200);
    const opts = optsOf();
    expect(opts.from).toMatch(ISO_DATE);
    expect(opts.to).toMatch(ISO_DATE);
  });

  it("da vuelta un rango invertido en vez de devolver vacio", async () => {
    await GET(
      new Request("http://localhost/api/stats/efficiency?from=2026-08-31&to=2026-08-01")
    );
    expect(optsOf()).toMatchObject({ from: "2026-08-01", to: "2026-08-31" });
  });
});
