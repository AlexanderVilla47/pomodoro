"use client";

import { useCallback, useEffect } from "react";
import type { SessionType } from "@/lib/db/queries/sessions";

interface SessionPayload {
  type: SessionType;
  started_at: string;
  ended_at: string;
  planned_duration: number;
  actual_duration: number;
  completed: boolean;
  label_id?: number | null;
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

async function sendSession(data: SessionPayload): Promise<boolean> {
  const res = await fetch("/api/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.status === 201 || res.status === 204;
}

export function useSessionLogger(onLogged: () => void) {
  const flushQueue = useCallback(async () => {
    const queue = getQueue();
    if (queue.length === 0) return;

    const failed: SessionPayload[] = [];
    for (const session of queue) {
      try {
        const ok = await sendSession(session);
        if (ok) onLogged();
        else failed.push(session);
      } catch {
        failed.push(session);
      }
    }
    saveQueue(failed);
  }, [onLogged]);

  // Flush pending sessions on mount and whenever connection is restored
  useEffect(() => {
    flushQueue();
    window.addEventListener("online", flushQueue);
    return () => window.removeEventListener("online", flushQueue);
  }, [flushQueue]);

  const logSession = useCallback(
    async (data: SessionPayload) => {
      try {
        const ok = await sendSession(data);
        if (ok) onLogged();
      } catch {
        // Offline — queue for later sync
        const queue = getQueue();
        queue.push(data);
        saveQueue(queue);
      }
    },
    [onLogged]
  );

  return { logSession };
}
