import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Inter } from "next/font/google";
import "./globals.css";
import { Download } from "lucide-react";
import { SearchForm } from "@/components/SearchForm";

export const metadata: Metadata = {
  title: "GameFive",
  description: "Private unofficial ARAM Mayhem MMR tracker",
  icons: {
    icon: "/companion-icon.ico"
  }
};

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter"
});

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`dark ${inter.variable}`}>
      <body className="min-h-screen bg-ink text-stone-100 antialiased">
        <header className="border-b border-line bg-panel/95 backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-2.5 lg:flex-row lg:items-center">
            <div className="flex min-w-0 items-center justify-between gap-3 lg:shrink-0">
              <Link href="/" className="inline-flex shrink-0 items-center gap-2">
                <Image src="/companion-icon.ico" alt="" width={28} height={28} className="h-7 w-7 rounded-sm" />
                <span className="font-display shrink-0 text-xl font-semibold tracking-tight text-gold">
                  GameFive
                </span>
              </Link>
              <nav className="flex min-w-0 items-center justify-end gap-2 text-sm sm:gap-3 lg:hidden">
                <Link href="/leaderboard" className="text-stone-300 hover:text-white">
                  Board
                </Link>
              </nav>
            </div>
            <div className="w-full min-w-0 lg:flex-1 lg:max-w-2xl">
              <SearchForm compact />
            </div>
            <nav className="hidden shrink-0 items-center gap-3 text-sm lg:flex">
              <Link
                href="/companion"
                className="interactive hidden items-center gap-2 rounded border border-line bg-black/20 px-3 py-1.5 font-semibold text-stone-300 hover:border-sky-300/40 hover:bg-black/35 hover:text-white lg:inline-flex"
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
