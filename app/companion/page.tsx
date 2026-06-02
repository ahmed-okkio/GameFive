import type { Metadata } from "next";
import Link from "next/link";
import { AlertCircle, CheckCircle2, Download, ExternalLink, MonitorDown, Play, Search, ShieldCheck } from "lucide-react";
import { appConfig } from "@/lib/config";

export const metadata: Metadata = {
  title: "Download Companion | GameFive",
  description: "Download and set up the GameFive Companion app for ARAM Mayhem tracking."
};

const steps = [
  {
    title: "Download the companion",
    body: "Get the latest GameFive Companion app, then keep the file somewhere easy to find, such as your Downloads folder or desktop.",
    icon: Download
  },
  {
    title: "Run the app",
    body: "Open the downloaded file. Windows may ask you to confirm because it is a small private app, not a store-installed program.",
    icon: Play
  },
  {
    title: "Look in the task tray",
    body: "The companion does not open a normal window. It runs quietly from the Windows task tray near the clock.",
    icon: Search
  },
  {
    title: "Open League and play Mayhem",
    body: "When League is running, the companion connects to the local League client and records completed Mayhem matches automatically.",
    icon: ShieldCheck
  }
];

export default function CompanionPage() {
  const downloadUrl = appConfig.companionDownloadUrl;

  return (
    <section className="mx-auto max-w-6xl px-4 py-10">
      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div>
          <div className="mb-8">
            <p className="mb-3 inline-flex rounded border border-gold/40 px-3 py-1 text-sm font-semibold text-gold">
              Windows companion app
            </p>
            <h1 className="max-w-3xl text-4xl font-black leading-tight text-white sm:text-6xl">
              Download GameFive Companion
            </h1>
            <p className="mt-4 max-w-2xl text-lg text-stone-300">
              Run this while you play ARAM Mayhem so GameFive can record your matches from the local League client.
            </p>
          </div>

          <div className="mb-8 rounded-lg border border-line bg-panel p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-black text-white">Latest companion download</h2>
                <p className="mt-1 text-sm text-stone-400">Single Windows app. No setup wizard, no normal app window.</p>
              </div>
              {downloadUrl ? (
                <a
                  href={downloadUrl}
                  className="inline-flex items-center justify-center gap-2 rounded bg-gold px-5 py-3 text-sm font-black text-black hover:bg-gold/90"
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

          <div className="space-y-3">
            {steps.map((step, index) => {
              const Icon = step.icon;

              return (
                <div key={step.title} className="rounded-lg border border-line bg-panel p-5">
                  <div className="flex gap-4">
                    <div className="grid h-12 w-12 shrink-0 place-items-center rounded bg-gold text-lg font-black text-black">
                      {index + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex items-center gap-2">
                        <Icon size={18} className="text-gold" />
                        <h2 className="text-xl font-black text-white">{step.title}</h2>
                      </div>
                      <p className="text-sm leading-6 text-stone-300">{step.body}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-lg border border-line bg-panel p-5">
            <h2 className="text-lg font-black text-white">What to look for</h2>
            <div className="mt-4 flex items-center gap-4 rounded border border-line bg-black/20 p-4">
              <img src="/companion-icon.ico" alt="GameFive Companion tray icon" className="h-14 w-14" />
              <div>
                <div className="font-bold text-white">Task tray icon</div>
                <p className="mt-1 text-sm text-stone-400">
                  The app has no main UI. It lives in the tray near the Windows clock.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-line bg-panel p-5">
            <h2 className="text-lg font-black text-white">Connection states</h2>
            <div className="mt-4 space-y-3">
              <div className="flex gap-3 rounded border border-line bg-black/20 p-3">
                <MonitorDown size={20} className="mt-0.5 text-stone-400" />
                <div>
                  <div className="font-bold text-stone-200">Disconnected</div>
                  <p className="mt-1 text-sm text-stone-400">
                    League is closed or the companion cannot see the local League client yet. This is normal before opening League.
                  </p>
                </div>
              </div>
              <div className="flex gap-3 rounded border border-emerald-500/30 bg-emerald-950/20 p-3">
                <CheckCircle2 size={20} className="mt-0.5 text-emerald-400" />
                <div>
                  <div className="font-bold text-emerald-300">Connected</div>
                  <p className="mt-1 text-sm text-stone-300">
                    League is running and the companion is ready to capture completed Mayhem games.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-line bg-panel p-5">
            <h2 className="text-lg font-black text-white">After a match</h2>
            <p className="mt-2 text-sm leading-6 text-stone-300">
              Leave the companion running while you play. When a Mayhem game ends, it uploads the match for GameFive profiles and leaderboards.
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
