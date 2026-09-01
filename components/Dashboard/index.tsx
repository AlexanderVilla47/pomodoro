"use client";

import { useCallback, useEffect, useState } from "react";
import { StatsCard } from "./StatsCard";
import { StudyReports } from "./StudyReports";

interface Stats {
  today: { count: number; total_seconds: number; distraction_count: number };
  week: { count: number; total_seconds: number; distraction_count: number };
}

export type DashboardView = "cards" | "analysis";

interface DashboardProps {
  refreshTrigger: number;
  /**
   * El padre necesita saberlo para estirar el panel: en desktop el bloque de
   * stats está capado en `max-h-[45%]`, que no alcanza para los informes.
   */
  onViewChange?: (view: DashboardView) => void;
}

function getTzOffset(): number {
  return -new Date().getTimezoneOffset();
}


export function Dashboard({ refreshTrigger, onViewChange }: DashboardProps) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [view, setView] = useState<DashboardView>("cards");

  useEffect(() => {
    const tz = getTzOffset();
    fetch(`/api/stats?tz=${tz}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data?.today) setStats(data); })
      .catch(console.error);
  }, [refreshTrigger]);

  const openReports = useCallback(() => {
    setView("analysis");
    onViewChange?.("analysis");
  }, [onViewChange]);

  const closeReports = useCallback(() => {
    setView("cards");
    onViewChange?.("cards");
  }, [onViewChange]);

  const today = stats?.today ?? null;
  const week = stats?.week ?? null;

  // ── Vista: informes ──
  if (view === "analysis") {
    return <StudyReports onBack={closeReports} />;
  }

  // ── Vista: tarjetas ──
  return (
    <div className="flex flex-col gap-2 p-3 rounded-2xl bg-white/5 border border-white/10">
      {/*
        Tres columnas en vez de dos, con la tercera al ancho del contenido.
        Una tercera TARJETA no entra: en 360px cada una quedaría en ~106px y
        el número en text-2xl más "sesiones" necesita ~84px de los 82 útiles.
        El botón se lleva ~48px y deja las tarjetas en ~140px, que sí entran.
      */}
      <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
        <StatsCard
          label="Hoy"
          count={today?.count ?? 0}
          totalSeconds={today?.total_seconds ?? 0}
          distractionCount={today?.distraction_count ?? 0}
          isLoading={today === null}
        />
        <StatsCard
          label="Esta semana"
          count={week?.count ?? 0}
          totalSeconds={week?.total_seconds ?? 0}
          distractionCount={week?.distraction_count ?? 0}
          isLoading={week === null}
        />
        {/*
          Un gráfico con flecha, no un "+": el más significa "agregar", y acá
          no se crea nada, se entra a un lugar.
        */}
        <button
          onClick={openReports}
          aria-label="Ver informes de estudio"
          title="Informes de estudio"
          className="flex flex-col items-center justify-center gap-1.5 w-12 rounded-xl bg-white/5 border border-white/10 text-white/40 hover:text-white hover:bg-white/10 transition-colors"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <path d="M3 3v18h18" />
            <path d="M7 15l4-5 3 3 5-7" />
          </svg>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
      </div>

    </div>
  );
}
