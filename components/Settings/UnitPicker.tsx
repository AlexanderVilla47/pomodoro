"use client";

import { UNIT_PRESETS } from "@/lib/preferences";

export interface UnitValue {
  singular: string;
  plural: string;
}

interface UnitPickerProps {
  value: UnitValue | null;
  onChange: (next: UnitValue | null) => void;
  /**
   * Ofrece dejar de medir. Sólo en Configuración: adentro del journal la salida
   * es no tocar nada, no un botón para apagar algo que todavía no prendiste.
   */
  allowClear?: boolean;
}

/**
 * La unidad se elige de una lista cerrada y nada más.
 *
 * Hubo un camino de texto libre con campos de singular y plural: para usar un
 * timer había que conjugar un plural adentro de un panel de configuración. El
 * plural existía porque `pluralizeEs` no puede adivinar los préstamos ("card"
 * da "cardes"), o sea que el campo estaba exponiendo una limitación interna
 * como si fuera una decisión del usuario.
 *
 * Los presets traen el plural ya escrito, así que nadie ve un campo de plural
 * nunca más. Una unidad vieja escrita a mano sigue viva en la base y en el
 * historial — `resolvePreferences` la sigue normalizando — pero no se puede
 * volver a elegir, y la lista no la marca.
 */
export function UnitPicker({ value, onChange, allowClear = false }: UnitPickerProps) {
  const chip = (activo: boolean) =>
    `text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
      activo
        ? "bg-[var(--color-mint)]/15 text-[var(--color-mint)] border-[var(--color-mint)]/40"
        : "bg-white/5 text-white/50 border-white/10 hover:text-white/80 hover:bg-white/10"
    }`;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        {UNIT_PRESETS.map((preset) => {
          const activo = value?.singular === preset.singular;
          return (
            <button
              key={preset.singular}
              type="button"
              aria-pressed={activo}
              onClick={() => onChange({ singular: preset.singular, plural: preset.plural })}
              className={chip(activo)}
            >
              {preset.plural}
            </button>
          );
        })}
      </div>

      {/*
        Separado de los chips a propósito: apaga la medición entera, no es una
        opción más de la lista. Sin el bloque de texto libre en el medio queda
        pegado a los chips y se lee como si fuera otro.
      */}
      {allowClear && value && (
        <div className="pt-2 border-t border-white/5">
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-[10px] text-white/30 hover:text-white/60 transition-colors"
          >
            No medir mi avance
          </button>
        </div>
      )}
    </div>
  );
}
