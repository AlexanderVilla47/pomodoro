"use client";

import { useState } from "react";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";

export function InstallButton({ className }: { className?: string }) {
  const { canInstall, install, showIOSHint, visible } = useInstallPrompt();
  const [showTooltip, setShowTooltip] = useState(false);

  if (!visible) return null;

  const handleClick = () => {
    if (canInstall) {
      install();
    } else if (showIOSHint) {
      setShowTooltip((v) => !v);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={handleClick}
        title="Instalar Pomy"
        className={`p-1.5 rounded-xl bg-white/5 border border-white/10 text-white/40 hover:text-white hover:bg-white/10 transition-colors ${className ?? ""}`}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      </button>

      {showIOSHint && showTooltip && (
        <div className="absolute top-full right-0 mt-2 z-30 w-56 rounded-xl bg-[#1a1a22] border border-white/10 shadow-2xl p-3 text-xs text-white/60 leading-relaxed">
          Tocá el botón{" "}
          <span className="text-white/90 font-medium">compartir ⬆</span> en
          Safari y luego{" "}
          <span className="text-white/90 font-medium">
            &ldquo;Agregar a pantalla de inicio&rdquo;
          </span>
          .
        </div>
      )}
    </div>
  );
}
