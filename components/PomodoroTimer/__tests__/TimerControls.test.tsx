import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TimerControls } from "../TimerControls";

const handlers = {
  onStart: vi.fn(),
  onPause: vi.fn(),
  onResume: vi.fn(),
  onStop: vi.fn(),
  onSkip: vi.fn(),
};

function mkProps(status: "idle" | "running" | "paused" | "completed") {
  return { status, ...handlers };
}

describe("TimerControls — botones visibles por estado", () => {
  it("idle: muestra solo Start", () => {
    render(<TimerControls {...mkProps("idle")} />);
    expect(screen.getByRole("button", { name: /start/i })).toBeDefined();
    expect(screen.queryByRole("button", { name: /pause/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /resume/i })).toBeNull();
  });

  it("running: muestra Pause, Stop y Skip; no muestra Start", () => {
    render(<TimerControls {...mkProps("running")} />);
    expect(screen.queryByRole("button", { name: /start/i })).toBeNull();
    expect(screen.getByRole("button", { name: /pause/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /stop/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /skip/i })).toBeDefined();
  });

  it("paused: muestra Resume, Stop y Skip; no muestra Pause", () => {
    render(<TimerControls {...mkProps("paused")} />);
    expect(screen.queryByRole("button", { name: /pause/i })).toBeNull();
    expect(screen.getByRole("button", { name: /resume/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /stop/i })).toBeDefined();
  });

  it("completed: muestra Start (siguiente sesión)", () => {
    render(<TimerControls {...mkProps("completed")} />);
    expect(screen.getByRole("button", { name: /start/i })).toBeDefined();
  });
});

describe("TimerControls — handlers", () => {
  it("click en Start llama onStart", async () => {
    render(<TimerControls {...mkProps("idle")} />);
    await userEvent.click(screen.getByRole("button", { name: /start/i }));
    expect(handlers.onStart).toHaveBeenCalledTimes(1);
  });

  it("click en Pause llama onPause", async () => {
    render(<TimerControls {...mkProps("running")} />);
    await userEvent.click(screen.getByRole("button", { name: /pause/i }));
    expect(handlers.onPause).toHaveBeenCalledTimes(1);
  });

  it("click en Stop llama onStop", async () => {
    render(<TimerControls {...mkProps("running")} />);
    await userEvent.click(screen.getByRole("button", { name: /stop/i }));
    expect(handlers.onStop).toHaveBeenCalledTimes(1);
  });

  it("click en Resume llama onResume", async () => {
    render(<TimerControls {...mkProps("paused")} />);
    await userEvent.click(screen.getByRole("button", { name: /resume/i }));
    expect(handlers.onResume).toHaveBeenCalledTimes(1);
  });
});
