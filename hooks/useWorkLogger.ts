"use client";

import { useCallback, useEffect } from "react";

export interface WorkLogPayload {
  sessionId: number;
  notes: string | null;
  topics: string[];
}

const QUEUE_KEY = "pomodoro_worklog_queue";

function getQueue(): WorkLogPayload[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveQueue(queue: WorkLogPayload[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

async function sendWorkLog(p: WorkLogPayload): Promise<boolean> {
  const res = await fetch("/api/work-logs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(p),
  });
  // 201 = created, 409 = already exists — both are "done", drop from queue
  return res.status === 201 || res.status === 409;
}

export function useWorkLogger() {
  const flushQueue = useCallback(async () => {
    const queue = getQueue();
    if (queue.length === 0) return;

    const failed: WorkLogPayload[] = [];
    for (const item of queue) {
      try {
        const ok = await sendWorkLog(item);
        if (!ok) failed.push(item);
      } catch {
        failed.push(item);
      }
    }
    saveQueue(failed);
  }, []);

  useEffect(() => {
    flushQueue();
    window.addEventListener("online", flushQueue);
    return () => window.removeEventListener("online", flushQueue);
  }, [flushQueue]);

  const saveWorkLog = useCallback(async (p: WorkLogPayload): Promise<void> => {
    try {
      const ok = await sendWorkLog(p);
      if (!ok) {
        const queue = getQueue();
        queue.push(p);
        saveQueue(queue);
      }
    } catch {
      const queue = getQueue();
      queue.push(p);
      saveQueue(queue);
    }
  }, []);

  return { saveWorkLog };
}
