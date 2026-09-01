"use client";

import { useCallback } from "react";
import type { SessionType } from "@/lib/db/queries/sessions";

export interface SessionPayload {
  type: SessionType;
  started_at: string;
  ended_at: string;
  planned_duration: number;
  actual_duration: number;
  completed: boolean;
  label_id?: number | null;
  distraction_count?: number;
  distraction_marks?: number[];
  /** UUID de la sesión, generado en el cliente. Es la identidad real. */
  client_id?: string;
}

const QUEUE_KEY = "pomodoro_offline_queue";

function getQueue(): SessionPayload[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveQueue(queue: SessionPayload[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

/**
 * 201 = insertada (o resuelta por el upsert si era un reintento).
 * 204 = el servidor la ignoró por corta: no hay nada que reintentar.
 *
 * Cualquier otro status se trata como fallo y el item vuelve a la cola. Ya no
 * hace falta leer el id de la respuesta: la identidad de la sesión la puso el
 * cliente antes de mandarla.
 */
async function sendSession(data: SessionPayload): Promise<void> {
  const res = await fetch("/api/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (res.status === 201 || res.status === 204) return;
  throw new Error(`Unexpected status: ${res.status}`);
}

/**
 * Vacía la cola de sesiones y devuelve cuántas se entregaron.
 *
 * Va a nivel de módulo y no adentro del hook a propósito: `useOfflineSync`
 * tiene que correr esta cola ANTES que la de work logs (un work_log no se puede
 * resolver si su sesión todavía no llegó), y para eso no puede depender de la
 * instancia del hook, que vive adentro del TimerProvider.
 *
 * Reenviar un item es seguro: lleva su client_id original, así que si la primera
 * request sí había entrado, el upsert del servidor devuelve la fila que ya está
 * en vez de crear un duplicado.
 */
export async function flushSessionQueue(): Promise<number> {
  const queue = getQueue();
  if (queue.length === 0) return 0;

  const failed: SessionPayload[] = [];
  for (const session of queue) {
    try {
      await sendSession(session);
    } catch {
      failed.push(session);
    }
  }
  saveQueue(failed);
  return queue.length - failed.length;
}

export function useSessionLogger(onLogged: (clientId: string | null) => void) {
  const logSession = useCallback(
    async (data: SessionPayload) => {
      // Al instante, sin esperar al servidor. Antes el prompt de chunks se abría
      // con el id que devolvía el INSERT, así que sin internet no se abría
      // nunca: la sesión se encolaba y no volvía ningún id. No es que se
      // perdieran los datos de teoría — es que nunca se preguntaba.
      onLogged(data.client_id ?? null);
      try {
        await sendSession(data);
      } catch {
        const queue = getQueue();
        queue.push(data);
        saveQueue(queue);
      }
    },
    [onLogged]
  );

  return { logSession };
}
