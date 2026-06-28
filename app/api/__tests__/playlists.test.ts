import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/db/index", () => ({ getDb: () => ({}) }));
vi.mock("@/lib/db/queries/playlists", () => ({
  upsertPlaylist: vi.fn(),
  upsertTracks: vi.fn(),
  getPlaylists: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({
  getSession: vi.fn().mockResolvedValue({
    user: { id: "test-user-id", email: "test@test.com", name: "Test User" },
    session: { id: "test-session-id" },
  }),
}));
vi.mock("@/lib/youtube/client", () => ({
  fetchPlaylistItems: vi.fn(),
  fetchPlaylistInfo: vi.fn(),
  YouTubeApiError: class YouTubeApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  },
}));

import { POST, GET } from "../playlists/route";
import { upsertPlaylist, upsertTracks, getPlaylists } from "@/lib/db/queries/playlists";
import { fetchPlaylistItems, fetchPlaylistInfo } from "@/lib/youtube/client";

const mockUpsertPlaylist = vi.mocked(upsertPlaylist);
const mockUpsertTracks = vi.mocked(upsertTracks);
const mockGetPlaylists = vi.mocked(getPlaylists);
const mockItems = vi.mocked(fetchPlaylistItems);
const mockInfo = vi.mocked(fetchPlaylistInfo);

const FAKE_PLAYLIST = {
  id: 1,
  playlist_id: "PLtest123",
  title: "Lo-fi Hip Hop",
  thumbnail_url: "https://i.ytimg.com/thumb.jpg",
  cached_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
};

beforeEach(() => {
  vi.stubEnv("YOUTUBE_API_KEY", "test-key");
  mockInfo.mockResolvedValue({ title: "Lo-fi Hip Hop", thumbnailUrl: "https://i.ytimg.com/thumb.jpg" });
  mockItems.mockResolvedValue([
    { videoId: "v1", title: "Track 1", thumbnailUrl: null, position: 0 },
    { videoId: "v2", title: "Track 2", thumbnailUrl: null, position: 1 },
  ]);
  mockUpsertPlaylist.mockResolvedValue(FAKE_PLAYLIST);
  mockUpsertTracks.mockResolvedValue(undefined);
  mockGetPlaylists.mockResolvedValue([]);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("POST /api/playlists", () => {
  it("procesa URL válida y retorna 201 con playlist y tracks", async () => {
    const req = new Request("http://localhost/api/playlists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://www.youtube.com/playlist?list=PLtest123" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.playlist.playlist_id).toBe("PLtest123");
    expect(body.playlist.title).toBe("Lo-fi Hip Hop");
    expect(body.tracks).toHaveLength(2);
  });

  it("retorna 400 si la URL no contiene un playlist ID válido", async () => {
    const req = new Request("http://localhost/api/playlists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://www.youtube.com/watch?v=abc123" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("retorna 400 si no se envía url en el body", async () => {
    const req = new Request("http://localhost/api/playlists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("retorna 503 si YOUTUBE_API_KEY no está configurada", async () => {
    vi.stubEnv("YOUTUBE_API_KEY", "");
    const req = new Request("http://localhost/api/playlists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://www.youtube.com/playlist?list=PLtest123" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(503);
  });

  it("llama a fetchPlaylistInfo y fetchPlaylistItems con el playlistId correcto", async () => {
    const req = new Request("http://localhost/api/playlists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://www.youtube.com/playlist?list=PLtest123" }),
    });
    await POST(req);
    expect(mockInfo).toHaveBeenCalledWith("PLtest123", "test-key");
    expect(mockItems).toHaveBeenCalledWith("PLtest123", "test-key");
  });
});

describe("GET /api/playlists", () => {
  it("retorna array vacío si no hay playlists", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([]);
  });

  it("retorna las playlists cacheadas", async () => {
    mockGetPlaylists.mockResolvedValue([FAKE_PLAYLIST]);
    const res = await GET();
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].playlist_id).toBe("PLtest123");
  });
});
