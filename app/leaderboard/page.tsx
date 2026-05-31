import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getTierLabel } from "@/lib/mmr/tier";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  const entries = await prisma.friendsLeaderboard.findMany({
    include: {
      player: true
    },
    orderBy: [
      {
        player: {
          rawMmr: "desc"
        }
      }
    ]
  });

  return (
    <section className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-black text-white">Friends Leaderboard</h1>
          <p className="mt-1 text-sm text-stone-400">Admin-curated EUW players, sorted by displayed MMR.</p>
        </div>
        <span className="rounded border border-gold/40 px-3 py-1 text-sm text-gold">EUW</span>
      </div>
      <div className="overflow-hidden rounded border border-line bg-panel">
        {entries.length ? (
          <table className="w-full border-collapse text-left">
            <thead className="bg-black/20 text-sm text-stone-400">
              <tr>
                <th className="p-3">#</th>
                <th className="p-3">Player</th>
                <th className="p-3">Rank</th>
                <th className="p-3 text-right">LP</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, index) => {
                const tier = entry.player.isPlaced ? getTierLabel(entry.player.rawMmr) : { label: "Unranked" };

                return (
                  <tr key={entry.id} className="border-t border-line">
                    <td className="p-3 text-stone-400">{index + 1}</td>
                    <td className="p-3">
                      <Link
                        href={`/player/${encodeURIComponent(entry.player.riotIdName)}/${encodeURIComponent(entry.player.riotIdTag)}`}
                        className="font-semibold text-white hover:text-gold"
                      >
                        {entry.player.riotIdName}#{entry.player.riotIdTag}
                      </Link>
                    </td>
                    <td className="p-3 text-gold">{tier.label}</td>
                    <td className="p-3 text-right font-bold">{entry.player.isPlaced ? entry.player.currentLp.toLocaleString() : "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p className="p-8 text-center text-stone-400">No leaderboard entries yet.</p>
        )}
      </div>
    </section>
  );
}
