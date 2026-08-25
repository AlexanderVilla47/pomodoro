"use client";

import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import gsap from "gsap";
import { transition } from "@/lib/timer/stateMachine";
import { computeRemaining, shouldLog } from "@/lib/timer/engine";
import { useSessionLogger } from "@/hooks/useSessionLogger";
import { notifySessionComplete } from "@/lib/notifications";
import { startKeepAlive, stopKeepAlive } from "@/lib/timer/keepAlive";
import { MAX_DISTRACTION_MARKS } from "@/lib/timer/constants";
import type { MachineState } from "@/lib/timer/stateMachine";
import type { Settings } from "@/lib/db/queries/settings";

interface TimerContextValue {
  status: MachineState["status"];
  phase: MachineState["phase"];
  sessionCount: number;
  remaining: number;
  distractionCount: number;
  start: () => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  skip: () => void;
  markDistraction: () => void;
}

const TimerContext = createContext<TimerContextValue | null>(null);

const LS_KEY = "pomodoro_endTime";
const LS_PAUSED_KEY = "pomodoro_paused_state";
const LS_DISTRACTIONS_KEY = "pomodoro_distractions";

interface DistractionRecord {
  /** identidad de la sesión dueña de estos marks */
  startedAt: number;
  /** segundos desde el inicio de la sesión */
  marks: number[];
}

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
  // guards against advancing the same phase-expiry twice when the ticker and
  // the background setTimeout both fire around the boundary (foreground case)
  const processedEndTimeRef = useRef<number | null>(null);

  const onSessionLoggedRef = useRef(onSessionLogged);
  onSessionLoggedRef.current = onSessionLogged;

  const selectedLabelIdRef = useRef(selectedLabelId);
  selectedLabelIdRef.current = selectedLabelId;

  const { logSession } = useSessionLogger((id) => {
    onSessionLoggedRef.current?.(id);
  });

  // Los marks llevan la identidad de su sesión (startedAt). Así, cuando arranca
  // una sesión nueva, los de la anterior se invalidan solos sin depender de que
  // algún camino del ciclo de vida se acuerde de limpiarlos.
  const distractionsRef = useRef<DistractionRecord>({ startedAt: 0, marks: [] });
  const [distractionCount, setDistractionCount] = useState(0);

  const currentMarks = useCallback((): number[] => {
    return distractionsRef.current.startedAt === sessionStartRef.current
      ? distractionsRef.current.marks
      : [];
  }, []);

  // Sólo toca refs y localStorage, nunca estado de React: por eso es seguro
  // llamarla desde adentro de un updater de setMachine, que es donde hace falta
  // para garantizar que corra DESPUÉS de que doLog leyó los marks. El contador
  // visible lo recalcula el efecto de sync cuando el estado se asienta.
  const resetDistractionRecord = useCallback(() => {
    distractionsRef.current = { startedAt: 0, marks: [] };
    try {
      localStorage.removeItem(LS_DISTRACTIONS_KEY);
    } catch {}
  }, []);

  const markDistraction = useCallback(() => {
    const m = machineRef.current;
    // sólo durante el foco corriendo: en pausa o en descanso no hay nada que medir
    if (m.status !== "running" || m.phase !== "work") return;

    const startedAt = sessionStartRef.current;
    const mark = Math.max(0, Math.round((Date.now() - startedAt) / 1000));
    const marks = [...currentMarks(), mark].slice(0, MAX_DISTRACTION_MARKS);

    distractionsRef.current = { startedAt, marks };
    // espejo en localStorage: un refresh o que el SO mate la PWA no se lleva
    // puestos los cortes de la sesión en curso
    try {
      localStorage.setItem(LS_DISTRACTIONS_KEY, JSON.stringify({ startedAt, marks }));
    } catch {}
    setDistractionCount(marks.length);
  }, [currentMarks]);

  const doLog = useCallback(
    (m: MachineState, elapsed: number, completed: boolean) => {
      if (m.phase === "work" && (completed || shouldLog(elapsed / 1000, settings.work_duration))) {
        const marks = currentMarks();
        logSession({
          type: m.phase,
          started_at: new Date(sessionStartRef.current).toISOString(),
          ended_at: new Date().toISOString(),
          planned_duration: settings.work_duration,
          actual_duration: Math.round(elapsed / 1000),
          completed,
          label_id: selectedLabelIdRef.current ?? null,
          distraction_count: marks.length,
          distraction_marks: marks,
        });
      }
    },
    [logSession, settings.work_duration, currentMarks]
  );

  // Authoritative phase-boundary handler. Shared by the GSAP ticker (foreground
  // smoothness), the visibility handler (catch-up on return), and the background
  // setTimeout (the only one that keeps firing when the tab is hidden).
  const handleSessionEnd = useCallback(
    (m: MachineState) => {
      const expiredEndTime = endTimeRef.current;
      if (expiredEndTime === null) return;
      // idempotency: each distinct phase-expiry is processed exactly once,
      // no matter which of the three triggers reaches it first
      if (processedEndTimeRef.current === expiredEndTime) return;
      processedEndTimeRef.current = expiredEndTime;

      const elapsed = phaseDuration(m.phase, settingsRef.current);
      doLog(m, elapsed, true);
      // la sesión ya viajó con sus cortes: el registro deja de ser válido y no
      // debe sobrevivir a un refresh durante la fase siguiente
      resetDistractionRecord();

      const afterComplete = transition(m, "COMPLETE");

      // Full cycle done — reset to a fresh work-ready state so the UI muestra
      // "Enfoque" (no el descanso largo recién terminado) y START arranca un
      // ciclo nuevo desde cero. El usuario reinicia manualmente.
      if (m.phase === "long_break") {
        endTimeRef.current = null;
        localStorage.removeItem(LS_KEY);
        stopKeepAlive();
        setMachine({ status: "idle", phase: "work", sessionCount: 0 });
        return;
      }

      const afterStart = transition(afterComplete, "START", settingsRef.current.long_break_interval);
      if (afterStart.status === "running") {
        const nextDur = phaseDuration(afterStart.phase, settingsRef.current);
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
    },
    [doLog, resetDistractionRecord]
  );

  // El contador visible se recalcula ante cualquier cambio de estado: si la
  // sesión cambió, currentMarks() ya no reconoce los marks viejos y da 0.
  useEffect(() => {
    setDistractionCount(currentMarks().length);
  }, [machine, currentMarks]);

  useEffect(() => {
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
  }, [handleSessionEnd]);

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
      // advance the cycle here too: setTimeout keeps firing in background tabs,
      // the GSAP ticker (requestAnimationFrame) does not. This is what lets the
      // next session/break start automatically while the tab is hidden.
      handleSessionEnd(machineRef.current);
    }, delay);
    return () => {
      if (soundTimeoutRef.current !== null) {
        clearTimeout(soundTimeoutRef.current);
        soundTimeoutRef.current = null;
      }
    };
  }, [machine, handleSessionEnd]);

  useEffect(() => {
    if (machine.status === "idle" || machine.status === "completed") {
      const dur = phaseDuration(machine.phase, settings);
      setRemaining(dur);
      pausedRemainingRef.current = dur;
    }
  }, [machine.phase, machine.status, settings]);

  useEffect(() => {
    // Recupera los cortes de la sesión que se está restaurando. El registro
    // trae su propio startedAt, que además le devuelve al timer el origen real
    // de la sesión (sin esto los marks se calcularían contra el momento del
    // remontaje y quedarían corridos).
    const restoreDistractions = () => {
      const saved = localStorage.getItem(LS_DISTRACTIONS_KEY);
      if (!saved) return;
      try {
        const { startedAt, marks } = JSON.parse(saved) as DistractionRecord;
        if (typeof startedAt === "number" && Array.isArray(marks)) {
          sessionStartRef.current = startedAt;
          distractionsRef.current = { startedAt, marks };
          setDistractionCount(marks.length);
          return;
        }
      } catch {}
      localStorage.removeItem(LS_DISTRACTIONS_KEY);
    };

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
        restoreDistractions();
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
        restoreDistractions();
        setMachine({ status: "paused", phase, sessionCount });
        return;
      } catch {
        localStorage.removeItem(LS_PAUSED_KEY);
      }
    }

    // no hay sesión viva que restaurar: lo que haya quedado es basura
    localStorage.removeItem(LS_DISTRACTIONS_KEY);
  }, []);

  const start = useCallback(() => {
    // sesión nueva, cortes en cero (y sin registro viejo esperando un refresh)
    resetDistractionRecord();
    setMachine((prev) => {
      const next = transition(prev, "START", settingsRef.current.long_break_interval);
      if (next.status === "running") {
        const dur = phaseDuration(next.phase, settings);
        endTimeRef.current = Date.now() + dur;
        pausedRemainingRef.current = dur;
        sessionStartRef.current = Date.now();
        localStorage.setItem(LS_KEY, JSON.stringify({ endTime: endTimeRef.current, phase: next.phase, sessionCount: next.sessionCount }));
        localStorage.removeItem(LS_PAUSED_KEY);
        // gesto del usuario: habilita el keep-alive de audio contra el freeze
        startKeepAlive();
      }
      return next;
    });
  }, [settings, resetDistractionRecord]);

  const pause = useCallback(() => {
    setMachine((prev) => {
      if (prev.status !== "running") return prev;
      pausedRemainingRef.current = remaining;
      endTimeRef.current = null;
      localStorage.removeItem(LS_KEY);
      stopKeepAlive();
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
      // gesto del usuario: reactiva el keep-alive de audio
      startKeepAlive();
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
      // adentro del updater y después de doLog: el body del callback corre
      // antes que el updater, así que limpiar afuera se llevaría los marks
      // puestos antes de que la sesión los pueda mandar
      resetDistractionRecord();
      endTimeRef.current = null;
      localStorage.removeItem(LS_KEY);
      localStorage.removeItem(LS_PAUSED_KEY);
      stopKeepAlive();
      return transition(prev, "STOP");
    });
  }, [settings, doLog, resetDistractionRecord]);

  const skip = useCallback(() => {
    setMachine((prev) => {
      endTimeRef.current = null;
      localStorage.removeItem(LS_KEY);
      localStorage.removeItem(LS_PAUSED_KEY);
      resetDistractionRecord();
      stopKeepAlive();
      return transition(prev, "SKIP", settingsRef.current.long_break_interval);
    });
  }, [resetDistractionRecord]);

  // asegura cortar el tono keep-alive si el provider se desmonta corriendo
  useEffect(() => () => stopKeepAlive(), []);

  return (
    <TimerContext.Provider
      value={{
        status: machine.status,
        phase: machine.phase,
        sessionCount: machine.sessionCount,
        remaining,
        distractionCount,
        start,
        pause,
        resume,
        stop,
        skip,
        markDistraction,
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

