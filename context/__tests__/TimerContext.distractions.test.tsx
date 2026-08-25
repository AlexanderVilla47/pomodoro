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

// doLog sólo persiste la sesión si superó el mínimo loggeable (50%). Para poder
// inspeccionar el payload en un test corto forzamos shouldLog a true.
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

const LS_DISTRACTIONS_KEY = "pomodoro_distractions";

let clock = 1_700_000_000_000;

function advance(ms: number) {
  clock += ms;
}

function TestConsumer() {
  const { status, phase, distractionCount, start, stop, skip, markDistraction } = useTimer();
  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="phase">{phase}</span>
      <span data-testid="distractions">{distractionCount}</span>
      <button onClick={start}>start</button>
      <button onClick={stop}>stop</button>
      <button onClick={skip}>skip</button>
      <button onClick={markDistraction}>mark</button>
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

function sessionPayload() {
  const call = vi
    .mocked(fetch)
    .mock.calls.find(([url]) => url === "/api/sessions");
  if (!call) return null;
  return JSON.parse((call[1] as RequestInit).body as string);
}

beforeEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  clock = 1_700_000_000_000;
  vi.spyOn(Date, "now").mockImplementation(() => clock);
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => ({ id: 1 }) })
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("TimerContext — registro de distracciones", () => {
  it("arranca en cero", () => {
    render(<TestConsumer />, { wrapper: Wrapper });
    expect(screen.getByTestId("distractions").textContent).toBe("0");
  });

  it("markDistraction() incrementa el contador durante el foco", async () => {
    render(<TestConsumer />, { wrapper: Wrapper });
    await click("start");
    await click("mark");
    await click("mark");
    expect(screen.getByTestId("distractions").textContent).toBe("2");
  });

  it("ignora el tap si el timer no está corriendo", async () => {
    render(<TestConsumer />, { wrapper: Wrapper });
    await click("mark");
    expect(screen.getByTestId("distractions").textContent).toBe("0");
  });

  it("ignora el tap si la fase no es de foco", async () => {
    render(<TestConsumer />, { wrapper: Wrapper });
    await click("start");
    await click("skip"); // pasa a short_break, status idle
    await click("start"); // arranca el break
    expect(screen.getByTestId("phase").textContent).not.toBe("work");
    await click("mark");
    expect(screen.getByTestId("distractions").textContent).toBe("0");
  });

  it("guarda el segundo exacto de cada tap y lo manda con la sesión", async () => {
    render(<TestConsumer />, { wrapper: Wrapper });
    await click("start");
    advance(7_000);
    await click("mark");
    advance(11_000);
    await click("mark");
    await click("stop");

    const body = sessionPayload();
    expect(body).not.toBeNull();
    expect(body.distraction_count).toBe(2);
    expect(body.distraction_marks).toEqual([7, 18]);
  });

  it("manda count 0 y array vacío si no hubo distracciones", async () => {
    render(<TestConsumer />, { wrapper: Wrapper });
    await click("start");
    advance(60_000);
    await click("stop");

    const body = sessionPayload();
    expect(body.distraction_count).toBe(0);
    expect(body.distraction_marks).toEqual([]);
  });

  it("espeja los marks en localStorage para sobrevivir un refresh", async () => {
    render(<TestConsumer />, { wrapper: Wrapper });
    await click("start");
    advance(5_000);
    await click("mark");

    const raw = localStorage.getItem(LS_DISTRACTIONS_KEY);
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw!).marks).toEqual([5]);
  });

  it("limpia el contador al empezar una sesión nueva", async () => {
    render(<TestConsumer />, { wrapper: Wrapper });
    await click("start");
    await click("mark");
    expect(screen.getByTestId("distractions").textContent).toBe("1");
    await click("stop");
    await click("start");
    expect(screen.getByTestId("distractions").textContent).toBe("0");
  });

  it("rehidrata los marks de una sesión en curso tras remontar", async () => {
    const startedAt = clock;
    localStorage.setItem(
      "pomodoro_endTime",
      JSON.stringify({ endTime: clock + 900_000, phase: "work", sessionCount: 0 })
    );
    localStorage.setItem(
      LS_DISTRACTIONS_KEY,
      JSON.stringify({ startedAt, marks: [12, 40, 61] })
    );

    render(<TestConsumer />, { wrapper: Wrapper });
    expect(screen.getByTestId("status").textContent).toBe("running");
    expect(screen.getByTestId("distractions").textContent).toBe("3");
  });
});
