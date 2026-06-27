"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";

const PARTICLE_COUNT = 28;
const COLORS = ["#E8735A", "#5ABFA8", "#ffffff", "#ffd166", "#a29bfe"];

export function Confetti({ trigger }: { trigger: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!trigger || !containerRef.current) return;
    const container = containerRef.current;
    const particles: HTMLSpanElement[] = [];

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const p = document.createElement("span");
      const size = Math.random() * 8 + 4;
      p.style.cssText = `
        position:absolute;top:50%;left:50%;
        width:${size}px;height:${size}px;
        border-radius:${Math.random() > 0.5 ? "50%" : "2px"};
        background:${COLORS[Math.floor(Math.random() * COLORS.length)]};
        pointer-events:none;
      `;
      container.appendChild(p);
      particles.push(p);

      const angle = Math.random() * 360;
      const dist = 80 + Math.random() * 120;
      const rad = (angle * Math.PI) / 180;

      gsap.fromTo(
        p,
        { x: 0, y: 0, opacity: 1, scale: 1 },
        {
          x: Math.cos(rad) * dist,
          y: Math.sin(rad) * dist,
          opacity: 0,
          scale: 0,
          duration: 0.8 + Math.random() * 0.4,
          ease: "power2.out",
          onComplete: () => p.remove(),
        }
      );
    }

    return () => particles.forEach((p) => p.remove());
  }, [trigger]);

  return (
    <div
      ref={containerRef}
      className="pointer-events-none absolute inset-0"
      aria-hidden="true"
    />
  );
}
