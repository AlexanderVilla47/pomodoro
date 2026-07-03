"use client";

import { useEffect, useRef, useState } from "react";

// Pulso en vivo y ANÓNIMO: muestra cuántos amigos te alentaron sin decir quién.
// Los nombres se revelan recién al terminar la sesión (ver reveal en HomeClient).
// Es decorativo (pointer-events-none) para no robar foco ni clicks.
export function CheerPulse() {
  const [count, setCount] = useState(0);
  const [bump, setBump] = useState(false);
  const prevRef = useRef(0);

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch("/api/cheers");
        if (!res.ok) return;
        const { count } = await res.json();
        setCount(count);
        if (count > prevRef.current) {
          setBump(true);
          setTimeout(() => setBump(false), 700);
        }
        prevRef.current = count;
      } catch {
        // silencioso: es un extra, no rompe nada si falla
      }
    };

    poll();
    const id = setInterval(poll, 12_000);
    // Al revelar los nombres (fin de sesión) se marcan vistos → reseteamos ya.
    const reset = () => {
      setCount(0);
      prevRef.current = 0;
    };
    window.addEventListener("cheers-seen", reset);
    return () => {
      clearInterval(id);
      window.removeEventListener("cheers-seen", reset);
    };
  }, []);

  if (count <= 0) return null;

  return (
    <div className="fixed top-16 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
      <div
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-500/15 border border-orange-500/30 backdrop-blur-sm transition-transform duration-300 ${
          bump ? "scale-125" : "scale-100"
        }`}
        title="Alguien te está alentando"
      >
        <span className="text-sm">🔥</span>
        <span className="text-xs font-semibold text-orange-300">{count}</span>
      </div>
    </div>
  );
}
