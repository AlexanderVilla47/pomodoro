import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DistractionButton } from "../DistractionButton";

vi.mock("gsap", () => ({
  default: {
    fromTo: vi.fn(),
    to: vi.fn(),
    set: vi.fn(),
    killTweensOf: vi.fn(),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("DistractionButton", () => {
  it("muestra el label", () => {
    render(<DistractionButton count={0} onMark={vi.fn()} />);
    expect(screen.getByRole("button", { name: /distra/i })).toBeInTheDocument();
  });

  it("llama a onMark en cada tap, sin confirmación", async () => {
    const onMark = vi.fn();
    render(<DistractionButton count={0} onMark={onMark} />);
    const btn = screen.getByRole("button", { name: /distra/i });
    await userEvent.click(btn);
    await userEvent.click(btn);
    expect(onMark).toHaveBeenCalledTimes(2);
  });

  it("no muestra contador cuando no hubo distracciones", () => {
    render(<DistractionButton count={0} onMark={vi.fn()} />);
    expect(screen.queryByTestId("distraction-count")).toBeNull();
  });

  it("muestra el contador cuando hay al menos una", () => {
    render(<DistractionButton count={3} onMark={vi.fn()} />);
    expect(screen.getByTestId("distraction-count").textContent).toBe("3");
  });
});
