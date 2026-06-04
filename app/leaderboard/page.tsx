import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getTierLabel } from "@/lib/mmr/tier";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  const players = await prisma.player.findMany({
    orderBy: [
      {
        rawMmr: "desc"
      }
    ]
  });

  return (
    <section className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-black text-white">Leaderboard</h1>
          <p className="mt-1 text-sm text-stone-400">All players in the database, sorted by MMR.</p>
        </div>
        <span className="rounded border border-gold/40 px-3 py-1 text-sm text-gold">EUW</span>
      </div>
      <div className="overflow-hidden rounded border border-line bg-panel">
        {players.length ? (
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
              {players.map((player, index) => {
                const tier = player.isPlaced ? getTierLabel(player.rawMmr) : { label: "Unranked" };

                return (
                  <tr key={player.id} className="border-t border-line">
                    <td className="p-3 text-stone-400">{index + 1}</td>
                    <td className="p-3">
                      <Link
                        href={`/player/${encodeURIComponent(player.riotIdName)}/${encodeURIComponent(player.riotIdTag)}`}
                        className="font-semibold text-white hover:text-gold"
                      >
                        {player.riotIdName}#{player.riotIdTag}
                      </Link>
                    </td>
                    <td className="p-3 text-gold">{tier.label}</td>
                    <td className="p-3 text-right font-bold">{player.isPlaced ? player.currentLp.toLocaleString() : "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p className="p-8 text-center text-stone-400">No players are in the database yet.</p>
        )}
      </div>
    </section>
  );
}
