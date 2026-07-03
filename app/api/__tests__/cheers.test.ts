import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/index", () => ({ getDb: () => ({}) }));
vi.mock("@/lib/auth/session", () => ({ getSession: vi.fn() }));
vi.mock("@/lib/db/queries/cheers", () => ({
  sendCheer: vi.fn(),
  getUnseenCheerCount: vi.fn(),
  revealCheers: vi.fn(),
}));
vi.mock("@/lib/db/queries/friends", () => ({ areFriends: vi.fn() }));

import { POST, GET } from "../cheers/route";
import { POST as REVEAL } from "../cheers/reveal/route";
import { sendCheer, getUnseenCheerCount, revealCheers } from "@/lib/db/queries/cheers";
import { areFriends } from "@/lib/db/queries/friends";
import { getSession } from "@/lib/auth/session";

const mockSend = vi.mocked(sendCheer);
const mockCount = vi.mocked(getUnseenCheerCount);
const mockReveal = vi.mocked(revealCheers);
const mockAreFriends = vi.mocked(areFriends);
const mockSession = vi.mocked(getSession);

function postReq(body: Record<string, unknown>) {
  return new Request("http://localhost/api/cheers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockSession.mockResolvedValue({ user: { id: "me" }, session: { id: "s" } } as any);
  mockAreFriends.mockResolvedValue(true);
  mockCount.mockResolvedValue(0);
  mockReveal.mockResolvedValue({ names: [], count: 0 });
});

describe("POST /api/cheers", () => {
  it("retorna 401 sin sesión", async () => {
    mockSession.mockResolvedValueOnce(null);
    const res = await POST(postReq({ toUserId: "u2" }));
    expect(res.status).toBe(401);
  });

  it("retorna 400 si falta toUserId", async () => {
    const res = await POST(postReq({}));
    expect(res.status).toBe(400);
  });

  it("retorna 400 si te alentás a vos mismo", async () => {
    const res = await POST(postReq({ toUserId: "me" }));
    expect(res.status).toBe(400);
  });

  it("retorna 403 si no son amigos", async () => {
    mockAreFriends.mockResolvedValueOnce(false);
    const res = await POST(postReq({ toUserId: "u2" }));
    expect(res.status).toBe(403);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("retorna 201 y manda el aliento cuando son amigos", async () => {
    const res = await POST(postReq({ toUserId: "u2" }));
    expect(res.status).toBe(201);
    expect(mockSend).toHaveBeenCalledWith(expect.anything(), "me", "u2");
  });
});

describe("GET /api/cheers", () => {
  it("retorna 401 sin sesión", async () => {
    mockSession.mockResolvedValueOnce(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("retorna el contador de alientos sin ver", async () => {
    mockCount.mockResolvedValueOnce(4);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.count).toBe(4);
  });
});

describe("POST /api/cheers/reveal", () => {
  it("retorna 401 sin sesión", async () => {
    mockSession.mockResolvedValueOnce(null);
    const res = await REVEAL();
    expect(res.status).toBe(401);
  });

  it("retorna nombres y count", async () => {
    mockReveal.mockResolvedValueOnce({ names: ["Juan", "Pedro"], count: 2 });
    const res = await REVEAL();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.names).toEqual(["Juan", "Pedro"]);
    expect(body.count).toBe(2);
  });
});
