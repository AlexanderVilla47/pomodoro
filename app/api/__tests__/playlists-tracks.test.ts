import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { runMigrations } from "@/lib/db/migrations";
import { upsertPlaylist, upsertTracks } from "@/lib/db/queries/playlists";

let mockDb: DatabaseSync;

vi.mock("@/lib/db/index", () => ({
  getDb: () => mockDb,
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

import { GET } from "../playlists/[id]/tracks/route";
import { fetchPlaylistItems, fetchPlaylistInfo } from "@/lib/youtube/client";

const mockItems = vi.mocked(fetchPlaylistItems);
const mockInfo = vi.mocked(fetchPlaylistInfo);

beforeEach(() => {
  mockDb = new DatabaseSync(":memory:");
  runMigrations(mockDb);
  vi.stubEnv("YOUTUBE_API_KEY", "test-key");
  mockInfo.mockResolvedValue({ title: "Lo-fi", thumbnailUrl: null });
  mockItems.mockResolvedValue([
    { videoId: "v1", title: "Track 1", thumbnailUrl: null, position: 0 },
  ]);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("GET /api/playlists/[id]/tracks", () => {
  it("retorna 404 si la playlist no existe", async () => {
    const res = await GET(
      new Request("http://localhost/api/playlists/PLno-existe/tracks"),
      { params: Promise.resolve({ id: "PLno-existe" }) }
    );
    expect(res.status).toBe(404);
  });

  it("retorna los tracks de una playlist fresca (no stale)", async () => {
    const p = upsertPlaylist(mockDb, {
      playlist_id: "PLtest123",
      title: "Lo-fi",
      thumbnail_url: null,
    });
    upsertTracks(mockDb, p.id, [
      { video_id: "v1", title: "Track 1", duration_seconds: null, position: 0 },
      { video_id: "v2", title: "Track 2", duration_seconds: 180, position: 1 },
    ]);

    const res = await GET(
      new Request("http://localhost/api/playlists/PLtest123/tracks"),
      { params: Promise.resolve({ id: "PLtest123" }) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(2);
    expect(body[0].video_id).toBe("v1");
    expect(mockItems).not.toHaveBeenCalled();
  });

  it("re-fetcha los tracks si la playlist está stale (>24h)", async () => {
    const p = upsertPlaylist(mockDb, {
      playlist_id: "PLstale",
      title: "Lo-fi",
      thumbnail_url: null,
    });
    upsertTracks(mockDb, p.id, [
      { video_id: "old", title: "Old Track", duration_seconds: null, position: 0 },
    ]);
    mockDb
      .prepare("UPDATE playlists SET cached_at = datetime('now', '-25 hours') WHERE playlist_id = ?")
      .run("PLstale");

    const res = await GET(
      new Request("http://localhost/api/playlists/PLstale/tracks"),
      { params: Promise.resolve({ id: "PLstale" }) }
    );
    expect(res.status).toBe(200);
    expect(mockItems).toHaveBeenCalledWith("PLstale", "test-key");
  });

  it("retorna 503 si playlist es stale y no hay API key", async () => {
    vi.stubEnv("YOUTUBE_API_KEY", "");
    const p = upsertPlaylist(mockDb, {
      playlist_id: "PLstale2",
      title: "Lo-fi",
      thumbnail_url: null,
    });
    upsertTracks(mockDb, p.id, [
      { video_id: "old", title: "Old Track", duration_seconds: null, position: 0 },
    ]);
    mockDb
      .prepare("UPDATE playlists SET cached_at = datetime('now', '-25 hours') WHERE playlist_id = ?")
      .run("PLstale2");

    const res = await GET(
      new Request("http://localhost/api/playlists/PLstale2/tracks"),
      { params: Promise.resolve({ id: "PLstale2" }) }
    );
    expect(res.status).toBe(503);
  });
});
