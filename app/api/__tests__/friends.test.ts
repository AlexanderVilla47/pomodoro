import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/index", () => ({ getDb: () => ({}) }));
vi.mock("@/lib/auth/session", () => ({
  getSession: vi.fn().mockResolvedValue({
    user: { id: "me", email: "me@test.com", name: "Me" },
    session: { id: "sess-1" },
  }),
}));
vi.mock("@/lib/db/queries/friends", () => ({
  searchUsers: vi.fn(),
  findUserById: vi.fn(),
  sendFriendRequest: vi.fn(),
  getFriendsWithStats: vi.fn(),
  getPendingRequests: vi.fn(),
  areFriends: vi.fn(),
}));

import { GET as SEARCH } from "../friends/search/route";
import { POST } from "../friends/route";
import {
  searchUsers,
  findUserById,
  sendFriendRequest,
  areFriends,
} from "@/lib/db/queries/friends";
import { getSession } from "@/lib/auth/session";

const mockSearch = vi.mocked(searchUsers);
const mockFindById = vi.mocked(findUserById);
const mockSend = vi.mocked(sendFriendRequest);
const mockAreFriends = vi.mocked(areFriends);
const mockSession = vi.mocked(getSession);

beforeEach(() => {
  vi.clearAllMocks();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockSession.mockResolvedValue({ user: { id: "me", email: "me@test.com" }, session: { id: "s" } } as any);
  mockSearch.mockResolvedValue([]);
  mockFindById.mockResolvedValue({ id: "u2", name: "Juan", image: null });
  mockSend.mockResolvedValue({ id: 7 });
  mockAreFriends.mockResolvedValue(false);
});

describe("GET /api/friends/search", () => {
  it("retorna 401 sin sesión", async () => {
    mockSession.mockResolvedValueOnce(null);
    const res = await SEARCH(new Request("http://localhost/api/friends/search?q=juan"));
    expect(res.status).toBe(401);
  });

  it("retorna results vacíos si falta q", async () => {
    const res = await SEARCH(new Request("http://localhost/api/friends/search"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results).toEqual([]);
    expect(mockSearch).not.toHaveBeenCalled();
  });

  it("delega en searchUsers y retorna results", async () => {
    mockSearch.mockResolvedValueOnce([
      { id: "u2", name: "Juan", image: null, relation: "none" },
    ]);
    const res = await SEARCH(new Request("http://localhost/api/friends/search?q=juan"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results).toHaveLength(1);
    expect(mockSearch).toHaveBeenCalledWith(expect.anything(), "juan", "me");
  });
});

describe("POST /api/friends (por userId)", () => {
  it("retorna 401 sin sesión", async () => {
    mockSession.mockResolvedValueOnce(null);
    const res = await POST(makeReq({ userId: "u2" }));
    expect(res.status).toBe(401);
  });

  it("retorna 400 si falta userId", async () => {
    const res = await POST(makeReq({}));
    expect(res.status).toBe(400);
  });

  it("retorna 400 si te agregás a vos mismo", async () => {
    const res = await POST(makeReq({ userId: "me" }));
    expect(res.status).toBe(400);
  });

  it("retorna 404 si el usuario no existe", async () => {
    mockFindById.mockResolvedValueOnce(null);
    const res = await POST(makeReq({ userId: "ghost" }));
    expect(res.status).toBe(404);
  });

  it("retorna 409 si ya son amigos", async () => {
    mockAreFriends.mockResolvedValueOnce(true);
    const res = await POST(makeReq({ userId: "u2" }));
    expect(res.status).toBe(409);
  });

  it("retorna 409 si ya hay solicitud pendiente", async () => {
    mockSend.mockResolvedValueOnce(null);
    const res = await POST(makeReq({ userId: "u2" }));
    expect(res.status).toBe(409);
  });

  it("retorna 201 con id en caso exitoso", async () => {
    const res = await POST(makeReq({ userId: "u2" }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe(7);
    expect(mockSend).toHaveBeenCalledWith(expect.anything(), "me", "u2");
  });
});

function makeReq(body: Record<string, unknown>) {
  return new Request("http://localhost/api/friends", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
