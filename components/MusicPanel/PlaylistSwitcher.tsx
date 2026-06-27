"use client";

import { useState, useEffect, useCallback } from "react";
import type { Playlist } from "@/lib/db/queries/playlists";

const LS_KEY = "pomodoro_activePlaylist";

interface PlaylistSwitcherProps {
  onSelect: (playlistId: string) => void;
}

export function PlaylistSwitcher({ onSelect }: PlaylistSwitcherProps) {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/playlists")
      .then((r) => r.json())
      .then((data: Playlist[]) => {
        setPlaylists(data);
        const saved = localStorage.getItem(LS_KEY);
        const initial = saved ?? data[0]?.playlist_id ?? null;
        if (initial) {
          setActiveId(initial);
          onSelect(initial);
        }
      })
      .catch(console.error);
  }, [onSelect]);

  const handleSelect = useCallback(
    (id: string) => {
      setActiveId(id);
      localStorage.setItem(LS_KEY, id);
      onSelect(id);
    },
    [onSelect]
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
      handleSelect(playlist.playlist_id);
      setUrl("");
    } catch {
      setError("Error de red");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-1.5 flex-1 min-w-0">
      {/* chips + URL en una sola fila */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {playlists.map((p) => (
          <button
            key={p.playlist_id}
            onClick={() => handleSelect(p.playlist_id)}
            className={`px-2.5 py-0.5 rounded-full text-xs transition-colors whitespace-nowrap ${
              activeId === p.playlist_id
                ? "bg-mint text-black font-semibold"
                : "bg-white/10 text-white/60 hover:bg-white/20"
            }`}
          >
            {p.title}
          </button>
        ))}
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
