"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Image from "next/image";

interface FriendUser {
  friendshipId: number;
  userId: string;
  name: string;
  image: string | null;
  todaySeconds: number;
  weekSeconds: number;
}

interface PendingRequest {
  friendshipId: number;
  userId: string;
  name: string;
  image: string | null;
  direction: "incoming" | "outgoing";
}

interface FriendsData {
  friends: FriendUser[];
  pending: PendingRequest[];
}

function formatDuration(seconds: number): string {
  if (seconds === 0) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function Avatar({ name, image, size = 32 }: { name: string; image: string | null; size?: number }) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  if (image) {
    return (
      <Image
        src={image}
        alt={name}
        width={size}
        height={size}
        className="rounded-full object-cover shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className="rounded-full bg-white/20 flex items-center justify-center text-xs font-medium shrink-0 text-white/70"
      style={{ width: size, height: size }}
    >
      {initials}
    </div>
  );
}

export function FriendsPanel() {
  const [data, setData] = useState<FriendsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [addEmail, setAddEmail] = useState("");
  const [addState, setAddState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [addError, setAddError] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const tzOffset = -new Date().getTimezoneOffset();

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/friends?tz=${tzOffset}`);
      if (res.ok) setData(await res.json());
    } finally {
      setIsLoading(false);
    }
  }, [tzOffset]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (showAddForm) setTimeout(() => inputRef.current?.focus(), 50);
  }, [showAddForm]);

  async function handleAddFriend(e: React.FormEvent) {
    e.preventDefault();
    if (!addEmail.trim()) return;
    setAddState("loading");
    setAddError("");
    try {
      const res = await fetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: addEmail.trim() }),
      });
      if (res.ok) {
        setAddState("success");
        setAddEmail("");
        setTimeout(() => {
          setAddState("idle");
          setShowAddForm(false);
          load();
        }, 1500);
      } else {
        const { error } = await res.json();
        setAddError(error ?? "Error al enviar solicitud");
        setAddState("error");
      }
    } catch {
      setAddError("Error de red");
      setAddState("error");
    }
  }

  async function handleRespond(id: number, action: "accept" | "decline") {
    await fetch(`/api/friends/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    load();
  }

  async function handleRemove(id: number) {
    await fetch(`/api/friends/${id}`, { method: "DELETE" });
    load();
  }

  const incoming = data?.pending.filter((p) => p.direction === "incoming") ?? [];
  const outgoing = data?.pending.filter((p) => p.direction === "outgoing") ?? [];

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2 h-full">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10 animate-pulse">
            <div className="w-8 h-8 rounded-full bg-white/10 shrink-0" />
            <div className="flex-1 flex flex-col gap-1.5">
              <div className="h-3 w-24 rounded bg-white/10" />
              <div className="h-2.5 w-32 rounded bg-white/10" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 h-full overflow-y-auto no-scrollbar">

      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <span className="text-xs text-white/40 uppercase tracking-wider">
          Amigos {data && data.friends.length > 0 ? `(${data.friends.length})` : ""}
        </span>
        <button
          onClick={() => {
            setShowAddForm((v) => !v);
            setAddState("idle");
            setAddError("");
          }}
          className="flex items-center gap-1 text-xs text-mint hover:text-white transition-colors"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <line x1="19" y1="8" x2="19" y2="14" />
            <line x1="22" y1="11" x2="16" y2="11" />
          </svg>
          Agregar
        </button>
      </div>

      {/* Add friend form */}
      {showAddForm && (
        <form onSubmit={handleAddFriend} className="flex flex-col gap-2 p-3 rounded-xl bg-white/5 border border-white/10 shrink-0">
          <input
            ref={inputRef}
            type="email"
            value={addEmail}
            onChange={(e) => { setAddEmail(e.target.value); setAddState("idle"); setAddError(""); }}
            placeholder="Email del amigo"
            className="bg-transparent text-sm text-white placeholder:text-white/30 outline-none border-b border-white/10 pb-1 focus:border-mint transition-colors"
          />
          {addError && <span className="text-xs text-red-400">{addError}</span>}
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="text-xs text-white/30 hover:text-white/60 transition-colors px-2 py-1"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={addState === "loading" || addState === "success"}
              className="text-xs px-3 py-1 rounded-lg bg-mint/20 text-mint hover:bg-mint/30 transition-colors disabled:opacity-50"
            >
              {addState === "loading" ? "Enviando..." : addState === "success" ? "¡Enviada!" : "Enviar solicitud"}
            </button>
          </div>
        </form>
      )}

      {/* Incoming requests */}
      {incoming.length > 0 && (
        <div className="flex flex-col gap-1.5 shrink-0">
          <span className="text-xs text-white/30 uppercase tracking-wider">
            Solicitudes recibidas ({incoming.length})
          </span>
          {incoming.map((req) => (
            <div key={req.friendshipId} className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/5 border border-white/10">
              <Avatar name={req.name} image={req.image} size={30} />
              <span className="flex-1 text-sm text-white/80 truncate">{req.name}</span>
              <button
                onClick={() => handleRespond(req.friendshipId, "accept")}
                title="Aceptar"
                className="w-7 h-7 flex items-center justify-center rounded-lg bg-mint/20 text-mint hover:bg-mint/30 transition-colors"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </button>
              <button
                onClick={() => handleRespond(req.friendshipId, "decline")}
                title="Rechazar"
                className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/5 text-white/40 hover:bg-red-500/20 hover:text-red-400 transition-colors"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Friends list */}
      {data && data.friends.length === 0 && incoming.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-2 text-center py-8">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8 text-white/15">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <p className="text-xs text-white/25">Todavía no tenés amigos.<br />¡Agregá uno para ver sus stats!</p>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {data?.friends.map((friend) => (
            <div key={friend.friendshipId} className="group flex items-center gap-2.5 p-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/[0.07] transition-colors">
              <Avatar name={friend.name} image={friend.image} size={30} />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white/80 truncate">{friend.name}</p>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-[10px] text-white/35">
                    Hoy <span className="text-white/60">{formatDuration(friend.todaySeconds)}</span>
                  </span>
                  <span className="text-[10px] text-white/35">
                    Semana <span className="text-white/60">{formatDuration(friend.weekSeconds)}</span>
                  </span>
                </div>
              </div>
              <button
                onClick={() => handleRemove(friend.friendshipId)}
                title="Eliminar amigo"
                className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center rounded-lg text-white/25 hover:text-red-400 hover:bg-red-500/10 transition-all"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14H6L5 6" />
                  <path d="M10 11v6M14 11v6" />
                  <path d="M9 6V4h6v2" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Outgoing pending */}
      {outgoing.length > 0 && (
        <div className="flex flex-col gap-1.5 shrink-0">
          <span className="text-xs text-white/30 uppercase tracking-wider">
            Solicitudes enviadas ({outgoing.length})
          </span>
          {outgoing.map((req) => (
            <div key={req.friendshipId} className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
              <Avatar name={req.name} image={req.image} size={30} />
              <span className="flex-1 text-sm text-white/40 truncate">{req.name}</span>
              <span className="text-[10px] text-white/25 italic">Pendiente</span>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
