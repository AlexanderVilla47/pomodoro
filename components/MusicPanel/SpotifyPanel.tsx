"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSpotifyPlayer, type SpotifyPlayerStatus } from "@/hooks/useSpotifyPlayer";
import { PlayerControls } from "./PlayerControls";
import type { SpotifyPlaylist, SpotifyTrack } from "@/lib/spotify/client";

function statusMessage(status: SpotifyPlayerStatus): string | null {
  if (status === "loading") return "Iniciando reproductor…";
  if (status === "premium_required") return "Necesitás Spotify Premium para reproducir música en el browser.";
  if (status === "error") return "Error al conectar con Spotify. Intentá reconectar tu cuenta.";
  return null;
}

export function SpotifyPanel() {
  const player = useSpotifyPlayer();

  const [connected, setConnected] = useState<boolean | null>(null);
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [playlistsError, setPlaylistsError] = useState(false);
  const [viewedId, setViewedId] = useState<string | null>(null);
  const [tracks, setTracks] = useState<SpotifyTrack[]>([]);
  const [tracksLoading, setTracksLoading] = useState(false);
  const [tracksError, setTracksError] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [volume, setVolume] = useState(80);
  const onViewRef = useRef(setViewedId);

  const loadPlaylists = useCallback(() => {
    setPlaylistsError(false);
    fetch("/api/spotify/playlists")
      .then((r) => r.json())
      .then((data) => {
        setConnected(data.connected);
        if (data.connected) {
          if (data.error) {
            setPlaylistsError(true);
          } else if (data.playlists?.length) {
            setPlaylists(data.playlists);
            onViewRef.current(data.playlists[0].id);
          }
        }
      })
      .catch(() => setConnected(false));
  }, []);

  useEffect(() => {
    loadPlaylists();
  }, [loadPlaylists]);

  // Init SDK once we know user is connected
  useEffect(() => {
    if (connected) player.initSDK();
  }, [connected]);

  useEffect(() => {
    if (!viewedId) return;
    setTracks([]);
    setTracksError(false);
    setTracksLoading(true);
    fetch(`/api/spotify/playlists/${viewedId}`)
      .then((r) => r.json())
      .then((data: unknown) => {
        if (Array.isArray(data)) {
          setTracks(data as SpotifyTrack[]);
        } else {
          setTracksError(true);
        }
      })
      .catch(() => setTracksError(true))
      .finally(() => setTracksLoading(false));
  }, [viewedId]);

  useEffect(() => {
    if (player.currentTrackUri) {
      const idx = tracks.findIndex((t) => t.uri === player.currentTrackUri);
      if (idx >= 0) setCurrentIndex(idx);
    }
  }, [player.currentTrackUri, tracks]);

  const handleView = useCallback((id: string) => setViewedId(id), []);

  const handleDisconnect = useCallback(async () => {
    player.disconnect();
    await fetch("/api/spotify/disconnect", { method: "DELETE" });
    setConnected(false);
    setPlaylists([]);
    setTracks([]);
  }, [player.disconnect]);

  const handleTrackSelect = useCallback(
    (index: number) => {
      setCurrentIndex(index);
      player.loadAndPlay(tracks.map((t) => t.uri), index);
    },
    [tracks, player.loadAndPlay]
  );

  const handleVolumeChange = useCallback(
    (v: number) => {
      setVolume(v);
      player.setVolume(v);
    },
    [player.setVolume]
  );

  if (connected === null) return null;

  if (!connected) {
    return (
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-4 p-6">
        <div className="text-center space-y-2">
          <svg viewBox="0 0 24 24" className="w-10 h-10 mx-auto" fill="#1DB954">
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
          </svg>
          <p className="text-sm text-white/60">Conectá tu cuenta de Spotify</p>
          <p className="text-xs text-white/30">Requiere Spotify Premium para reproducción en el browser</p>
        </div>
        <a
          href="/api/auth/spotify"
          className="flex items-center gap-2 bg-[#1DB954] text-black font-semibold text-sm px-5 py-2.5 rounded-full hover:bg-[#1ed760] transition-colors"
        >
          Conectar Spotify
        </a>
      </div>
    );
  }

  const msg = statusMessage(player.status);

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-3">
      {/* Playlist tabs */}
      <div className="shrink-0 flex items-center gap-1.5 flex-wrap">
        {playlists.map((p) => (
          <button
            key={p.id}
            onClick={() => handleView(p.id)}
            className={`px-2.5 py-0.5 rounded-full text-xs transition-colors whitespace-nowrap ${
              viewedId === p.id
                ? "bg-[#1DB954] text-black font-semibold"
                : "bg-white/10 text-white/60 hover:bg-white/20"
            }`}
          >
            {p.name}
          </button>
        ))}
        <button
          onClick={handleDisconnect}
          className="ml-auto text-xs text-white/20 hover:text-white/50 transition-colors"
        >
          Desconectar
        </button>
      </div>

      {/* Playlists error */}
      {playlistsError && (
        <div className="shrink-0 text-center py-1">
          <p className="text-xs text-white/40">No se pudieron cargar las playlists.</p>
          <button onClick={loadPlaylists} className="mt-1 text-xs text-mint hover:underline">
            Reintentar
          </button>
        </div>
      )}

      {/* SDK status / error */}
      {msg && (
        <div className="shrink-0 text-center py-1">
          <p className="text-xs text-white/40">{msg}</p>
          {player.status === "error" && (
            <button
              onClick={handleDisconnect}
              className="mt-2 text-xs text-[#1DB954] hover:underline"
            >
              Reconectar cuenta
            </button>
          )}
        </div>
      )}

      {/* Now Playing — visible whenever algo suena, aunque no se haya iniciado desde acá */}
      {player.isReady && (
        <div className="shrink-0">
          {player.currentTrackName ? (
            <div className="mb-1 px-1">
              <p className="text-xs font-medium text-white truncate">{player.currentTrackName}</p>
              <p className="text-[10px] text-white/40 truncate">{player.currentArtistName}</p>
            </div>
          ) : (
            <p className="text-xs text-white/30 text-center mb-1">
              Conectado · seleccioná &ldquo;Pomodoro&rdquo; en tu app de Spotify
            </p>
          )}
          <PlayerControls
            isReady={player.isReady}
            isPlaying={player.isPlaying}
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
      )}

      {/* Track list de la playlist seleccionada */}
      {tracks.length > 0 && (
        <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar flex flex-col gap-0.5">
          {tracks.map((t, i) => (
            <button
              key={t.uri}
              onClick={() => handleTrackSelect(i)}
              className={`w-full text-left px-2 py-1.5 rounded-lg text-xs transition-colors ${
                t.uri === player.currentTrackUri
                  ? "bg-[#1DB954]/20 text-[#1DB954]"
                  : "text-white/60 hover:bg-white/5 hover:text-white"
              }`}
            >
              <span className="font-medium truncate block">{t.name}</span>
              <span className="text-white/30 truncate block">{t.artistName}</span>
            </button>
          ))}
        </div>
      )}

      {/* Estado de carga / vacío / error cuando no hay tracks */}
      {!tracks.length && (
        <>
          {tracksLoading && (
            <p className="text-xs text-white/30 text-center py-2">Cargando tracks…</p>
          )}
          {!tracksLoading && tracksError && (
            <p className="text-xs text-red-400/70 text-center py-2">
              Error al cargar los tracks. Probá reconectar tu cuenta.
            </p>
          )}
          {!tracksLoading && !tracksError && viewedId && (
            <p className="text-xs text-white/30 text-center py-2">Esta playlist está vacía.</p>
          )}

          {/* A continuación — cola del SDK cuando no hay lista de playlist */}
          {!tracksLoading && player.nextTracks.length > 0 && (
            <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar flex flex-col gap-0.5">
              <p className="text-[10px] text-white/25 px-2 pb-1 uppercase tracking-wider">A continuación</p>
              {player.nextTracks.map((t) => (
                <div key={t.uri} className="w-full text-left px-2 py-1.5 rounded-lg text-xs text-white/50">
                  <span className="font-medium truncate block">{t.name}</span>
                  <span className="text-white/25 truncate block">{t.artists[0]?.name ?? ""}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
