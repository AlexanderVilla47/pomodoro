"use client";

import type { TimerPhase } from "@/lib/timer/constants";

const RADIUS = 150;
const STROKE_WIDTH = 12;
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
  const glowId = `glow-${phase}`;

  return (
    <svg
      width={SIZE}
      height={SIZE}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      overflow="visible"
      role="img"
      aria-label="Timer progress ring"
    >
      <defs>
        <filter id={glowId} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="8" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Fondo oscuro sólido dentro del ring — evita que el fondo "se vea" distinto */}
      <circle
        cx={SIZE / 2}
        cy={SIZE / 2}
        r={RADIUS - STROKE_WIDTH / 2 - 1}
        fill="var(--color-bg)"
      />

      {/* Track */}
      <circle
        cx={SIZE / 2}
        cy={SIZE / 2}
        r={RADIUS}
        fill="none"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth={STROKE_WIDTH}
      />

      {/* Progreso con glow */}
      <circle
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
        filter={`url(#${glowId})`}
        style={{ transition: "stroke 0.6s ease" }}
      />
    </svg>
  );
}
