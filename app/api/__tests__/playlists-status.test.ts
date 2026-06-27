import { describe, it, expect, vi, afterEach } from "vitest";

import { GET } from "../playlists/status/route";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GET /api/playlists/status", () => {
  it("retorna { configured: true } cuando YOUTUBE_API_KEY está definida", async () => {
    vi.stubEnv("YOUTUBE_API_KEY", "my-api-key");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ configured: true });
  });

  it("retorna { configured: false } cuando YOUTUBE_API_KEY está ausente", async () => {
    vi.stubEnv("YOUTUBE_API_KEY", "");
    const res = await GET();
    const body = await res.json();
    expect(body).toEqual({ configured: false });
  });

  it("nunca expone la clave en la respuesta", async () => {
    vi.stubEnv("YOUTUBE_API_KEY", "super-secret-key");
    const res = await GET();
    const body = await res.json();
    const bodyStr = JSON.stringify(body);
    expect(bodyStr).not.toContain("super-secret-key");
  });
});
