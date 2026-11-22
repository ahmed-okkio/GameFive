"use client";
import { useEffect, useState } from "react";

// Splash on every full page load. The server paints it unlit; it only plays once the page is ready, so a slow load
// never eats the start. A prismatic shine crosses the rim and V diagonally (bottom left to top right) and leaves them
// grey, then the whole mark flares prismatic and dims down into its gold rim and prismatic V. Client navigation doesn't replay it (it lives in the layout); hidden under reduced motion.
export function Splash() {
  const [go, setGo] = useState(false);
  const [done, setDone] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setGo(true));
    return () => cancelAnimationFrame(id);
  }, []);
  if (done) return null;
  const crest = "M14 2H62V50L50 62H2V14Z";
  const v = "M15 18H25L32 40L39 18H49L36 50H28Z";
  // Inside this frame local x runs from bottom left to top right, so moving along x crosses the logo diagonally.
  const diag = "rotate(-45 32 32)";
  return (
    <div aria-hidden="true" onAnimationEnd={(e) => e.animationName === "splash-out" && setDone(true)} className={`splash fixed inset-0 z-[100] flex items-center justify-center bg-[#010A13] ${go ? "go" : ""}`}>
      <svg width="120" height="120" viewBox="0 0 64 64" className="sp-mark overflow-visible">
        <defs>
          <linearGradient id="sp-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#F6D879" /><stop offset="1" stopColor="#8A6418" /></linearGradient>
          <linearGradient id="sp-p" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#7FF0E0" /><stop offset=".5" stopColor="#B59CFF" /><stop offset="1" stopColor="#FF9CD6" /></linearGradient>
          <linearGradient id="sp-band" gradientUnits="userSpaceOnUse" x1="-12" y1="0" x2="12" y2="0">
            <stop offset="0" stopColor="#7FF0E0" stopOpacity="0" /><stop offset=".3" stopColor="#7FF0E0" stopOpacity=".8" />
            <stop offset=".5" stopColor="#FFFFFF" /><stop offset=".7" stopColor="#FF9CD6" stopOpacity=".8" /><stop offset="1" stopColor="#FF9CD6" stopOpacity="0" />
          </linearGradient>
          <mask id="sp-logo" maskUnits="userSpaceOnUse" x="-40" y="-40" width="144" height="144">
            <path d={crest} fill="#000" stroke="#fff" strokeWidth="2.5" />
            <path d={v} fill="#fff" />
          </mask>
        </defs>
        <path d={crest} fill="#0A1428" stroke="#4A4F57" strokeWidth="2.5" />
        <path d={v} fill="#2A3039" />
        {/* The shine, on the rim and V only; it leaves them grey. */}
        <g mask="url(#sp-logo)" className="sp-shine" style={{ mixBlendMode: "screen" }}>
          <g transform={diag}><rect className="sp-move" x="-12" y="-40" width="24" height="144" fill="url(#sp-band)" transform="translate(-70 0)" /></g>
        </g>
        {/* The flare: rim and V both prismatic, then gone as the final colours come up. */}
        <g className="sp-flash">
          <path d={crest} fill="none" stroke="url(#sp-p)" strokeWidth="3" />
          <path d={v} fill="url(#sp-p)" />
        </g>
        <g className="sp-final">
          <path d={crest} fill="none" stroke="url(#sp-g)" strokeWidth="2.5" />
          <path d={v} fill="url(#sp-p)" />
        </g>
      </svg>
    </div>
  );
}
