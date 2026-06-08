
export function LoadingSkeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded bg-panel/50 ${className}`}>
      <div className="h-full w-full bg-stone-700/30 rounded" />
    </div>
  );
}

export function PageLoader({ text = "Loading..." }: { text?: string }) {
  return (
    <div className="flex h-64 flex-col items-center justify-center gap-3">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-gold/30 border-t-gold"></div>
      <p className="text-sm font-medium text-stone-500 animate-pulse">{text}</p>
    </div>
  );
}
