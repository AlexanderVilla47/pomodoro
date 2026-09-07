"use client";

import { useEffect, useMemo, useState } from "react";
import {
  groupByPeriod,
  compare,
  byLabel,
  type EfficiencyRow,
  type Granularity,
  type Direction,
  type Summary,
} from "@/lib/analytics/efficiency";
import type { UnitValue } from "@/components/Settings/UnitPicker";

interface StudyReportsProps {
  onBack: () => void;
  /** La unidad de avance del usuario. null = dejó de medir (o nunca midió). */
  unit: UnitValue | null;
}

/**
 * Con qué rotular cuando no hay unidad configurada.
 *
 * Pasa si alguien cargó datos y después dejó de medir: los chunks viejos siguen
 * ahí y hay que llamarlos de alguna forma. "unidad" es genérico pero nunca es
 * incorrecto, que es exactamente lo que se necesita para un rótulo de fallback.
 */
const UNIDAD_GENERICA: UnitValue = { singular: "unidad", plural: "unidades" };

/**
 * El nivel de una métrica, y con eso cuándo se muestra.
 *
 * `always` sale de las sesiones y existe desde el primer pomodoro. `units`
 * necesita que alguien haya cargado unidades: sin eso no vale cero, no existe.
 */
type Tier = "always" | "units";

/**
 * Las seis métricas, con su nivel y su dirección de mejora declarados.
 *
 * La dirección no es decorativa: min/unidad mejora BAJANDO y unidades/día
 * mejora SUBIENDO. Pintar de verde "todo lo que sube" marcaría como logro un
 * min/unidad que empeoró.
 *
 * El nivel tampoco: es una columna del registro y no un `if` por métrica, así
 * que agregar una sigue siendo agregar una entrada a este array.
 */
const METRICS: Array<{
  id: string;
  field: keyof Summary;
  /**
   * Función y no string: el rótulo lleva la unidad que eligió el usuario, y esa
   * unidad no se conoce hasta el render. Los `id` en cambio NO se tocan — son
   * identidad (alimentan los data-testid), no rótulo.
   */
  label: (u: UnitValue) => string;
  hint: string;
  direction: Direction;
  tier: Tier;
}> = [
  {
    id: "hours",
    field: "hours",
    label: () => "horas estudiadas",
    hint: "más es mejor",
    direction: "higher-is-better",
    tier: "always",
  },
  {
    id: "worked-days",
    field: "workedDays",
    label: () => "días trabajados",
    hint: "más es mejor",
    direction: "higher-is-better",
    tier: "always",
  },
  {
    id: "distractions-per-hour",
    field: "distractionsPerHour",
    label: () => "cortes/hora",
    hint: "menos es mejor",
    direction: "lower-is-better",
    tier: "always",
  },
  {
    id: "minutes-per-block",
    field: "minutesPerBlock",
    label: (u) => `min/${u.singular}`,
    hint: "menos es mejor",
    direction: "lower-is-better",
    tier: "units",
  },
  {
    id: "blocks-per-day",
    field: "blocksPerDay",
    label: (u) => `${u.plural}/día`,
    hint: "más es mejor",
    direction: "higher-is-better",
    tier: "units",
  },
  {
    // "días con avance" y no "días estudiados": ahora convive con "días
    // trabajados" y dos rótulos parecidos sobre números distintos se leen
    // como un bug.
    id: "study-days",
    field: "studyDays",
    label: () => "días con avance",
    hint: "más es mejor",
    direction: "higher-is-better",
    tier: "units",
  },
];

const TREND_COLOR: Record<string, string> = {
  better: "text-mint",
  worse: "text-coral",
  same: "text-white/30",
};

/** Las sesiones sin materia son un grupo más, no un dato a descartar. */
function labelKey(id: number | null): string {
  return id === null ? "sin-materia" : String(id);
}

function getTzOffset(): number {
  return -new Date().getTimezoneOffset();
}

function fmt(value: number | null): string {
  return value === null ? "—" : String(value);
}

function fmtPeriod(start: string, granularity: Granularity): string {
  const d = new Date(start + "T12:00:00Z");
  if (granularity === "month") {
    return d.toLocaleDateString("es-AR", { month: "short", timeZone: "UTC" });
  }
  return d.toLocaleDateString("es-AR", { day: "numeric", month: "short", timeZone: "UTC" });
}

