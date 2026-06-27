import { describe, it, expect } from "vitest";
import {
  computeRemaining,
  shouldLog,
  isBreakPhase,
  getNextPhase,
} from "../engine";

describe("computeRemaining", () => {
  it("retorna ms restantes cuando hay tiempo", () => {
    const now = 1_000_000;
    const endTimestamp = 1_060_000;
    expect(computeRemaining(endTimestamp, now)).toBe(60_000);
  });

  it("retorna 0 cuando ya se venció el tiempo", () => {
    const now = 1_100_000;
    const endTimestamp = 1_060_000;
    expect(computeRemaining(endTimestamp, now)).toBe(0);
  });

  it("retorna 0 exacto cuando now === endTimestamp", () => {
    expect(computeRemaining(5000, 5000)).toBe(0);
  });

  it("no retorna valores negativos", () => {
    expect(computeRemaining(100, 999)).toBeGreaterThanOrEqual(0);
  });
});

describe("shouldLog", () => {
  it("retorna true cuando elapsed / total >= 0.5", () => {
    expect(shouldLog(750, 1500)).toBe(true);
  });

  it("retorna true cuando se completó exactamente el 50%", () => {
    expect(shouldLog(750, 1500)).toBe(true);
  });

  it("retorna false cuando elapsed / total < 0.5", () => {
    expect(shouldLog(749, 1500)).toBe(false);
  });

  it("retorna true cuando elapsed === total (completado)", () => {
    expect(shouldLog(1500, 1500)).toBe(true);
  });

  it("retorna false cuando elapsed es 0", () => {
    expect(shouldLog(0, 1500)).toBe(false);
  });

  it("retorna false si total es 0 para evitar división por cero", () => {
    expect(shouldLog(0, 0)).toBe(false);
  });
});

describe("isBreakPhase", () => {
  it("retorna false para 'work'", () => {
    expect(isBreakPhase("work")).toBe(false);
  });

  it("retorna true para 'short_break'", () => {
    expect(isBreakPhase("short_break")).toBe(true);
  });

  it("retorna true para 'long_break'", () => {
    expect(isBreakPhase("long_break")).toBe(true);
  });
});

describe("getNextPhase", () => {
  it("work después de 1 sesión → short_break", () => {
    expect(getNextPhase("work", 4, 1)).toBe("short_break");
  });

  it("work después de 4 sesiones → long_break", () => {
    expect(getNextPhase("work", 4, 4)).toBe("long_break");
  });

  it("work después de 8 sesiones → long_break", () => {
    expect(getNextPhase("work", 4, 8)).toBe("long_break");
  });

  it("work después de 2 sesiones → short_break", () => {
    expect(getNextPhase("work", 4, 2)).toBe("short_break");
  });

  it("short_break siempre va a work", () => {
    expect(getNextPhase("short_break", 4, 1)).toBe("work");
  });

  it("long_break siempre va a work", () => {
    expect(getNextPhase("long_break", 4, 4)).toBe("work");
  });
});
