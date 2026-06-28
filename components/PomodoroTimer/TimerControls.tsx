"use client";

import type { TimerStatus } from "@/lib/timer/constants";

interface TimerControlsProps {
  status: TimerStatus;
  accentColor?: string;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onSkip: () => void;
}

const btnBase =
  "px-6 py-2 rounded-full font-semibold transition-all duration-200 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50";

export function TimerControls({
  status,
  accentColor = "var(--color-mint)",
  onStart,
  onPause,
  onResume,
  onStop,
  onSkip,
}: TimerControlsProps) {
  return (
    <div className="flex gap-3 items-center">
      {(status === "idle" || status === "completed") && (
        <button
          onClick={onStart}
          aria-label="Start"
          className={`${btnBase} text-white hover:brightness-110`}
          style={{ backgroundColor: accentColor }}
        >
          Start
        </button>
      )}

      {status === "running" && (
        <>
          <button
            onClick={onPause}
            aria-label="Pause"
            className={`${btnBase} bg-white/10 text-white hover:bg-white/20`}
          >
            Pause
          </button>
          <button
            onClick={onStop}
            aria-label="Stop"
            className={`${btnBase} bg-white/10 text-white hover:bg-white/20`}
          >
            Stop
          </button>
          <button
            onClick={onSkip}
            aria-label="Skip"
            className={`${btnBase} bg-white/5 text-white/50 hover:text-white`}
          >
            Skip
          </button>
        </>
      )}

      {status === "paused" && (
        <>
          <button
            onClick={onResume}
            aria-label="Resume"
            className={`${btnBase} text-white hover:brightness-110`}
            style={{ backgroundColor: accentColor }}
          >
            Resume
          </button>
          <button
            onClick={onStop}
            aria-label="Stop"
            className={`${btnBase} bg-white/10 text-white hover:bg-white/20`}
          >
            Stop
          </button>
          <button
            onClick={onSkip}
            aria-label="Skip"
            className={`${btnBase} bg-white/5 text-white/50 hover:text-white`}
          >
            Skip
          </button>
        </>
      )}
    </div>
  );
}
