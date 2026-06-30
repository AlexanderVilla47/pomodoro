import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useWorkLogger } from "../useWorkLogger";

const QUEUE_KEY = "pomodoro_worklog_queue";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  localStorage.clear();
  mockFetch.mockReset();
});

afterEach(() => {
  localStorage.clear();
});

const payload = { sessionId: 1, notes: "test", topics: ["a"] };

describe("useWorkLogger — saveWorkLog", () => {
  it("llama a POST /api/work-logs y dropea en 201", async () => {
    mockFetch.mockResolvedValueOnce({ status: 201 });
    const { result } = renderHook(() => useWorkLogger());

    await act(async () => {
      await result.current.saveWorkLog(payload);
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/work-logs",
      expect.objectContaining({ method: "POST" })
    );
    const queue = JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]");
    expect(queue).toHaveLength(0);
  });

  it("dropea del queue en 409 (ya existía)", async () => {
    mockFetch.mockResolvedValueOnce({ status: 409 });
    const { result } = renderHook(() => useWorkLogger());

    await act(async () => {
      await result.current.saveWorkLog(payload);
    });

    const queue = JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]");
    expect(queue).toHaveLength(0);
  });

  it("encola si hay error de red", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));
    const { result } = renderHook(() => useWorkLogger());

    await act(async () => {
      await result.current.saveWorkLog(payload);
    });

    const queue = JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]");
    expect(queue).toHaveLength(1);
    expect(queue[0]).toEqual(payload);
  });

  it("flushea la queue cuando se restaura la conexión", async () => {
    localStorage.setItem(QUEUE_KEY, JSON.stringify([payload]));
    mockFetch.mockResolvedValue({ status: 201 });

    renderHook(() => useWorkLogger());

    await act(async () => {
      window.dispatchEvent(new Event("online"));
      await new Promise((r) => setTimeout(r, 50));
    });

    const queue = JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]");
    expect(queue).toHaveLength(0);
  });
});
