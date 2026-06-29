"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

declare global {
  interface Window {
    __pwa_prompt: BeforeInstallPromptEvent | null;
  }
}

function getEnv() {
  if (typeof window === "undefined") return { isIOS: false, isInstalled: false };
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isInstalled = window.matchMedia("(display-mode: standalone)").matches;
  return { isIOS, isInstalled };
}

export function useInstallPrompt() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const { isIOS, isInstalled } = getEnv();
    setIsIOS(isIOS);
    setIsInstalled(isInstalled);

    // Pick up event captured before React hydrated
    if (window.__pwa_prompt) {
      setPrompt(window.__pwa_prompt);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      const evt = e as BeforeInstallPromptEvent;
      window.__pwa_prompt = evt;
      setPrompt(evt);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const install = async () => {
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") {
      setPrompt(null);
      window.__pwa_prompt = null;
    }
  };

  const canInstall = !!prompt;
  const showIOSHint = isIOS && !isInstalled;
  const visible = (canInstall || showIOSHint) && !isInstalled;

  return { canInstall, install, showIOSHint, visible };
}
