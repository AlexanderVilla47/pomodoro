"use client";

import { useEffect, useRef } from "react";
import { flushSessionQueue } from "@/hooks/useSessionLogger";
import { flushWorkLogQueue } from "@/hooks/useWorkLogger";

/**
 * Ordena el vaciado de las dos colas offline: **sesiones primero, work logs
 * después**.
 *
 * Un work_log no se puede resolver si su sesión todavía no llegó al servidor.
 * Antes cada hook enganchaba `online` por su cuenta y era una carrera: si el
 * work log ganaba, el route no encontraba la sesión. Ese caso ahora responde
 * 202 y se reintenta, pero reintentar es el plan B — el plan A es no correr la
 * carrera.
 *
 * Se monta UNA sola vez, arriba de todo. Los `flush*` viven a nivel de módulo
 * justamente para esto: los hooks que los usan están en componentes distintos
 * (useSessionLogger adentro del TimerProvider, useWorkLogger en HomeClient) y
 * desde acá no hay forma de alcanzar sus instancias.
 *
 * @param onSynced se llama sólo si algo efectivamente se entregó, para que
 *   quien lo monte pueda refrescar lo que muestra sin repintar de gusto.
 */
export function useOfflineSync(onSynced?: () => void) {
  const onSyncedRef = useRef(onSynced);
  onSyncedRef.current = onSynced;

  // Dos vaciados en paralelo leerían y escribirían la misma cola pisándose, así
  // que un `online` que llega con uno en curso se descarta: el que está
  // corriendo ya va a dejar la cola en su lugar.
  const runningRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    const sync = async () => {
      if (runningRef.current) return;
      runningRef.current = true;
      let moved = 0;
      try {
        moved += await flushSessionQueue();
      } catch {
        // que las sesiones fallen no es motivo para no intentar los work logs:
        // los que referencian sesiones ya entregadas se resuelven igual
      }
      try {
        moved += await flushWorkLogQueue();
      } catch {}
      runningRef.current = false;
      if (mounted && moved > 0) onSyncedRef.current?.();
    };

    sync();
    window.addEventListener("online", sync);
    return () => {
      mounted = false;
      window.removeEventListener("online", sync);
    };
  }, []);
}
