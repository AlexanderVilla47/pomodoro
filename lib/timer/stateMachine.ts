import type { TimerPhase, TimerStatus, TimerAction } from "./constants";
import { DEFAULT_LONG_BREAK_INTERVAL } from "./constants";

export type { TimerPhase, TimerStatus, TimerAction };

export interface MachineState {
  status: TimerStatus;
  phase: TimerPhase;
  sessionCount: number;
}

function nextPhase(state: MachineState): TimerPhase {
  if (state.phase !== "work") return "work";
  if (state.sessionCount > 0 && state.sessionCount % DEFAULT_LONG_BREAK_INTERVAL === 0) return "long_break";
  return "short_break";
}

export function transition(state: MachineState, action: TimerAction): MachineState {
  const { status, phase, sessionCount } = state;

  switch (action) {
    case "START": {
      if (status === "idle" || status === "completed") {
        const newPhase = status === "completed" ? nextPhase(state) : phase;
        return { status: "running", phase: newPhase, sessionCount };
      }
      return state;
    }

    case "PAUSE": {
      if (status === "running") return { ...state, status: "paused" };
      return state;
    }

    case "RESUME": {
      if (status === "paused") return { ...state, status: "running" };
      return state;
    }

    case "COMPLETE": {
      if (status === "running" || status === "paused") {
        const newCount = phase === "work" ? sessionCount + 1 : sessionCount;
        return { status: "completed", phase, sessionCount: newCount };
      }
      return state;
    }

    case "STOP": {
      if (status === "running" || status === "paused") {
        return { status: "idle", phase: "work", sessionCount };
      }
      return state;
    }

    case "SKIP": {
      if (status === "running" || status === "paused") {
        const skippedPhase = nextPhase(state);
        return { status: "idle", phase: skippedPhase, sessionCount };
      }
      return state;
    }

    case "RESET": {
      return { status: "idle", phase: "work", sessionCount: 0 };
    }

    default:
      return state;
  }
}
