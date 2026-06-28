"use client";

import { useState } from "react";
import type { Settings } from "@/lib/db/queries/settings";

interface SettingsPanelProps {
  settings: Settings;
  onSave: (patch: Partial<Omit<Settings, "id">>) => void;
}

export function SettingsPanel({ settings, onSave }: SettingsPanelProps) {
  const [workMin, setWorkMin] = useState(String(settings.work_duration / 60));
  const [shortMin, setShortMin] = useState(String(settings.short_break_duration / 60));
  const [longMin, setLongMin] = useState(String(settings.long_break_duration / 60));
  const [interval, setIntervalVal] = useState(String(settings.long_break_interval));
  const [sound, setSound] = useState(settings.notification_sound_enabled);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const handleSubmit = (e: { preventDefault(): void }) => {
    e.preventDefault();
    setError(null);

    const work = parseInt(workMin, 10);
    const short = parseInt(shortMin, 10);
    const long = parseInt(longMin, 10);
    const iv = parseInt(interval, 10);

    if (!work || work < 1 || work > 120) {
      setError("Tiempo de enfoque: debe ser entre 1 y 120 minutos");
      return;
    }
    if (!short || short < 1 || short > 60) {
      setError("Descanso corto: debe ser entre 1 y 60 minutos");
      return;
    }
    if (!long || long < 1 || long > 60) {
      setError("Descanso largo: debe ser entre 1 y 60 minutos");
      return;
    }
    if (!iv || iv < 1 || iv > 10) {
      setError("Intervalo: debe ser entre 1 y 10");
      return;
    }

    onSave({
      work_duration: work * 60,
      short_break_duration: short * 60,
      long_break_duration: long * 60,
      long_break_interval: iv,
      notification_sound_enabled: sound,
    });

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const field = "flex flex-col gap-1";
  const label = "text-xs text-white/50";
  const input =
    "bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white w-full focus:outline-none focus:border-mint/50";

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4 p-5 rounded-2xl bg-white/5 border border-white/10">
      <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wider">Configuración</h3>

      {error && (
        <p role="alert" className="text-xs text-red-400 bg-red-400/10 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 items-end">
        <div className={field}>
          <label htmlFor="work_duration" className={label}>
            Tiempo de enfoque (min)
          </label>
          <input
            id="work_duration"
            type="number"
            min={1}
            max={120}
            value={workMin}
            onChange={(e) => setWorkMin(e.target.value)}
            className={input}
          />
        </div>

        <div className={field}>
          <label htmlFor="short_break" className={label}>
            Descanso corto (min)
          </label>
          <input
            id="short_break"
            type="number"
            min={1}
            max={60}
            value={shortMin}
            onChange={(e) => setShortMin(e.target.value)}
            className={input}
          />
        </div>

        <div className={field}>
          <label htmlFor="interval" className={label}>
            Intervalos hasta descanso largo
          </label>
          <input
            id="interval"
            type="number"
            min={1}
            max={10}
            value={interval}
            onChange={(e) => setIntervalVal(e.target.value)}
            className={input}
          />
        </div>

        <div className={field}>
          <label htmlFor="long_break" className={label}>
            Descanso largo (min)
          </label>
          <input
            id="long_break"
            type="number"
            min={1}
            max={60}
            value={longMin}
            onChange={(e) => setLongMin(e.target.value)}
            className={input}
          />
        </div>
      </div>

      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={sound}
          onChange={(e) => setSound(e.target.checked)}
          className="w-4 h-4 accent-mint"
        />
        <span className="text-sm text-white/60">Sonido de notificación</span>
      </label>

      <button
        type="submit"
        className="w-full py-2 rounded-lg bg-mint/20 text-mint font-semibold text-sm hover:bg-mint/30 transition-colors"
      >
        {saved ? "✓ Guardado" : "Guardar"}
      </button>

      <p className="text-xs text-white/30 text-center">
        Los cambios se aplican en la próxima sesión
      </p>
    </form>
  );
}
