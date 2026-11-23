"use client";
import { useEffect, useRef, useState } from "react";

// Looping Howling Abyss ambience, on by default unless the visitor turned it off. Browsers usually block sound
// before a gesture, so if the autoplay attempt fails it starts on the first click or key press anywhere.
const KEY = "gf-ambience";

export function Ambience() {
  const audio = useRef<HTMLAudioElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const [on, setOn] = useState(true);

  useEffect(() => {
    let off = false;
    try { off = localStorage.getItem(KEY) === "off"; } catch {}
    if (off) return setOn(false);
    const a = audio.current!;
    a.volume = 0.15;
    const start = (e?: Event) => {
      // The toggle handles its own click; starting here would let that click switch it straight back off.
      if (e && button.current?.contains(e.target as Node)) return;
      a.play().then(stop, () => {});
    };
    const stop = () => ["pointerdown", "keydown"].forEach((t) => window.removeEventListener(t, start));
    ["pointerdown", "keydown"].forEach((t) => window.addEventListener(t, start));
    start();
    return stop;
  }, []);

  function toggle() {
    const a = audio.current!;
    // On but still blocked by autoplay: this click is the gesture that starts it.
    const next = !on || a.paused;
    setOn(next);
    try { localStorage.setItem(KEY, next ? "on" : "off"); } catch {}
    a.volume = 0.15;
    if (next) a.play().catch(() => {});
    else a.pause();
  }

  return (
    <>
      <audio ref={audio} src="/audio/howling-abyss.mp3" loop preload="none" />
      <button
        ref={button}
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
