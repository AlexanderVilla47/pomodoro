"use client";

import { useState, useCallback, useEffect } from "react";
import { TimerProvider } from "@/context/TimerContext";
import { PomodoroTimer } from "@/components/PomodoroTimer";
import { MusicPanel } from "@/components/MusicPanel";
import { Dashboard } from "@/components/Dashboard";
import { SettingsPanel } from "@/components/Settings/SettingsPanel";
import { Confetti } from "@/components/Confetti";
import { LabelSelector } from "@/components/LabelSelector";
import type { Label } from "@/components/LabelSelector";
import { useSettings } from "@/hooks/useSettings";
import { requestNotificationPermission } from "@/lib/notifications";
import type { Settings } from "@/lib/db/queries/settings";
import { UserBadge } from "@/components/UserBadge";

function AppContent() {
  const { settings, updateSettings } = useSettings();
  const [statsVersion, setStatsVersion] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState<Label | null>(null);

  const handleSessionComplete = useCallback(() => {
    setStatsVersion((v) => v + 1);
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 1200);
  }, []);

  useEffect(() => {
    requestNotificationPermission().catch(() => {});
  }, []);

  if (!settings) return null;

  return (
    <TimerProvider
      settings={settings}
      onSessionLogged={handleSessionComplete}
      selectedLabelId={selectedLabel?.id ?? null}
    >
      <div className="h-screen overflow-hidden bg-[var(--color-bg)] text-white">
        <div className="h-full max-w-6xl mx-auto px-4 flex gap-8">

          {/* Izquierda: timer centrado, label selector arriba a la izquierda */}
          <div className="flex-1 flex flex-col items-center justify-center relative">
            <Confetti trigger={showConfetti} />
            <div className="absolute top-4 left-0">
              <LabelSelector selectedId={selectedLabel?.id ?? null} onChange={setSelectedLabel} />
            </div>
            <PomodoroTimer labelColor={selectedLabel?.color} />
          </div>

          {/* Derecha: columna flex, MusicPanel toma el espacio restante */}
          <div className="w-[440px] shrink-0 flex flex-col gap-3 py-6 overflow-hidden">

            <div className="shrink-0">
              <UserBadge />
            </div>

            <div className="shrink-0">
              <Dashboard refreshTrigger={statsVersion} />
            </div>

            <div className="flex-1 min-h-0">
              <MusicPanel />
            </div>

            <div className="shrink-0 relative">
              <button
                onClick={() => setSettingsOpen((o) => !o)}
                className="w-full py-2 px-4 rounded-xl bg-white/5 border border-white/10 text-sm text-white/50 hover:text-white hover:bg-white/10 transition-colors"
              >
                {settingsOpen ? "✕ Cerrar configuración" : "⚙ Configuración"}
              </button>

              {settingsOpen && (
                <div className="absolute bottom-full left-0 right-0 mb-2 z-20 max-h-[70vh] overflow-y-auto no-scrollbar bg-[var(--color-bg)] rounded-2xl">
                  <SettingsPanel
                    settings={settings}
                    onSave={(patch) => {
                      updateSettings(patch as Partial<Omit<Settings, "id">>);
                      setSettingsOpen(false);
                    }}
                  />
                </div>
              )}
            </div>

          </div>

        </div>
      </div>
    </TimerProvider>
  );
}

export default function Home() {
  return <AppContent />;
}
