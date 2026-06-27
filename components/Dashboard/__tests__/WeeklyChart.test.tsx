import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { WeeklyChart } from "../WeeklyChart";

const EMPTY_DAYS = Array.from({ length: 7 }, (_, i) => ({ day: i, count: 0, totalSeconds: 0 }));

describe("WeeklyChart", () => {
  it("renderiza 7 barras", () => {
    const { container } = render(<WeeklyChart days={EMPTY_DAYS} todayIndex={0} />);
    const bars = container.querySelectorAll("[data-bar]");
    expect(bars.length).toBe(7);
  });

  it("la barra de hoy tiene clase destacada", () => {
    const { container } = render(<WeeklyChart days={EMPTY_DAYS} todayIndex={3} />);
    const todayBar = container.querySelector("[data-bar='3']");
    expect(todayBar?.className).toContain("coral");
  });

  it("barras proporcionales al máximo valor", () => {
    const days = EMPTY_DAYS.map((d, i) => ({
      ...d,
      totalSeconds: i === 0 ? 3600 : i === 1 ? 1800 : 0,
    }));
    const { container } = render(<WeeklyChart days={days} todayIndex={6} />);
    const bar0 = container.querySelector("[data-bar='0']") as HTMLElement;
    const bar1 = container.querySelector("[data-bar='1']") as HTMLElement;
    const height0 = parseFloat(bar0?.style?.height ?? "0");
    const height1 = parseFloat(bar1?.style?.height ?? "0");
    expect(height0).toBeGreaterThan(height1);
  });
});
