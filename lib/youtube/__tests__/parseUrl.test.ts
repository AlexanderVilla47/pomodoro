import { describe, it, expect } from "vitest";
import { extractPlaylistId } from "../parseUrl";

describe("extractPlaylistId — URLs válidas", () => {
  it("youtube.com/playlist?list=PLxxx", () => {
    expect(extractPlaylistId("https://www.youtube.com/playlist?list=PLtest123abc")).toBe("PLtest123abc");
  });

  it("youtube.com/watch?v=...&list=PLxxx", () => {
    expect(extractPlaylistId("https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLtest123abc")).toBe("PLtest123abc");
  });

  it("youtu.be/...?list=PLxxx", () => {
    expect(extractPlaylistId("https://youtu.be/dQw4w9WgXcQ?list=PLtest123abc")).toBe("PLtest123abc");
  });

  it("music.youtube.com/playlist?list=PLxxx", () => {
    expect(extractPlaylistId("https://music.youtube.com/playlist?list=PLtest123abc")).toBe("PLtest123abc");
  });

  it("URL con parámetros adicionales extrae solo el list", () => {
    expect(
      extractPlaylistId("https://www.youtube.com/watch?v=abc&list=PLtest123abc&index=3&t=120s")
    ).toBe("PLtest123abc");
  });

  it("URL sin protocolo con www", () => {
    expect(extractPlaylistId("www.youtube.com/playlist?list=PLtest123abc")).toBe("PLtest123abc");
  });
});

describe("extractPlaylistId — URLs inválidas", () => {
  it("retorna null para URL sin list param", () => {
    expect(extractPlaylistId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBeNull();
  });

  it("retorna null para string vacío", () => {
    expect(extractPlaylistId("")).toBeNull();
  });

  it("retorna null para URL que no es de YouTube", () => {
    expect(extractPlaylistId("https://www.google.com/search?q=test")).toBeNull();
  });

  it("retorna null para texto plano sin URL", () => {
    expect(extractPlaylistId("esto no es una URL")).toBeNull();
  });

  it("retorna null si list está vacío", () => {
    expect(extractPlaylistId("https://www.youtube.com/playlist?list=")).toBeNull();
  });
});
