import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { TimerRing } from "../TimerRing";

const RADIUS = 120;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

describe("TimerRing", () => {
  it("renderiza un SVG con el círculo de progreso", () => {
    const { container } = render(
      <TimerRing remaining={1500000} total={1500000} phase="work" />
    );
    const circle = container.querySelector("circle.progress");
    expect(circle).not.toBeNull();
  });

  it("strokeDashoffset es 0 cuando remaining === total (100%)", () => {
    const { container } = render(
      <TimerRing remaining={1500000} total={1500000} phase="work" />
    );
    const circle = container.querySelector("circle.progress") as SVGCircleElement;
    const offset = parseFloat(circle.getAttribute("stroke-dashoffset") ?? "0");
    expect(offset).toBeCloseTo(0, 1);
  });

  it("strokeDashoffset es circunferencia/2 cuando remaining es 50%", () => {
    const { container } = render(
      <TimerRing remaining={750000} total={1500000} phase="work" />
    );
    const circle = container.querySelector("circle.progress") as SVGCircleElement;
    const offset = parseFloat(circle.getAttribute("stroke-dashoffset") ?? "0");
    expect(offset).toBeCloseTo(CIRCUMFERENCE / 2, 1);
  });

  it("strokeDashoffset es circunferencia cuando remaining es 0 (agotado)", () => {
    const { container } = render(
      <TimerRing remaining={0} total={1500000} phase="work" />
    );
    const circle = container.querySelector("circle.progress") as SVGCircleElement;
    const offset = parseFloat(circle.getAttribute("stroke-dashoffset") ?? "0");
    expect(offset).toBeCloseTo(CIRCUMFERENCE, 1);
  });

  it("usa color coral para phase work", () => {
    const { container } = render(
      <TimerRing remaining={1500000} total={1500000} phase="work" />
    );
    const circle = container.querySelector("circle.progress") as SVGCircleElement;
    expect(circle.getAttribute("stroke")).toContain("coral");
  });

  it("usa color mint para phase short_break", () => {
    const { container } = render(
      <TimerRing remaining={300000} total={300000} phase="short_break" />
    );
    const circle = container.querySelector("circle.progress") as SVGCircleElement;
    expect(circle.getAttribute("stroke")).toContain("mint");
  });
});
