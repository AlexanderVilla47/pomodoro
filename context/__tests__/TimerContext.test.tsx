import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TimerProvider } from "../TimerContext";
import { useTimer } from "@/hooks/useTimer";

vi.mock("gsap", () => ({
  default: {
    ticker: { add: vi.fn(), remove: vi.fn() },
    to: vi.fn(),
    timeline: vi.fn(() => ({ from: vi.fn().mockReturnThis(), to: vi.fn().mockReturnThis() })),
  },
}));

const DEFAULT_SETTINGS = {
  id: 1,
  work_duration: 1500,
  short_break_duration: 300,
  long_break_duration: 900,
  long_break_interval: 4,
  notification_sound_enabled: false,
};

function mockFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn()
      .mockResolvedValue({ ok: true, status: 201, json: async () => ({ id: 1 }) })
  );
}

function TestConsumer() {
  const { status, phase, sessionCount, remaining, start, pause, resume, stop } = useTimer();
  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="phase">{phase}</span>
      <span data-testid="count">{sessionCount}</span>
      <span data-testid="remaining">{remaining}</span>
      <button onClick={start}>start</button>
      <button onClick={pause}>pause</button>
      <button onClick={resume}>resume</button>
      <button onClick={stop}>stop</button>
    </div>
  );
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return <TimerProvider settings={DEFAULT_SETTINGS}>{children}</TimerProvider>;
}

beforeEach(() => {
  vi.restoreAllMocks();
  mockFetch();
  localStorage.clear();
});

describe("TimerContext — estado inicial", () => {
  it("empieza en idle con phase work", () => {
    render(<TestConsumer />, { wrapper: Wrapper });
    expect(screen.getByTestId("status").textContent).toBe("idle");
    expect(screen.getByTestId("phase").textContent).toBe("work");
    expect(screen.getByTestId("count").textContent).toBe("0");
  });

  it("remaining inicial es work_duration (1500s en ms)", () => {
    render(<TestConsumer />, { wrapper: Wrapper });
    expect(screen.getByTestId("remaining").textContent).toBe("1500000");
  });
});

describe("TimerContext — transiciones", () => {
  it("start() cambia status a running", async () => {
    render(<TestConsumer />, { wrapper: Wrapper });
    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: "start" }));
    });
    expect(screen.getByTestId("status").textContent).toBe("running");
  });

  it("pause() desde running cambia a paused", async () => {
    render(<TestConsumer />, { wrapper: Wrapper });
    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: "start" }));
    });
    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: "pause" }));
    });
    expect(screen.getByTestId("status").textContent).toBe("paused");
  });

  it("resume() desde paused vuelve a running", async () => {
    render(<TestConsumer />, { wrapper: Wrapper });
    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: "start" }));
    });
    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: "pause" }));
    });
    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: "resume" }));
    });
    expect(screen.getByTestId("status").textContent).toBe("running");
  });

  it("stop() vuelve a idle", async () => {
    render(<TestConsumer />, { wrapper: Wrapper });
    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: "start" }));
    });
    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: "stop" }));
    });
    expect(screen.getByTestId("status").textContent).toBe("idle");
  });
});
