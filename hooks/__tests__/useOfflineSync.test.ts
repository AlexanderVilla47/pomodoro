import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

vi.mock("@/hooks/useSessionLogger", () => ({ flushSessionQueue: vi.fn() }));
vi.mock("@/hooks/useWorkLogger", () => ({ flushWorkLogQueue: vi.fn() }));

import { useOfflineSync } from "../useOfflineSync";
import { flushSessionQueue } from "@/hooks/useSessionLogger";
import { flushWorkLogQueue } from "@/hooks/useWorkLogger";

const flushSessions = vi.mocked(flushSessionQueue);
const flushWorkLogs = vi.mocked(flushWorkLogQueue);

beforeEach(() => {
  vi.clearAllMocks();
  flushSessions.mockResolvedValue(0);
  flushWorkLogs.mockResolvedValue(0);
});

/** Deja pasar los microtasks pendientes. */
async function settle() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

describe("useOfflineSync", () => {
  it("vacía las dos colas al montarse", async () => {
    renderHook(() => useOfflineSync());
    await settle();

    expect(flushSessions).toHaveBeenCalledTimes(1);
    expect(flushWorkLogs).toHaveBeenCalledTimes(1);
  });

  it("vuelve a vaciarlas cuando se recupera la conexión", async () => {
    renderHook(() => useOfflineSync());
    await settle();

    await act(async () => {
      window.dispatchEvent(new Event("online"));
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(flushSessions).toHaveBeenCalledTimes(2);
    expect(flushWorkLogs).toHaveBeenCalledTimes(2);
  });

  // El punto entero del hook. Un work_log no se puede resolver si su sesión
  // todavía no llegó: hasta ahora cada cola vaciaba por su cuenta en el evento
  // `online` y era una carrera.
  it("no toca los work logs hasta que terminaron las sesiones", async () => {
    let liberarSesiones!: (n: number) => void;
    flushSessions.mockReturnValue(
      new Promise<number>((resolve) => { liberarSesiones = resolve; })
    );

    renderHook(() => useOfflineSync());
    await settle();

    expect(flushSessions).toHaveBeenCalledTimes(1);
    expect(flushWorkLogs).not.toHaveBeenCalled();

    await act(async () => {
      liberarSesiones(1);
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(flushWorkLogs).toHaveBeenCalledTimes(1);
  });

  it("vacía los work logs aunque las sesiones fallen", async () => {
    flushSessions.mockRejectedValue(new Error("boom"));

    renderHook(() => useOfflineSync());
    await settle();

    expect(flushWorkLogs).toHaveBeenCalledTimes(1);
  });

  it("avisa por onSynced cuando algo se movió", async () => {
    flushSessions.mockResolvedValue(1);
    const onSynced = vi.fn();

    renderHook(() => useOfflineSync(onSynced));
    await settle();

    expect(onSynced).toHaveBeenCalledTimes(1);
  });

  it("no avisa si no había nada encolado", async () => {
    const onSynced = vi.fn();

    renderHook(() => useOfflineSync(onSynced));
    await settle();

    expect(onSynced).not.toHaveBeenCalled();
  });

  // Dos vaciados en paralelo leerían y escribirían la misma cola pisándose.
  it("no arranca un vaciado nuevo si ya hay uno corriendo", async () => {
    let liberarSesiones!: (n: number) => void;
    flushSessions.mockReturnValue(
      new Promise<number>((resolve) => { liberarSesiones = resolve; })
    );

    renderHook(() => useOfflineSync());
    await settle();

    await act(async () => {
      window.dispatchEvent(new Event("online"));
      window.dispatchEvent(new Event("online"));
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(flushSessions).toHaveBeenCalledTimes(1);

    await act(async () => {
      liberarSesiones(0);
      await new Promise((r) => setTimeout(r, 0));
    });
  });

  it("desengancha el listener al desmontar", async () => {
    const { unmount } = renderHook(() => useOfflineSync());
    await settle();
    unmount();

    await act(async () => {
      window.dispatchEvent(new Event("online"));
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(flushSessions).toHaveBeenCalledTimes(1);
  });
});
