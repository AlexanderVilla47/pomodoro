import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseContextUri, getAlbumTracks, getContextTracks } from "../client";

const TOKEN = "test-token";

function makeResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body, text: async () => JSON.stringify(body) };
}

function albumTrack(id: string, name: string) {
  return {
    id,
    uri: `spotify:track:${id}`,
    name,
    duration_ms: 200000,
    artists: [{ name: "Artista" }],
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("parseContextUri", () => {
  it("parsea un contexto de playlist", () => {
    expect(parseContextUri("spotify:playlist:37i9dQ")).toEqual({
      type: "playlist",
      id: "37i9dQ",
    });
  });

  it("parsea un contexto de álbum", () => {
    expect(parseContextUri("spotify:album:1DFixLW")).toEqual({
      type: "album",
      id: "1DFixLW",
    });
  });

  it("retorna null para contextos no soportados (artist, collection)", () => {
    expect(parseContextUri("spotify:artist:abc")).toBeNull();
    expect(parseContextUri("spotify:collection:tracks")).toBeNull();
  });

  it("retorna null para basura o string vacío", () => {
    expect(parseContextUri("")).toBeNull();
    expect(parseContextUri("no-es-un-uri")).toBeNull();
  });
});

describe("getAlbumTracks", () => {
  it("mapea los tracks aplicando la imagen del álbum a todos", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        makeResponse({
          images: [{ url: "http://cover.jpg" }],
          tracks: {
            items: [albumTrack("t1", "Uno"), albumTrack("t2", "Dos")],
            next: null,
          },
        })
      )
    );

    const tracks = await getAlbumTracks(TOKEN, "album-1");

    expect(tracks).toHaveLength(2);
    expect(tracks[0]).toEqual({
      uri: "spotify:track:t1",
      id: "t1",
      name: "Uno",
      artistName: "Artista",
      durationMs: 200000,
      imageUrl: "http://cover.jpg",
    });
    expect(tracks[1].imageUrl).toBe("http://cover.jpg");
  });

  it("pagina cuando el álbum tiene más de una página de tracks", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        makeResponse({
          images: [{ url: "http://cover.jpg" }],
          tracks: {
            items: [albumTrack("t1", "Uno")],
            next: "https://api.spotify.com/v1/albums/album-1/tracks?offset=1",
          },
        })
      )
      .mockResolvedValueOnce(
        makeResponse({ items: [albumTrack("t2", "Dos")], next: null })
      );
    vi.stubGlobal("fetch", fetchMock);

    const tracks = await getAlbumTracks(TOKEN, "album-1");

    expect(tracks.map((t) => t.id)).toEqual(["t1", "t2"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("getContextTracks", () => {
  it("retorna null (sin pegarle a la API) para contexto no soportado", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await getContextTracks(TOKEN, "spotify:artist:abc");

    expect(result).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("expande un contexto de álbum", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        makeResponse({
          images: [{ url: "http://cover.jpg" }],
          tracks: { items: [albumTrack("t1", "Uno")], next: null },
        })
      )
    );

    const result = await getContextTracks(TOKEN, "spotify:album:album1");

    expect(result).toHaveLength(1);
    expect(result![0].id).toBe("t1");
  });
});
