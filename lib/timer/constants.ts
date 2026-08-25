export const MIN_LOGGABLE_RATIO = 0.5;

// Tope defensivo de distracciones por sesión. El cliente lo respeta al
// acumular y el server lo vuelve a aplicar sobre lo que le llega, así un
// payload manipulado no puede meter un array gigante en la base.
export const MAX_DISTRACTION_MARKS = 200;

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
