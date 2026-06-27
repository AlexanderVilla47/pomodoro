"use client";

interface PlayerControlsProps {
  isReady: boolean;
  isPlaying: boolean;
  volume: number;
  currentTime: number;
  duration: number;
  onPlay: () => void;
  onPause: () => void;
  onNext: () => void;
  onPrev: () => void;
  onVolumeChange: (v: number) => void;
  onSeek: (seconds: number) => void;
}

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export function PlayerControls({
  isReady,
  isPlaying,
  volume,
  currentTime,
  duration,
  onPlay,
  onPause,
  onNext,
  onPrev,
  onVolumeChange,
  onSeek,
}: PlayerControlsProps) {
  const btn =
    "p-2 rounded-full transition-all disabled:opacity-30 hover:bg-white/10 active:scale-95";

  return (
    <div className="flex flex-col gap-3">
      {/* Botones */}
      <div className="flex items-center justify-center gap-4">
        <button onClick={onPrev} disabled={!isReady} aria-label="Anterior" className={btn}>
          ⏮
        </button>
        <button
          onClick={isPlaying ? onPause : onPlay}
          disabled={!isReady}
          aria-label={isPlaying ? "Pausar" : "Reproducir"}
          className={`${btn} w-10 h-10 bg-mint/20 hover:bg-mint/30 text-mint`}
        >
          {isPlaying ? "⏸" : "▶"}
        </button>
        <button onClick={onNext} disabled={!isReady} aria-label="Siguiente" className={btn}>
          ⏭
        </button>
      </div>

      {/* Progreso */}
      <div className="flex flex-col gap-1">
        <input
          type="range"
          min={0}
          max={duration || 1}
          value={currentTime}
          onChange={(e) => onSeek(Number(e.target.value))}
          disabled={!isReady || duration === 0}
          aria-label="Progreso de canción"
          className="w-full accent-mint disabled:opacity-30"
        />
        <div className="flex justify-between text-xs text-white/40 px-0.5">
          <span>{fmt(currentTime)}</span>
          <span>{fmt(duration)}</span>
        </div>
      </div>

      {/* Volumen */}
      <div className="flex items-center gap-2">
        <span className="text-white/50 text-sm select-none">
          {volume === 0 ? "🔇" : volume < 50 ? "🔈" : "🔊"}
        </span>
        <input
          type="range"
          min={0}
          max={100}
          value={volume}
          onChange={(e) => onVolumeChange(Number(e.target.value))}
          aria-label="Volumen"
          className="flex-1 accent-mint"
        />
        <span className="text-xs text-white/40 w-7 text-right">{volume}</span>
      </div>
    </div>
  );
}
