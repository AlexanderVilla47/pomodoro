"use client";

// Keep-alive de fondo para el timer.
//
// Chrome congela (Page Lifecycle "frozen") las pestañas ocultas / ventanas
// minimizadas: pausa TODO el JS, incluidos los setTimeout, por eso el ciclo no
// avanzaba ni sonaba la alarma minimizado. Una página que está reproduciendo
// audio queda EXENTA de ese freeze. Así que mantenemos un tono sub-audible vivo
// mientras el timer corre para que el navegador la considere "activa".
//
// Debe arrancarse desde un gesto del usuario (el click de "iniciar"/"reanudar")
// por la política de autoplay: un AudioContext creado sin gesto queda suspended.

let audioCtx: AudioContext | null = null;
let oscillator: OscillatorNode | null = null;
let gainNode: GainNode | null = null;

type AudioCtxCtor = typeof AudioContext;

function getAudioContextCtor(): AudioCtxCtor | null {
  if (typeof window === "undefined") return null;
  return (
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: AudioCtxCtor }).webkitAudioContext ||
    null
  );
}

export function startKeepAlive(): void {
  const Ctx = getAudioContextCtor();
  if (!Ctx) return;

  try {
    if (!audioCtx) audioCtx = new Ctx();
    if (audioCtx.state === "suspended") void audioCtx.resume();

    // ya hay un oscilador corriendo — no apilar otro
    if (oscillator) return;

    oscillator = audioCtx.createOscillator();
    gainNode = audioCtx.createGain();

    // frecuencia grave + gain muy bajo: inaudible para el usuario, pero salida
    // de audio real para que Chrome marque la pestaña como "audible" y no la freeze
    oscillator.frequency.value = 30;
    gainNode.gain.value = 0.0015;

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.start();
  } catch {
    // AudioContext no disponible o bloqueado — el keep-alive es best-effort
  }
}

export function stopKeepAlive(): void {
  try {
    if (oscillator) {
      oscillator.stop();
      oscillator.disconnect();
      oscillator = null;
    }
    if (gainNode) {
      gainNode.disconnect();
      gainNode = null;
    }
    // suspend (no close) para poder reanudar sin recrear el contexto
    if (audioCtx && audioCtx.state === "running") void audioCtx.suspend();
  } catch {
    // ignorar — best-effort
  }
}
