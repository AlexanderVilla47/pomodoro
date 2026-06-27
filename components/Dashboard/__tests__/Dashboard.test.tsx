import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { Dashboard } from "../index";

vi.mock("gsap", () => ({
  default: { to: vi.fn((obj, { onUpdate }) => { if (onUpdate) onUpdate(); return {}; }) },
}));

const STATS = {
  today: { count: 3, total_seconds: 4500 },
  week: { count: 10, total_seconds: 18000 },
};

beforeEach(() => vi.restoreAllMocks());

describe("Dashboard", () => {
  it("llama a GET /api/stats al montar", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => STATS });
    vi.stubGlobal("fetch", fetchMock);

    render(<Dashboard refreshTrigger={0} />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/api/stats"));
    });
  });

  it("vuelve a fetchear cuando refreshTrigger cambia", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => STATS });
    vi.stubGlobal("fetch", fetchMock);

    const { rerender } = render(<Dashboard refreshTrigger={0} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    rerender(<Dashboard refreshTrigger={1} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });
});
