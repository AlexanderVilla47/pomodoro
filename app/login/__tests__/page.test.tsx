import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth/session", () => ({ getSession: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import LoginPage from "../page";
import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";

const mockGetSession = vi.mocked(getSession);
const mockRedirect = vi.mocked(redirect);

type Sesion = Awaited<ReturnType<typeof getSession>>;

const SESION_ACTIVA = {
  user: { id: "u1", email: "test@test.com", name: "Test" },
  session: { id: "s1" },
} as unknown as Sesion;

beforeEach(() => {
  vi.clearAllMocks();
});

// /login es una URL que el usuario puede tener bookmarkeada. Si no chequea
// sesion, a quien la guardo le pide iniciar sesion cada vez que abre la app,
// tenga una sesion perfectamente valida o no.
describe("LoginPage", () => {
  it("manda a la home si ya hay sesion", async () => {
    mockGetSession.mockResolvedValue(SESION_ACTIVA);

    await LoginPage();

    expect(mockRedirect).toHaveBeenCalledWith("/");
  });

  it("muestra el login si no hay sesion", async () => {
    mockGetSession.mockResolvedValue(null);

    await LoginPage();

    expect(mockRedirect).not.toHaveBeenCalled();
  });
});
