"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { Playlist } from "@/lib/db/queries/playlists";

const LS_KEY = "pomodoro_activePlaylist";

interface PlaylistSwitcherProps {
  viewedId: string | null;
  playingId: string | null;
  onView: (playlistId: string) => void;
  onDelete: (playlistId: string) => void;
}

export function PlaylistSwitcher({ viewedId, playingId, onView, onDelete }: PlaylistSwitcherProps) {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ref so the initial useEffect doesn't re-run when onView changes
  const onViewRef = useRef(onView);
  onViewRef.current = onView;

  useEffect(() => {
    fetch("/api/playlists")
      .then((r) => r.json())
      .then((data: Playlist[]) => {
        setPlaylists(data);
        const saved = localStorage.getItem(LS_KEY);
        const initial = saved ?? data[0]?.playlist_id ?? null;
        if (initial) onViewRef.current(initial);
      })
      .catch(console.error);
  }, []);

  const handleView = useCallback(
    (id: string) => {
      localStorage.setItem(LS_KEY, id);
      onView(id);
    },
    [onView]
  );

  const handleDelete = useCallback(
    async (e: React.MouseEvent, playlistId: string) => {
      e.stopPropagation();
      await fetch(`/api/playlists/${playlistId}`, { method: "DELETE" });
      setPlaylists((prev) => prev.filter((p) => p.playlist_id !== playlistId));
      if (localStorage.getItem(LS_KEY) === playlistId) localStorage.removeItem(LS_KEY);
      onDelete(playlistId);
    },
    [onDelete]
  );

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/playlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      if (!res.ok) {
        const body = await res.json();
        setError(body.error ?? "Error al agregar playlist");
        return;
      }
      const { playlist } = await res.json();
      setPlaylists((prev) => [playlist, ...prev.filter((p) => p.playlist_id !== playlist.playlist_id)]);
      handleView(playlist.playlist_id);
      setUrl("");
    } catch {
      setError("Error de red");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-1.5 flex-1 min-w-0">
      <div className="flex items-center gap-1.5 flex-wrap">
        {playlists.map((p) => {
          const isViewed = viewedId === p.playlist_id;
          const isPlaying = playingId === p.playlist_id;
          return (
            <button
              key={p.playlist_id}
              onClick={() => handleView(p.playlist_id)}
              className={`group flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs transition-colors whitespace-nowrap ${
                isViewed
                  ? "bg-mint text-black font-semibold"
                  : "bg-white/10 text-white/60 hover:bg-white/20"
              }`}
            >
              {isPlaying && !isViewed && (
                <span className="text-mint text-[9px]">♪</span>
              )}
              {p.title}
              <span
                onClick={(e) => handleDelete(e, p.playlist_id)}
                className="hidden group-hover:inline opacity-40 hover:opacity-80 ml-0.5"
              >
                ×
              </span>
            </button>
          );
        })}

        <form onSubmit={handleAdd} className="flex gap-1 flex-1 min-w-[120px]">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Pegar URL de YouTube Music..."
            className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white placeholder-white/30 focus:outline-none focus:border-mint/50"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-2.5 py-1 bg-mint/20 text-mint rounded-lg text-xs hover:bg-mint/30 disabled:opacity-50 shrink-0"
          >
            {loading ? "…" : "+"}
          </button>
        </form>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
