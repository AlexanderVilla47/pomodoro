"use client";

import { useState, useEffect, useCallback } from "react";
import { SetupGuide } from "./SetupGuide";
import { YouTubePlayer } from "./YouTubePlayer";
import { PlayerControls } from "./PlayerControls";
import { TrackList } from "./TrackList";
import { PlaylistSwitcher } from "./PlaylistSwitcher";
import { useYouTubePlayer } from "@/hooks/useYouTubePlayer";
import type { Track } from "@/lib/db/queries/playlists";

export function MusicPanel() {
  const player = useYouTubePlayer();

  const [configured, setConfigured] = useState<boolean | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null);
  const [volume, setVolume] = useState(80);
  const [currentIndex, setCurrentIndex] = useState(0);

  const isPlaying = player.playerState === 1;

  useEffect(() => {
    fetch("/api/playlists/status")
      .then((r) => r.json())
      .then((d) => setConfigured(d.configured))
      .catch(() => setConfigured(false));
  }, []);

  useEffect(() => {
    if (!tracks.length) return;
    const videoIds = tracks.map((t) => t.video_id);
    player.loadPlayer("yt-player", videoIds);
  }, [tracks]);

  useEffect(() => {
    if (player.isReady) player.setVolume(volume);
  }, [player.isReady]);

  useEffect(() => {
    if (player.playerState === 1 || player.playerState === 2) {
      const idx = player.getPlaylistIndex();
      if (idx >= 0) setCurrentIndex(idx);
    }
  }, [player.playerState]);

  const loadTracks = useCallback(async (playlistId: string) => {
    setActivePlaylistId(playlistId);
    setCurrentIndex(0);
    try {
      const res = await fetch(`/api/playlists/${playlistId}/tracks`);
      if (res.ok) setTracks(await res.json());
    } catch (err) {
      console.error(err);
    }
  }, []);

  const handleVolumeChange = useCallback(
    (v: number) => {
      setVolume(v);
      player.setVolume(v);
    },
    [player.setVolume]
  );

  if (configured === null) return null;
  if (!configured) return <SetupGuide />;

  return (
    <div className="h-full flex flex-col gap-3 p-4 rounded-2xl bg-white/5 border border-white/10 min-h-0">

      {/* Header: título + playlist switcher en la misma fila */}
      <div className="shrink-0 flex items-start gap-2">
        <span className="text-xs font-semibold text-white/50 uppercase tracking-wider whitespace-nowrap pt-1">
          Música
        </span>
        <PlaylistSwitcher onSelect={loadTracks} />
      </div>

      {tracks.length > 0 ? (
        <>
          <YouTubePlayer />

          <div className="shrink-0">
            <PlayerControls
              isReady={player.isReady}
              isPlaying={isPlaying}
              volume={volume}
              currentTime={player.currentTime}
              duration={player.duration}
              onPlay={() => player.play()}
              onPause={() => player.pause()}
              onNext={() => player.next()}
              onPrev={() => player.prev()}
              onVolumeChange={handleVolumeChange}
              onSeek={(s) => player.seekTo(s)}
            />
          </div>

          {/* Track list: ocupa todo el espacio restante */}
          <div className="flex-1 min-h-0">
            <TrackList
              tracks={tracks}
              currentIndex={currentIndex}
              onSelect={(i) => {
                setCurrentIndex(i);
                player.playAt(i);
              }}
            />
          </div>
        </>
      ) : activePlaylistId ? (
        <p className="text-xs text-white/30 text-center py-2">Cargando tracks…</p>
      ) : null}
    </div>
  );
}
