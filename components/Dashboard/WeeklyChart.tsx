"use client";

const DAY_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

interface DayData {
  day: number;
  count: number;
  totalSeconds: number;
}

interface WeeklyChartProps {
  days: DayData[];
  todayIndex: number;
}

export function WeeklyChart({ days, todayIndex }: WeeklyChartProps) {
  const max = Math.max(...days.map((d) => d.totalSeconds), 1);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-end gap-1.5 h-20">
        {days.map((d, i) => {
          const heightPct = (d.totalSeconds / max) * 100;
          const isToday = i === todayIndex;
          return (
            <div key={i} className="flex flex-col items-center gap-1 flex-1">
              <div
                data-bar={i}
                className={`w-full rounded-t-sm transition-all duration-500 ${
                  isToday ? "bg-coral" : "bg-white/20"
                }`}
                style={{ height: `${Math.max(heightPct, 2)}%` }}
              />
              <span className="text-[10px] text-white/30">{DAY_LABELS[d.day % 7]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
