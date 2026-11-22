"use client";
// The Mayhem promo art, faint and pinned behind the page. It drifts up a little as you scroll and
// leans away from the cursor, like a client background; nearly hidden behind the content column. Static under reduced motion.
import { useEffect, useRef } from "react";

const ART = "/mayhem-promo.jpg"; // owner-supplied, letterbox bars cropped, kept locally (the wiki blocks hotlinks)
const grain = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;
// Full strength in the side margins, nearly gone over the content column, with a wide soft edge between.
const column = "linear-gradient(90deg,#000 0,#000 calc(50% - 46rem),rgba(0,0,0,.04) calc(50% - 28rem),rgba(0,0,0,.04) calc(50% + 28rem),#000 calc(50% + 46rem),#000 100%)";
// Shown whole at screen width, so its lower edge fades into the page background.
const fade = "linear-gradient(#000 70%, transparent 100%)";

export function Backdrop() {
  const artRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // ?cursor=x,y fakes a resting cursor so headless screenshots can show the cursor reaction.
    const fake = new URLSearchParams(location.search).get("cursor")?.split(",").map(Number);
    const mouse = fake?.length === 2 ? { x: fake[0], y: fake[1] } : { x: innerWidth / 2, y: innerHeight / 2 };
    const eased = { x: 0, y: 0 };
    let last = 0;
    let raf = 0;
    const loop = (ms: number) => {
      const t = ms / 1000;
      const k = 1 - Math.exp(-Math.min(0.05, last ? t - last : 0) * 2);
      last = t;
      eased.x += ((mouse.x - innerWidth / 2) / innerWidth - eased.x) * k;
      eased.y += ((mouse.y - innerHeight / 2) / innerHeight - eased.y) * k;
      if (artRef.current) artRef.current.style.transform = `translate3d(${(-eased.x * 24).toFixed(1)}px,${(-Math.min(scrollY * 0.04, 60) - eased.y * 16).toFixed(1)}px,0) scale(1.1)`;
      raf = requestAnimationFrame(loop);
    };
    const onMove = (e: PointerEvent) => Object.assign(mouse, { x: e.clientX, y: e.clientY });
    addEventListener("pointermove", onMove);
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener("pointermove", onMove);
    };
  }, []);

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="fixed inset-0 overflow-hidden" style={{ maskImage: column, WebkitMaskImage: column }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img ref={artRef} src={ART} alt="" className="absolute left-0 top-0 w-full origin-top scale-110" style={{ opacity: 0.1, maskImage: fade, WebkitMaskImage: fade }} />
      </div>
      <div className="absolute inset-0 opacity-[0.06] mix-blend-overlay" style={{ backgroundImage: grain }} />
    </div>
  );
}
