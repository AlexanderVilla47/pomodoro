"use client";

import { useState, useCallback, useEffect } from "react";
import { TimerProvider } from "@/context/TimerContext";
import { YouTubePlayerProvider } from "@/context/YouTubePlayerContext";
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

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r} ${g} ${b}`;
}

function AppContent() {
  const { settings, updateSettings } = useSettings();
  const [statsVersion, setStatsVersion] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState<Label | null>(null);
  const [mobileTab, setMobileTab] = useState<MobileTab>("timer");

  useEffect(() => {
    try {
      const stored = localStorage.getItem("pomodoro-selected-label");
      if (stored) setSelectedLabel(JSON.parse(stored));
    } catch {}
  }, []);

  const handleSessionComplete = useCallback(() => {
    setStatsVersion((v) => v + 1);
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 1200);
  }, []);

  useEffect(() => {
    requestNotificationPermission().catch(() => {});
  }, []);

  useEffect(() => {
    const color = selectedLabel?.color ?? "#5ABFA8";
    document.documentElement.style.setProperty("--color-mint", color);
    document.documentElement.style.setProperty("--color-mint-rgb", hexToRgb(color));
  }, [selectedLabel]);

  const handleLabelChange = useCallback((label: Label | null) => {
    setSelectedLabel(label);
    if (label) {
      localStorage.setItem("pomodoro-selected-label", JSON.stringify(label));
    } else {
      localStorage.removeItem("pomodoro-selected-label");
    }
  }, []);

  if (!settings) return null;

  const settingsPatch = (patch: Partial<Omit<Settings, "id">>) => {
    updateSettings(patch);
    setSettingsOpen(false);
  };

  return (
    <YouTubePlayerProvider>
    <TimerProvider
      settings={settings}
      onSessionLogged={handleSessionComplete}
      selectedLabelId={selectedLabel?.id ?? null}
    >
      {/* Single permanent yt-player anchor — always in DOM with real dimensions */}
      <div aria-hidden="true" style={{ position: "fixed", top: 0, left: 0, width: 1, height: 1, overflow: "hidden", opacity: 0, pointerEvents: "none", zIndex: -1 }}>
        <div id="yt-player" />
      </div>

      <div className="h-dvh overflow-hidden bg-[var(--color-bg)] text-white">

        {/* ── Desktop ── */}
        <div className="hidden md:flex flex-col h-full max-w-6xl mx-auto px-4">

          {/* Top bar — mirrors the same gap-8 column split so gear aligns flush with timer edge */}
          <div className="shrink-0 flex items-center gap-8 pt-4 pb-0">
            <div className="flex-1 flex items-center justify-between">
              <LabelSelector selectedId={selectedLabel?.id ?? null} onChange={handleLabelChange} />
              <div className="relative">
                <button
                  onClick={() => setSettingsOpen((o) => !o)}
                  title="Configuración"
                  className="p-1.5 rounded-xl bg-white/5 border border-white/10 text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                </button>
                {settingsOpen && (
                  <div className="absolute top-full right-0 mt-2 z-20 w-[360px] max-h-[70vh] overflow-y-auto no-scrollbar bg-[var(--color-bg)] rounded-2xl shadow-2xl border border-white/10">
                    <SettingsPanel settings={settings} onSave={settingsPatch} />
                  </div>
                )}
              </div>
            </div>
            <div className="w-[440px] shrink-0">
              <UserBadge className="w-full" />
            </div>
          </div>

          {/* Main content */}
          <div className="flex flex-1 gap-8 min-h-0 pb-6">
            <div className="flex-1 flex flex-col items-center justify-center relative">
              <Confetti trigger={showConfetti} />
              <PomodoroTimer labelColor={selectedLabel?.color} />
            </div>

            <div className="w-[440px] shrink-0 flex flex-col gap-3 pt-3 pb-6 overflow-hidden">
              <div className="shrink-0">
                <Dashboard refreshTrigger={statsVersion} />
              </div>
              <div className="flex-1 min-h-0">
                <MusicPanel />
              </div>
            </div>
          </div>

        </div>

        {/* ── Mobile ── */}
        <div className="flex flex-col h-full md:hidden">

          {/* Header */}
          <div className="shrink-0 flex items-center gap-2 px-4 py-2 border-b border-white/5">
            <LabelSelector selectedId={selectedLabel?.id ?? null} onChange={handleLabelChange} />
            <div className="flex-1" />
            <div className="relative">
              <button
                onClick={() => setSettingsOpen((o) => !o)}
                title="Configuración"
                className="p-2 rounded-xl bg-white/5 border border-white/10 text-white/40 hover:text-white hover:bg-white/10 transition-colors"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </button>
              {settingsOpen && (
                <div className="absolute top-full right-0 mt-2 z-20 w-[340px] max-h-[70vh] overflow-y-auto no-scrollbar bg-[var(--color-bg)] rounded-2xl shadow-2xl border border-white/10">
                  <SettingsPanel settings={settings} onSave={settingsPatch} />
                </div>
              )}
            </div>
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
    </YouTubePlayerProvider>
  );
}

export default function Home() {
  return <AppContent />;
}
