"use client";

interface PlayerControlsProps {
  isReady: boolean;
  isPlaying: boolean;
  volume: number;
  onPlay: () => void;
  onPause: () => void;
  onNext: () => void;
  onPrev: () => void;
  onVolumeChange: (v: number) => void;
}

export function PlayerControls({
  isReady,
  isPlaying,
  volume,
  onPlay,
  onPause,
  onNext,
  onPrev,
  onVolumeChange,
}: PlayerControlsProps) {
  const btn = "p-2 rounded-full transition-all disabled:opacity-30 hover:bg-white/10 active:scale-95";

  return (
    <div className="flex flex-col gap-3">
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
      <input
        type="range"
        min={0}
        max={100}
        value={volume}
        onChange={(e) => onVolumeChange(Number(e.target.value))}
        aria-label="Volumen"
        className="w-full accent-mint"
      />
    </div>
  );
}
