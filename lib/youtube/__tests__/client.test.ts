import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchPlaylistItems, fetchPlaylistInfo, YouTubeApiError } from "../client";

const MOCK_API_KEY = "test-api-key";
const PLAYLIST_ID = "PLtest123";

function makeItem(videoId: string, title: string, position: number) {
  return {
    snippet: {
      title,
      position,
      resourceId: { videoId },
      thumbnails: { medium: { url: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg` } },
      contentDetails: { videoPublishedAt: "2024-01-01T00:00:00Z" },
    },
  };
}

function makeResponse(items: object[], nextPageToken?: string) {
  return {
    ok: true,
    json: async () => ({
      items,
      ...(nextPageToken ? { nextPageToken } : {}),
    }),
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("fetchPlaylistItems", () => {
  it("retorna tracks mapeados desde una página única", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        makeResponse([
          makeItem("vid001", "Track 1", 0),
          makeItem("vid002", "Track 2", 1),
        ])
      )
    );

    const tracks = await fetchPlaylistItems(PLAYLIST_ID, MOCK_API_KEY);

    expect(tracks).toHaveLength(2);
    expect(tracks[0]).toMatchObject({
      videoId: "vid001",
      title: "Track 1",
      position: 0,
    });
    expect(tracks[1].videoId).toBe("vid002");
  });

  it("pagina automáticamente cuando hay nextPageToken", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        makeResponse([makeItem("vid001", "Track 1", 0)], "token-page-2")
      )
      .mockResolvedValueOnce(
        makeResponse([makeItem("vid002", "Track 2", 1)])
      );

    vi.stubGlobal("fetch", fetchMock);

    const tracks = await fetchPlaylistItems(PLAYLIST_ID, MOCK_API_KEY);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(tracks).toHaveLength(2);
  });

  it("incluye pageToken en la segunda petición", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(makeResponse([makeItem("v1", "T1", 0)], "next-token"))
      .mockResolvedValueOnce(makeResponse([makeItem("v2", "T2", 1)]));

    vi.stubGlobal("fetch", fetchMock);

    await fetchPlaylistItems(PLAYLIST_ID, MOCK_API_KEY);

    const secondCallUrl = fetchMock.mock.calls[1][0] as string;
    expect(secondCallUrl).toContain("pageToken=next-token");
  });

  it("mapea thumbnailUrl correctamente", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        makeResponse([makeItem("vid001", "Track 1", 0)])
      )
    );

    const tracks = await fetchPlaylistItems(PLAYLIST_ID, MOCK_API_KEY);
    expect(tracks[0].thumbnailUrl).toBe("https://i.ytimg.com/vi/vid001/mqdefault.jpg");
  });

  it("usa la API key en la URL", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(makeResponse([makeItem("v1", "T1", 0)]));

    vi.stubGlobal("fetch", fetchMock);

    await fetchPlaylistItems(PLAYLIST_ID, MOCK_API_KEY);

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain(`key=${MOCK_API_KEY}`);
    expect(url).toContain(`playlistId=${PLAYLIST_ID}`);
  });

  it("lanza YouTubeApiError cuando la respuesta no es ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({ ok: false, status: 403, json: async () => ({}) })
    );

    await expect(fetchPlaylistItems(PLAYLIST_ID, MOCK_API_KEY)).rejects.toThrow(YouTubeApiError);
  });

  it("el error incluye el status HTTP", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({ ok: false, status: 403, json: async () => ({}) })
    );

    await expect(fetchPlaylistItems(PLAYLIST_ID, MOCK_API_KEY)).rejects.toMatchObject({
      status: 403,
    });
  });

  it("retorna array vacío si la playlist no tiene items", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(makeResponse([]))
    );

    const tracks = await fetchPlaylistItems(PLAYLIST_ID, MOCK_API_KEY);
    expect(tracks).toEqual([]);
  });
});

describe("fetchPlaylistInfo", () => {
  it("retorna título y thumbnailUrl de la playlist", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            {
              snippet: {
                title: "Lo-fi Hip Hop",
                thumbnails: { medium: { url: "https://i.ytimg.com/vi/abc/mqdefault.jpg" } },
              },
            },
          ],
        }),
      })
    );

    const info = await fetchPlaylistInfo(PLAYLIST_ID, MOCK_API_KEY);
    expect(info.title).toBe("Lo-fi Hip Hop");
    expect(info.thumbnailUrl).toBe("https://i.ytimg.com/vi/abc/mqdefault.jpg");
  });

  it("retorna thumbnailUrl null si no hay thumbnails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [{ snippet: { title: "Sin thumb" } }],
        }),
      })
    );

    const info = await fetchPlaylistInfo(PLAYLIST_ID, MOCK_API_KEY);
    expect(info.thumbnailUrl).toBeNull();
  });

  it("lanza YouTubeApiError si la playlist no existe (items vacío)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [] }),
      })
    );

    await expect(fetchPlaylistInfo(PLAYLIST_ID, MOCK_API_KEY)).rejects.toThrow(YouTubeApiError);
  });

  it("lanza YouTubeApiError en respuesta no-ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({ ok: false, status: 403, json: async () => ({}) })
    );

    await expect(fetchPlaylistInfo(PLAYLIST_ID, MOCK_API_KEY)).rejects.toMatchObject({ status: 403 });
  });
});
