import { SearchForm } from "@/components/SearchForm";
import Link from "next/link";
import { Activity, Download, Trophy } from "lucide-react";

export default function HomePage() {
  return (
    <section className="mx-auto grid min-h-[calc(100vh-170px)] max-w-6xl content-center px-4 py-10 sm:py-16">
      <div className="max-w-5xl">
        <p className="mb-3 inline-flex rounded border border-gold/40 bg-gold/10 px-3 py-1 text-sm font-semibold text-gold">EUW Mayhem tracker</p>
        <h1 className="max-w-4xl text-5xl font-black leading-tight text-white sm:text-7xl">GameFive</h1>
        <p className="mt-4 max-w-3xl text-lg text-stone-300">
          Search a Riot ID to view Mayhem MMR, recent games, champion stats, and lobby performance.
        </p>
        <div className="mt-8 max-w-4xl rounded-lg border border-line bg-panel p-4 shadow-2xl shadow-black/20 sm:p-5">
          <SearchForm />
        </div>
        <div className="mt-5 flex flex-col gap-3 text-sm text-stone-300 sm:flex-row sm:flex-wrap">
          <Link href="/companion" className="hidden items-center gap-2 rounded border border-line bg-black/20 px-3 py-2 font-semibold text-gold hover:border-gold sm:inline-flex">
            <Download size={16} />
            Download Companion
          </Link>
          <span className="inline-flex items-center gap-2 rounded border border-line bg-black/20 px-3 py-2">
            <Activity size={16} className="text-emerald-400" />
            Live Mayhem ingestion
          </span>
          <span className="inline-flex items-center gap-2 rounded border border-line bg-black/20 px-3 py-2">
            <Trophy size={16} className="text-gold" />
            Private leaderboard
          </span>
        </div>
      </div>
    </section>
  );
}
