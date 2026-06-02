import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
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
        <header className="border-b border-line bg-panel/95 backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center">
            <div className="flex min-w-0 items-center justify-between gap-3">
              <Link href="/" className="shrink-0 text-xl font-black tracking-wide text-gold">
                GameFive
              </Link>
              <nav className="flex min-w-0 items-center justify-end gap-2 text-sm sm:gap-3 lg:hidden">
                <Link
                  href="/companion"
                  className="inline-flex shrink-0 items-center gap-1.5 rounded bg-gold px-2.5 py-1.5 text-xs font-semibold text-black hover:bg-gold/90 sm:text-sm"
                >
                  <Download size={14} />
                  Companion
                </Link>
                <Link href="/leaderboard" className="text-stone-300 hover:text-white">
                  Board
                </Link>
              </nav>
            </div>
            <div className="w-full min-w-0 lg:max-w-2xl lg:flex-1">
              <SearchForm compact />
            </div>
            <nav className="hidden shrink-0 items-center gap-3 text-sm lg:flex">
              <Link
                href="/companion"
                className="inline-flex items-center gap-2 rounded bg-gold px-3 py-1.5 font-semibold text-black hover:bg-gold/90"
              >
                <Download size={14} />
                Download Companion
              </Link>
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
