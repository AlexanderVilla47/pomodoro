"use client";

import { useState, useEffect, useCallback } from "react";
import { SetupGuide } from "./SetupGuide";
import { YouTubePlayer } from "./YouTubePlayer";
import { PlayerControls } from "./PlayerControls";
import { TrackList } from "./TrackList";
import { PlaylistSwitcher } from "./PlaylistSwitcher";
import { SpotifyPanel } from "./SpotifyPanel";
import { useYouTubePlayer } from "@/hooks/useYouTubePlayer";
import type { Track } from "@/lib/db/queries/playlists";

type Source = "youtube" | "spotify";

export function MusicPanel() {
  const player = useYouTubePlayer();
  const [source, setSource] = useState<Source>("youtube");
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
  if (source === "youtube" && !configured) return (
    <div className="h-full flex flex-col gap-3 p-4 rounded-2xl bg-white/5 border border-white/10 min-h-0">
      <SourceToggle source={source} onChange={setSource} />
      <SetupGuide />
    </div>
  );

  return (
    <div className="h-full flex flex-col gap-3 p-4 rounded-2xl bg-white/5 border border-white/10 min-h-0">

      <div className="shrink-0 flex items-center justify-between gap-2">
        <SourceToggle source={source} onChange={setSource} />
      </div>

      {source === "spotify" ? (
        <SpotifyPanel />
      ) : (
        <>
          <div className="shrink-0 flex items-start gap-2">
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
        </>
      )}
    </div>
  );
}

function SourceToggle({ source, onChange }: { source: Source; onChange: (s: Source) => void }) {
  return (
    <div className="flex gap-1 bg-white/5 rounded-lg p-0.5 shrink-0">
      <button
        onClick={() => onChange("youtube")}
        className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
          source === "youtube" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"
        }`}
      >
        YouTube
      </button>
      <button
        onClick={() => onChange("spotify")}
        className={`px-3 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
          source === "spotify" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"
        }`}
      >
        <svg viewBox="0 0 24 24" className="w-3 h-3" fill="currentColor">
          <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
        </svg>
        Spotify
      </button>
    </div>
  );
}
