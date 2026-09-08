import { describe, it, expect, vi, beforeEach } from "vitest";

// `betterAuth` se mockea para capturar la configuración con la que se lo
// construye: acá se valida el contrato de la sesión (cuánto dura, cada cuánto
// desliza), no el runtime de better-auth.
const { getSessionSpy } = vi.hoisted(() => ({ getSessionSpy: vi.fn() }));

vi.mock("pg", () => ({ Pool: class {} }));
vi.mock("better-auth", () => ({
  betterAuth: vi.fn((options) => ({ options, api: { getSession: getSessionSpy } })),
}));
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers()),
}));

import { auth } from "@/lib/auth";
import { getSession } from "@/lib/auth/session";

const DIA = 60 * 60 * 24;

describe("configuración de sesión", () => {
  it("declara una sesión de 90 días", () => {
    expect(auth.options.session?.expiresIn).toBe(DIA * 90);
  });

  it("desliza la expiración una vez por día", () => {
    expect(auth.options.session?.updateAge).toBe(DIA);
  });
});

describe("getSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // El refresh de better-auth extiende la fila en la base Y reemite la cookie.
  // Del lado del servidor la cookie se descarta (un Server Component no puede
  // escribirla), así que si el refresh se gasta acá, la única llamada que sí
  // puede persistirla — `/api/auth/get-session` vía useSession — ya no
  // encuentra nada que renovar y el Max-Age del login nunca se extiende.
  it("lee la sesión sin gastar la ventana de refresh", async () => {
    await getSession();

    expect(getSessionSpy).toHaveBeenCalledWith(
      expect.objectContaining({ query: { disableRefresh: true } }),
    );
  });
});
