"use client";

import { useState, useEffect, useCallback } from "react";

const PRESET_COLORS = [
  "#5ABFA8",
  "#E85D75",
  "#7C6FCD",
  "#4A9EDB",
  "#F5A623",
  "#6BCB77",
];

export interface Label {
  id: number;
  name: string;
  color: string;
}

interface Props {
  selectedId: number | null;
  onChange: (label: Label | null) => void;
}

export function LabelSelector({ selectedId, onChange }: Props) {
  const [labels, setLabels] = useState<Label[]>([]);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);

  const fetchLabels = useCallback(() => {
    fetch("/api/labels")
      .then((r) => r.json())
      .then(setLabels)
      .catch(console.error);
  }, []);

  useEffect(() => {
    fetchLabels();
  }, [fetchLabels]);

  const create = async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;

    const res = await fetch("/api/labels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed, color: newColor }),
    });

    if (res.ok) {
      const label: Label = await res.json();
      setLabels((prev) =>
        [...prev, label].sort((a, b) => a.name.localeCompare(b.name))
      );
      onChange(label);
      setCreating(false);
      setNewName("");
      setNewColor(PRESET_COLORS[0]);
    }
  };

  const remove = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    await fetch(`/api/labels/${id}`, { method: "DELETE" });
    setLabels((prev) => prev.filter((l) => l.id !== id));
    if (selectedId === id) onChange(null);
  };

  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs text-white/30 uppercase tracking-wider shrink-0">
          Etiqueta
        </span>

        <button
          onClick={() => onChange(null)}
          className={`px-3 py-1 rounded-full text-xs transition-all border ${
            selectedId === null
              ? "bg-white/15 border-white/30 text-white"
              : "border-white/10 text-white/30 hover:text-white/50"
          }`}
        >
          Ninguna
        </button>

        {labels.map((label) => {
          const active = selectedId === label.id;
          return (
            <button
              key={label.id}
              onClick={() => onChange(active ? null : label)}
              className="group relative px-3 py-1 rounded-full text-xs transition-all border"
              style={
                active
                  ? { backgroundColor: label.color, borderColor: "transparent", color: "#000", fontWeight: 600 }
                  : { borderColor: label.color + "55", color: "rgba(255,255,255,0.65)" }
              }
            >
              {label.name}
              <span
                onClick={(e) => remove(e, label.id)}
                className="hidden group-hover:inline ml-1 opacity-50 hover:opacity-100 text-[10px]"
              >
                ×
              </span>
            </button>
          );
        })}

        {!creating && (
          <button
            onClick={() => setCreating(true)}
            className="px-3 py-1 rounded-full text-xs border border-dashed border-white/20 text-white/30 hover:text-white/60 hover:border-white/40 transition-all"
          >
            + Nueva
          </button>
        )}
      </div>

      {creating && (
        <div className="flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2">
          <input
            autoFocus
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") create();
              if (e.key === "Escape") {
                setCreating(false);
                setNewName("");
              }
            }}
            placeholder="Nombre de etiqueta..."
            className="flex-1 min-w-0 bg-transparent text-sm text-white placeholder-white/25 outline-none"
          />
          <div className="flex gap-1 shrink-0">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setNewColor(c)}
                className={`w-4 h-4 rounded-full transition-transform ${
                  newColor === c ? "scale-125 ring-2 ring-white/50" : "opacity-60 hover:opacity-100"
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <button
            onClick={create}
            className="text-xs text-white/60 hover:text-white px-2 shrink-0"
          >
            ✓
          </button>
          <button
            onClick={() => { setCreating(false); setNewName(""); }}
            className="text-xs text-white/30 hover:text-white/60 shrink-0"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
