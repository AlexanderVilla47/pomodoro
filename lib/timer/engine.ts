import { MIN_LOGGABLE_RATIO } from "./constants";
import type { TimerPhase } from "./constants";

export function computeRemaining(endTimestamp: number, now: number): number {
  return Math.max(0, endTimestamp - now);
}

export function shouldLog(elapsed: number, total: number): boolean {
  if (total === 0) return false;
  return elapsed / total >= MIN_LOGGABLE_RATIO;
}

export function isBreakPhase(phase: TimerPhase): boolean {
  return phase === "short_break" || phase === "long_break";
}

export function getNextPhase(
  current: TimerPhase,
  longBreakInterval: number,
  sessionCount: number
): TimerPhase {
  if (current !== "work") return "work";
  if (sessionCount > 0 && sessionCount % longBreakInterval === 0) return "long_break";
  return "short_break";
}
