"use client";

import type { TimerPhase } from "@/lib/timer/constants";

const RADIUS = 120;
const STROKE_WIDTH = 10;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const SIZE = (RADIUS + STROKE_WIDTH) * 2;

interface TimerRingProps {
  remaining: number;
  total: number;
  phase: TimerPhase;
}

export function TimerRing({ remaining, total, phase }: TimerRingProps) {
  const progress = total > 0 ? remaining / total : 0;
  const offset = (1 - progress) * CIRCUMFERENCE;
  const color = phase === "work" ? "var(--color-coral)" : "var(--color-mint)";

  return (
    <svg
      width={SIZE}
      height={SIZE}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      role="img"
      aria-label="Timer progress ring"
    >
      <circle
        cx={SIZE / 2}
        cy={SIZE / 2}
        r={RADIUS}
        fill="none"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth={STROKE_WIDTH}
      />
      <circle
        className="progress"
        cx={SIZE / 2}
        cy={SIZE / 2}
        r={RADIUS}
        fill="none"
        stroke={color}
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        strokeDasharray={CIRCUMFERENCE}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
        style={{ transition: "stroke 0.6s ease" }}
      />
    </svg>
  );
}
