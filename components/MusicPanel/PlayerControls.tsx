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

const IconPrev = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
    <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" />
  </svg>
);

const IconNext = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
    <path d="M6 18l8.5-6L6 6v12zm8.5-6v6H17V6h-2.5v6z" />
  </svg>
);

const IconPlay = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M7 4.5v15l13-7.5z" />
  </svg>
);

const IconPause = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
  </svg>
);

const IconVolumeMute = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
    <path d="M16.5 12A4.5 4.5 0 0 0 14 7.97v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.796 8.796 0 0 0 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3 3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06A8.99 8.99 0 0 0 17.73 18l2 2L21 18.73l-9-9L4.27 3zM12 4 9.91 6.09 12 8.18V4z" />
  </svg>
);

const IconVolumeLow = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
    <path d="M18.5 12A4.5 4.5 0 0 0 16 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z" />
  </svg>
);

const IconVolumeHigh = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
  </svg>
);

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
    "inline-flex items-center justify-center p-2 rounded-full transition-all disabled:opacity-30 hover:bg-white/10 active:scale-95 text-white/70 hover:text-white";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-center gap-4">
        <button onClick={onPrev} disabled={!isReady} aria-label="Anterior" className={btn}>
          <IconPrev />
        </button>
        <button
          onClick={isPlaying ? onPause : onPlay}
          disabled={!isReady}
          aria-label={isPlaying ? "Pausar" : "Reproducir"}
          className={`${btn} w-10 h-10 bg-mint/20 hover:bg-mint/30 !text-mint`}
        >
          {isPlaying ? <IconPause /> : <IconPlay />}
        </button>
        <button onClick={onNext} disabled={!isReady} aria-label="Siguiente" className={btn}>
          <IconNext />
        </button>
      </div>

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

      <div className="flex items-center gap-2">
        <span className="text-white/50">
          {volume === 0 ? <IconVolumeMute /> : volume < 50 ? <IconVolumeLow /> : <IconVolumeHigh />}
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
