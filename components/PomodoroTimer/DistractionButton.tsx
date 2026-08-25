"use client";

import { useRef } from "react";
import gsap from "gsap";

interface DistractionButtonProps {
  count: number;
  onMark: () => void;
}

/**
 * Un tap, sin confirmación, sin modal. La fricción va en otro lado: registrar
 * que te distrajiste tiene que costar menos que la distracción misma.
 */
export function DistractionButton({ count, onMark }: DistractionButtonProps) {
  const btnRef = useRef<HTMLButtonElement>(null);

  const handleClick = () => {
    onMark();
    if (btnRef.current) {
      gsap.fromTo(
        btnRef.current,
        { scale: 1 },
        { scale: 1.06, duration: 0.12, yoyo: true, repeat: 1, ease: "power2.out" }
      );
    }
  };

  return (
    <button
      ref={btnRef}
      onClick={handleClick}
      aria-label="Registrar distracción"
      data-testid="distraction-button"
      className="flex items-center gap-2 px-5 py-2 rounded-full text-xs font-medium bg-coral/10 text-coral border border-coral/25 hover:bg-coral/20 active:scale-95 transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-coral/50"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-3.5 h-3.5"
        aria-hidden="true"
      >
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      </svg>
      <span>Me distraje</span>
      {count > 0 && (
        <span
          data-testid="distraction-count"
          className="min-w-[18px] px-1 py-px rounded-full bg-coral/25 text-[10px] font-semibold tabular-nums text-center"
        >
          {count}
        </span>
      )}
    </button>
  );
}
