"use client";

import { useState, useEffect, useRef, useCallback } from "react";

const MONTHS = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const DAY_LABELS = ["", "Lun", "", "Mié", "", "Vie", ""];

const CELL = 10;
const GAP = 3;
const DAY_COL_W = 22;

function getColor(seconds: number): string {
  if (seconds === 0) return "rgba(255,255,255,0.07)";
  const m = seconds / 60;
  if (m < 30)  return "rgba(255,255,255,0.28)";
  if (m < 60)  return "rgba(255,255,255,0.52)";
  if (m < 120) return "rgba(255,255,255,0.76)";
  return "rgba(255,255,255,0.95)";
}

function fmtDuration(s: number): string {
  if (!s) return "Sin sesiones";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

function fmtDate(dateStr: string): string {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

interface DayData { date: string; total_seconds: number; }
interface Cell { date: string; seconds: number; inYear: boolean; }

function buildWeeks(year: number, dataMap: Map<string, number>): Cell[][] {
  const jan1 = new Date(Date.UTC(year, 0, 1));
  const cur = new Date(jan1);
  cur.setUTCDate(1 - jan1.getUTCDay()); // retroceder al domingo anterior

  const weeks: Cell[][] = [];
  while (true) {
    const week: Cell[] = [];
    for (let d = 0; d < 7; d++) {
      const y = cur.getUTCFullYear();
      const mo = String(cur.getUTCMonth() + 1).padStart(2, "0");
      const da = String(cur.getUTCDate()).padStart(2, "0");
      const dateStr = `${y}-${mo}-${da}`;
      week.push({ date: dateStr, seconds: dataMap.get(dateStr) ?? 0, inYear: y === year });
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
    weeks.push(week);
    if (cur.getUTCFullYear() > year) break;
  }
  return weeks;
}

function getMonthLabels(weeks: Cell[][]): { name: string; col: number }[] {
  const labels: { name: string; col: number }[] = [];
  let last = -1;
  weeks.forEach((week, wi) => {
    const first = week.find((d) => d.inYear);
    if (first) {
      const month = parseInt(first.date.slice(5, 7), 10) - 1;
      if (month !== last) { labels.push({ name: MONTHS[month], col: wi }); last = month; }
    }
  });
  return labels;
}

interface Props {
  initialYear?: number;
  onDateClick?: (date: string) => void;
  selectedDate?: string | null;
  cellSize?: number;
  confirmTap?: boolean;
  onPendingChange?: (date: string | null, label: string | null) => void;
}

export function ContributionGraph({ initialYear, onDateClick, selectedDate, cellSize: cellSizeProp, confirmTap, onPendingChange }: Props) {
  const cell = cellSizeProp ?? CELL;
  const dayColW = Math.round(DAY_COL_W * cell / CELL);
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(initialYear ?? currentYear);
  const [weeks, setWeeks] = useState<Cell[][]>([]);
  const [years, setYears] = useState<number[]>([currentYear]);
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [pendingDate, setPendingDate] = useState<string | null>(null);

  const handleCellClick = useCallback((day: Cell) => {
    if (!day.inYear || !onDateClick) return;
    if (confirmTap) {
      if (pendingDate === day.date) {
        onDateClick(day.date);
        setPendingDate(null);
        onPendingChange?.(null, null);
      } else {
        setPendingDate(day.date);
        onPendingChange?.(day.date, fmtDate(day.date));
      }
    } else {
      onDateClick(day.date);
    }
  }, [confirmTap, pendingDate, onDateClick, onPendingChange]);

  useEffect(() => {
    const tz = -new Date().getTimezoneOffset();
    fetch(`/api/stats/heatmap?year=${year}&tz=${tz}`)
      .then((r) => r.json())
      .then(({ days, years: ys }: { days: DayData[]; years: number[] }) => {
        const map = new Map<string, number>(days.map((d) => [d.date, d.total_seconds]));
        setWeeks(buildWeeks(year, map));
        setYears(ys);
      })
      .catch(console.error);
  }, [year]);

  // Centrar el día de hoy al mostrar el gráfico
  useEffect(() => {
    if (!weeks.length || !scrollRef.current) return;
    const today = new Date().toISOString().slice(0, 10);
    const todayCol = weeks.findIndex((week) => week.some((d) => d.date === today));
    if (todayCol === -1) return;
    const colPos = dayColW + todayCol * (cell + GAP);
    const half = scrollRef.current.clientWidth / 2;
    scrollRef.current.scrollLeft = Math.max(0, colPos - half + cell / 2);
  }, [weeks, cell, dayColW]);

  const monthLabels = getMonthLabels(weeks);
  const gridW = weeks.length * (cell + GAP) - GAP;

  return (
    <div className="flex flex-col gap-2 select-none">
      {/* Selector de año */}
      <div className="flex gap-1 flex-wrap justify-end">
        {years.map((y) => (
          <button
            key={y}
            onClick={() => setYear(y)}
            className={`px-2 py-0.5 rounded text-xs transition-colors ${
              y === year ? "bg-mint text-black font-semibold" : "text-white/30 hover:text-white/60"
            }`}
          >
            {y}
          </button>
        ))}
      </div>

      {/* Gráfico — scroll horizontal sin barra visible */}
      <div ref={scrollRef} className="overflow-x-auto no-scrollbar">
        <div style={{ width: dayColW + gridW }}>

          {/* Etiquetas de meses */}
          <div style={{ position: "relative", height: 14, marginLeft: dayColW }}>
            {monthLabels.map(({ name, col }) => (
              <span
                key={name + col}
                style={{ position: "absolute", left: col * (cell + GAP), fontSize: 10, color: "rgba(255,255,255,0.3)" }}
              >
                {name}
              </span>
            ))}
          </div>

          {/* Fila: etiquetas de días + columnas de semanas */}
          <div style={{ display: "flex", gap: 0 }}>

            {/* Días (Lun, Mié, Vie) */}
            <div style={{ display: "flex", flexDirection: "column", gap: GAP, width: dayColW }}>
              {DAY_LABELS.map((label, i) => (
                <div
                  key={i}
                  style={{ height: cell, fontSize: 9, color: "rgba(255,255,255,0.3)", display: "flex", alignItems: "center" }}
                >
                  {label}
                </div>
              ))}
            </div>

            {/* Semanas */}
            <div style={{ display: "flex", gap: GAP }}>
              {weeks.map((week, wi) => (
                <div key={wi} style={{ display: "flex", flexDirection: "column", gap: GAP }}>
                  {week.map((day, di) => (
                    <div
                      key={di}
                      style={{
                        width: cell,
                        height: cell,
                        borderRadius: Math.round(cell / 5),
                        backgroundColor: day.inYear ? getColor(day.seconds) : "transparent",
                        cursor: day.inYear ? "pointer" : "default",
                        outline: selectedDate === day.date
                          ? "2px solid rgba(255,255,255,0.7)"
                          : pendingDate === day.date
                          ? "2px solid rgba(255,255,255,0.35)"
                          : undefined,
                        outlineOffset: 1,
                      }}
                      onClick={day.inYear ? () => handleCellClick(day) : undefined}
                      onMouseEnter={
                        day.inYear
                          ? (e) => {
                              const r = e.currentTarget.getBoundingClientRect();
                              setTooltip({
                                text: `${fmtDate(day.date)} — ${fmtDuration(day.seconds)}`,
                                x: r.left + cell / 2,
                                y: r.top,
                              });
                            }
                          : undefined
                      }
                      onMouseLeave={() => setTooltip(null)}
                    />
                  ))}
                </div>
              ))}
            </div>

          </div>
        </div>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 px-2 py-1 rounded-lg bg-[#1a1a24] border border-white/10 text-xs text-white/80 pointer-events-none whitespace-nowrap"
          style={{ left: tooltip.x, top: tooltip.y - 34, transform: "translateX(-50%)" }}
        >
          {tooltip.text}
        </div>
      )}
    </div>
  );
}
