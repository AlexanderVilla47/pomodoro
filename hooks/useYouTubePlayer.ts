"use client";

import { useRef, useState, useCallback, useEffect } from "react";

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
  playVideoAt: (index: number) => void;
  setVolume: (v: number) => void;
  unMute: () => void;
  loadPlaylist: (ids: string[], index?: number, startSeconds?: number) => void;
  cuePlaylist: (ids: string[], index?: number, startSeconds?: number) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlaylistIndex: () => number;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  destroy: () => void;
}

export function useYouTubePlayer() {
  const [isReady, setIsReady] = useState(false);
  const [playerState, setPlayerState] = useState(-1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const playerRef = useRef<YTPlayer | null>(null);
  const videoIdsRef = useRef<string[]>([]);
  const playerStateRef = useRef(-1);
  const initializingRef = useRef(false);
  const readyPromiseRef = useRef<Promise<void>>(Promise.resolve());

  // Poll currentTime while playing
  useEffect(() => {
    if (playerState !== 1) return;
    const id = setInterval(() => {
      if (!playerRef.current) return;
      if (typeof playerRef.current.getCurrentTime !== "function") return;
      setCurrentTime(playerRef.current.getCurrentTime());
      if (typeof playerRef.current.getDuration === "function") {
        const d = playerRef.current.getDuration();
        if (d > 0) setDuration(d);
      }
    }, 500);
    return () => clearInterval(id);
  }, [playerState]);

  const loadPlayer = useCallback(
    (containerId: string, videoIds: string[]): Promise<void> => {
      // Reuse or wait — don't double-init
      if (playerRef.current || initializingRef.current) {
        setCurrentTime(0);
        setDuration(0);
        videoIdsRef.current = videoIds;
        if (playerRef.current) {
          playerRef.current.cuePlaylist(videoIds);
        }
        return readyPromiseRef.current;
      }

      initializingRef.current = true;

      let resolve!: () => void;
      readyPromiseRef.current = new Promise<void>((res) => {
        resolve = res;
      });

      const init = () => {
        playerRef.current = new window.YT.Player(containerId, {
          playerVars: { autoplay: 0, controls: 0 },
          events: {
            onReady: (e) => {
              videoIdsRef.current = videoIds;
              e.target.cuePlaylist(videoIds);
              setIsReady(true);
              resolve();
            },
            onStateChange: (e) => {
              setPlayerState(e.data);
              playerStateRef.current = e.data;
              // Guard: getDuration is not available during iframe transitions
              if (e.data === 1 && playerRef.current && typeof playerRef.current.getDuration === "function") {
                const d = playerRef.current.getDuration();
                if (d > 0) setDuration(d);
              }
            },
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

  const play = useCallback(() => {
    if (!playerRef.current) return;
    playerRef.current.unMute();
    playerRef.current.playVideo();
  }, []);

  const pause = useCallback(() => {
    playerRef.current?.pauseVideo();
  }, []);

  const next = useCallback(() => {
    setCurrentTime(0);
    playerRef.current?.nextVideo();
  }, []);

  const prev = useCallback(() => {
    setCurrentTime(0);
    playerRef.current?.previousVideo();
  }, []);

  // loadPlaylist loads AND auto-plays — reliable one-command solution
  const playAt = useCallback((index: number) => {
    setCurrentTime(0);
    setDuration(0);
    if (!playerRef.current) return;
    playerRef.current.loadPlaylist(videoIdsRef.current, index);
  }, []);

  const setVolume = useCallback((v: number) => {
    playerRef.current?.setVolume(Math.min(100, Math.max(0, v)));
  }, []);

  const seekTo = useCallback((seconds: number) => {
    playerRef.current?.seekTo(seconds, true);
    setCurrentTime(seconds);
  }, []);

  const getPlaylistIndex = useCallback(() => {
    if (!playerRef.current || typeof playerRef.current.getPlaylistIndex !== "function") return 0;
    return playerRef.current.getPlaylistIndex();
  }, []);

  return {
    isReady,
    playerState,
    currentTime,
    duration,
    loadPlayer,
    play,
    pause,
    next,
    prev,
    playAt,
    setVolume,
    seekTo,
    getPlaylistIndex,
  };
}
