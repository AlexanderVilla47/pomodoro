"use client";

import { useEffect, useState } from "react";
import { StatsCard } from "./StatsCard";
import { ContributionGraph } from "./ContributionGraph";

interface Stats {
  today: { count: number; total_seconds: number };
  week: { count: number; total_seconds: number };
}

interface LabelStat {
  id: number;
  name: string;
  color: string;
  count: number;
  total_seconds: number;
}

interface DashboardProps {
  refreshTrigger: number;
}

function getTzOffset(): number {
  return -new Date().getTimezoneOffset();
}

function fmtTime(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

export function Dashboard({ refreshTrigger }: DashboardProps) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [labelStats, setLabelStats] = useState<LabelStat[]>([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const tz = getTzOffset();
    fetch(`/api/stats?tz=${tz}`)
      .then((r) => r.json())
      .then(setStats)
      .catch(console.error);
  }, [refreshTrigger]);

  useEffect(() => {
    if (!expanded) return;
    fetch("/api/labels?stats=1")
      .then((r) => r.json())
      .then(setLabelStats)
      .catch(console.error);
  }, [expanded, refreshTrigger]);

  return (
    <div className="relative">
      {/* Card principal — altura fija, no se mueve */}
      <div className="flex flex-col gap-3 p-5 rounded-2xl bg-white/5 border border-white/10">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wider">Progreso</h3>
          <button
            onClick={() => setExpanded((e) => !e)}
            className="text-xs text-white/30 hover:text-white/60 transition-colors"
          >
            {expanded ? "▴ ocultar" : "▾ historial"}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
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

      {/* Historial: flota encima del MusicPanel, no desplaza el layout */}
      {expanded && (
        <div className="absolute top-full left-0 right-0 mt-1 z-10 p-5 rounded-2xl bg-[var(--color-bg)] border border-white/10 max-h-[60vh] overflow-y-auto no-scrollbar">
          <ContributionGraph />

          {labelStats.length > 0 && (
            <div className="flex flex-col gap-2 pt-3">
              <span className="text-xs text-white/30 uppercase tracking-wider">Por etiqueta</span>
              <div className="flex flex-col gap-1.5">
                {labelStats.map((l) => (
                  <div key={l.id} className="flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: l.color }}
                    />
                    <span className="text-xs text-white/70 flex-1 truncate">{l.name}</span>
                    <span className="text-xs text-white/40">{l.count} sesiones</span>
                    <span className="text-xs font-medium" style={{ color: l.color }}>
                      {fmtTime(l.total_seconds)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
