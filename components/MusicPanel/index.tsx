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

  // Lo que se muestra en la lista
  const [viewedPlaylistId, setViewedPlaylistId] = useState<string | null>(null);
  const [viewedTracks, setViewedTracks] = useState<Track[]>([]);

  // Lo que está cargado en el player de YouTube
  const [playerPlaylistId, setPlayerPlaylistId] = useState<string | null>(null);

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
    if (player.isReady) player.setVolume(volume);
  }, [player.isReady]);

  useEffect(() => {
    if (player.playerState === 1 || player.playerState === 2) {
      const idx = player.getPlaylistIndex();
      if (idx >= 0) setCurrentIndex(idx);
    }
  }, [player.playerState]);

  // Cambiar la playlist que se ve en la lista — NO interrumpe la música
  const handleView = useCallback(
    async (playlistId: string) => {
      setViewedPlaylistId(playlistId);
      try {
        const res = await fetch(`/api/playlists/${playlistId}/tracks`);
        if (!res.ok) return;
        const tracks: Track[] = await res.json();
        setViewedTracks(tracks);

        // Solo cargar el player si no hay nada reproduciéndose aún
        setPlayerPlaylistId((current) => {
          if (!current) {
            player.loadPlayer("yt-player", tracks.map((t) => t.video_id));
            return playlistId;
          }
          return current;
        });
      } catch (err) {
        console.error(err);
      }
    },
    [player.loadPlayer]
  );

  const handleDelete = useCallback(
    (deletedId: string) => {
      if (viewedPlaylistId === deletedId) {
        setViewedPlaylistId(null);
        setViewedTracks([]);
      }
      setPlayerPlaylistId((cur) => (cur === deletedId ? null : cur));
    },
    [viewedPlaylistId]
  );

  // Click en un track: si es de otra playlist, cargar esa primero
  const handleTrackSelect = useCallback(
    (index: number) => {
      setCurrentIndex(index);
      if (viewedPlaylistId !== playerPlaylistId && viewedTracks.length) {
        player.loadPlayer("yt-player", viewedTracks.map((t) => t.video_id));
        setPlayerPlaylistId(viewedPlaylistId);
      }
      player.playAt(index);
    },
    [viewedPlaylistId, playerPlaylistId, viewedTracks, player.loadPlayer, player.playAt]
  );

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

      <div className="shrink-0 flex items-start gap-2">
        <span className="text-xs font-semibold text-white/50 uppercase tracking-wider whitespace-nowrap pt-1">
          Música
        </span>
        <PlaylistSwitcher
          viewedId={viewedPlaylistId}
          playingId={playerPlaylistId}
          onView={handleView}
          onDelete={handleDelete}
        />
      </div>

      {viewedTracks.length > 0 ? (
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

          <div className="flex-1 min-h-0">
            <TrackList
              tracks={viewedTracks}
              currentIndex={playerPlaylistId === viewedPlaylistId ? currentIndex : -1}
              onSelect={handleTrackSelect}
            />
          </div>
        </>
      ) : viewedPlaylistId ? (
        <p className="text-xs text-white/30 text-center py-2">Cargando tracks…</p>
      ) : null}
    </div>
  );
}
