import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/db/index", () => ({ getDb: () => ({}) }));
vi.mock("@/lib/db/queries/playlists", () => ({
  getPlaylist: vi.fn(),
  isPlaylistStale: vi.fn(),
  upsertTracks: vi.fn(),
  getTracksByPlaylist: vi.fn(),
  updatePlaylistCachedAt: vi.fn(),
}));
vi.mock("@/lib/youtube/client", () => ({
  fetchPlaylistItems: vi.fn(),
  YouTubeApiError: class YouTubeApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  },
}));

import { GET } from "../playlists/[id]/tracks/route";
import {
  getPlaylist,
  isPlaylistStale,
  upsertTracks,
  getTracksByPlaylist,
  updatePlaylistCachedAt,
} from "@/lib/db/queries/playlists";
import { fetchPlaylistItems } from "@/lib/youtube/client";

const mockGetPlaylist = vi.mocked(getPlaylist);
const mockIsStale = vi.mocked(isPlaylistStale);
const mockUpsertTracks = vi.mocked(upsertTracks);
const mockGetTracks = vi.mocked(getTracksByPlaylist);
const mockUpdateCachedAt = vi.mocked(updatePlaylistCachedAt);
const mockItems = vi.mocked(fetchPlaylistItems);

const FAKE_PLAYLIST = {
  id: 1,
  playlist_id: "PLtest123",
  title: "Lo-fi",
  thumbnail_url: null,
  cached_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
};

const FAKE_TRACKS = [
  { id: 1, playlist_id: 1, video_id: "v1", title: "Track 1", duration_seconds: null, position: 0 },
  { id: 2, playlist_id: 1, video_id: "v2", title: "Track 2", duration_seconds: 180, position: 1 },
];

beforeEach(() => {
  vi.stubEnv("YOUTUBE_API_KEY", "test-key");
  mockGetPlaylist.mockResolvedValue(FAKE_PLAYLIST);
  mockIsStale.mockResolvedValue(false);
  mockGetTracks.mockResolvedValue(FAKE_TRACKS);
  mockUpsertTracks.mockResolvedValue(undefined);
  mockUpdateCachedAt.mockResolvedValue(undefined);
  mockItems.mockResolvedValue([{ videoId: "v1", title: "Track 1", thumbnailUrl: null, position: 0 }]);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("GET /api/playlists/[id]/tracks", () => {
  it("retorna 404 si la playlist no existe", async () => {
    mockGetPlaylist.mockResolvedValue(null);
    const res = await GET(
      new Request("http://localhost/api/playlists/PLno-existe/tracks"),
      { params: Promise.resolve({ id: "PLno-existe" }) }
    );
    expect(res.status).toBe(404);
  });

  it("retorna los tracks de una playlist fresca (no stale)", async () => {
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
    mockIsStale.mockResolvedValue(true);
    const res = await GET(
      new Request("http://localhost/api/playlists/PLtest123/tracks"),
      { params: Promise.resolve({ id: "PLtest123" }) }
    );
    expect(res.status).toBe(200);
    expect(mockItems).toHaveBeenCalledWith("PLtest123", "test-key");
    expect(mockUpsertTracks).toHaveBeenCalled();
    expect(mockUpdateCachedAt).toHaveBeenCalled();
  });

  it("retorna 503 si playlist es stale y no hay API key", async () => {
    vi.stubEnv("YOUTUBE_API_KEY", "");
    mockIsStale.mockResolvedValue(true);
    const res = await GET(
      new Request("http://localhost/api/playlists/PLtest123/tracks"),
      { params: Promise.resolve({ id: "PLtest123" }) }
    );
    expect(res.status).toBe(503);
  });
});
