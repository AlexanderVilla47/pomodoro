"use client";

import { useCallback } from "react";

export interface WorkLogPayload {
  /** UUID de la sesión, puesto por el cliente. La referencia buena. */
  sessionClientId?: string;
  /** Id numérico. Sólo lo traen los items encolados antes de este deploy. */
  sessionId?: number;
  notes: string | null;
  topics: string[];
  isTheory?: boolean;
  chunks?: number | null;
}

const QUEUE_KEY = "pomodoro_worklog_queue";

/**
 * Techo de reintentos "con respuesta del servidor".
 *
 * La trampa conocida de este repo es que la cola sólo suelta un item con 201 o
 * 409: cualquier otro status lo reencola y lo reintenta en cada evento `online`
 * y en cada montaje del hook. El 202 que agrega este cambio es legítimo — la
 * sesión todavía no llegó — pero legítimo no quiere decir eterno: si por lo que
 * sea nunca llega, sin techo el item queda dando vueltas para siempre.
 *
 * Diez intentos alcanzan de sobra para la carrera real (useOfflineSync ya vacía
 * las sesiones primero, así que lo normal es que se resuelva en el primero).
 */
const MAX_ATTEMPTS = 10;

interface QueuedWorkLog {
  payload: WorkLogPayload;
  /** intentos que SÍ tuvieron respuesta del servidor; estar offline no cuenta */
  attempts: number;
}

function getQueue(): QueuedWorkLog[] {
  try {
    const raw = JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]");
    if (!Array.isArray(raw)) return [];
    // Los items encolados antes de este deploy son el payload pelado.
    return raw.map((item) =>
      item && typeof item === "object" && "payload" in item
        ? (item as QueuedWorkLog)
        : { payload: item as WorkLogPayload, attempts: 0 }
    );
  } catch {
    return [];
  }
}

function saveQueue(queue: QueuedWorkLog[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

type SendResult =
  /** 201 o 409: la fila está, se suelta el item */
  | "done"
  /** 202: la sesión todavía no llegó al servidor, se reintenta */
  | "pending"
  /** status raro: se reintenta, pero gasta un intento */
  | "rejected"
  /** sin red: se reintenta sin gastar intentos, no es culpa del item */
  | "offline";

async function sendWorkLog(p: WorkLogPayload): Promise<SendResult> {
  let res: Response;
  try {
    res = await fetch("/api/work-logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(p),
    });
  } catch {
    return "offline";
  }
  if (res.status === 201 || res.status === 409) return "done";
  if (res.status === 202) return "pending";
  return "rejected";
}

function retry(item: QueuedWorkLog, result: SendResult): QueuedWorkLog | null {
  if (result === "offline") return item;
  const attempts = item.attempts + 1;
  return attempts >= MAX_ATTEMPTS ? null : { ...item, attempts };
}

/**
 * Vacía la cola de work logs.
 *
 * Va a nivel de módulo por lo mismo que `flushSessionQueue`: `useOfflineSync`
 * la corre DESPUÉS de las sesiones, y para ordenarlas no puede depender de las
 * instancias de los hooks, que viven en componentes distintos.
 */
export async function flushWorkLogQueue(): Promise<number> {
  const queue = getQueue();
  if (queue.length === 0) return 0;

  const pending: QueuedWorkLog[] = [];
  let delivered = 0;
  for (const item of queue) {
    const result = await sendWorkLog(item.payload);
    if (result === "done") {
      delivered++;
      continue;
    }
    const next = retry(item, result);
    if (next) pending.push(next);
  }
  saveQueue(pending);
  return delivered;
}

export function useWorkLogger() {
  const saveWorkLog = useCallback(async (p: WorkLogPayload): Promise<void> => {
    const result = await sendWorkLog(p);
    if (result === "done") return;
    const queue = getQueue();
    queue.push({ payload: p, attempts: result === "offline" ? 0 : 1 });
    saveQueue(queue);
  }, []);

  return { saveWorkLog };
}
