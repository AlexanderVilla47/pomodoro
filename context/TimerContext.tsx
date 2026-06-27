"use client";

import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import gsap from "gsap";
import { transition } from "@/lib/timer/stateMachine";
import { computeRemaining, shouldLog } from "@/lib/timer/engine";
import { useSessionLogger } from "@/hooks/useSessionLogger";
import type { MachineState } from "@/lib/timer/stateMachine";
import type { Settings } from "@/lib/db/queries/settings";

interface TimerContextValue {
  status: MachineState["status"];
  phase: MachineState["phase"];
  sessionCount: number;
  remaining: number;
  start: () => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  skip: () => void;
}

const TimerContext = createContext<TimerContextValue | null>(null);

const LS_KEY = "pomodoro_endTime";

function phaseDuration(phase: MachineState["phase"], settings: Settings): number {
  if (phase === "work") return settings.work_duration * 1000;
  if (phase === "short_break") return settings.short_break_duration * 1000;
  return settings.long_break_duration * 1000;
}

export function TimerProvider({
  children,
  settings,
}: {
  children: React.ReactNode;
  settings: Settings;
}) {
  const [machine, setMachine] = useState<MachineState>({
    status: "idle",
    phase: "work",
    sessionCount: 0,
  });
  const [remaining, setRemaining] = useState(() => phaseDuration("work", settings));

  const endTimeRef = useRef<number | null>(null);
  const pausedRemainingRef = useRef<number>(phaseDuration("work", settings));
  const sessionStartRef = useRef<number>(Date.now());
  const machineRef = useRef(machine);
  machineRef.current = machine;

  const [statsVersion, setStatsVersion] = useState(0);
  const { logSession } = useSessionLogger(() => setStatsVersion((v) => v + 1));

  const doLog = useCallback(
    (m: MachineState, elapsed: number, completed: boolean) => {
      if (m.phase === "work" && (completed || shouldLog(elapsed / 1000, settings.work_duration))) {
        logSession({
          type: m.phase,
          started_at: new Date(sessionStartRef.current).toISOString(),
          ended_at: new Date().toISOString(),
          planned_duration: settings.work_duration,
          actual_duration: Math.round(elapsed / 1000),
          completed,
        });
      }
    },
    [logSession, settings.work_duration]
  );

  useEffect(() => {
    const tick = () => {
      const m = machineRef.current;
      if (m.status !== "running" || endTimeRef.current === null) return;
      const rem = computeRemaining(endTimeRef.current, Date.now());
      setRemaining(rem);
      if (rem <= 0) {
        const elapsed = phaseDuration(m.phase, settings);
        doLog(m, elapsed, true);
        endTimeRef.current = null;
        localStorage.removeItem(LS_KEY);
        setMachine((prev) => transition(prev, "COMPLETE"));
      }
    };
    gsap.ticker.add(tick);
    return () => gsap.ticker.remove(tick);
  }, [settings, doLog]);

  useEffect(() => {
    if (machine.status === "idle" || machine.status === "completed") {
      const dur = phaseDuration(machine.phase, settings);
      setRemaining(dur);
      pausedRemainingRef.current = dur;
    }
  }, [machine.phase, machine.status, settings]);

  useEffect(() => {
    const saved = localStorage.getItem(LS_KEY);
    if (saved) {
      const endTime = Number(saved);
      if (endTime > Date.now()) {
        endTimeRef.current = endTime;
        setRemaining(computeRemaining(endTime, Date.now()));
        setMachine((prev) => ({ ...prev, status: "running" }));
      } else {
        localStorage.removeItem(LS_KEY);
      }
    }
  }, []);

  const start = useCallback(() => {
    setMachine((prev) => {
      const next = transition(prev, "START");
      if (next.status === "running") {
        const dur = phaseDuration(next.phase, settings);
        endTimeRef.current = Date.now() + dur;
        pausedRemainingRef.current = dur;
        sessionStartRef.current = Date.now();
        localStorage.setItem(LS_KEY, String(endTimeRef.current));
      }
      return next;
    });
  }, [settings]);

  const pause = useCallback(() => {
    setMachine((prev) => {
      if (prev.status !== "running") return prev;
      pausedRemainingRef.current = remaining;
      endTimeRef.current = null;
      localStorage.removeItem(LS_KEY);
      return transition(prev, "PAUSE");
    });
  }, [remaining]);

  const resume = useCallback(() => {
    setMachine((prev) => {
      if (prev.status !== "paused") return prev;
      endTimeRef.current = Date.now() + pausedRemainingRef.current;
      localStorage.setItem(LS_KEY, String(endTimeRef.current));
      return transition(prev, "RESUME");
    });
  }, []);

  const stop = useCallback(() => {
    setMachine((prev) => {
      if (prev.status !== "running" && prev.status !== "paused") return prev;
      const elapsed =
        prev.status === "running" && endTimeRef.current
          ? phaseDuration(prev.phase, settings) - computeRemaining(endTimeRef.current, Date.now())
          : phaseDuration(prev.phase, settings) - pausedRemainingRef.current;
      doLog(prev, elapsed, false);
      endTimeRef.current = null;
      localStorage.removeItem(LS_KEY);
      return transition(prev, "STOP");
    });
  }, [settings, doLog]);

  const skip = useCallback(() => {
    setMachine((prev) => {
      endTimeRef.current = null;
      localStorage.removeItem(LS_KEY);
      return transition(prev, "SKIP");
    });
  }, []);

  return (
    <TimerContext.Provider
      value={{
        status: machine.status,
        phase: machine.phase,
        sessionCount: machine.sessionCount,
        remaining,
        start,
        pause,
        resume,
        stop,
        skip,
      }}
    >
      {children}
    </TimerContext.Provider>
  );
}

export function useTimerContext() {
  const ctx = useContext(TimerContext);
  if (!ctx) throw new Error("useTimerContext must be used inside TimerProvider");
  return ctx;
}

