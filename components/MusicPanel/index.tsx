"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { SetupGuide } from "./SetupGuide";
import { YouTubePlayer } from "./YouTubePlayer";
import { PlayerControls } from "./PlayerControls";
import { TrackList } from "./TrackList";
import { PlaylistSwitcher } from "./PlaylistSwitcher";
import type { Track } from "@/lib/db/queries/playlists";
import type { useYouTubePlayer } from "@/hooks/useYouTubePlayer";

export function MusicPanel() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null);
  const [volume, setVolume] = useState(80);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const playerRef = useRef<ReturnType<typeof useYouTubePlayer> | null>(null);

  useEffect(() => {
    fetch("/api/playlists/status")
      .then((r) => r.json())
      .then((d) => setConfigured(d.configured))
      .catch(() => setConfigured(false));
  }, []);

  const loadTracks = useCallback(async (playlistId: string) => {
    setActivePlaylistId(playlistId);
    try {
      const res = await fetch(`/api/playlists/${playlistId}/tracks`);
      if (res.ok) setTracks(await res.json());
    } catch (err) {
      console.error(err);
    }
  }, []);

  const handleReady = useCallback((player: ReturnType<typeof useYouTubePlayer>) => {
    playerRef.current = player;
    player.setVolume(volume);
  }, [volume]);

  const handleVolumeChange = useCallback((v: number) => {
    setVolume(v);
    playerRef.current?.setVolume(v);
  }, []);

  if (configured === null) return null;

  if (!configured) return <SetupGuide />;

  return (
    <div className="flex flex-col gap-4 p-5 rounded-2xl bg-white/5 border border-white/10 min-w-[260px]">
      <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wider">Música</h3>

      <PlaylistSwitcher onSelect={loadTracks} />

      {tracks.length > 0 && (
        <>
          <YouTubePlayer
            tracks={tracks}
            onReady={handleReady}
          />
          <PlayerControls
            isReady={playerRef.current?.isReady ?? false}
            isPlaying={isPlaying}
            volume={volume}
            onPlay={() => { playerRef.current?.play(); setIsPlaying(true); }}
            onPause={() => { playerRef.current?.pause(); setIsPlaying(false); }}
            onNext={() => { playerRef.current?.next(); setCurrentIndex((i) => i + 1); }}
            onPrev={() => { playerRef.current?.prev(); setCurrentIndex((i) => Math.max(0, i - 1)); }}
            onVolumeChange={handleVolumeChange}
          />
          <TrackList
            tracks={tracks}
            currentIndex={currentIndex}
            onSelect={(i) => {
              setCurrentIndex(i);
            }}
          />
        </>
      )}

      {activePlaylistId && !tracks.length && (
        <p className="text-xs text-white/30 text-center py-2">Cargando tracks...</p>
      )}
    </div>
  );
}
