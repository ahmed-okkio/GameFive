import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { appConfig } from "@/lib/config";
import { Download } from "lucide-react";
import { SearchForm } from "@/components/SearchForm";

export const metadata: Metadata = {
  title: "GameFive",
  description: "Private unofficial ARAM Mayhem MMR tracker"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-ink text-stone-100 antialiased">
        <header className="border-b border-line bg-panel/90">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
            <Link href="/" className="text-xl font-black tracking-wide text-gold">
              GameFive
            </Link>
            <div className="hidden sm:block w-96">
                <SearchForm />
            </div>
            <nav className="flex items-center gap-3 text-sm">
              {appConfig.companionDownloadUrl && (
                <a
                  href={appConfig.companionDownloadUrl}
                  className="inline-flex items-center gap-2 rounded bg-gold px-3 py-1.5 font-semibold text-black hover:bg-gold/90"
                >
                  <Download size={14} />
                  Download Companion
                </a>
              )}
              <span className="rounded border border-gold/50 px-2 py-1 text-gold">EUW</span>
              <Link href="/leaderboard" className="text-stone-300 hover:text-white">
                Leaderboard
              </Link>
              <Link href="/admin" className="text-stone-300 hover:text-white">
                Admin
              </Link>
            </nav>
          </div>
        </header>
        <main>{children}</main>
        <footer className="mx-auto max-w-6xl px-4 py-8 text-xs text-stone-500">
          GameFive is a private, unofficial project and is not endorsed by Riot Games. Riot Games and League of Legends are
          trademarks or registered trademarks of Riot Games, Inc.
        </footer>
      </body>
    </html>
  );
}
