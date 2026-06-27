export const MIN_LOGGABLE_RATIO = 0.5;

export const DEFAULT_WORK_DURATION = 1500;
export const DEFAULT_SHORT_BREAK = 300;
export const DEFAULT_LONG_BREAK = 900;
export const DEFAULT_LONG_BREAK_INTERVAL = 4;

export type TimerPhase = "work" | "short_break" | "long_break";

export type TimerStatus = "idle" | "running" | "paused" | "completed";

export type TimerAction =
  | "START"
  | "PAUSE"
  | "RESUME"
  | "COMPLETE"
  | "STOP"
  | "SKIP"
  | "RESET";
