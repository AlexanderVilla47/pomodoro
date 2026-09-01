import { describe, it, expect } from "vitest";
import { minutesPerChunk } from "../efficiency";

describe("minutesPerChunk", () => {
  it("divide los minutos por la cantidad de chunks", () => {
    // 25 min en 2 chunks -> 12.5 min/chunk
    expect(minutesPerChunk(1500, 2)).toBe(12.5);
  });

  it("redondea a un decimal", () => {
    // 1500 / 60 / 3 = 8.333...
    expect(minutesPerChunk(1500, 3)).toBe(8.3);
  });

  it("soporta chunks decimales", () => {
    // 25 min en medio chunk -> 50 min/chunk
    expect(minutesPerChunk(1500, 0.5)).toBe(50);
  });

  it("retorna null con 0 chunks en vez de dividir por cero", () => {
    expect(minutesPerChunk(1500, 0)).toBeNull();
  });

  it("retorna null con chunks negativos", () => {
    expect(minutesPerChunk(1500, -2)).toBeNull();
  });

  it("retorna null si los chunks no son un número finito", () => {
    expect(minutesPerChunk(1500, NaN)).toBeNull();
    expect(minutesPerChunk(1500, Infinity)).toBeNull();
  });

  it("retorna null si los segundos no son válidos", () => {
    expect(minutesPerChunk(NaN, 2)).toBeNull();
    expect(minutesPerChunk(-100, 2)).toBeNull();
  });

  it("una sesión de 0 segundos da 0, no null", () => {
    expect(minutesPerChunk(0, 2)).toBe(0);
  });
});
