"use client";

import { useCallback } from "react";
import type { SessionType } from "@/lib/db/queries/sessions";

interface SessionPayload {
  type: SessionType;
  started_at: string;
  ended_at: string;
  planned_duration: number;
  actual_duration: number;
  completed: boolean;
}

export function useSessionLogger(onLogged: () => void) {
  const logSession = useCallback(
    async (data: SessionPayload) => {
      try {
        const res = await fetch("/api/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (res.status === 201) {
          onLogged();
        }
      } catch (err) {
        console.error("[useSessionLogger]", err);
      }
    },
    [onLogged]
  );

  return { logSession };
}
