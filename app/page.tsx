import { prisma } from "@/lib/prisma";
import { SearchForm } from "@/components/SearchForm";
import Link from "next/link";
import { Activity, ArrowUpRight, Download, Trophy } from "lucide-react";
import { getTierLabel } from "@/lib/mmr/tier";

export default async function HomePage() {
  const [trackedPlayers, placedPlayers, mayhemMatches, topPlayers] = await Promise.all([
    prisma.player.count(),
    prisma.player.count({ where: { isPlaced: true } }),
    prisma.match.count({ where: { gameMode: "MAYHEM" } }),
    prisma.player.findMany({
      take: 5,
      orderBy: { rawMmr: "desc" },
      select: {
        id: true,
        riotIdName: true,
        riotIdTag: true,
        rawMmr: true,
        currentLp: true,
        isPlaced: true,
        promoFromTier: true,
        promoToTier: true,
        promoWins: true,
        promoLosses: true
      }
    })
  ]);

  return (
    <section className="mx-auto min-h-[calc(100vh-170px)] max-w-6xl px-4 py-8 sm:py-12">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <div className="min-w-0">
          <p className="mb-3 inline-flex rounded border border-gold/40 bg-gold/10 px-3 py-1 text-sm font-semibold text-gold">
            EUW Mayhem tracker
          </p>
          <h1 className="font-display max-w-4xl text-4xl font-black leading-tight text-white sm:text-6xl">
            GameFive
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-stone-300 sm:text-lg">
            Search a Riot ID to view Mayhem MMR, recent games, champion stats, and lobby performance.
          </p>

          <div className="mt-7 w-full rounded-lg border border-line bg-panel p-4 shadow-2xl shadow-black/20 sm:p-5">
            <SearchForm />
          </div>

          <div className="mt-5 flex flex-wrap gap-3 text-sm text-stone-300">
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

        <aside className="space-y-4">
          <div className="rounded-lg border border-line bg-panel p-4 shadow-xl shadow-black/20">
            <h2 className="text-sm font-bold uppercase tracking-widest text-stone-400">Live state</h2>
            <dl className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded border border-line bg-black/20 p-3">
                <dt className="text-xs text-stone-500">Tracked players</dt>
                <dd className="mt-1 text-2xl font-black text-white">{trackedPlayers.toLocaleString()}</dd>
              </div>
              <div className="rounded border border-line bg-black/20 p-3">
                <dt className="text-xs text-stone-500">Placed players</dt>
                <dd className="mt-1 text-2xl font-black text-white">{placedPlayers.toLocaleString()}</dd>
              </div>
              <div className="rounded border border-line bg-black/20 p-3 col-span-2">
                <dt className="text-xs text-stone-500">Mayhem matches</dt>
                <dd className="mt-1 text-2xl font-black text-white">{mayhemMatches.toLocaleString()}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-lg border border-line bg-panel p-4">
            <h2 className="text-sm font-bold uppercase tracking-widest text-stone-400">Companion</h2>
            <p className="mt-3 text-sm leading-6 text-stone-300">
              Run the desktop app to upload games automatically and keep placement data current.
            </p>
            <Link
            href="/companion"
            className="interactive mt-4 hidden items-center gap-2 rounded border border-sky-300/30 bg-sky-500/15 px-3 py-2 text-sm font-semibold text-sky-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] hover:border-sky-200/50 hover:bg-sky-400/20 hover:text-white sm:inline-flex"
          >
              <Download size={16} />
              Download Companion
            </Link>
          </div>

          <div className="rounded-lg border border-line bg-panel p-4">
            <h2 className="text-sm font-bold uppercase tracking-widest text-stone-400">What you get</h2>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-stone-300">
              <li>Rank snapshots, placements, and promos</li>
              <li>Recent Mayhem history and lobby MMR</li>
              <li>Private leaderboard and match replay data</li>
            </ul>
          </div>
        </aside>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
        <section className="rounded-lg border border-line bg-panel shadow-xl shadow-black/20">
          <div className="flex items-center justify-between border-b border-line px-4 py-4 sm:px-5">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-widest text-stone-400">Top of board</h2>
              <p className="mt-1 text-sm text-stone-500">The strongest tracked players right now</p>
            </div>
            <Link href="/leaderboard" className="interactive inline-flex items-center gap-1.5 text-sm font-semibold text-gold hover:text-white">
              Open board
              <ArrowUpRight size={16} />
            </Link>
          </div>

          <div className="overflow-hidden">
            <table className="w-full border-collapse text-left">
              <thead className="bg-black/20 text-xs uppercase tracking-widest text-stone-500">
                <tr>
                  <th className="px-4 py-3 sm:px-5">#</th>
                  <th className="px-4 py-3 sm:px-5">Player</th>
                  <th className="px-4 py-3 sm:px-5">Rank</th>
                  <th className="px-4 py-3 text-right sm:px-5">LP</th>
                </tr>
              </thead>
              <tbody>
                {topPlayers.map((player, index) => {
                  const promoLabel =
                    player.promoFromTier && player.promoToTier
                      ? `${player.promoFromTier} I PROMO (${player.promoWins}W ${player.promoLosses}L)`
                      : null;
                  const rankLabel = player.isPlaced ? (promoLabel ?? getTierLabel(player.rawMmr).label) : "Unranked";

                  return (
                    <tr key={player.id} className="border-t border-line/80">
                      <td className="px-4 py-3 text-sm text-stone-500 sm:px-5">{index + 1}</td>
                      <td className="px-4 py-3 sm:px-5">
                        <Link
                          href={`/player/${encodeURIComponent(player.riotIdName)}/${encodeURIComponent(player.riotIdTag)}`}
                          className="font-semibold text-white hover:text-gold"
                        >
                          {player.riotIdName}#{player.riotIdTag}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm text-sky-300 sm:px-5">
                        <div>{rankLabel}</div>
                        {!player.isPlaced ? <div className="text-xs text-stone-500">Placement in progress</div> : null}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-white sm:px-5">
                        {player.isPlaced ? player.currentLp.toLocaleString() : "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </section>
  );
}
