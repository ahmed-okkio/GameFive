export function StatBar({ value, max, color }: { value: number; max: number; color: "damage" | "healing" }) {
  const width = max > 0 ? Math.max(4, Math.round((value / max) * 100)) : 0;
  const barColor = color === "damage" ? "bg-red-500/80" : "bg-emerald-500/80";
  const label = color === "damage" ? "Damage" : "Healing";

  return (
    <div className="flex flex-col items-start gap-0.5">
      <div className="flex items-center gap-1">
        <span className="text-[9px] font-bold text-stone-500">{label}</span>
        <span className="font-mono text-[10px] text-stone-300">{value.toLocaleString()}</span>
      </div>
      <div className="h-1.5 w-24 rounded-full bg-stone-800/50">
        <div className={`h-1.5 rounded-full ${barColor}`} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}
