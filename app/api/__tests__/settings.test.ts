import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/index", () => ({ getDb: () => ({}) }));
vi.mock("@/lib/db/queries/settings", () => ({
  getSettings: vi.fn(),
  upsertSettings: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({
  getSession: vi.fn().mockResolvedValue({
    user: { id: "test-user-id", email: "test@test.com", name: "Test User" },
    session: { id: "test-session-id" },
  }),
}));

import { GET, PUT } from "../settings/route";
import { getSettings, upsertSettings } from "@/lib/db/queries/settings";
import { DEFAULT_PREFERENCES } from "@/lib/preferences";

const mockGet = vi.mocked(getSettings);
const mockUpsert = vi.mocked(upsertSettings);

const DEFAULT_SETTINGS = {
  id: 1,
  work_duration: 1500,
  short_break_duration: 300,
  long_break_duration: 900,
  long_break_interval: 4,
  notification_sound_enabled: true,
  preferences: DEFAULT_PREFERENCES,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGet.mockResolvedValue(DEFAULT_SETTINGS);
  // El patch es PARCIAL, incluidas las preferencias: mergearlas acá replica lo
  // que hace upsertSettings de verdad. Spreadear el patch sobre el fixture
  // dejaría `preferences` a medias.
  mockUpsert.mockImplementation(async (_db, _userId, patch) => ({
    ...DEFAULT_SETTINGS,
    ...patch,
    preferences: { ...DEFAULT_PREFERENCES, ...(patch.preferences ?? {}) },
  }));
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

  it("retorna las preferencias ya resueltas, sin unidad configurada", async () => {
    const res = await GET();
    const body = await res.json();
    expect(body.preferences).toEqual(DEFAULT_PREFERENCES);
    expect(body.preferences.unitSingular).toBeNull();
  });
});

describe("PUT /api/settings", () => {
  it("actualiza work_duration y retorna la config actualizada", async () => {
    mockUpsert.mockResolvedValue({ ...DEFAULT_SETTINGS, work_duration: 1800 });
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
    mockUpsert.mockResolvedValue({ ...DEFAULT_SETTINGS, short_break_duration: 600, long_break_interval: 6 });
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

  /**
   * Acá un 400 SÍ es seguro, y es la diferencia con /api/work-logs.
   *
   * SettingsContext hace un fetch directo y evalúa `res.ok`: no hay cola, no
   * hay reintento, un error se descarta. useWorkLogger, en cambio, sólo da por
   * entregado un item con 201 o 409 y reencola todo lo demás para siempre —
   * ahí un 400 es una poison pill. Son contratos opuestos.
   */
  it.each([["un string", "no-soy-objeto"], ["un array", []], ["un número", 42], ["null", null]])(
    "retorna 400 si preferences es %s",
    async (_desc, preferences) => {
      const req = new Request("http://localhost/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences }),
      });
      const res = await PUT(req);
      expect(res.status).toBe(400);
    }
  );

  it("pasa las preferencias parciales al upsert sin tocarlas", async () => {
    // La normalización es del resolver, no de la ruta: acá sólo se corta lo
    // que ni siquiera tiene la forma de un objeto de preferencias.
    const req = new Request("http://localhost/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ preferences: { journal: false } }),
    });
    const res = await PUT(req);
    expect(res.status).toBe(200);
    expect(mockUpsert).toHaveBeenCalledWith(expect.anything(), "test-user-id", {
      preferences: { journal: false },
    });
  });
});
