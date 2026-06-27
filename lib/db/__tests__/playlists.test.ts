import { describe, it, expect, beforeEach } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { runMigrations } from "../migrations";
import {
  upsertPlaylist,
  getPlaylist,
  isPlaylistStale,
  upsertTracks,
  getTracksByPlaylist,
} from "../queries/playlists";

function freshDb() {
  const db = new DatabaseSync(":memory:");
  runMigrations(db);
  return db;
}

const SAMPLE_PLAYLIST = {
  playlist_id: "PLtest123",
  title: "Lo-fi Hip Hop",
  thumbnail_url: "https://i.ytimg.com/vi/abc/hqdefault.jpg",
};

const SAMPLE_TRACKS = [
  { video_id: "vid001", title: "Track 1", duration_seconds: 240, position: 0 },
  { video_id: "vid002", title: "Track 2", duration_seconds: 180, position: 1 },
  { video_id: "vid003", title: "Track 3", duration_seconds: null, position: 2 },
];

describe("upsertPlaylist", () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = freshDb();
  });

  it("inserta una playlist nueva y devuelve el registro", () => {
    const playlist = upsertPlaylist(db, SAMPLE_PLAYLIST);
    expect(playlist.id).toBeGreaterThan(0);
    expect(playlist.playlist_id).toBe("PLtest123");
    expect(playlist.title).toBe("Lo-fi Hip Hop");
    expect(playlist.thumbnail_url).toBe("https://i.ytimg.com/vi/abc/hqdefault.jpg");
  });

  it("actualiza una playlist existente (upsert por playlist_id)", () => {
    upsertPlaylist(db, SAMPLE_PLAYLIST);
    const updated = upsertPlaylist(db, {
      ...SAMPLE_PLAYLIST,
      title: "Lo-fi Updated",
    });
    expect(updated.title).toBe("Lo-fi Updated");
    const count = db.prepare("SELECT COUNT(*) as n FROM playlists").get() as { n: number };
    expect(Number(count.n)).toBe(1);
  });

  it("acepta thumbnail_url nulo", () => {
    const playlist = upsertPlaylist(db, {
      playlist_id: "PLno-thumb",
      title: "Sin thumbnail",
      thumbnail_url: null,
    });
    expect(playlist.thumbnail_url).toBeNull();
  });
});

describe("getPlaylist", () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = freshDb();
  });

  it("retorna null si la playlist no existe", () => {
    const result = getPlaylist(db, "PLno-existe");
    expect(result).toBeNull();
  });

  it("retorna la playlist si existe", () => {
    upsertPlaylist(db, SAMPLE_PLAYLIST);
    const result = getPlaylist(db, "PLtest123");
    expect(result).not.toBeNull();
    expect(result!.title).toBe("Lo-fi Hip Hop");
  });
});

describe("isPlaylistStale", () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = freshDb();
  });

  it("retorna true si la playlist no existe", () => {
    expect(isPlaylistStale(db, "PLno-existe")).toBe(true);
  });

  it("retorna false para playlist recién cacheada", () => {
    upsertPlaylist(db, SAMPLE_PLAYLIST);
    expect(isPlaylistStale(db, "PLtest123")).toBe(false);
  });

  it("retorna true para playlist con cached_at > 24h en el pasado", () => {
    upsertPlaylist(db, SAMPLE_PLAYLIST);
    db.prepare(
      "UPDATE playlists SET cached_at = datetime('now', '-25 hours') WHERE playlist_id = ?"
    ).run("PLtest123");
    expect(isPlaylistStale(db, "PLtest123")).toBe(true);
  });
});

describe("upsertTracks", () => {
  let db: DatabaseSync;
  let playlistId: number;

  beforeEach(() => {
    db = freshDb();
    const p = upsertPlaylist(db, SAMPLE_PLAYLIST);
    playlistId = p.id;
  });

  it("inserta los tracks correctamente", () => {
    upsertTracks(db, playlistId, SAMPLE_TRACKS);
    const count = db
      .prepare("SELECT COUNT(*) as n FROM tracks WHERE playlist_id = ?")
      .get(playlistId) as { n: number };
    expect(Number(count.n)).toBe(3);
  });

  it("reemplaza tracks existentes al hacer upsert (DELETE + INSERT)", () => {
    upsertTracks(db, playlistId, SAMPLE_TRACKS);
    upsertTracks(db, playlistId, [
      { video_id: "new001", title: "New Track", duration_seconds: 300, position: 0 },
    ]);
    const count = db
      .prepare("SELECT COUNT(*) as n FROM tracks WHERE playlist_id = ?")
      .get(playlistId) as { n: number };
    expect(Number(count.n)).toBe(1);
  });

  it("acepta duration_seconds nulo", () => {
    upsertTracks(db, playlistId, [
      { video_id: "vid_null", title: "Sin duración", duration_seconds: null, position: 0 },
    ]);
    const row = db
      .prepare("SELECT duration_seconds FROM tracks WHERE video_id = ?")
      .get("vid_null") as { duration_seconds: number | null };
    expect(row.duration_seconds).toBeNull();
  });
});

describe("getTracksByPlaylist", () => {
  let db: DatabaseSync;
  let playlistId: number;

  beforeEach(() => {
    db = freshDb();
    const p = upsertPlaylist(db, SAMPLE_PLAYLIST);
    playlistId = p.id;
  });

  it("retorna array vacío si no hay tracks", () => {
    const tracks = getTracksByPlaylist(db, "PLtest123");
    expect(tracks).toEqual([]);
  });

  it("retorna tracks ordenados por position", () => {
    upsertTracks(db, playlistId, [
      { video_id: "v2", title: "Segundo", duration_seconds: 100, position: 1 },
      { video_id: "v0", title: "Primero", duration_seconds: 200, position: 0 },
    ]);
    const tracks = getTracksByPlaylist(db, "PLtest123");
    expect(tracks[0].video_id).toBe("v0");
    expect(tracks[1].video_id).toBe("v2");
  });

  it("retorna null si la playlist_id no existe", () => {
    const tracks = getTracksByPlaylist(db, "PLno-existe");
    expect(tracks).toEqual([]);
  });
});