export function StudyReports({ onBack, unit }: StudyReportsProps) {
  const u = unit ?? UNIDAD_GENERICA;
  const [rows, setRows] = useState<EfficiencyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [granularity, setGranularity] = useState<Granularity>("week");
  const [hiddenLabels, setHiddenLabels] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    fetch(`/api/stats/efficiency?tz=${getTzOffset()}`)
      .then((r) => {
        if (!r.ok) throw new Error("fetch failed");
        return r.json();
      })
      .then((data) => {
        if (cancelled) return;
        setRows(Array.isArray(data?.rows) ? data.rows : []);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /** Las materias que aparecen en los datos, para armar los chips. */
  const labels = useMemo(() => {
    const seen = new Map<string, { key: string; name: string; color: string | null }>();
    for (const r of rows) {
      const key = labelKey(r.label_id);
      if (!seen.has(key)) {
        seen.set(key, { key, name: r.label_name ?? "Sin materia", color: r.label_color });
      }
    }
    return [...seen.values()];
  }, [rows]);

  const visibleRows = useMemo(
    () => rows.filter((r) => !hiddenLabels.has(labelKey(r.label_id))),
    [rows, hiddenLabels]
  );

  const periods = useMemo(
    () => groupByPeriod(visibleRows, granularity),
    [visibleRows, granularity]
  );

  const current = periods.at(-1) ?? null;
  const previous = periods.at(-2) ?? null;

  /**
   * ¿Hay algo que medir en lo que se está mirando?
   *
   * Se pregunta sobre `periods` y no sobre `rows` a propósito: así respeta los
   * chips de materia. Filtrar hasta quedarse sólo con materias sin unidades
   * deja un panel coherente en vez de tres métricas en guión.
   *
   * Una métrica no se prende con un toggle: se calcula si hay con qué. Por eso
   * no existe una preferencia de "mostrar métricas de ritmo".
   */
  const hasUnits = periods.some((p) => p.totalUnits > 0);

  const visibleMetrics = METRICS.filter((m) => m.tier === "always" || hasUnits);

  const breakdown = useMemo(() => {
    if (!current) return [];
    return byLabel(
      visibleRows.filter((r) => groupByPeriod([r], granularity)[0]?.start === current.start)
    );
  }, [visibleRows, granularity, current]);

  function toggleLabel(key: string) {
    setHiddenLabels((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div className="h-full flex flex-col rounded-2xl bg-white/5 border border-white/10 overflow-hidden">
      {/* Header — fijo */}
      <div className="shrink-0 flex items-center gap-2 px-3 pt-3 pb-2">
        <button
          onClick={onBack}
          className="text-white/40 hover:text-white/70 transition-colors"
          aria-label="Volver a las estadísticas"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <p className="text-xs font-semibold text-white/80 flex-1">Informes de estudio</p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-3 pb-3 flex flex-col gap-3">
        {loading && (
          <div className="flex flex-col gap-2">
            <div className="h-20 bg-white/5 rounded-xl animate-pulse" />
            <div className="h-24 bg-white/5 rounded-xl animate-pulse" />
          </div>
        )}

        {error && !loading && (
          <p data-testid="reports-error" className="text-xs text-white/40 text-center py-3">
            No se pudieron cargar los informes.
          </p>
        )}

        {/*
          El vacío ya no puede culpar a las unidades: el informe arranca en las
          sesiones, así que lo único que lo deja vacío es no haber trabajado.
        */}
        {!loading && !error && rows.length === 0 && (
          <p data-testid="reports-empty" className="text-xs text-white/30 text-center py-4 leading-relaxed">
            Todavía no hay sesiones para medir.
            <br />
            Terminá un pomodoro y acá vas a ver tus horas, tus días y tus cortes.
          </p>
        )}

        {!loading && !error && rows.length > 0 && (
          <>
            {/* Granularidad */}
            <div className="shrink-0 flex gap-1 p-1 bg-white/5 rounded-xl">
              {(["week", "month"] as const).map((g) => (
                <button
                  key={g}
                  onClick={() => setGranularity(g)}
                  className={`flex-1 px-2 py-1 text-[11px] rounded-lg transition-colors ${
                    granularity === g
                      ? "bg-white/10 text-white font-medium"
                      : "text-white/40 hover:text-white/70"
                  }`}
                >
                  {g === "week" ? "Semana" : "Mes"}
                </button>
              ))}
            </div>

            {/* Chips de materia */}
            {labels.length > 1 && (
              <div className="shrink-0 flex flex-wrap gap-1.5">
                {labels.map((l) => {
                  const on = !hiddenLabels.has(l.key);
                  const color = l.color ?? "#5ABFA8";
                  return (
                    <button
                      key={l.key}
                      onClick={() => toggleLabel(l.key)}
                      aria-pressed={on}
                      className="text-[10px] px-2 py-0.5 rounded-full font-medium transition-opacity"
                      style={{
                        backgroundColor: on ? color + "22" : "transparent",
                        color: on ? color : "rgba(255,255,255,0.25)",
                        border: `1px solid ${on ? color + "44" : "rgba(255,255,255,0.1)"}`,
                      }}
                    >
                      {l.name}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Período actual y su comparación */}
            {current && (
              <div className="flex flex-col gap-2 p-3 rounded-xl bg-white/5 border border-white/10">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs uppercase tracking-wider text-white/40">
                    {granularity === "week" ? "Esta semana" : "Este mes"}
                  </span>
                  {previous && (
                    <span className="text-[10px] text-white/25">
                      vs {granularity === "week" ? "la anterior" : "el anterior"}
                    </span>
                  )}
                </div>

                {visibleMetrics.map((m) => {
                  const value = current[m.field] as number | null;
                  const prev = previous ? (previous[m.field] as number | null) : null;
                  const delta = previous ? compare(value, prev, m.direction) : null;
                  return (
                    <div key={m.id} className="flex items-baseline gap-2">
                      <span className="text-lg font-bold text-white" data-testid={`metric-${m.id}`}>
                        {fmt(value)}
                      </span>
                      <span className="text-[11px] text-white/50 flex-1">{m.label(u)}</span>
                      {delta && delta.trend && (
                        <span
                          data-testid={`trend-${m.id}`}
                          data-trend={delta.trend}
                          title={m.hint}
                          className={`text-[10px] font-medium ${TREND_COLOR[delta.trend]}`}
                        >
                          {delta.trend === "same"
                            ? "="
                            : `${delta.diff !== null && delta.diff > 0 ? "↑" : "↓"} ${Math.abs(delta.diff ?? 0)}`}
                        </span>
                      )}
                    </div>
                  );
                })}

              </div>
            )}

            {/* Series por período — las dos son de unidades */}
            {hasUnits &&
              periods.length > 1 &&
              (["minutesPerBlock", "blocksPerDay"] as const).map((field) => {
                const max = Math.max(...periods.map((p) => p[field] ?? 0), 1);
                const title =
                  field === "minutesPerBlock" ? `min/${u.singular}` : `${u.plural}/día`;
                return (
                  <div
                    key={field}
                    data-testid={`series-${field}`}
                    className="flex flex-col gap-2 p-3 rounded-xl bg-white/5 border border-white/10"
                  >
                    <span className="text-xs uppercase tracking-wider text-white/40">{title}</span>
                    <div className="flex items-end gap-1 h-16">
                      {periods.slice(-12).map((p) => (
                        <div key={p.start} className="flex-1 flex flex-col items-center gap-1">
                          <div className="w-full flex-1 flex items-end">
                            <div
                              className="w-full rounded-t bg-mint/60"
                              style={{ height: `${((p[field] ?? 0) / max) * 100}%` }}
                              title={`${fmt(p[field])} ${title}`}
                            />
                          </div>
                          <span className="text-[8px] text-white/25 truncate w-full text-center">
                            {fmtPeriod(p.start, granularity)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

            {/* Desglose por materia — muestra min/unidad y nada más */}
            {hasUnits && breakdown.length > 0 && (
              <div
                data-testid="label-breakdown"
                className="flex flex-col gap-2 p-3 rounded-xl bg-white/5 border border-white/10"
              >
                <span className="text-xs uppercase tracking-wider text-white/40">
                  Por materia
                </span>
                {breakdown.map((l) => (
                  <div
                    key={labelKey(l.label_id)}
                    data-testid={`label-row-${labelKey(l.label_id)}`}
                    data-label-name={l.label_name ?? "Sin materia"}
                    className="flex items-baseline gap-2"
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: l.label_color ?? "#5ABFA8" }}
                    />
                    <span className="text-[11px] text-white/60 flex-1 truncate">
                      {l.label_name ?? "Sin materia"}
                    </span>
                    <span className="text-[11px] text-white/80 font-medium">
                      {fmt(l.minutesPerBlock)}
                    </span>
                    <span className="text-[10px] text-white/30">min/{u.singular}</span>
                  </div>
                ))}
              </div>
            )}

          </>
        )}
      </div>
    </div>
  );
}
