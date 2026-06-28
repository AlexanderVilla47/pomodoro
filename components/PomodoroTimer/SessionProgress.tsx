"use client";

interface SessionProgressProps {
  sessionCount: number;
  longBreakInterval: number;
}

export function SessionProgress({ sessionCount, longBreakInterval }: SessionProgressProps) {
  const completed = sessionCount % longBreakInterval;

  return (
    <div className="flex gap-2" aria-label={`${completed} de ${longBreakInterval} sesiones completadas`}>
      {Array.from({ length: longBreakInterval }, (_, i) => (
        <span
          key={i}
          className={`w-2 h-2 rounded-full transition-colors duration-300 ${
            i < completed ? "bg-mint" : "bg-white/20"
          }`}
        />
      ))}
    </div>
  );
}
