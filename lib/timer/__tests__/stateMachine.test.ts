import { describe, it, expect } from "vitest";
import { transition } from "../stateMachine";
import type { MachineState } from "../stateMachine";

const idle: MachineState = { status: "idle", phase: "work", sessionCount: 0 };

describe("transition — transiciones válidas", () => {
  it("idle → running con START", () => {
    const next = transition(idle, "START");
    expect(next.status).toBe("running");
  });

  it("running → paused con PAUSE", () => {
    const running = transition(idle, "START");
    const next = transition(running, "PAUSE");
    expect(next.status).toBe("paused");
  });

  it("paused → running con RESUME", () => {
    const paused = transition(transition(idle, "START"), "PAUSE");
    const next = transition(paused, "RESUME");
    expect(next.status).toBe("running");
  });

  it("running → completed con COMPLETE", () => {
    const running = transition(idle, "START");
    const next = transition(running, "COMPLETE");
    expect(next.status).toBe("completed");
  });

  it("COMPLETE incrementa sessionCount cuando phase=work", () => {
    const running = transition(idle, "START");
    const next = transition(running, "COMPLETE");
    expect(next.sessionCount).toBe(1);
  });

  it("completed → running con START (siguiente sesión)", () => {
    const completed = transition(transition(idle, "START"), "COMPLETE");
    const next = transition(completed, "START");
    expect(next.status).toBe("running");
  });

  it("running → idle con STOP", () => {
    const running = transition(idle, "START");
    const next = transition(running, "STOP");
    expect(next.status).toBe("idle");
  });

  it("paused → idle con STOP", () => {
    const paused = transition(transition(idle, "START"), "PAUSE");
    const next = transition(paused, "STOP");
    expect(next.status).toBe("idle");
  });

  it("RESET desde cualquier estado vuelve a idle con sessionCount=0", () => {
    const running = transition(idle, "START");
    const next = transition(running, "RESET");
    expect(next.status).toBe("idle");
    expect(next.sessionCount).toBe(0);
  });
});

describe("transition — rotación de phase", () => {
  it("después de work completo va a short_break (sesión 1)", () => {
    const running = transition(idle, "START");
    const completed = transition(running, "COMPLETE");
    const next = transition(completed, "START");
    expect(next.phase).toBe("short_break");
  });

  it("después de short_break va a work", () => {
    const afterWork = transition(transition(idle, "START"), "COMPLETE");
    const breakRunning = transition(afterWork, "START");
    const breakCompleted = transition(breakRunning, "COMPLETE");
    const next = transition(breakCompleted, "START");
    expect(next.phase).toBe("work");
  });

  it("en sesión 4 (longBreakInterval) va a long_break", () => {
    let state: MachineState = { status: "idle", phase: "work", sessionCount: 3 };
    state = transition(state, "START");
    state = transition(state, "COMPLETE");
    state = transition(state, "START");
    expect(state.phase).toBe("long_break");
  });

  it("SKIP en running avanza a la siguiente phase sin incrementar sessionCount (break skip)", () => {
    const afterWork = transition(transition(idle, "START"), "COMPLETE");
    const breakRunning = transition(afterWork, "START");
    const next = transition(breakRunning, "SKIP");
    expect(next.phase).toBe("work");
    expect(next.status).toBe("idle");
  });
});

describe("transition — acciones inválidas no-op", () => {
  it("PAUSE en idle no cambia estado", () => {
    const next = transition(idle, "PAUSE");
    expect(next.status).toBe("idle");
  });

  it("RESUME en idle no cambia estado", () => {
    const next = transition(idle, "RESUME");
    expect(next.status).toBe("idle");
  });

  it("COMPLETE en idle no cambia estado", () => {
    const next = transition(idle, "COMPLETE");
    expect(next.status).toBe("idle");
  });

  it("START en running no cambia estado", () => {
    const running = transition(idle, "START");
    const next = transition(running, "START");
    expect(next.status).toBe("running");
  });
});
