"use client";

import { useEffect, useState, useCallback } from "react";
import { fmtTime } from "@/lib/format";
import { ContributionGraph } from "@/components/Dashboard/ContributionGraph";
import type { WorkLogRow } from "@/lib/db/queries/work-logs";

interface HistorialProps {
  refreshTrigger: number;
  onViewChange?: (view: "calendar" | "day") => void;
  cellSize?: number;
  confirmTap?: boolean;
}

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtLocalDate(dateStr: string): string {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function getTzOffset(): number {
  return -new Date().getTimezoneOffset();
}

export function Historial({ refreshTrigger, onViewChange, cellSize, confirmTap }: HistorialProps) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dayLogs, setDayLogs] = useState<WorkLogRow[]>([]);
  const [dayLoading, setDayLoading] = useState(false);
  const [dayError, setDayError] = useState<string | null>(null);
  const [pendingLabel, setPendingLabel] = useState<string | null>(null);

  const fetchByDate = useCallback(async (date: string) => {
    setDayLoading(true);
    setDayError(null);
    try {
      const tz = getTzOffset();
      const res = await fetch(`/api/work-logs?date=${encodeURIComponent(date)}&tz=${tz}&limit=50`);
      if (!res.ok) throw new Error("fetch failed");
      const data = await res.json();
      setDayLogs(data.logs ?? []);
    } catch {
      setDayError("Error al cargar las sesiones.");
      setDayLogs([]);
    } finally {
      setDayLoading(false);
    }
  }, []);

  const handleDateClick = useCallback((date: string) => {
    setSelectedDate(date);
    fetchByDate(date);
    onViewChange?.("day");
  }, [fetchByDate, onViewChange]);

  const handleBack = useCallback(() => {
    setSelectedDate(null);
    setDayLogs([]);
    onViewChange?.("calendar");
  }, [onViewChange]);

  useEffect(() => {
    setSelectedDate(null);
    setDayLogs([]);
    onViewChange?.("calendar");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTrigger]);

  // ── Vista: sesiones del día ──
  if (selectedDate) {
    return (
      <div className="h-full flex flex-col rounded-2xl bg-white/5 border border-white/10 overflow-hidden">
        {/* Header — fijo */}
        <div className="shrink-0 flex items-center gap-2 px-3 pt-3 pb-2">
          <button
            onClick={handleBack}
            className="text-white/40 hover:text-white/70 transition-colors"
            aria-label="Volver al calendario"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <p className="text-xs font-semibold text-white/80 capitalize flex-1">
            {fmtLocalDate(selectedDate)}
          </p>
        </div>

        {/* Contenido — scrolleable internamente */}
        <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-3 pb-3 flex flex-col gap-3">

        {/* Loading */}
        {dayLoading && (
          <div className="flex flex-col gap-2">
            <div className="h-12 bg-white/5 rounded-xl animate-pulse" />
            <div className="h-12 bg-white/5 rounded-xl animate-pulse" />
          </div>
        )}

        {/* Error */}
        {dayError && !dayLoading && (
          <p className="text-xs text-white/40 text-center py-2">{dayError}</p>
        )}

        {/* Empty */}
        {!dayLoading && !dayError && dayLogs.length === 0 && (
          <p className="text-xs text-white/30 text-center py-3">
            No hay notas para este día.
          </p>
        )}

        {/* Sessions list */}
        {!dayLoading && dayLogs.length > 0 && (
          <div className="flex flex-col relative">
            <div className="absolute left-[7px] top-2 bottom-2 w-px bg-white/10" />
            {dayLogs.map((log) => {
              const dotColor = log.label_color ?? "#5ABFA8";
              return (
                <div key={log.id} className="flex gap-3 pb-3 last:pb-0">
                  <div className="shrink-0 w-[15px] flex justify-center pt-1">
                    <div
                      className="w-2 h-2 rounded-full ring-2 ring-[var(--color-bg)]"
                      style={{ backgroundColor: dotColor }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center flex-wrap gap-1.5 mb-1.5">
                      <span className="text-[10px] text-white/30">{formatTime(log.started_at)}</span>
                      <span className="text-[10px] text-white/30">·</span>
                      <span className="text-[10px] text-white/50">{fmtTime(log.actual_duration)}</span>
                      {log.label_name && (
                        <>
                          <span className="text-[10px] text-white/30">·</span>
                          <span
                            className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                            style={{ backgroundColor: dotColor + "22", color: dotColor }}
                          >
                            {log.label_name}
                          </span>
                        </>
                      )}
                    </div>

                    {log.notes === null && log.topics.length === 0 ? (
                      <p className="text-[11px] text-white/25 italic">Sin detalles</p>
                    ) : (
                      <p className="text-xs text-white/60 whitespace-pre-wrap leading-relaxed">
                        {log.topics.length > 0 && (
                          <span className="text-white/80 font-medium not-italic">
                            {log.topics.join(", ")}
                            {log.notes ? " : " : ""}
                          </span>
                        )}
                        {log.notes ?? ""}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        </div>
      </div>
    );
  }

  // ── Vista: calendario ──
  return (
    <div className="flex flex-col gap-2 p-3 rounded-2xl bg-white/5 border border-white/10 overflow-hidden">
      <ContributionGraph
        onDateClick={handleDateClick}
        selectedDate={selectedDate}
        cellSize={cellSize}
        confirmTap={confirmTap}
        onPendingChange={(_date, label) => setPendingLabel(label)}
      />
      <p className="text-[10px] text-center transition-colors mt-2" style={{ color: pendingLabel ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.25)" }}>
        {pendingLabel ? `${pendingLabel} — tocá de nuevo para abrir` : confirmTap ? "Tocá dos veces una fecha para ver las sesiones" : "Tocá una fecha para ver las sesiones"}
      </p>
    </div>
  );
}
