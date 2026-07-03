import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/index", () => ({ getDb: () => ({}) }));
vi.mock("@/lib/auth/session", () => ({
  getSession: vi.fn().mockResolvedValue({
    user: { id: "me", email: "me@test.com" },
    session: { id: "s" },
  }),
}));
vi.mock("@/lib/spotify/client", () => ({
  getAccessToken: vi.fn(),
  getContextTracks: vi.fn(),
}));

import { GET } from "../spotify/context/route";
import { getAccessToken, getContextTracks } from "@/lib/spotify/client";
import { getSession } from "@/lib/auth/session";

const mockToken = vi.mocked(getAccessToken);
const mockContext = vi.mocked(getContextTracks);
const mockSession = vi.mocked(getSession);

function req(uri?: string) {
  const url = uri
    ? `http://localhost/api/spotify/context?uri=${encodeURIComponent(uri)}`
    : "http://localhost/api/spotify/context";
  return new Request(url);
}

beforeEach(() => {
  vi.clearAllMocks();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockSession.mockResolvedValue({ user: { id: "me" }, session: { id: "s" } } as any);
  mockToken.mockResolvedValue("token-123");
  mockContext.mockResolvedValue([]);
});

describe("GET /api/spotify/context", () => {
  it("retorna 401 sin sesión", async () => {
    mockSession.mockResolvedValueOnce(null);
    const res = await GET(req("spotify:album:abc"));
    expect(res.status).toBe(401);
  });

  it("retorna 400 si falta uri", async () => {
    const res = await GET(req());
    expect(res.status).toBe(400);
  });

  it("retorna 401 si no hay cuenta de Spotify conectada", async () => {
    mockToken.mockResolvedValueOnce(null);
    const res = await GET(req("spotify:album:abc"));
    expect(res.status).toBe(401);
  });

  it("retorna tracks del contexto expandido", async () => {
    mockContext.mockResolvedValueOnce([
      { uri: "spotify:track:t1", id: "t1", name: "Uno", artistName: "A", durationMs: 1000, imageUrl: null },
    ]);
    const res = await GET(req("spotify:album:abc"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.tracks).toHaveLength(1);
    expect(body.supported).toBe(true);
    expect(mockContext).toHaveBeenCalledWith("token-123", "spotify:album:abc");
  });

  it("retorna supported:false cuando el contexto no es expandible", async () => {
    mockContext.mockResolvedValueOnce(null);
    const res = await GET(req("spotify:artist:abc"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.supported).toBe(false);
    expect(body.tracks).toEqual([]);
  });

  it("retorna 502 si la Spotify API falla", async () => {
    mockContext.mockRejectedValueOnce(new Error("boom"));
    const res = await GET(req("spotify:album:abc"));
    expect(res.status).toBe(502);
  });
});
