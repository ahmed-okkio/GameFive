"use client";
import { useEffect, useRef, useState } from "react";

// Looping Howling Abyss ambience. Browsers block sound before a gesture, so it starts off behind a toggle;
// the visitor's choice is remembered and, once on, resumes on their next click anywhere.
const KEY = "gf-ambience";

export function Ambience() {
  const audio = useRef<HTMLAudioElement>(null);
  const [on, setOn] = useState(false);

  useEffect(() => {
    let saved = false;
    try { saved = localStorage.getItem(KEY) === "on"; } catch {}
    if (!saved) return;
    setOn(true);
    const start = () => audio.current?.play().catch(() => {});
    start();
    window.addEventListener("pointerdown", start, { once: true });
    return () => window.removeEventListener("pointerdown", start);
  }, []);

  function toggle() {
    const a = audio.current;
    if (!a) return;
    const next = !on;
    setOn(next);
    try { localStorage.setItem(KEY, next ? "on" : "off"); } catch {}
    if (next) a.play().catch(() => {});
    else a.pause();
  }

  return (
    <>
      <audio ref={audio} src="/audio/howling-abyss.mp3" loop preload="none" onPlay={(e) => (e.currentTarget.volume = 0.35)} />
      <button
        type="button"
        onClick={toggle}
        aria-pressed={on}
        aria-label={on ? "Turn ambient sound off" : "Turn ambient sound on"}
        className="fixed bottom-4 right-4 z-50 flex h-10 w-10 items-center justify-center border border-[#463714] bg-[#0A1428]/90 text-[#C8AA6E] transition hover:border-[#C8AA6E] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0AC8B9]"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" stroke="none" />
          {on ? <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" /> : <path d="M17 9l5 6M22 9l-5 6" />}
        </svg>
      </button>
    </>
  );
}
