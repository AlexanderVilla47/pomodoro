import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { JournalBridge } from "../JournalBridge";

const mockUseTimerContext = vi.fn();

vi.mock("@/context/TimerContext", () => ({
  useTimerContext: () => mockUseTimerContext(),
}));

describe("JournalBridge", () => {
  it("llama onWorkStart cuando phase=work y status=running", () => {
    mockUseTimerContext.mockReturnValue({ phase: "work", status: "running" });
    const onWorkStart = vi.fn();
    render(<JournalBridge onWorkStart={onWorkStart} />);
    expect(onWorkStart).toHaveBeenCalledOnce();
  });

  it("NO llama onWorkStart en short_break running", () => {
    mockUseTimerContext.mockReturnValue({ phase: "short_break", status: "running" });
    const onWorkStart = vi.fn();
    render(<JournalBridge onWorkStart={onWorkStart} />);
    expect(onWorkStart).not.toHaveBeenCalled();
  });

  it("NO llama onWorkStart en work paused", () => {
    mockUseTimerContext.mockReturnValue({ phase: "work", status: "paused" });
    const onWorkStart = vi.fn();
    render(<JournalBridge onWorkStart={onWorkStart} />);
    expect(onWorkStart).not.toHaveBeenCalled();
  });

  it("NO llama onWorkStart en work idle", () => {
    mockUseTimerContext.mockReturnValue({ phase: "work", status: "idle" });
    const onWorkStart = vi.fn();
    render(<JournalBridge onWorkStart={onWorkStart} />);
    expect(onWorkStart).not.toHaveBeenCalled();
  });
});
