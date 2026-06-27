"use client";

import type { TimerPhase } from "./timer/constants";

const PHASE_MESSAGES: Record<TimerPhase, { title: string; body: string }> = {
  work: { title: "¡Sesión completada! 🍅", body: "Tomá un descanso bien merecido." },
  short_break: { title: "¡Descanso terminado!", body: "Es hora de enfocarse." },
  long_break: { title: "¡Descanso largo terminado!", body: "¡A trabajar con energía!" },
};

export async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

export function notifySessionComplete(
  phase: TimerPhase,
  soundEnabled: boolean
): void {
  const { title, body } = PHASE_MESSAGES[phase];

  if ("Notification" in window && Notification.permission === "granted") {
    new Notification(title, { body, icon: "/favicon.ico" });
  }

  if (soundEnabled) {
    try {
      new Audio("/chime.mp3").play().catch(() => {});
    } catch {
    }
  }
}
