"use client";

import { useRef, useState, useCallback, useEffect } from "react";

declare global {
  interface Window {
    Spotify: {
      Player: new (options: {
        name: string;
        getOAuthToken: (cb: (token: string) => void) => void;
        volume: number;
      }) => SpotifySDKPlayer;
    };
    onSpotifyWebPlaybackSDKReady: () => void;
  }
}

interface SpotifySDKPlayer {
  connect: () => Promise<boolean>;
  disconnect: () => void;
  addListener: (event: string, cb: (data: unknown) => void) => void;
  removeListener: (event: string) => void;
  togglePlay: () => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  nextTrack: () => Promise<void>;
  previousTrack: () => Promise<void>;
  seek: (ms: number) => Promise<void>;
  setVolume: (v: number) => Promise<void>;
  getCurrentState: () => Promise<SpotifyPlayerState | null>;
}

interface SpotifyPlayerState {
  paused: boolean;
  position: number;
  duration: number;
  track_window: {
    current_track: { name: string; uri: string; artists: { name: string }[] };
  };
}

export type SpotifyPlayerStatus = "idle" | "loading" | "ready" | "error" | "premium_required";

export function useSpotifyPlayer() {
  const playerRef = useRef<SpotifySDKPlayer | null>(null);
  const deviceIdRef = useRef<string | null>(null);
  const [status, setStatus] = useState<SpotifyPlayerStatus>("idle");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTrackUri, setCurrentTrackUri] = useState<string | null>(null);
  const [currentTrackName, setCurrentTrackName] = useState<string | null>(null);
  const [currentArtistName, setCurrentArtistName] = useState<string | null>(null);
  const urisRef = useRef<string[]>([]);
  const currentIndexRef = useRef(0);

  const getToken = useCallback(async (): Promise<string | null> => {
    const res = await fetch("/api/spotify/token");
    if (!res.ok) return null;
    const { accessToken } = await res.json();
    return accessToken;
  }, []);

  const initSDK = useCallback(() => {
    if (playerRef.current || status === "loading" || status === "ready") return;
    setStatus("loading");

    const createPlayer = () => {
      const p = new window.Spotify.Player({
        name: "Pomodoro",
        getOAuthToken: async (cb) => {
          const token = await getToken();
          if (token) {
            cb(token);
          } else {
            setStatus("error");
          }
        },
        volume: 0.8,
      });

      p.addListener("ready", (data) => {
        const { device_id } = data as { device_id: string };
        deviceIdRef.current = device_id;
        setStatus("ready");
      });

      p.addListener("not_ready", () => {
        deviceIdRef.current = null;
        setStatus("loading");
      });

      p.addListener("initialization_error", () => setStatus("error"));
      p.addListener("authentication_error", () => setStatus("error"));
      p.addListener("account_error", () => setStatus("premium_required"));

      p.addListener("player_state_changed", (state) => {
        const s = state as SpotifyPlayerState | null;
        if (!s) return;
        setIsPlaying(!s.paused);
        setCurrentTime(s.position / 1000);
        setDuration(s.duration / 1000);
        const track = s.track_window.current_track;
        setCurrentTrackUri(track.uri);
        setCurrentTrackName(track.name);
        setCurrentArtistName(track.artists[0]?.name ?? null);
        const idx = urisRef.current.indexOf(track.uri);
        if (idx >= 0) currentIndexRef.current = idx;
      });

      p.connect().then((ok) => {
        if (!ok) setStatus("error");
      });
      playerRef.current = p;
    };

    if (window.Spotify?.Player) {
      createPlayer();
    } else {
      const tag = document.createElement("script");
      tag.src = "https://sdk.scdn.co/spotify-player.js";
      document.head.appendChild(tag);
      window.onSpotifyWebPlaybackSDKReady = createPlayer;
    }
  }, [status, getToken]);

  // Poll position while playing
  useEffect(() => {
    if (!isPlaying) return;
    const id = setInterval(async () => {
      const state = await playerRef.current?.getCurrentState();
      if (state) {
        setCurrentTime(state.position / 1000);
        setDuration(state.duration / 1000);
      }
    }, 500);
    return () => clearInterval(id);
  }, [isPlaying]);

  const loadAndPlay = useCallback(
    async (uris: string[], startIndex = 0) => {
      if (!deviceIdRef.current) return;
      urisRef.current = uris;
      currentIndexRef.current = startIndex;
      const token = await getToken();
      if (!token) return;
      await fetch(
        `https://api.spotify.com/v1/me/player/play?device_id=${deviceIdRef.current}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ uris, offset: { position: startIndex } }),
        }
      );
    },
    [getToken]
  );

  const play = useCallback(async () => {
    await playerRef.current?.resume();
  }, []);

  const pause = useCallback(async () => {
    await playerRef.current?.pause();
  }, []);

  const next = useCallback(async () => {
    await playerRef.current?.nextTrack();
  }, []);

  const prev = useCallback(async () => {
    await playerRef.current?.previousTrack();
  }, []);

  const playAt = useCallback(
    async (index: number) => {
      await loadAndPlay(urisRef.current, index);
    },
    [loadAndPlay]
  );

  const setVolume = useCallback(async (v: number) => {
    await playerRef.current?.setVolume(v / 100);
  }, []);

  const seekTo = useCallback(async (seconds: number) => {
    await playerRef.current?.seek(seconds * 1000);
    setCurrentTime(seconds);
  }, []);

  const getPlaylistIndex = useCallback(() => currentIndexRef.current, []);

  const disconnect = useCallback(() => {
    playerRef.current?.disconnect();
    playerRef.current = null;
    deviceIdRef.current = null;
    setStatus("idle");
    setIsPlaying(false);
  }, []);

  return {
    status,
    isReady: status === "ready",
    isPlaying,
    currentTime,
    duration,
    currentTrackUri,
    currentTrackName,
    currentArtistName,
    initSDK,
    loadAndPlay,
    play,
    pause,
    next,
    prev,
    playAt,
    setVolume,
    seekTo,
    getPlaylistIndex,
    disconnect,
  };
}
