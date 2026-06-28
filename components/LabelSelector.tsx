"use client";

import { useState, useEffect, useCallback, useRef } from "react";

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
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedLabel = labels.find((l) => l.id === selectedId) ?? null;

  const fetchLabels = useCallback(() => {
    fetch("/api/labels")
      .then((r) => r.json())
      .then(setLabels)
      .catch(console.error);
  }, []);

  useEffect(() => {
    fetchLabels();
  }, [fetchLabels]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setCreating(false);
        setNewName("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

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
      setLabels((prev) => [...prev, label].sort((a, b) => a.name.localeCompare(b.name)));
      onChange(label);
      setOpen(false);
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
    <div ref={containerRef} className="relative">
      {/* Botón trigger */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white/70 hover:bg-white/10 transition-all"
      >
        {selectedLabel ? (
          <>
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: selectedLabel.color }} />
            <span className="font-medium" style={{ color: selectedLabel.color }}>{selectedLabel.name}</span>
          </>
        ) : (
          <span className="text-white/35 text-xs">¿En qué trabajás?</span>
        )}
        <span className="text-white/25 text-[10px] ml-1">{open ? "▲" : "▼"}</span>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full left-0 mt-1 z-30 min-w-[190px] rounded-xl bg-[#16161f] border border-white/10 shadow-2xl py-1 overflow-hidden">
          {/* Sin etiqueta */}
          <button
            onClick={() => { onChange(null); setOpen(false); }}
            className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-white/5 ${
              selectedId === null ? "text-white" : "text-white/45"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-white/20 shrink-0" />
            Sin etiqueta
            {selectedId === null && <span className="ml-auto text-white/40 text-xs">✓</span>}
          </button>

          {labels.map((label) => (
            <button
              key={label.id}
              onClick={() => { onChange(label); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-white/5 group"
            >
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: label.color }} />
              <span
                className={`flex-1 text-left ${
                  selectedId === label.id ? "font-medium text-white" : "text-white/65"
                }`}
              >
                {label.name}
              </span>
              {selectedId === label.id && (
                <span className="text-white/40 text-xs">✓</span>
              )}
              <span
                onClick={(e) => remove(e, label.id)}
                className="hidden group-hover:inline text-white/25 hover:text-white/60 text-xs ml-1"
              >
                ×
              </span>
            </button>
          ))}

          <div className="border-t border-white/5 mt-1 pt-1">
            {!creating ? (
              <button
                onClick={() => setCreating(true)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white/35 hover:text-white/60 hover:bg-white/5 transition-colors"
              >
                + Nueva etiqueta
              </button>
            ) : (
              <div className="px-3 py-2 flex flex-col gap-2">
                <input
                  autoFocus
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") create();
                    if (e.key === "Escape") { setCreating(false); setNewName(""); }
                  }}
                  placeholder="Nombre..."
                  className="w-full bg-white/5 rounded-lg px-2 py-1.5 text-sm text-white placeholder-white/25 outline-none border border-white/10 focus:border-white/30 transition-colors"
                />
                <div className="flex items-center gap-1.5">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setNewColor(c)}
                      className={`w-4 h-4 rounded-full transition-transform ${
                        newColor === c ? "scale-125 ring-2 ring-white/50" : "opacity-55 hover:opacity-100"
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                  <button
                    onClick={create}
                    className="ml-auto text-xs text-white/55 hover:text-white px-1"
                  >
                    ✓
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
