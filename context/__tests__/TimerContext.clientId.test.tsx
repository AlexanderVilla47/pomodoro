import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TimerProvider } from "../TimerContext";
import { useTimer } from "@/hooks/useTimer";

vi.mock("gsap", () => ({
  default: {
    ticker: { add: vi.fn(), remove: vi.fn() },
    to: vi.fn(),
    fromTo: vi.fn(),
    set: vi.fn(),
    killTweensOf: vi.fn(),
    timeline: vi.fn(() => ({ from: vi.fn().mockReturnThis(), to: vi.fn().mockReturnThis() })),
  },
}));

// doLog sólo persiste la sesión si superó el mínimo loggeable (50%).
vi.mock("@/lib/timer/engine", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/timer/engine")>();
  return { ...actual, shouldLog: () => true };
});

const DEFAULT_SETTINGS = {
  id: 1,
  work_duration: 1500,
  short_break_duration: 300,
  long_break_duration: 900,
  long_break_interval: 4,
  notification_sound_enabled: false,
};

const LS_CLIENT_ID_KEY = "pomodoro_session_client_id";
const LS_END_TIME_KEY = "pomodoro_endTime";

let clock = 1_700_000_000_000;
let uuidCounter = 0;

function advance(ms: number) {
  clock += ms;
}

function TestConsumer() {
  const { status, phase, start, stop } = useTimer();
  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="phase">{phase}</span>
      <button onClick={start}>start</button>
      <button onClick={stop}>stop</button>
    </div>
  );
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return <TimerProvider settings={DEFAULT_SETTINGS}>{children}</TimerProvider>;
}

async function click(name: string) {
  await act(async () => {
    await userEvent.click(screen.getByRole("button", { name }));
  });
}

/** Todos los bodies mandados a /api/sessions, en orden. */
function sessionPayloads() {
  return vi
    .mocked(fetch)
    .mock.calls.filter(([url]) => url === "/api/sessions")
    .map(([, init]) => JSON.parse((init as RequestInit).body as string));
}

function storedIdentity() {
  const raw = localStorage.getItem(LS_CLIENT_ID_KEY);
  return raw ? JSON.parse(raw) : null;
}

beforeEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  clock = 1_700_000_000_000;
  uuidCounter = 0;
  vi.spyOn(Date, "now").mockImplementation(() => clock);
  vi.spyOn(crypto, "randomUUID").mockImplementation(
    () => `uuid-${++uuidCounter}` as `${string}-${string}-${string}-${string}-${string}`
  );
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 201 }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("TimerContext — identidad de la sesión", () => {
  it("manda un client_id junto con la sesión", async () => {
    render(<TestConsumer />, { wrapper: Wrapper });
    await click("start");
    advance(60_000);
    await click("stop");

    expect(sessionPayloads()[0].client_id).toBe("uuid-1");
  });

  // Si dos sesiones compartieran el id, la segunda colisionaría con la primera
  // en el upsert y se perdería: quedaría una sola fila para dos pomodoros.
  it("no reusa el client_id de la sesión anterior", async () => {
    render(<TestConsumer />, { wrapper: Wrapper });

    await click("start");
    advance(60_000);
    await click("stop");

    await click("start");
    advance(60_000);
    await click("stop");

    const [first, second] = sessionPayloads();
    expect(first.client_id).toBe("uuid-1");
    expect(second.client_id).toBe("uuid-2");
  });

  it("espeja la identidad en localStorage al arrancar el foco", async () => {
    render(<TestConsumer />, { wrapper: Wrapper });
    await click("start");

    expect(storedIdentity()).toEqual({ startedAt: clock, clientId: "uuid-1" });
  });

  it("rehidrata el client_id de una sesión en curso tras remontar", async () => {
    const startedAt = clock;
    localStorage.setItem(
      LS_END_TIME_KEY,
      JSON.stringify({ endTime: clock + 900_000, phase: "work", sessionCount: 0 })
    );
    localStorage.setItem(
      LS_CLIENT_ID_KEY,
      JSON.stringify({ startedAt, clientId: "uuid-viejo" })
    );

    render(<TestConsumer />, { wrapper: Wrapper });
    expect(screen.getByTestId("status").textContent).toBe("running");

    advance(60_000);
    await click("stop");

    expect(sessionPayloads()[0].client_id).toBe("uuid-viejo");
  });

  // La identidad lleva su startedAt igual que distractionsRef: una guardada de
  // una sesión que ya terminó se invalida sola, sin depender de que algún camino
  // del ciclo de vida se acuerde de limpiarla.
  it("descarta una identidad que no es de la sesión en curso", async () => {
    localStorage.setItem(
      LS_CLIENT_ID_KEY,
      JSON.stringify({ startedAt: clock - 999_999, clientId: "uuid-de-otra" })
    );

    render(<TestConsumer />, { wrapper: Wrapper });
    await click("start");
    advance(60_000);
    await click("stop");

    expect(sessionPayloads()[0].client_id).toBe("uuid-1");
  });

  it("limpia la identidad guardada cuando la sesión se corta", async () => {
    render(<TestConsumer />, { wrapper: Wrapper });
    await click("start");
    advance(60_000);
    await click("stop");

    expect(storedIdentity()).toBeNull();
  });
});
