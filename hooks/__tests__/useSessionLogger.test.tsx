import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSessionLogger, flushSessionQueue } from "@/hooks/useSessionLogger";

const QUEUE_KEY = "pomodoro_offline_queue";

beforeEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

function now() {
  return new Date().toISOString();
}

function payload(overrides = {}) {
  return {
    type: "work" as const,
    started_at: now(),
    ended_at: now(),
    planned_duration: 1500,
    actual_duration: 1500,
    completed: true,
    ...overrides,
  };
}

function queue() {
  return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]");
}

describe("useSessionLogger", () => {
  it("llama a POST /api/sessions con los datos correctos", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ status: 201 });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useSessionLogger(() => {}));
    await act(async () => {
      await result.current.logSession(payload());
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/sessions",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"type":"work"'),
      })
    );
  });

  it("manda el client_id en el body", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ status: 201 });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useSessionLogger(() => {}));
    await act(async () => {
      await result.current.logSession(payload({ client_id: "uuid-1" }));
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.client_id).toBe("uuid-1");
  });

  it("maneja errores silenciosamente (no lanza)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));
    const { result } = renderHook(() => useSessionLogger(() => {}));

    await expect(
      act(async () => {
        await result.current.logSession(payload({ client_id: "uuid-1" }));
      })
    ).resolves.not.toThrow();
  });
});

// Sin internet, sendSession fallaba y no volvía ningún id, así que el modal de
// chunks nunca se abría: no es que se perdieran los datos de teoría, es que
// nunca se preguntó. Con la identidad puesta por el cliente ya no hace falta
// esperar al servidor para saber de qué sesión estamos hablando.
describe("useSessionLogger — el prompt no depende del servidor", () => {
  it("dispara onLogged con el client_id sin esperar la respuesta", async () => {
    let settle!: (v: unknown) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise((resolve) => { settle = resolve; }))
    );

    const onLogged = vi.fn();
    const { result } = renderHook(() => useSessionLogger(onLogged));

    await act(async () => {
      void result.current.logSession(payload({ client_id: "uuid-1" }));
    });

    expect(onLogged).toHaveBeenCalledWith("uuid-1");

    await act(async () => {
      settle({ status: 201 });
    });
  });

  it("dispara onLogged igual cuando no hay red, y encola la sesión", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    const onLogged = vi.fn();
    const { result } = renderHook(() => useSessionLogger(onLogged));

    await act(async () => {
      await result.current.logSession(payload({ client_id: "uuid-1" }));
    });

    expect(onLogged).toHaveBeenCalledWith("uuid-1");
    expect(queue()).toHaveLength(1);
    expect(queue()[0].client_id).toBe("uuid-1");
  });

  it("no abre el prompt para una sesión sin client_id", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 201 }));

    const onLogged = vi.fn();
    const { result } = renderHook(() => useSessionLogger(onLogged));

    await act(async () => {
      await result.current.logSession(payload());
    });

    expect(onLogged).toHaveBeenCalledWith(null);
  });

  // El vaciado ya no lo dispara el hook: lo ordena useOfflineSync, que corre
  // esta cola antes que la de work logs. Si el hook siguiera enganchado a
  // `online` por su cuenta, la carrera que este plan arregla seguiría viva.
  it("no engancha el vaciado al montarse ni al evento online", async () => {
    localStorage.setItem(QUEUE_KEY, JSON.stringify([payload({ client_id: "uuid-1" })]));
    const fetchMock = vi.fn().mockResolvedValue({ status: 201 });
    vi.stubGlobal("fetch", fetchMock);

    renderHook(() => useSessionLogger(() => {}));
    await act(async () => {
      window.dispatchEvent(new Event("online"));
      await new Promise((r) => setTimeout(r, 20));
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(queue()).toHaveLength(1);
  });
});

describe("flushSessionQueue", () => {
  it("reenvía el item encolado con su client_id original", async () => {
    localStorage.setItem(QUEUE_KEY, JSON.stringify([payload({ client_id: "uuid-1" })]));
    const fetchMock = vi.fn().mockResolvedValue({ status: 201 });
    vi.stubGlobal("fetch", fetchMock);

    await flushSessionQueue();

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.client_id).toBe("uuid-1");
    expect(queue()).toHaveLength(0);
  });

  it("suelta el item si el servidor lo ignora por corto (204)", async () => {
    localStorage.setItem(QUEUE_KEY, JSON.stringify([payload({ client_id: "uuid-1" })]));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 204 }));

    await flushSessionQueue();
    expect(queue()).toHaveLength(0);
  });

  it("deja el item en la cola si sigue sin haber red", async () => {
    localStorage.setItem(QUEUE_KEY, JSON.stringify([payload({ client_id: "uuid-1" })]));
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    await flushSessionQueue();
    expect(queue()).toHaveLength(1);
  });

  it("reporta cuántas sesiones entregó", async () => {
    localStorage.setItem(
      QUEUE_KEY,
      JSON.stringify([payload({ client_id: "uuid-1" }), payload({ client_id: "uuid-2" })])
    );
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 201 }));

    expect(await flushSessionQueue()).toBe(2);
  });

  it("no hace ninguna request con la cola vacía", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    expect(await flushSessionQueue()).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
