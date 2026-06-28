"use client";

export function YouTubePlayer() {
  return (
    // Outer div is React's stable anchor — YouTube replaces the inner div
    // with an iframe, so React must not try to remove the inner node directly
    <div
      aria-hidden="true"
      style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", opacity: 0, pointerEvents: "none" }}
    >
      <div id="yt-player" />
    </div>
  );
}
