"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";

interface StatsCardProps {
  label: string;
  count: number;
  totalSeconds: number;
  isLoading?: boolean;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function StatsCard({ label, count, totalSeconds, isLoading }: StatsCardProps) {
  const countRef = useRef<HTMLSpanElement>(null);
  const prevCount = useRef(count);

  useEffect(() => {
    if (!countRef.current || count === prevCount.current) return;
    const obj = { value: prevCount.current };
    gsap.to(obj, {
      value: count,
      duration: 0.8,
      ease: "power2.out",
      onUpdate: () => {
        if (countRef.current) countRef.current.textContent = String(Math.round(obj.value));
      },
    });
    prevCount.current = count;
  }, [count]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-1 p-4 rounded-xl bg-white/5 border border-white/10 animate-pulse">
        <span className="text-xs uppercase tracking-wider text-white/40">{label}</span>
        <div className="h-9 w-16 rounded bg-white/10 mt-1" />
        <div className="h-4 w-10 rounded bg-white/10 mt-1" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 p-4 rounded-xl bg-white/5 border border-white/10">
      <span className="text-xs uppercase tracking-wider text-white/40">{label}</span>
      <div className="flex items-baseline gap-2">
        <span ref={countRef} className="text-3xl font-bold text-white">
          {count}
        </span>
        <span className="text-sm text-white/40">sesiones</span>
      </div>
      <span className="text-sm text-white/60">{formatDuration(totalSeconds)}</span>
    </div>
  );
}
