"use client";

import { useEffect, useState } from "react";
import { StatsCard } from "./StatsCard";
import { WeeklyChart } from "./WeeklyChart";

interface Stats {
  today: { count: number; total_seconds: number };
  week: { count: number; total_seconds: number };
}

interface DashboardProps {
  refreshTrigger: number;
}

function getTzOffset(): number {
  return -new Date().getTimezoneOffset();
}

export function Dashboard({ refreshTrigger }: DashboardProps) {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    const tz = getTzOffset();
    fetch(`/api/stats?tz=${tz}`)
      .then((r) => r.json())
      .then(setStats)
      .catch(console.error);
  }, [refreshTrigger]);

  const todayIndex = new Date().getDay();

  const days = Array.from({ length: 7 }, (_, i) => ({
    day: (todayIndex - 6 + i + 7) % 7,
    count: 0,
    totalSeconds: 0,
  }));

  return (
    <div className="flex flex-col gap-4 p-5 rounded-2xl bg-white/5 border border-white/10">
      <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wider">Progreso</h3>

      <div className="grid grid-cols-2 gap-3">
        <StatsCard
          label="Hoy"
          count={stats?.today.count ?? 0}
          totalSeconds={stats?.today.total_seconds ?? 0}
        />
        <StatsCard
          label="Esta semana"
          count={stats?.week.count ?? 0}
          totalSeconds={stats?.week.total_seconds ?? 0}
        />
      </div>

      <WeeklyChart days={days} todayIndex={6} />
    </div>
  );
}
