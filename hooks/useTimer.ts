"use client";

import { useTimerContext } from "@/context/TimerContext";

export function useTimer() {
  return useTimerContext();
}
