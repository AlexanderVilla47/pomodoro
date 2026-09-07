"use client";

import { useState } from "react";
import { UNIT_PRESETS, pluralizeEs, validateUnit } from "@/lib/preferences";

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

const ERRORES: Record<string, string> = {
  empty: "Escribí una unidad.",
  "too-long": "Máximo 24 caracteres.",
  "is-time":
    "Pomy ya mide tu tiempo solo. Elegí algo que produzcas: páginas, ejercicios, cards…",
};

function esPreset(singular: string): boolean {
  return UNIT_PRESETS.some((p) => p.singular === singular);
}

export function UnitPicker({ value, onChange, allowClear = false }: UnitPickerProps) {
  // Una unidad que no está en la lista se escribió a mano: arrancar los campos
  // con ella es lo que permite corregir un plural sin volver a tipear todo.
  const custom = value && !esPreset(value.singular) ? value : null;

  const [singular, setSingular] = useState(custom?.singular ?? "");
  const [plural, setPlural] = useState(custom?.plural ?? "");
  const [pluralTouched, setPluralTouched] = useState(custom !== null);
  const [error, setError] = useState<string | null>(null);

  const handleSingular = (next: string) => {
    setSingular(next);
    setError(null);
    // El plural sigue al singular hasta que alguien lo edita. Después no se
    // pisa nunca más: la app adivina una vez y el usuario tiene la última
    // palabra, que es todo el punto de guardarlo aparte.
    if (!pluralTouched) setPlural(pluralizeEs(next));
  };

  const handlePlural = (next: string) => {
    setPlural(next);
    setPluralTouched(true);
  };

  const commitCustom = () => {
    const check = validateUnit(singular);
    if (!check.ok) {
      setError(ERRORES[check.reason]);
      return;
    }
    const limpio = singular.trim();
    onChange({ singular: limpio, plural: plural.trim() || pluralizeEs(limpio) });
    setError(null);
  };

  const chip = (activo: boolean) =>
    `text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
      activo
        ? "bg-[var(--color-mint)]/15 text-[var(--color-mint)] border-[var(--color-mint)]/40"
        : "bg-white/5 text-white/50 border-white/10 hover:text-white/80 hover:bg-white/10"
    }`;

  const input =
    "bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white w-full focus:outline-none focus:border-[var(--color-mint)]/50";

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

      <div className="flex flex-col gap-1.5">
        <div className="flex gap-1.5 items-end">
          <div className="flex-1 flex flex-col gap-0.5">
            <label htmlFor="unit-singular" className="text-[10px] text-white/35">
              o escribí tu unidad
            </label>
            <input
              id="unit-singular"
              type="text"
              value={singular}
              onChange={(e) => handleSingular(e.target.value)}
              placeholder="kata"
              className={input}
            />
          </div>
          <div className="flex-1 flex flex-col gap-0.5">
            <label htmlFor="unit-plural" className="text-[10px] text-white/35">
              plural
            </label>
            <input
              id="unit-plural"
              type="text"
              value={plural}
              onChange={(e) => handlePlural(e.target.value)}
              placeholder="katas"
              className={input}
            />
          </div>
          <button
            type="button"
            onClick={commitCustom}
            className="shrink-0 px-3 py-1.5 text-xs font-medium rounded-lg bg-white/10 text-white/70 hover:bg-white/20 transition-colors"
          >
            Usar
          </button>
        </div>

        {error && (
          <p role="alert" className="text-[10px] text-red-400 leading-relaxed">
            {error}
          </p>
        )}
      </div>

      {allowClear && value && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="self-start text-[10px] text-white/30 hover:text-white/60 transition-colors"
        >
          No medir mi avance
        </button>
      )}
    </div>
  );
}
