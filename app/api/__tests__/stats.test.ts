import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/index", () => ({ getDb: () => ({}) }));
vi.mock("@/lib/db/queries/sessions", () => ({
  getStatsForToday: vi.fn(),
  getStatsForWeek: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({
  getSession: vi.fn().mockResolvedValue({
    user: { id: "test-user-id", email: "test@test.com", name: "Test User" },
    session: { id: "test-session-id" },
  }),
}));

import { GET } from "../stats/route";
import { getStatsForToday, getStatsForWeek } from "@/lib/db/queries/sessions";

const mockToday = vi.mocked(getStatsForToday);
const mockWeek = vi.mocked(getStatsForWeek);

beforeEach(() => {
  vi.clearAllMocks();
  mockToday.mockResolvedValue({ count: 0, total_seconds: 0 });
  mockWeek.mockResolvedValue({ count: 0, total_seconds: 0 });
});

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

  it("retorna los datos que proveen las queries", async () => {
    mockToday.mockResolvedValue({ count: 1, total_seconds: 1500 });
    mockWeek.mockResolvedValue({ count: 3, total_seconds: 4500 });
    const req = new Request("http://localhost/api/stats");
    const res = await GET(req);
    const body = await res.json();
    expect(body.today.count).toBe(1);
    expect(body.today.total_seconds).toBe(1500);
    expect(body.week.count).toBe(3);
  });

  it("sin parámetro tz llama a las queries con offset 0", async () => {
    const req = new Request("http://localhost/api/stats");
    await GET(req);
    expect(mockToday).toHaveBeenCalledWith(expect.anything(), "test-user-id", 0);
    expect(mockWeek).toHaveBeenCalledWith(expect.anything(), "test-user-id", 0);
  });

  it("acepta parámetro tz=-180", async () => {
    const req = new Request("http://localhost/api/stats?tz=-180");
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(mockToday).toHaveBeenCalledWith(expect.anything(), "test-user-id", -180);
  });

  it("ignora tz inválido y usa 0", async () => {
    const req = new Request("http://localhost/api/stats?tz=abc");
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(mockToday).toHaveBeenCalledWith(expect.anything(), "test-user-id", 0);
  });
});
