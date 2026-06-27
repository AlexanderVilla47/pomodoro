import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatsCard } from "../StatsCard";

vi.mock("gsap", () => ({
  default: { to: vi.fn((obj, { onUpdate }) => { if (onUpdate) onUpdate(); return {}; }) },
}));

describe("StatsCard", () => {
  it("renderiza el label", () => {
    render(<StatsCard label="Hoy" count={3} totalSeconds={4500} />);
    expect(screen.getByText("Hoy")).toBeDefined();
  });

  it("formatea la duración correctamente (1h 15m)", () => {
    render(<StatsCard label="Semana" count={5} totalSeconds={4500} />);
    expect(screen.getByText(/1h 15m/i)).toBeDefined();
  });

  it("muestra solo minutos cuando es menos de 1h", () => {
    render(<StatsCard label="Hoy" count={1} totalSeconds={1500} />);
    expect(screen.getByText(/25m/i)).toBeDefined();
  });

  it("muestra el count", () => {
    render(<StatsCard label="Hoy" count={7} totalSeconds={0} />);
    expect(screen.getByText("7")).toBeDefined();
  });
});
