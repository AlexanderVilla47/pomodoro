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
  const [showAdd, setShowAdd] = useState(false);

  const onViewRef = useRef(onView);
  onViewRef.current = onView;

  useEffect(() => {
    fetch("/api/playlists")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: Playlist[] | null) => {
        if (!Array.isArray(data)) return;
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

  const handleDelete = useCallback(async () => {
    if (!viewedId) return;
    await fetch(`/api/playlists/${viewedId}`, { method: "DELETE" });
    setPlaylists((prev) => {
      const next = prev.filter((p) => p.playlist_id !== viewedId);
      const fallback = next[0]?.playlist_id ?? null;
      if (fallback) {
        localStorage.setItem(LS_KEY, fallback);
        onViewRef.current(fallback);
      } else {
        localStorage.removeItem(LS_KEY);
      }
      return next;
    });
    onDelete(viewedId);
  }, [viewedId, onDelete]);

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
      setShowAdd(false);
    } catch {
      setError("Error de red");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-1.5 flex-1 min-w-0">
      <div className="flex items-center gap-1.5">

        {/* Dropdown de playlists */}
        <div className="relative flex-1 min-w-0">
          <select
            value={viewedId ?? ""}
            onChange={(e) => handleView(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1 text-xs text-white appearance-none focus:outline-none focus:border-mint/50 pr-6 cursor-pointer"
          >
            {playlists.length === 0 && (
              <option value="" disabled>Sin playlists</option>
            )}
            {playlists.map((p) => (
              <option key={p.playlist_id} value={p.playlist_id} className="bg-gray-900">
                {p.playlist_id === playingId ? `♪ ${p.title}` : p.title}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-white/30 text-[10px]">▾</span>
        </div>

        {/* Borrar la seleccionada */}
        {viewedId && (
          <button
            onClick={handleDelete}
            title="Eliminar playlist"
            className="shrink-0 w-6 h-6 flex items-center justify-center rounded-md bg-white/5 border border-white/10 text-white/30 hover:text-red-400 hover:border-red-400/30 transition-colors text-xs"
          >
            ×
          </button>
        )}

        {/* Toggle agregar */}
        <button
          onClick={() => { setShowAdd((o) => !o); setError(null); }}
          title="Agregar playlist"
          className="shrink-0 w-6 h-6 flex items-center justify-center rounded-md bg-white/5 border border-white/10 text-white/30 hover:text-mint hover:border-mint/30 transition-colors text-xs"
        >
          {showAdd ? "✕" : "+"}
        </button>
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} className="flex gap-1">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Pegar URL de YouTube Music..."
            autoFocus
            className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white placeholder-white/30 focus:outline-none focus:border-mint/50"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-2.5 py-1 bg-mint/20 text-mint rounded-lg text-xs hover:bg-mint/30 disabled:opacity-50 shrink-0"
          >
            {loading ? "…" : "Agregar"}
          </button>
        </form>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
