import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSessionLogger } from "@/hooks/useSessionLogger";

beforeEach(() => {
  vi.restoreAllMocks();
});

function now() {
  return new Date().toISOString();
}

describe("useSessionLogger", () => {
  it("llama a POST /api/sessions con los datos correctos", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, status: 201, json: async () => ({ id: 1 }) });
    vi.stubGlobal("fetch", fetchMock);

    const onLogged = vi.fn();
    const { result } = renderHook(() => useSessionLogger(onLogged));

    await act(async () => {
      await result.current.logSession({
        type: "work",
        started_at: now(),
        ended_at: now(),
        planned_duration: 1500,
        actual_duration: 1500,
        completed: true,
      });
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/sessions", expect.objectContaining({
      method: "POST",
      body: expect.stringContaining('"type":"work"'),
    }));
  });

  it("llama al callback onLogged después de una sesión exitosa", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => ({ id: 1 }) })
    );

    const onLogged = vi.fn();
    const { result } = renderHook(() => useSessionLogger(onLogged));

    await act(async () => {
      await result.current.logSession({
        type: "work",
        started_at: now(),
        ended_at: now(),
        planned_duration: 1500,
        actual_duration: 1500,
        completed: true,
      });
    });

    expect(onLogged).toHaveBeenCalledTimes(1);
  });

  it("llama onLogged con null cuando el servidor retorna 204 (sesión ignorada)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 204, json: async () => null })
    );

    const onLogged = vi.fn();
    const { result } = renderHook(() => useSessionLogger(onLogged));

    await act(async () => {
      await result.current.logSession({
        type: "work",
        started_at: now(),
        ended_at: now(),
        planned_duration: 1500,
        actual_duration: 100,
        completed: false,
      });
    });

    expect(onLogged).toHaveBeenCalledWith(null);
  });

  it("maneja errores silenciosamente (no lanza)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));

    const { result } = renderHook(() => useSessionLogger(() => {}));

    await expect(
      act(async () => {
        await result.current.logSession({
          type: "work",
          started_at: now(),
          ended_at: now(),
          planned_duration: 1500,
          actual_duration: 1500,
          completed: true,
        });
      })
    ).resolves.not.toThrow();
  });
});
