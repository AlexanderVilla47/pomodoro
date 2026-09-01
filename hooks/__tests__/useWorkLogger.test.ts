import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useWorkLogger, flushWorkLogQueue } from "../useWorkLogger";

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

const payload = { sessionClientId: "uuid-1", notes: "test", topics: ["a"] };

/** Los payloads que quedaron en la cola, sin el envoltorio de reintentos. */
function queued() {
  const raw = JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]");
  return raw.map((item: { payload?: unknown }) => item.payload ?? item);
}

function bodyOf(call: number) {
  return JSON.parse(mockFetch.mock.calls[call][1].body);
}

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
    expect(queued()).toHaveLength(0);
  });

  it("manda el sessionClientId en el body", async () => {
    mockFetch.mockResolvedValueOnce({ status: 201 });
    const { result } = renderHook(() => useWorkLogger());

    await act(async () => {
      await result.current.saveWorkLog(payload);
    });

    expect(bodyOf(0).sessionClientId).toBe("uuid-1");
  });

  it("dropea del queue en 409 (ya existía)", async () => {
    mockFetch.mockResolvedValueOnce({ status: 409 });
    const { result } = renderHook(() => useWorkLogger());

    await act(async () => {
      await result.current.saveWorkLog(payload);
    });

    expect(queued()).toHaveLength(0);
  });

  it("encola si hay error de red", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));
    const { result } = renderHook(() => useWorkLogger());

    await act(async () => {
      await result.current.saveWorkLog(payload);
    });

    expect(queued()).toEqual([payload]);
  });

  // El caso que ordena useOfflineSync: el work log salió antes que su sesión.
  it("encola en 202 — la sesión todavía no llegó", async () => {
    mockFetch.mockResolvedValueOnce({ status: 202 });
    const { result } = renderHook(() => useWorkLogger());

    await act(async () => {
      await result.current.saveWorkLog(payload);
    });

    expect(queued()).toEqual([payload]);
  });

  // El vaciado lo ordena useOfflineSync: sesiones primero, work logs después.
  // Si el hook siguiera enganchado a `online` por su cuenta seguiría la carrera.
  it("no engancha el vaciado al montarse ni al evento online", async () => {
    localStorage.setItem(QUEUE_KEY, JSON.stringify([payload]));
    renderHook(() => useWorkLogger());

    await act(async () => {
      window.dispatchEvent(new Event("online"));
      await new Promise((r) => setTimeout(r, 20));
    });

    expect(mockFetch).not.toHaveBeenCalled();
    expect(queued()).toHaveLength(1);
  });
});

describe("flushWorkLogQueue", () => {
  it("entrega los items pendientes y vacía la cola", async () => {
    localStorage.setItem(QUEUE_KEY, JSON.stringify([payload]));
    mockFetch.mockResolvedValue({ status: 201 });

    await flushWorkLogQueue();
    expect(queued()).toHaveLength(0);
  });

  it("deja el item si la sesión todavía no llegó (202)", async () => {
    localStorage.setItem(QUEUE_KEY, JSON.stringify([payload]));
    mockFetch.mockResolvedValue({ status: 202 });

    await flushWorkLogQueue();
    expect(queued()).toEqual([payload]);
  });

  it("lo entrega en el reintento siguiente, ya con la sesión en el servidor", async () => {
    localStorage.setItem(QUEUE_KEY, JSON.stringify([payload]));
    mockFetch.mockResolvedValueOnce({ status: 202 });
    await flushWorkLogQueue();

    mockFetch.mockResolvedValueOnce({ status: 201 });
    await flushWorkLogQueue();

    expect(queued()).toHaveLength(0);
  });

  // La trampa documentada de este repo: la cola sólo suelta un item con 201 o
  // 409, así que sin techo un status que nunca cambia se reintenta para
  // siempre. El 202 es legítimo, pero legítimo no quiere decir eterno.
  it("descarta el item si el 202 no se resuelve nunca", async () => {
    localStorage.setItem(QUEUE_KEY, JSON.stringify([payload]));
    mockFetch.mockResolvedValue({ status: 202 });

    for (let i = 0; i < 20; i++) await flushWorkLogQueue();

    expect(queued()).toHaveLength(0);
  });

  it("también le pone techo a un status inesperado", async () => {
    localStorage.setItem(QUEUE_KEY, JSON.stringify([payload]));
    mockFetch.mockResolvedValue({ status: 500 });

    for (let i = 0; i < 20; i++) await flushWorkLogQueue();

    expect(queued()).toHaveLength(0);
  });

  // Estar sin internet no es culpa del item: no le puede gastar los intentos,
  // o una semana offline se comería la cola entera.
  it("no gasta intentos cuando no hay red", async () => {
    localStorage.setItem(QUEUE_KEY, JSON.stringify([payload]));
    mockFetch.mockRejectedValue(new Error("offline"));

    for (let i = 0; i < 20; i++) await flushWorkLogQueue();
    expect(queued()).toEqual([payload]);

    mockFetch.mockReset();
    mockFetch.mockResolvedValue({ status: 201 });
    await flushWorkLogQueue();
    expect(queued()).toHaveLength(0);
  });

  // Un item encolado antes de este deploy es el payload pelado, con sessionId
  // numérico. El route lo sigue aceptando; la cola tiene que poder leerlo.
  it("procesa un item viejo sin envoltorio de reintentos", async () => {
    const viejo = { sessionId: 5, notes: "n", topics: [] };
    localStorage.setItem(QUEUE_KEY, JSON.stringify([viejo]));
    mockFetch.mockResolvedValue({ status: 201 });

    await flushWorkLogQueue();

    expect(bodyOf(0)).toMatchObject({ sessionId: 5 });
    expect(queued()).toHaveLength(0);
  });

  it("no hace ninguna request con la cola vacía", async () => {
    await flushWorkLogQueue();
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
