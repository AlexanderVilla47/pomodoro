"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client";
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
import { useWorkLogger } from "@/hooks/useWorkLogger";
import { requestNotificationPermission } from "@/lib/notifications";
import type { Settings } from "@/lib/db/queries/settings";
import { UserBadge } from "@/components/UserBadge";
import { InstallButton } from "@/components/InstallButton";
import { JournalPrompt } from "@/components/JournalPrompt";
import { JournalBridge } from "@/components/JournalPrompt/JournalBridge";
import { Historial } from "@/components/Historial";
import { FriendsPanel } from "@/components/Friends";

type MobileTab = "timer" | "music" | "history" | "friends";
type DesktopRightTab = "stats" | "history" | "friends";

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r} ${g} ${b}`;
}

function tabCls(active: boolean) {
  return `flex-1 py-1.5 text-[11px] font-medium rounded-lg transition-colors ${
    active
      ? "bg-white/10 text-white"
      : "text-white/30 hover:text-white/60"
  }`;
}

function AppContent() {
  const { settings, updateSettings } = useSettings();
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const router = useRouter();
  const [statsVersion, setStatsVersion] = useState(0);
  const [historyVersion, setHistoryVersion] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState<Label | null>(null);
  const [mobileTab, setMobileTab] = useState<MobileTab>("timer");
  const [desktopRightTab, setDesktopRightTab] = useState<DesktopRightTab>("stats");
  const [mobileHistorialView, setMobileHistorialView] = useState<"calendar" | "day">("calendar");
  const [pendingSessionId, setPendingSessionId] = useState<number | null>(null);

  const { saveWorkLog } = useWorkLogger();

  useEffect(() => {
    try {
      const stored = localStorage.getItem("pomodoro-selected-label");
      if (stored) setSelectedLabel(JSON.parse(stored));
    } catch {}
  }, []);

  const handleSessionComplete = useCallback((sessionId: number | null) => {
    setStatsVersion((v) => v + 1);
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 1200);
    if (sessionId !== null) setPendingSessionId(sessionId);
  }, []);

  const handleJournalClose = useCallback(() => {
    if (pendingSessionId !== null) {
      saveWorkLog({ sessionId: pendingSessionId, notes: null, topics: [] }).catch(() => {});
    }
    setPendingSessionId(null);
  }, [pendingSessionId, saveWorkLog]);

  const handleJournalSaved = useCallback(() => {
    setPendingSessionId(null);
    setHistoryVersion((v) => v + 1);
  }, []);

  useEffect(() => {
    requestNotificationPermission().catch(() => {});
  }, []);

  // Auth guard: si no hay sesión, al login antes de que cualquier fetch explote
  useEffect(() => {
    if (!sessionPending && !session) {
      router.replace("/login");
    }
  }, [sessionPending, session, router]);

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

  if (sessionPending) return null;
  if (!session) return null;
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
      {/* Auto-dismiss journal prompt when a new work session starts */}
      <JournalBridge onWorkStart={handleJournalClose} />

      {/* Single permanent yt-player anchor — always in DOM with real dimensions */}
      <div aria-hidden="true" style={{ position: "fixed", top: 0, left: 0, width: 1, height: 1, overflow: "hidden", opacity: 0, pointerEvents: "none", zIndex: -1 }}>
        <div id="yt-player" />
      </div>

      <div className="h-dvh overflow-hidden bg-[var(--color-bg)] text-white">

        {/* ── Desktop ── */}
        <div className="hidden md:flex flex-col h-full max-w-6xl mx-auto px-4">

          {/* Top bar */}
          <div className="shrink-0 flex items-center gap-8 pt-4 pb-0">
            <div className="flex-1 flex items-center justify-between">
              <LabelSelector selectedId={selectedLabel?.id ?? null} onChange={handleLabelChange} />
              <div className="flex items-center gap-2">
              <InstallButton />
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
            </div>
            <div className="w-[440px] shrink-0">
              <UserBadge className="w-full" />
            </div>
          </div>

          {/* Main content */}
          <div className="flex flex-1 gap-8 min-h-0 pb-6">
            {/* Timer — overlay flotante cuando hay sesión pendiente */}
            <div className="flex-1 flex flex-col items-center justify-center relative">
              <Confetti trigger={showConfetti} />
              <PomodoroTimer labelColor={selectedLabel?.color} />

              {/* Journal overlay sobre el timer */}
              {pendingSessionId !== null && (
                <div className="absolute inset-0 flex items-center justify-center z-10 backdrop-blur-md rounded-2xl">
                  <div className="w-full max-w-sm mx-4">
                    <JournalPrompt
                      sessionId={pendingSessionId}
                      variant="desktop"
                      onClose={handleJournalClose}
                      onSaved={handleJournalSaved}
                      saveWorkLog={saveWorkLog}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Right panel — siempre muestra stats/historial */}
            <div className="w-[440px] shrink-0 flex flex-col gap-3 pt-3 pb-6 overflow-hidden">
              <div className="flex flex-col gap-2 max-h-[45%] overflow-hidden shrink-0">
                <div className="shrink-0 flex gap-1 p-1 bg-white/5 rounded-xl">
                  <button
                    onClick={() => setDesktopRightTab("stats")}
                    className={tabCls(desktopRightTab === "stats")}
                  >
                    Estadísticas
                  </button>
                  <button
                    onClick={() => setDesktopRightTab("history")}
                    className={tabCls(desktopRightTab === "history")}
                  >
                    Historial
                  </button>
                  <button
                    onClick={() => setDesktopRightTab("friends")}
                    className={tabCls(desktopRightTab === "friends")}
                  >
                    Amigos
                  </button>
                </div>
                <div className="flex-1 min-h-0 overflow-hidden">
                  {desktopRightTab === "stats" ? (
                    <Dashboard refreshTrigger={statsVersion} />
                  ) : desktopRightTab === "history" ? (
                    <Historial refreshTrigger={historyVersion} />
                  ) : (
                    <FriendsPanel />
                  )}
                </div>
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
          <div className="shrink-0 flex items-center gap-2 px-4 py-2 border-b border-white/5" style={{ paddingTop: "calc(env(safe-area-inset-top) + 8px)" }}>
            <LabelSelector selectedId={selectedLabel?.id ?? null} onChange={handleLabelChange} />
            <div className="flex-1" />
            <InstallButton className="w-8 h-8 flex items-center justify-center" />
            <div className="relative">
              <button
                onClick={() => setSettingsOpen((o) => !o)}
                title="Configuración"
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-white/40 hover:text-white hover:bg-white/10 transition-colors"
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
            <UserBadge compact />
          </div>

          {/* Content */}
          <div className="flex-1 min-h-0 overflow-hidden relative">
            <Confetti trigger={showConfetti} />

            <div className={`absolute inset-0 flex flex-col items-center justify-center px-6 transition-opacity duration-150 ${mobileTab === "timer" ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
              <PomodoroTimer labelColor={selectedLabel?.color} />
            </div>

            <div className={`absolute inset-0 p-3 transition-opacity duration-150 ${mobileTab === "music" ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
              <MusicPanel />
            </div>

            <div className={`absolute inset-0 overflow-y-auto p-4 flex flex-col gap-3 transition-opacity duration-150 ${mobileTab === "history" ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
              {mobileHistorialView === "calendar" && (
                <Dashboard refreshTrigger={statsVersion} />
              )}
              <Historial
                refreshTrigger={historyVersion}
                onViewChange={setMobileHistorialView}
                cellSize={16}
                confirmTap
              />
            </div>

            <div className={`absolute inset-0 overflow-y-auto p-4 transition-opacity duration-150 ${mobileTab === "friends" ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
              <FriendsPanel />
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
                  label: "Temporizador",
                  icon: (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                      <circle cx="12" cy="13" r="8" />
                      <path d="M12 9v4l2.5 2.5" />
                      <path d="M9.5 3h5" />
                    </svg>
                  ),
                },
                {
                  tab: "history",
                  label: "Historial",
                  icon: (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                    </svg>
                  ),
                },
                {
                  tab: "friends",
                  label: "Amigos",
                  icon: (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
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

          {/* Mobile journal prompt — fixed overlay, outside tab panels */}
          <JournalPrompt
            sessionId={pendingSessionId}
            variant="mobile"
            onClose={handleJournalClose}
            onSaved={handleJournalSaved}
            saveWorkLog={saveWorkLog}
          />

        </div>

      </div>
    </TimerProvider>
    </YouTubePlayerProvider>
  );
}

export default function Home() {
  return <AppContent />;
}
