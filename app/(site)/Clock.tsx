"use client";
import { useEffect, useState } from "react";
import { timeLeft } from "@/lib/countdown";
import { Frame, N, caps, goldEdge, quiet, tilt } from "./ui";

// The clock is the page: four chamfered cards like a quest offer, ticking every second. Screen readers get one sentence instead of a ticking region.
// Starts from the server's `now` so the first client render matches the server's.
export function Clock({ now: serverNow }: { now: number }) {
  const [now, setNow] = useState(serverNow);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const [d, h, m, sec] = timeLeft(now);
  return (
    <>
      <p className="sr-only">Starts in {d} days, {h} hours and {m} minutes.</p>
      <ol aria-hidden="true" className="mx-auto mt-8 grid max-w-3xl grid-cols-4 gap-2 sm:gap-4">
        {([[d, "Days"], [h, "Hours"], [m, "Minutes"], [sec, "Seconds"]] as const).map(([v, label], k) => (
          <li key={label} className="enter" style={{ animationDelay: `${k * 70}ms` }}>
            <div className={`h-full ${tilt}`}>
              <Frame edge={k === 0 ? goldEdge : quiet} rim className="flex flex-col items-center px-2 pb-4 pt-5 sm:pb-5 sm:pt-7">
                <span className={`${N} text-[clamp(2.5rem,7vw,5rem)] leading-none text-[#F0E6D2]`}>{String(v).padStart(2, "0")}</span>
                <span className={`${caps} mt-3 text-[11px] sm:text-xs ${k === 0 ? "text-[#C8AA6E]" : ""}`}>{label}</span>
              </Frame>
            </div>
          </li>
        ))}
      </ol>
    </>
  );
}
