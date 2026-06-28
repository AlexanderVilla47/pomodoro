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

type MobileTab = "timer" | "music" | "stats";

function AppContent() {
  const { settings, updateSettings } = useSettings();
  const [statsVersion, setStatsVersion] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState<Label | null>(null);
  const [mobileTab, setMobileTab] = useState<MobileTab>("timer");

  const handleSessionComplete = useCallback(() => {
    setStatsVersion((v) => v + 1);
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 1200);
  }, []);

  useEffect(() => {
    requestNotificationPermission().catch(() => {});
  }, []);

  if (!settings) return null;

  const settingsPatch = (patch: Partial<Omit<Settings, "id">>) => {
    updateSettings(patch);
    setSettingsOpen(false);
  };

  return (
    <TimerProvider
      settings={settings}
      onSessionLogged={handleSessionComplete}
      selectedLabelId={selectedLabel?.id ?? null}
    >
      <div className="h-dvh overflow-hidden bg-[var(--color-bg)] text-white">

        {/* ── Desktop ── */}
        <div className="hidden md:flex h-full max-w-6xl mx-auto px-4 gap-8">

          <div className="flex-1 flex flex-col items-center justify-center relative">
            <Confetti trigger={showConfetti} />
            <div className="absolute top-4 left-0">
              <LabelSelector selectedId={selectedLabel?.id ?? null} onChange={setSelectedLabel} />
            </div>
            <PomodoroTimer labelColor={selectedLabel?.color} />
          </div>

          <div className="w-[440px] shrink-0 flex flex-col gap-3 py-6 overflow-hidden">
            <div className="shrink-0">
              <Dashboard refreshTrigger={statsVersion} />
            </div>
            <div className="flex-1 min-h-0">
              <MusicPanel />
            </div>
            <div className="shrink-0 flex gap-2 relative">
              <button
                onClick={() => setSettingsOpen((o) => !o)}
                className="flex-1 py-2 px-3 rounded-xl bg-white/5 border border-white/10 text-sm text-white/50 hover:text-white hover:bg-white/10 transition-colors"
              >
                {settingsOpen ? "✕ Cerrar" : "⚙ Configuración"}
              </button>
              <UserBadge className="flex-1 min-w-0" />
              {settingsOpen && (
                <div className="absolute bottom-full left-0 right-0 mb-2 z-20 max-h-[70vh] overflow-y-auto no-scrollbar bg-[var(--color-bg)] rounded-2xl">
                  <SettingsPanel settings={settings} onSave={settingsPatch} />
                </div>
              )}
            </div>
          </div>

        </div>

        {/* ── Mobile ── */}
        <div className="flex flex-col h-full md:hidden">

          {/* Header */}
          <div className="shrink-0 flex items-center gap-2 px-4 py-2 border-b border-white/5">
            <LabelSelector selectedId={selectedLabel?.id ?? null} onChange={setSelectedLabel} />
            <div className="flex-1" />
            <UserBadge />
          </div>

          {/* Content — panels stacked with absolute positioning so YouTube player always has real dimensions */}
          <div className="flex-1 min-h-0 overflow-hidden relative">
            <Confetti trigger={showConfetti} />

            <div className={`absolute inset-0 flex flex-col items-center justify-center px-6 transition-opacity duration-150 ${mobileTab === "timer" ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
              <PomodoroTimer labelColor={selectedLabel?.color} />
            </div>

            <div className={`absolute inset-0 p-3 transition-opacity duration-150 ${mobileTab === "music" ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
              <MusicPanel />
            </div>

            <div className={`absolute inset-0 overflow-y-auto p-4 flex flex-col gap-3 transition-opacity duration-150 ${mobileTab === "stats" ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
              <Dashboard refreshTrigger={statsVersion} />
              <div className="relative">
                <button
                  onClick={() => setSettingsOpen((o) => !o)}
                  className="w-full py-2 px-4 rounded-xl bg-white/5 border border-white/10 text-sm text-white/50 hover:text-white hover:bg-white/10 transition-colors"
                >
                  {settingsOpen ? "✕ Cerrar configuración" : "⚙ Configuración"}
                </button>
                {settingsOpen && (
                  <div className="mt-2">
                    <SettingsPanel settings={settings} onSave={settingsPatch} />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Tab bar */}
          <div className="shrink-0 flex border-t border-white/10 bg-[var(--color-bg)]" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
            {(
              [
                {
                  tab: "music",
                  label: "Música",
                  icon: (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                      <path d="M9 18V5l12-2v13" />
                      <circle cx="6" cy="18" r="3" />
                      <circle cx="18" cy="16" r="3" />
                    </svg>
                  ),
                },
                {
                  tab: "timer",
                  label: "Timer",
                  icon: (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                      <circle cx="12" cy="13" r="8" />
                      <path d="M12 9v4l2.5 2.5" />
                      <path d="M9.5 3h5" />
                    </svg>
                  ),
                },
                {
                  tab: "stats",
                  label: "Stats",
                  icon: (
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                      <rect x="3" y="13" width="4" height="8" rx="1" />
                      <rect x="10" y="8" width="4" height="13" rx="1" />
                      <rect x="17" y="4" width="4" height="17" rx="1" />
                    </svg>
                  ),
                },
              ] as const
            ).map(({ tab, icon, label }) => (
              <button
                key={tab}
                onClick={() => setMobileTab(tab)}
                className={`flex-1 flex flex-col items-center gap-1 py-3 text-[10px] font-medium transition-colors ${
                  mobileTab === tab ? "text-mint" : "text-white/30 hover:text-white/60"
                }`}
              >
                {icon}
                {label}
              </button>
            ))}
          </div>

        </div>

      </div>
    </TimerProvider>
  );
}

export default function Home() {
  return <AppContent />;
}
