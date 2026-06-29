"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import type { TimerPhase, TimerStatus } from "@/lib/timer/constants";
import { quotes } from "@/lib/quotes";

interface QuoteDisplayProps {
  phase: TimerPhase;
  status: TimerStatus;
}

const REVEAL_DURATION_MS = 8000;
const ROTATE_INTERVAL_MS = 180000;

export const QuoteDisplay = memo(function QuoteDisplay({ phase, status }: QuoteDisplayProps) {
  const [index, setIndex] = useState(() => Math.floor(Math.random() * quotes.length));
  const [revealed, setRevealed] = useState(false);
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isWorkActive = phase === "work" && (status === "running" || status === "paused");

  // Rotate quote and reset reveal on each phase change
  useEffect(() => {
    setIndex((prev) => {
      let next = Math.floor(Math.random() * quotes.length);
      if (next === prev) next = (prev + 1) % quotes.length;
      return next;
    });
    setRevealed(false);
    if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
  }, [phase]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    };
  }, []);

  const handleReveal = () => {
    if (revealed) {
      setRevealed(false);
      if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
      return;
    }
    setRevealed(true);
    revealTimerRef.current = setTimeout(() => setRevealed(false), REVEAL_DURATION_MS);
  };

  const nextQuote = useCallback(() => {
    setIndex((prev) => {
      let next = Math.floor(Math.random() * quotes.length);
      if (next === prev) next = (prev + 1) % quotes.length;
      return next;
    });
  }, []);

  // Auto-rotate every 30 seconds
  useEffect(() => {
    const id = setInterval(nextQuote, ROTATE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [nextQuote]);

  const quote = quotes[index];
  const quoteVisible = !isWorkActive || revealed;

  return (
    <div className="flex flex-col items-center gap-2 w-full max-w-xs text-center">
      {isWorkActive && (
        <button
          onClick={handleReveal}
          title={revealed ? "Ocultar frase" : "Ver frase motivacional"}
          className={`text-[11px] tracking-widest uppercase transition-colors duration-300 ${
            revealed ? "text-white/40" : "text-white/20 hover:text-white/40"
          }`}
        >
          ✦ {revealed ? "ocultar" : "inspiración"}
        </button>
      )}

      <div
        className={`transition-opacity duration-500 ${quoteVisible ? "opacity-100" : "opacity-0 pointer-events-none select-none"}`}
        aria-hidden={!quoteVisible}
      >
        <p className="text-sm italic text-white/50 leading-relaxed">
          &ldquo;{quote.text}&rdquo;
        </p>
        <span className="mt-1.5 block text-[11px] tracking-wide text-white/25">
          — {quote.author}
        </span>
      </div>
    </div>
  );
});
