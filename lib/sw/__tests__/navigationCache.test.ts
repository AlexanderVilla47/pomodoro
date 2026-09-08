import { describe, it, expect } from "vitest";
import { puedeCachearNavegacion } from "../navigationCache";

// Una respuesta con `redirected: true` es la que el server devolvio despues de
// mandar a /login. Guardarla bajo la clave de la home deja la pantalla de login
// cacheada ahi: el usuario vuelve logueado y el service worker le contesta con
// el login sin que el pedido llegue nunca al server.
describe("puedeCachearNavegacion", () => {
  it("cachea una home servida directo", () => {
    expect(puedeCachearNavegacion({ status: 200, redirected: false })).toBe(true);
  });

  it("no cachea una respuesta que venga de un redirect", () => {
    expect(puedeCachearNavegacion({ status: 200, redirected: true })).toBe(false);
  });

  it("no cachea respuestas que no sean 200", () => {
    expect(puedeCachearNavegacion({ status: 404, redirected: false })).toBe(false);
    expect(puedeCachearNavegacion({ status: 500, redirected: false })).toBe(false);
  });
});
