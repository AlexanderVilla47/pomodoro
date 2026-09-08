"use client";

import { UNIT_PRESETS } from "@/lib/preferences";

export interface UnitValue {
  singular: string;
  plural: string;
}

interface UnitPickerProps {
  value: UnitValue | null;
  /** Sólo emite unidades: apagar la medición no es asunto de este componente. */
  onChange: (next: UnitValue) => void;
}

/**
 * Elegir ENTRE unidades. Nada más que eso.
 *
 * No ofrece dejar de medir: eso lo decide quien lo monta. En Configuración es
 * la casilla "Medir mi avance", que además esconde esta lista cuando está
 * destildada; adentro del journal la salida es no tocar nada. Tener acá un
 * botón de apagado daba dos formas de expresar lo mismo, y la de acá se leía
 * como una opción más de la lista.
 *
 * Hubo también un camino de texto libre con campos de singular y plural: para
 * usar un timer había que conjugar un plural. El plural existía porque
 * `pluralizeEs` no puede adivinar los préstamos ("card" da "cardes"), o sea que
 * el campo exponía una limitación interna como si fuera una decisión del
 * usuario. Los presets lo traen ya escrito.
 *
 * Una unidad vieja escrita a mano sigue viva en la base y en el historial —
 * `resolvePreferences` la sigue normalizando — pero no se puede volver a
 * elegir, y la lista no la marca.
 */
export function UnitPicker({ value, onChange }: UnitPickerProps) {
  const chip = (activo: boolean) =>
    `text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
      activo
        ? "bg-[var(--color-mint)]/15 text-[var(--color-mint)] border-[var(--color-mint)]/40"
        : "bg-white/5 text-white/50 border-white/10 hover:text-white/80 hover:bg-white/10"
    }`;

  return (
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
  );
}
