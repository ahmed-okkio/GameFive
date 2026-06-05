import type { Metadata } from "next";
import Link from "next/link";
import { AlertCircle, CheckCircle2, Download, ExternalLink, MonitorDown, Play, Search } from "lucide-react";
import { appConfig } from "@/lib/config";

export const metadata: Metadata = {
  title: "Download Companion | GameFive",
  description: "Download and set up the GameFive Companion app for ARAM Mayhem tracking."
};

const steps = [
  {
    title: "Download",
    body: "Save the companion app to your PC.",
    icon: Download
  },
  {
    title: "Run",
    body: "Open it once. Windows may ask for confirmation.",
    icon: Play
  },
  {
    title: "Check the tray",
    body: "There is no app window. Look near the Windows clock.",
    icon: Search
  },
  {
    title: "Play Mayhem",
    body: "Connected games upload automatically after they end.",
    icon: CheckCircle2
  }
];

export default function CompanionPage() {
  const downloadUrl = appConfig.companionDownloadUrl;

  return (
    <section className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div>
          <div className="mb-6">
            <p className="mb-3 inline-flex rounded border border-gold/40 px-3 py-1 text-sm font-semibold text-gold">
              Windows companion app
            </p>
            <h1 className="max-w-3xl text-4xl font-black leading-tight text-white sm:text-5xl">
              Download GameFive Companion
            </h1>
            <p className="mt-3 max-w-2xl text-base text-stone-300 sm:text-lg">
              Run it while League is open. It records completed Mayhem games from your local client.
            </p>
          </div>

          <div className="mb-6 rounded-lg border border-line bg-panel p-4 sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-black text-white">Latest download</h2>
                <p className="mt-1 text-sm text-stone-400">Windows tray app. No normal window.</p>
              </div>
              {downloadUrl ? (
                <a
                  href={downloadUrl}
                  className="interactive hidden items-center justify-center gap-2 rounded border border-sky-300/30 bg-sky-500/15 px-5 py-3 text-sm font-black text-sky-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] hover:border-sky-200/50 hover:bg-sky-400/20 hover:text-white md:inline-flex"
                >
                  <Download size={18} />
                  Download for Windows
                  <ExternalLink size={15} />
                </a>
              ) : (
                <span className="inline-flex items-center justify-center gap-2 rounded border border-line px-5 py-3 text-sm font-bold text-stone-400">
                  <AlertCircle size={18} />
                  Download unavailable
                </span>
              )}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {steps.map((step, index) => {
              const Icon = step.icon;

              return (
                <div key={step.title} className="rounded-lg border border-line bg-panel p-4">
                  <div className="flex gap-4">
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded bg-gold text-lg font-black text-black">
                      {index + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex items-center gap-2">
                        <Icon size={18} className="text-gold" />
                        <h2 className="text-lg font-black text-white">{step.title}</h2>
                      </div>
                      <p className="text-sm leading-5 text-stone-300">{step.body}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-lg border border-line bg-panel p-4 sm:p-5">
            <h2 className="text-lg font-black text-white">What to look for</h2>
            <div className="mt-4 flex items-center gap-4 rounded border border-line bg-black/20 p-4">
              <img src="/companion-icon.ico" alt="GameFive Companion tray icon" className="h-14 w-14" />
              <div>
                <div className="font-bold text-white">Task tray icon</div>
                <p className="mt-1 text-sm text-stone-400">
                  Tray icon only. No main window.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-line bg-panel p-4 sm:p-5">
            <h2 className="text-lg font-black text-white">Connection states</h2>
            <div className="mt-4 space-y-3">
              <div className="flex gap-3 rounded border border-line bg-black/20 p-3">
                <MonitorDown size={20} className="mt-0.5 text-stone-400" />
                <div>
                  <div className="font-bold text-stone-200">Disconnected</div>
                  <p className="mt-1 text-sm text-stone-400">
                    League is closed or not detected yet.
                  </p>
                </div>
              </div>
              <div className="flex gap-3 rounded border border-emerald-500/30 bg-emerald-950/20 p-3">
                <CheckCircle2 size={20} className="mt-0.5 text-emerald-400" />
                <div>
                  <div className="font-bold text-emerald-300">Connected</div>
                  <p className="mt-1 text-sm text-stone-300">
                    League is detected and Mayhem capture is ready.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-line bg-panel p-4 sm:p-5">
            <h2 className="text-lg font-black text-white">After a match</h2>
            <p className="mt-2 text-sm leading-6 text-stone-300">
              Leave it running while you play. Mayhem results upload after the game ends.
            </p>
            <Link href="/" className="mt-4 inline-flex text-sm font-bold text-gold hover:underline">
              Return to GameFive
            </Link>
          </div>
        </aside>
      </div>
    </section>
  );
}
