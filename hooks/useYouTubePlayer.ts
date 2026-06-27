"use client";

import { useRef, useState, useCallback } from "react";

declare global {
  interface Window {
    YT: {
      Player: new (
        elementId: string,
        options: {
          playerVars?: Record<string, unknown>;
          events: {
            onReady: (e: { target: YTPlayer }) => void;
            onStateChange: (e: { data: number }) => void;
          };
        }
      ) => YTPlayer;
      PlayerState: { PLAYING: number; PAUSED: number; ENDED: number };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

interface YTPlayer {
  playVideo: () => void;
  pauseVideo: () => void;
  nextVideo: () => void;
  previousVideo: () => void;
  setVolume: (v: number) => void;
  loadPlaylist: (ids: string[]) => void;
  destroy: () => void;
}

export function useYouTubePlayer() {
  const [isReady, setIsReady] = useState(false);
  const [playerState, setPlayerState] = useState(-1);
  const playerRef = useRef<YTPlayer | null>(null);
  const readyPromiseRef = useRef<Promise<void>>(Promise.resolve());
  const resolveReadyRef = useRef<() => void>(() => {});

  const loadPlayer = useCallback(
    (containerId: string, videoIds: string[]): Promise<void> => {
      let resolve!: () => void;
      readyPromiseRef.current = new Promise<void>((res) => {
        resolve = res;
        resolveReadyRef.current = res;
      });

      const init = () => {
        playerRef.current = new window.YT.Player(containerId, {
          playerVars: { autoplay: 0, controls: 0, listType: "playlist" },
          events: {
            onReady: (e) => {
              e.target.loadPlaylist(videoIds);
              setIsReady(true);
              resolve();
            },
            onStateChange: (e) => setPlayerState(e.data),
          },
        });
      };

      if (window.YT?.Player) {
        init();
      } else {
        const tag = document.createElement("script");
        tag.src = "https://www.youtube.com/iframe_api";
        document.head.appendChild(tag);
        window.onYouTubeIframeAPIReady = init;
      }

      return readyPromiseRef.current;
    },
    []
  );

  const play = useCallback(async () => {
    await readyPromiseRef.current;
    playerRef.current?.playVideo();
  }, []);

  const pause = useCallback(async () => {
    await readyPromiseRef.current;
    playerRef.current?.pauseVideo();
  }, []);

  const next = useCallback(async () => {
    await readyPromiseRef.current;
    playerRef.current?.nextVideo();
  }, []);

  const prev = useCallback(async () => {
    await readyPromiseRef.current;
    playerRef.current?.previousVideo();
  }, []);

  const setVolume = useCallback((v: number) => {
    playerRef.current?.setVolume(Math.min(100, Math.max(0, v)));
  }, []);

  return { isReady, playerState, loadPlayer, play, pause, next, prev, setVolume };
}
