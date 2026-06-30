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

async function sendSession(data: SessionPayload): Promise<number | null> {
  const res = await fetch("/api/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (res.status === 201) {
    const { id } = await res.json();
    return id as number;
  }
  if (res.status === 204) return null;
  throw new Error(`Unexpected status: ${res.status}`);
}

export function useSessionLogger(onLogged: (sessionId: number | null) => void) {
  const flushQueue = useCallback(async () => {
    const queue = getQueue();
    if (queue.length === 0) return;

    const failed: SessionPayload[] = [];
    for (const session of queue) {
      try {
        const id = await sendSession(session);
        onLogged(id);
      } catch {
        failed.push(session);
      }
    }
    saveQueue(failed);
  }, [onLogged]);

  useEffect(() => {
    flushQueue();
    window.addEventListener("online", flushQueue);
    return () => window.removeEventListener("online", flushQueue);
  }, [flushQueue]);

  const logSession = useCallback(
    async (data: SessionPayload) => {
      try {
        const id = await sendSession(data);
        onLogged(id);
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
