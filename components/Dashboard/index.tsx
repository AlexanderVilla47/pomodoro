"use client";

import { useEffect, useState } from "react";
import { StatsCard } from "./StatsCard";

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

  return (
    <div className="flex flex-col gap-2 p-3 rounded-2xl bg-white/5 border border-white/10">
      <div className="grid grid-cols-2 gap-2">
        <StatsCard
          label="Hoy"
          count={stats?.today.count ?? 0}
          totalSeconds={stats?.today.total_seconds ?? 0}
          isLoading={stats === null}
        />
        <StatsCard
          label="Esta semana"
          count={stats?.week.count ?? 0}
          totalSeconds={stats?.week.total_seconds ?? 0}
          isLoading={stats === null}
        />
      </div>

    </div>
  );
}
