import React from "react";

interface PerformanceBadgeProps {
  place?: number;
  isAce?: boolean;
}

export function PerformanceBadge({ place, isAce }: PerformanceBadgeProps) {
  const isMVP = place === 1;
  const label = isMVP ? "MVP" : isAce ? "ACE" : `${place}${getOrdinal(place)}`;
  
  const style = isMVP
    ? { borderColor: "#b6983eff", color: "#b6983eff" }
    : isAce
    ? { borderColor: "#9a69c7ff", color: "#9a69c7ff" }
    : { borderColor: "#A8A29E", color: "#A8A29E" };

  return (
    <div 
      className="inline-block ml-1 rounded border bg-transparent"
      style={style}
    >
      <span
        className="flex items-center justify-center px-1 py-[0.5px] text-[8px] uppercase tracking-widest"
      >
        {label}
      </span>
    </div>
  );
}

function getOrdinal(n?: number) {
  if (!n) return "";
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}
