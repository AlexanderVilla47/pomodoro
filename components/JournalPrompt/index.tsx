"use client";

import { useState, useEffect, useCallback } from "react";
import type { WorkLogPayload } from "@/hooks/useWorkLogger";

interface JournalPromptProps {
  sessionId: number | null;
  onClose: () => void;
  onSaved: () => void;
  saveWorkLog: (p: WorkLogPayload) => Promise<void>;
  variant: "mobile" | "desktop";
}

const MAX_NOTES = 2000;
const MAX_TOPICS = 10;

export function JournalPrompt({
  sessionId,
  onClose,
  onSaved,
  saveWorkLog,
  variant,
}: JournalPromptProps) {
  const [notes, setNotes] = useState("");
  const [topics, setTopics] = useState<string[]>([]);
  const [chipDraft, setChipDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visible = sessionId !== null;

  useEffect(() => {
    if (sessionId === null) {
      setNotes("");
      setTopics([]);
      setChipDraft("");
      setSaving(false);
      setError(null);
    }
  }, [sessionId]);

  const commitChip = useCallback(() => {
    const trimmed = chipDraft.trim();
    if (!trimmed) return;
    if (!topics.includes(trimmed) && topics.length < MAX_TOPICS) {
      setTopics((prev) => [...prev, trimmed]);
    }
    setChipDraft("");
  }, [chipDraft, topics]);

  const handleChipKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" || e.key === ",") {
        e.preventDefault();
        commitChip();
      } else if (e.key === "Backspace" && chipDraft === "" && topics.length > 0) {
        setTopics((prev) => prev.slice(0, -1));
      }
    },
    [chipDraft, topics.length, commitChip]
  );

  const handleChipChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      if (val.endsWith(",")) {
        setChipDraft(val.slice(0, -1));
        setTimeout(commitChip, 0);
      } else {
        setChipDraft(val);
      }
    },
    [commitChip]
  );

  const handleSave = useCallback(async () => {
    if (sessionId === null || saving) return;
    const draft = chipDraft.trim();
    const finalTopics =
      draft && !topics.includes(draft) && topics.length < MAX_TOPICS
        ? [...topics, draft]
        : topics;
    setSaving(true);
    setError(null);
    try {
      await saveWorkLog({
        sessionId,
        notes: notes.trim() || null,
        topics: finalTopics,
      });
      onSaved();
    } catch {
      setError("Error al guardar. Intentá de nuevo.");
      setSaving(false);
    }
  }, [sessionId, saving, notes, topics, chipDraft, saveWorkLog, onSaved]);

  const notesOver = notes.length > MAX_NOTES;
  const topicsOver = topics.length >= MAX_TOPICS;
  const canSave = !saving && !notesOver;

  if (variant === "mobile") {
    return (
      <>
        {/* Backdrop */}
        <div
          className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 ${visible ? "opacity-100" : "opacity-0 pointer-events-none"}`}
          onClick={onClose}
        />
        {/* Sheet */}
        <div
          className={`fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl bg-[var(--color-bg)] border-t border-white/10 transition-transform duration-300 ease-out ${visible ? "translate-y-0" : "translate-y-full"}`}
          style={{ paddingBottom: "env(safe-area-inset-bottom, 16px)" }}
        >
          <JournalContent
            notes={notes}
            setNotes={setNotes}
            topics={topics}
            setTopics={setTopics}
            chipDraft={chipDraft}
            handleChipChange={handleChipChange}
            handleChipKeyDown={handleChipKeyDown}
            notesOver={notesOver}
            topicsOver={topicsOver}
            canSave={canSave}
            saving={saving}
            error={error}
            onSave={handleSave}
            onClose={onClose}
          />
        </div>
      </>
    );
  }

  /* Desktop: card flotante sobre el timer */
  return (
    <div className={`flex flex-col rounded-2xl bg-[var(--color-bg)] border border-white/10 shadow-2xl transition-all duration-200 ${visible ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"}`}>
      <JournalContent
        notes={notes}
        setNotes={setNotes}
        topics={topics}
        setTopics={setTopics}
        chipDraft={chipDraft}
        handleChipChange={handleChipChange}
        handleChipKeyDown={handleChipKeyDown}
        notesOver={notesOver}
        topicsOver={topicsOver}
        canSave={canSave}
        saving={saving}
        error={error}
        onSave={handleSave}
        onClose={onClose}
      />
    </div>
  );
}

interface JournalContentProps {
  notes: string;
  setNotes: (v: string) => void;
  topics: string[];
  setTopics: (fn: (prev: string[]) => string[]) => void;
  chipDraft: string;
  handleChipChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleChipKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  notesOver: boolean;
  topicsOver: boolean;
  canSave: boolean;
  saving: boolean;
  error: string | null;
  onSave: () => void;
  onClose: () => void;
}

function JournalContent({
  notes,
  setNotes,
  topics,
  setTopics,
  chipDraft,
  handleChipChange,
  handleChipKeyDown,
  notesOver,
  topicsOver,
  canSave,
  saving,
  error,
  onSave,
  onClose,
}: JournalContentProps) {
  return (
    <div className="flex flex-col">
      {/* Header compacto — fijo */}
      <div className="px-3 pt-3 pb-2 shrink-0">
        <p className="text-sm font-semibold text-white/90">¿En qué trabajaste?</p>
      </div>

      {/* Contenido scrollable */}
      <div className="overflow-y-auto no-scrollbar px-3 flex flex-col gap-2.5">
        {/* Topics */}
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap gap-1.5 bg-white/5 border border-white/10 rounded-xl p-2 min-h-[36px]">
            {topics.map((t) => (
              <span
                key={t}
                className="flex items-center gap-1 text-[11px] bg-[var(--color-mint)]/15 text-[var(--color-mint)] rounded-full px-2.5 py-0.5"
              >
                {t}
                <button
                  onClick={() => setTopics((prev) => prev.filter((x) => x !== t))}
                  className="text-[var(--color-mint)]/60 hover:text-[var(--color-mint)] leading-none"
                >
                  ×
                </button>
              </span>
            ))}
            {!topicsOver && (
              <input
                type="text"
                className="flex-1 min-w-[80px] bg-transparent text-[11px] text-white/80 placeholder:text-white/25 focus:outline-none"
                placeholder={topics.length === 0 ? "Tema: ej. Unidad 1, Sesión de trabajo..." : ""}
                value={chipDraft}
                onChange={handleChipChange}
                onKeyDown={handleChipKeyDown}
              />
            )}
          </div>
          {topicsOver && <p className="text-[10px] text-white/30">Máximo {MAX_TOPICS} temas</p>}
        </div>

        {/* Notes */}
        <div className="flex flex-col gap-0.5">
          <textarea
            className="w-full bg-white/5 border border-white/10 rounded-xl p-2.5 text-sm text-white/90 placeholder:text-white/25 resize-none focus:outline-none focus:border-[var(--color-mint)]/50 transition-colors"
            rows={4}
            placeholder="Descripción: ej. Resolví BFS en grafos, me trabé con el set de visitados..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={MAX_NOTES + 100}
          />
          <div className={`text-right text-[10px] ${notesOver ? "text-red-400" : "text-white/25"}`}>
            {notes.length}/{MAX_NOTES}
          </div>
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>

      {/* Botones — siempre visibles, fijos abajo */}
      <div className="flex gap-2 justify-end px-3 py-2.5 shrink-0 border-t border-white/5 mt-1">
        <button
          onClick={onClose}
          disabled={saving}
          className="px-4 py-1.5 text-xs text-white/40 hover:text-white/70 transition-colors disabled:opacity-40"
        >
          Saltar
        </button>
        <button
          onClick={onSave}
          disabled={!canSave}
          className="px-4 py-1.5 text-xs font-medium rounded-xl bg-[var(--color-mint)] text-[var(--color-bg)] hover:opacity-90 transition-opacity disabled:opacity-40"
        >
          {saving ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </div>
  );
}
