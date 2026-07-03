"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { authClient } from "@/lib/auth/client";

const MAX_NAME_LENGTH = 50;

export function UserBadge({ className, compact }: { className?: string; compact?: boolean }) {
  const { data: session } = authClient.useSession();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) setTimeout(() => editInputRef.current?.focus(), 50);
  }, [editing]);

  if (!session?.user) return null;

  const { name, email, image } = session.user;
  const initials = name
    ? name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : (email?.[0]?.toUpperCase() ?? "?");

  function startEditing() {
    setNameInput(name ?? "");
    setEditing(true);
  }

  async function handleSaveName() {
    // Guard contra doble disparo (ej: onBlur + click del botón de confirmar).
    if (saving) return;
    const trimmed = nameInput.trim();
    // Sin cambios o vacío → no tocamos nada, salimos del modo edición.
    if (!trimmed || trimmed === name) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await authClient.updateUser({ name: trimmed.slice(0, MAX_NAME_LENGTH) });
      setEditing(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/login");
    router.refresh();
  }

  if (compact) {
    return (
      <div className={`relative ${className ?? ""}`}>
        <button
          onClick={() => setMenuOpen((o) => !o)}
          title="Cuenta"
          className="w-8 h-8 rounded-full bg-white/10 border border-white/10 flex items-center justify-center shrink-0 overflow-hidden hover:ring-2 hover:ring-white/20 transition-all"
        >
          {image ? (
            <Image src={image} alt={name ?? email ?? ""} width={32} height={32} className="object-cover" />
          ) : (
            <span className="text-xs font-medium text-white/70">{initials}</span>
          )}
        </button>

        {menuOpen && (
          <>
            {/* Backdrop para cerrar al tocar afuera */}
            <div
              className="fixed inset-0 z-30"
              onClick={() => {
                setMenuOpen(false);
                setEditing(false);
              }}
            />
            <div className="absolute top-full right-0 mt-2 z-40 w-56 bg-[var(--color-bg)] rounded-xl border border-white/10 shadow-2xl p-1.5 flex flex-col gap-0.5">
              {editing ? (
                <div className="flex items-center gap-1.5 px-2 py-1.5">
                  <input
                    ref={editInputRef}
                    value={nameInput}
                    maxLength={MAX_NAME_LENGTH}
                    disabled={saving}
                    onChange={(e) => setNameInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveName();
                      if (e.key === "Escape") setEditing(false);
                    }}
                    className="text-xs text-white bg-transparent flex-1 min-w-0 outline-none border-b border-mint/50 pb-0.5"
                  />
                  <button
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={handleSaveName}
                    disabled={saving}
                    title="Guardar"
                    aria-label="Guardar nombre"
                    className="shrink-0 text-mint hover:text-mint/80 disabled:opacity-40"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <button
                  onClick={startEditing}
                  className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors text-left"
                >
                  <span className="text-xs text-white/80 truncate">{name ?? email}</span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 shrink-0 text-white/40">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                  </svg>
                </button>
              )}
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors text-xs text-white/50 hover:text-white/80"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 shrink-0">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                Salir
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 ${className ?? ""}`}>
      {image ? (
        <Image
          src={image}
          alt={name ?? email ?? ""}
          width={26}
          height={26}
          className="rounded-full"
        />
      ) : (
        <div className="w-[26px] h-[26px] rounded-full bg-white/20 flex items-center justify-center text-xs font-medium shrink-0">
          {initials}
        </div>
      )}
      {editing ? (
        <>
          <input
            ref={editInputRef}
            value={nameInput}
            maxLength={MAX_NAME_LENGTH}
            disabled={saving}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSaveName();
              if (e.key === "Escape") setEditing(false);
            }}
            onBlur={handleSaveName}
            className="text-xs text-white bg-transparent flex-1 min-w-0 outline-none border-b border-mint/50 pb-0.5"
          />
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleSaveName}
            disabled={saving}
            title="Guardar"
            aria-label="Guardar nombre"
            className="shrink-0 text-mint hover:text-mint/80 transition-colors disabled:opacity-40"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </button>
        </>
      ) : (
        <>
          <button
            onClick={startEditing}
            title="Cambiar nombre"
            className="text-xs text-white/60 hover:text-white flex-1 truncate text-left transition-colors"
          >
            {name ?? email}
          </button>
          <button
            onClick={startEditing}
            title="Cambiar nombre"
            aria-label="Cambiar nombre"
            className="shrink-0 text-white/30 hover:text-white/70 transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
            </svg>
          </button>
        </>
      )}
      <button
        onClick={handleSignOut}
        title="Cerrar sesión"
        aria-label="Cerrar sesión"
        className="shrink-0 text-white/30 hover:text-white/70 transition-colors"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
      </button>
    </div>
  );
}
