"use client";

import type { Track } from "@/lib/db/queries/playlists";

interface TrackListProps {
  tracks: Track[];
  currentIndex: number;
  onSelect: (index: number) => void;
}

export function TrackList({ tracks, currentIndex, onSelect }: TrackListProps) {
  if (!tracks.length) {
    return <p className="text-sm text-white/30 text-center py-4">Sin tracks</p>;
  }

  return (
    <ul className="flex flex-col gap-0.5 h-full overflow-y-auto no-scrollbar">
      {tracks.map((track, i) => (
        <li key={track.id}>
          <button
            onClick={() => onSelect(i)}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
              i === currentIndex
                ? "bg-mint/20 text-mint font-medium"
                : "text-white/60 hover:bg-white/5 hover:text-white"
            }`}
          >
            <span className="mr-2 text-xs opacity-50">{i + 1}.</span>
            {track.title}
          </button>
        </li>
      ))}
    </ul>
  );
}
