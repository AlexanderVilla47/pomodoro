"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { useTimer } from "@/hooks/useTimer";
import { useSettings } from "@/hooks/useSettings";
import { TimerRing } from "./TimerRing";
import { TimerLabel } from "./TimerLabel";
import { SessionProgress } from "./SessionProgress";
import { TimerControls } from "./TimerControls";
import { QuoteDisplay } from "./QuoteDisplay";

interface PomodoroTimerProps {
  labelColor?: string;
}

export function PomodoroTimer({ labelColor }: PomodoroTimerProps) {
  const { status, phase, sessionCount, remaining, start, pause, resume, stop, skip } = useTimer();
  const { settings } = useSettings();
  const containerRef = useRef<HTMLDivElement>(null);
  const prevPhaseRef = useRef(phase);

  const total = settings
    ? phase === "work"
      ? settings.work_duration * 1000
      : phase === "short_break"
        ? settings.short_break_duration * 1000
        : settings.long_break_duration * 1000
    : 1500000;

  // Color del acento: etiqueta durante trabajo, mint durante descanso
  const accentColor = labelColor ?? "var(--color-mint)";

  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    gsap.killTweensOf(el);
    gsap.set(el, { clearProps: "opacity,scale" });
    const tween = gsap.from(el, {
      scale: 0.8,
      opacity: 0,
      duration: 0.6,
      ease: "elastic.out(1, 0.5)",
    });
    return () => { tween.kill(); };
  }, []);

  useEffect(() => {
    if (phase !== prevPhaseRef.current && containerRef.current) {
      gsap.to(containerRef.current, {
        scale: 1.04,
        duration: 0.15,
        yoyo: true,
        repeat: 1,
        ease: "power2.out",
      });
      prevPhaseRef.current = phase;
    }
  }, [phase]);

  useEffect(() => {
    if (!containerRef.current) return;
    if (status === "paused") {
      gsap.to(containerRef.current, {
        scale: 0.97,
        duration: 1.2,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
        id: "breathe",
      });
    } else {
      gsap.killTweensOf(containerRef.current, "scale");
      gsap.set(containerRef.current, { scale: 1 });
    }
  }, [status]);

  return (
    <div
      ref={containerRef}
      className="relative flex flex-col items-center gap-6"
      data-testid="pomodoro-timer"
    >
      <div className="relative flex items-center justify-center">
        <TimerRing remaining={remaining} total={total} phase={phase} accentColor={accentColor} />
        <div className="absolute inset-0 flex items-center justify-center">
          <TimerLabel remaining={remaining} phase={phase} />
        </div>
      </div>
      <SessionProgress
        sessionCount={sessionCount}
        longBreakInterval={settings?.long_break_interval ?? 4}
      />
      <TimerControls
        status={status}
        accentColor={accentColor}
        onStart={start}
        onPause={pause}
        onResume={resume}
        onStop={stop}
        onSkip={skip}
      />
      <QuoteDisplay phase={phase} status={status} />
    </div>
  );
}
