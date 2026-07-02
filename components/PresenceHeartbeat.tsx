"use client";

import { useEffect, useRef } from "react";
import { useTimerContext } from "@/context/TimerContext";

type PresencePhase = "work" | "break" | "idle";

const HEARTBEAT_MS = 40_000;

/**
 * Reporta la presencia del usuario al servidor mientras la app está abierta.
 * Deriva la fase del timer: trabajando / descanso / en línea (idle).
 * Debe montarse dentro del TimerProvider.
 */
export function PresenceHeartbeat() {
  const { status, phase } = useTimerContext();

  const presencePhase: PresencePhase =
    status === "running"
      ? phase === "work"
        ? "work"
        : "break"
      : "idle";

  const phaseRef = useRef(presencePhase);
  phaseRef.current = presencePhase;

  const send = (p: PresencePhase) => {
    fetch("/api/presence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phase: p }),
      keepalive: true,
    }).catch(() => {});
  };

  // Manda al toque cuando cambia la fase (para que el estado aparezca rápido)
  useEffect(() => {
    send(presencePhase);
  }, [presencePhase]);

  // Heartbeat periódico mientras la app está abierta
  useEffect(() => {
    const id = setInterval(() => send(phaseRef.current), HEARTBEAT_MS);
    return () => clearInterval(id);
  }, []);

  return null;
}
