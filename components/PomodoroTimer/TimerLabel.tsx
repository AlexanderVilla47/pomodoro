"use client";

import { memo } from "react";
import type { TimerPhase } from "@/lib/timer/constants";

const PHASE_LABELS: Record<TimerPhase, string> = {
  work: "Enfoque",
  short_break: "Descanso corto",
  long_break: "Descanso largo",
};

interface TimerLabelProps {
  remaining: number;
  phase: TimerPhase;
}

function formatTime(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export const TimerLabel = memo(function TimerLabel({ remaining, phase }: TimerLabelProps) {
  return (
    <div className="flex flex-col items-center gap-1 select-none">
      <span
        className="text-6xl font-bold tabular-nums text-white"
        role="timer"
        aria-live="polite"
        aria-label={`${formatTime(remaining)} restantes`}
      >
        {formatTime(remaining)}
      </span>
      <span className="text-sm uppercase tracking-widest text-white/50">
        {PHASE_LABELS[phase]}
      </span>
    </div>
  );
});
