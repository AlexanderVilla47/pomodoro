"use client";

import { createContext, useContext } from "react";
import { useYouTubePlayer } from "@/hooks/useYouTubePlayer";

type YTPlayerCtx = ReturnType<typeof useYouTubePlayer>;

const YouTubePlayerContext = createContext<YTPlayerCtx | null>(null);

export function YouTubePlayerProvider({ children }: { children: React.ReactNode }) {
  const player = useYouTubePlayer();
  return <YouTubePlayerContext.Provider value={player}>{children}</YouTubePlayerContext.Provider>;
}

export function useYTPlayer(): YTPlayerCtx {
  const ctx = useContext(YouTubePlayerContext);
  if (!ctx) throw new Error("useYTPlayer must be used inside YouTubePlayerProvider");
  return ctx;
}
