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

// El chime se dispara desde un setTimeout, sin ningún gesto del usuario en el
// stack. Los navegadores móviles bloquean play() en cualquier HTMLAudioElement
// que no haya sido desbloqueado antes por una interacción real, y el .catch()
// se comía el rechazo en silencio: en tablet y celular la alarma nunca sonaba.
//
// Ojo: el AudioContext que desbloquea startKeepAlive() NO sirve acá. Web Audio
// y los elementos <audio> son dominios de desbloqueo distintos — hay que
// desbloquear un elemento propio y después REUSARLO. Crear uno nuevo en cada
// alarma lo deja bloqueado de nuevo.
let chime: HTMLAudioElement | null = null;

/**
 * Prepara el elemento de audio de la alarma. Se llama desde el click de
 * Iniciar/Retomar y tiene que invocarse SINCRÓNICAMENTE dentro del handler: si
 * se hace después de un await, el gesto ya no cuenta como activación.
 */
export function unlockChime(): void {
  if (chime) return;
  try {
    const audio = new Audio("/chime.mp3");
    // `muted` y no `volume = 0`: en iOS el volumen es de sólo lectura y
    // asignarlo se ignora, así que el usuario escucharía el chime al iniciar.
    audio.muted = true;
    audio
      .play()
      .then(() => {
        audio.pause();
        audio.currentTime = 0;
        audio.muted = false;
        chime = audio;
      })
      .catch(() => {
        // no se pudo desbloquear — playChime cae al camino de siempre
      });
  } catch {
    // sin soporte de Audio
  }
}

function playChime(): void {
  try {
    const audio = chime ?? new Audio("/chime.mp3");
    audio.currentTime = 0;
    audio.play().catch(() => {});
  } catch {
    // best-effort
  }
}

export function notifySessionComplete(
  phase: TimerPhase,
  soundEnabled: boolean
): void {
  const { title, body } = PHASE_MESSAGES[phase];

  // El sonido va PRIMERO y aislado. En Android Chrome `new Notification()` tira
  // "Illegal constructor" (sólo se permite vía ServiceWorkerRegistration), y esa
  // excepción se llevaba puesto al bloque del sonido, que estaba abajo y sin
  // proteger. Un bug se comía al otro.
  if (soundEnabled) playChime();

  if ("Notification" in window && Notification.permission === "granted") {
    try {
      new Notification(title, { body, icon: "/favicon.ico" });
    } catch {
      // Android: la notificación sólo sale por el service worker.
      void navigator.serviceWorker?.ready
        .then((reg) => reg.showNotification(title, { body, icon: "/favicon.ico" }))
        .catch(() => {});
    }
  }
}
