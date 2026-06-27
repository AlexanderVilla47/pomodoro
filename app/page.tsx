"use client";

import { useState, useCallback, useEffect } from "react";
import { TimerProvider } from "@/context/TimerContext";
import { PomodoroTimer } from "@/components/PomodoroTimer";
import { MusicPanel } from "@/components/MusicPanel";
import { Dashboard } from "@/components/Dashboard";
import { SettingsPanel } from "@/components/Settings/SettingsPanel";
import { Confetti } from "@/components/Confetti";
import { useSettings } from "@/hooks/useSettings";
import { requestNotificationPermission } from "@/lib/notifications";
import type { Settings } from "@/lib/db/queries/settings";

function AppContent() {
  const { settings, updateSettings } = useSettings();
  const [statsVersion, setStatsVersion] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

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
    <TimerProvider settings={settings}>
      <div className="relative min-h-screen bg-[var(--color-bg)] text-white">
        <div className="relative mx-auto max-w-6xl px-4 py-8 flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-12">

          <div className="flex flex-col items-center gap-8 flex-1 relative">
            <Confetti trigger={showConfetti} />
            <PomodoroTimer />
            <MusicPanel />
          </div>

          <div className="flex flex-col gap-4 lg:w-80">
            <Dashboard refreshTrigger={statsVersion} />

            <button
              onClick={() => setSettingsOpen((o) => !o)}
              className="w-full py-2 px-4 rounded-xl bg-white/5 border border-white/10 text-sm text-white/50 hover:text-white hover:bg-white/10 transition-colors"
            >
              {settingsOpen ? "✕ Cerrar configuración" : "⚙ Configuración"}
            </button>

            {settingsOpen && (
              <SettingsPanel
                settings={settings}
                onSave={(patch) => {
                  updateSettings(patch as Partial<Omit<Settings, "id">>);
                  setSettingsOpen(false);
                }}
              />
            )}
          </div>
        </div>
      </div>
    </TimerProvider>
  );
}

export default function Home() {
  return <AppContent />;
}
