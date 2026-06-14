import React from "react";

interface PerformanceBadgeProps {
  place?: number;
  isAce?: boolean;
}

export function PerformanceBadge({ place, isAce }: PerformanceBadgeProps) {
  const isMVP = place === 1;
  const label = isMVP ? "MVP" : isAce ? "ACE" : `${place}${getOrdinal(place)}`;
  
  const getStyle = () => {
    if (isMVP) return { borderColor: "#b6983eff", color: "#b6983eff" };
    if (isAce) return { borderColor: "#9a69c7ff", color: "#9a69c7ff" };
    
    switch (place) {
      case 2:
        return { borderColor: "#C0C0C0", color: "#C0C0C0" }; // Silver
      case 9:
        return { borderColor: "#804A00", color: "#804A00" }; // Deep Bronze
      case 10:
        return { borderColor: "#7A2E2E", color: "#7A2E2E" }; // Darker, Redder Bronze
      default:
        return { borderColor: "#A8A29E", color: "#A8A29E" }; // Iron
    }
  };

  const style = getStyle();

  return (
    <span
        className="flex items-center justify-center px-2 py-[0.5px] text-[10px] uppercase tracking-widest"
        style={style}
      >
        {label}
    </span>
  );
}

function getOrdinal(n?: number) {
  if (!n) return "";
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}
