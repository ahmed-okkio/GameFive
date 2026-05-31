"use client";

type ProgressScreenProps = {
  gameName: string;
  tagLine: string;
  status?: string;
  completedSteps?: number;
  totalSteps?: number;
  queuePosition?: number | null;
  error?: string | null;
};

export function ProgressScreen({
  gameName,
  tagLine,
  status = "queued",
  completedSteps = 0,
  totalSteps = 1001,
  queuePosition,
  error
}: ProgressScreenProps) {
  const percent = Math.min(100, Math.round((completedSteps / Math.max(totalSteps, 1)) * 100));
  const isQueued = status === "queued";
  const statusLabel = isQueued
    ? `Number ${queuePosition ?? "?"} in rank calculation queue`
    : "Calculating real rank";

  return (
    <section className="mx-auto max-w-3xl px-4 py-16">
      <div className="rounded border border-line bg-panel p-6">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-gold">Awaiting calculation</p>
        <h1 className="mt-2 text-3xl font-black text-white">
          {gameName}#{tagLine}
        </h1>
        <p className="mt-3 text-stone-300">We are preparing a rank calculation. First-time profiles can take a while.</p>
        <div className="mt-8">
          <div className="mb-2 flex justify-between text-sm text-stone-400">
            <span>{statusLabel}</span>
            <span>{percent}%</span>
          </div>
          <div className="h-3 overflow-hidden rounded bg-black/40">
            <div className="h-full bg-gold transition-all" style={{ width: `${percent}%` }} />
          </div>
        </div>
        {error ? <p className="mt-4 rounded border border-ember/40 bg-ember/10 p-3 text-sm text-ember">{error}</p> : null}
      </div>
    </section>
  );
}
