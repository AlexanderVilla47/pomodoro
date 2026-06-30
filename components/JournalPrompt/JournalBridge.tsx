"use client";

import { useEffect } from "react";
import { useTimerContext } from "@/context/TimerContext";

interface JournalBridgeProps {
  onWorkStart: () => void;
}

export function JournalBridge({ onWorkStart }: JournalBridgeProps) {
  const { phase, status } = useTimerContext();

  useEffect(() => {
    if (phase === "work" && status === "running") {
      onWorkStart();
    }
  }, [phase, status, onWorkStart]);

  return null;
}
