"use client";

import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import gsap from "gsap";
import { transition } from "@/lib/timer/stateMachine";
import { computeRemaining, shouldLog } from "@/lib/timer/engine";
import { useSessionLogger } from "@/hooks/useSessionLogger";
import { notifySessionComplete } from "@/lib/notifications";
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
const LS_PAUSED_KEY = "pomodoro_paused_state";

function phaseDuration(phase: MachineState["phase"], settings: Settings): number {
  if (phase === "work") return settings.work_duration * 1000;
  if (phase === "short_break") return settings.short_break_duration * 1000;
  return settings.long_break_duration * 1000;
}

export function TimerProvider({
  children,
  settings,
  onSessionLogged,
  selectedLabelId,
}: {
  children: React.ReactNode;
  settings: Settings;
  onSessionLogged?: (sessionId: number | null) => void;
  selectedLabelId?: number | null;
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
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const soundTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onSessionLoggedRef = useRef(onSessionLogged);
  onSessionLoggedRef.current = onSessionLogged;

  const selectedLabelIdRef = useRef(selectedLabelId);
  selectedLabelIdRef.current = selectedLabelId;

  const { logSession } = useSessionLogger((id) => {
    onSessionLoggedRef.current?.(id);
  });

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
          label_id: selectedLabelIdRef.current ?? null,
        });
      }
    },
    [logSession, settings.work_duration]
  );

  useEffect(() => {
    const handleSessionEnd = (m: MachineState) => {
      // Sound is fired by the dedicated setTimeout effect, not here
      const elapsed = phaseDuration(m.phase, settings);
      doLog(m, elapsed, true);

      const afterComplete = transition(m, "COMPLETE");

      // Full cycle done — stop after long break, user restarts manually
      if (m.phase === "long_break") {
        endTimeRef.current = null;
        localStorage.removeItem(LS_KEY);
        setMachine(afterComplete);
        return;
      }

      const afterStart = transition(afterComplete, "START");
      if (afterStart.status === "running") {
        const nextDur = phaseDuration(afterStart.phase, settings);
        endTimeRef.current = Date.now() + nextDur;
        pausedRemainingRef.current = nextDur;
        sessionStartRef.current = Date.now();
        localStorage.setItem(LS_KEY, JSON.stringify({ endTime: endTimeRef.current, phase: afterStart.phase, sessionCount: afterStart.sessionCount }));
        setRemaining(nextDur);
      } else {
        endTimeRef.current = null;
        localStorage.removeItem(LS_KEY);
      }
      setMachine(afterStart);
    };

    const tick = () => {
      const m = machineRef.current;
      if (m.status !== "running" || endTimeRef.current === null) return;
      const rem = computeRemaining(endTimeRef.current, Date.now());
      setRemaining(rem);
      if (rem <= 0) handleSessionEnd(m);
    };

    // GSAP lag smoothing masks expired time in background tabs —
    // check wall clock directly when tab becomes visible
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      const m = machineRef.current;
      if (m.status !== "running" || endTimeRef.current === null) return;
      const rem = computeRemaining(endTimeRef.current, Date.now());
      if (rem <= 0) handleSessionEnd(m);
      else setRemaining(rem);
    };

    gsap.ticker.add(tick);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      gsap.ticker.remove(tick);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [settings, doLog]);

  // setTimeout fires at exact expiry time even in background tabs —
  // GSAP ticker can't be relied on for sound since it throttles in background
  useEffect(() => {
    if (machine.status !== "running" || endTimeRef.current === null) {
      if (soundTimeoutRef.current !== null) {
        clearTimeout(soundTimeoutRef.current);
        soundTimeoutRef.current = null;
      }
      return;
    }
    const delay = Math.max(0, endTimeRef.current - Date.now());
    const phase = machine.phase;
    soundTimeoutRef.current = setTimeout(() => {
      notifySessionComplete(phase, settingsRef.current.notification_sound_enabled);
    }, delay);
    return () => {
      if (soundTimeoutRef.current !== null) {
        clearTimeout(soundTimeoutRef.current);
        soundTimeoutRef.current = null;
      }
    };
  }, [machine.status, machine.phase]);

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
      let endTime: number;
      let savedPhase: MachineState["phase"] = "work";
      let savedSessionCount = 0;
      try {
        const parsed = JSON.parse(saved);
        endTime = parsed.endTime;
        savedPhase = parsed.phase ?? "work";
        savedSessionCount = parsed.sessionCount ?? 0;
      } catch {
        endTime = Number(saved);
      }
      if (endTime > Date.now()) {
        endTimeRef.current = endTime;
        setRemaining(computeRemaining(endTime, Date.now()));
        setMachine({ status: "running", phase: savedPhase, sessionCount: savedSessionCount });
        return;
      } else {
        localStorage.removeItem(LS_KEY);
      }
    }

    const savedPaused = localStorage.getItem(LS_PAUSED_KEY);
    if (savedPaused) {
      try {
        const { phase, sessionCount, remaining: rem } = JSON.parse(savedPaused);
        pausedRemainingRef.current = rem;
        setRemaining(rem);
        setMachine({ status: "paused", phase, sessionCount });
      } catch {
        localStorage.removeItem(LS_PAUSED_KEY);
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
        localStorage.setItem(LS_KEY, JSON.stringify({ endTime: endTimeRef.current, phase: next.phase, sessionCount: next.sessionCount }));
        localStorage.removeItem(LS_PAUSED_KEY);
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
      const next = transition(prev, "PAUSE");
      localStorage.setItem(
        LS_PAUSED_KEY,
        JSON.stringify({ phase: next.phase, sessionCount: next.sessionCount, remaining })
      );
      return next;
    });
  }, [remaining]);

  const resume = useCallback(() => {
    setMachine((prev) => {
      if (prev.status !== "paused") return prev;
      endTimeRef.current = Date.now() + pausedRemainingRef.current;
      const next = transition(prev, "RESUME");
      localStorage.setItem(LS_KEY, JSON.stringify({ endTime: endTimeRef.current, phase: next.phase, sessionCount: next.sessionCount }));
      localStorage.removeItem(LS_PAUSED_KEY);
      return next;
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
      localStorage.removeItem(LS_PAUSED_KEY);
      return transition(prev, "STOP");
    });
  }, [settings, doLog]);

  const skip = useCallback(() => {
    setMachine((prev) => {
      endTimeRef.current = null;
      localStorage.removeItem(LS_KEY);
      localStorage.removeItem(LS_PAUSED_KEY);
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

