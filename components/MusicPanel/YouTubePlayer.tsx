"use client";

import { useEffect } from "react";
import { useYouTubePlayer } from "@/hooks/useYouTubePlayer";
import type { Track } from "@/lib/db/queries/playlists";

interface YouTubePlayerProps {
  tracks: Track[];
  onReady?: (player: ReturnType<typeof useYouTubePlayer>) => void;
}

export function YouTubePlayer({ tracks, onReady }: YouTubePlayerProps) {
  const player = useYouTubePlayer();

  useEffect(() => {
    if (!tracks.length) return;
    const videoIds = tracks.map((t) => t.video_id);
    player.loadPlayer("yt-player", videoIds).then(() => onReady?.(player));
  }, [tracks]);

  return <div id="yt-player" className="hidden" aria-hidden="true" />;
}
