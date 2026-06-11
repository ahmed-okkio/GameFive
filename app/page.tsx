import { MatchRow } from "@/components/MatchRow";
import { prisma } from "@/lib/prisma";
import { SearchForm } from "@/components/SearchForm";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { getTierLabel } from "@/lib/mmr/tier";
import { DEFAULT_DDRAGON_VERSION, getLatestDDragonVersion, getProfileIconUrl } from "@/lib/riot/ddragon";
import { getChampionAssetMap } from "@/lib/riot/champions";
import { Suspense } from "react";
import { PageLoader } from "@/components/Loading";

type MatchParticipant = {
  id: string;
  matchId: string;
  win: boolean;
  kills: number;
  deaths: number;
  assists: number;
  lpDelta: number;
  isPlacement: boolean;
  championId: number;
  championName: string | null;
  itemsJson: unknown;
  augmentsJson: unknown;
  spell1Id: number | null;
  spell2Id: number | null;
  team: number;
  player: {
    riotIdName: string;
    riotIdTag: string;
    profileIconId: number | null;
  } | null;
  match: {
    gameDate: Date;
    durationSeconds: number;
    participants: {
      team: number;
      kills: number;
      assists: number;
    }[];
  };
};

async function HomeLoader() {
  const latestVersion = await getLatestDDragonVersion().catch(() => DEFAULT_DDRAGON_VERSION);
  const championAssets = await getChampionAssetMap();

  const [, , , topPlayers, recentGames] = await Promise.all([
    prisma.player.count(),
    prisma.player.count({ where: { isPlaced: true } }),
    prisma.match.count({ where: { gameMode: "MAYHEM" } }),
    prisma.player.findMany({
      take: 10,
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
    }),
    prisma.matchParticipant.findMany({
      where: {
        playerId: { not: null },
        match: { gameMode: "MAYHEM" }
      },
      take: 5,
      orderBy: { match: { gameDate: "desc" } },
      include: {
        player: true,
        match: {
          include: {
            participants: true
          }
        }
      }
    }) as Promise<MatchParticipant[]>
  ]);

  return (
    <div className="grid gap-8">
      <div className="mt-8 space-y-8">
        <section className="rounded-lg border border-line bg-panel shadow-xl shadow-black/20 overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-4 py-4 sm:px-5">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-widest text-stone-400">Recent Games</h2>
              <p className="mt-1 text-sm text-stone-500">Latest activity across the server</p>
            </div>
          </div>

          <div className="divide-y divide-line/80">
            {recentGames.map((participant: MatchParticipant) => {
              const matchData = {
                id: participant.matchId,
                win: participant.win,
                kills: participant.kills,
                deaths: participant.deaths,
                assists: participant.assists,
                lpDelta: participant.lpDelta,
                isPlacement: participant.isPlacement,
                championName: participant.championName ?? "Unknown",
                championImage: championAssets[participant.championId]?.imageUrl ?? null,
                match: {
                  gameDate: participant.match.gameDate.toISOString(),
                  durationSeconds: participant.match.durationSeconds
                },
                viewedParticipant: {
                  itemsJson: participant.itemsJson,
                  spell1Id: participant.spell1Id,
                  spell2Id: participant.spell2Id,
                  augmentsJson: participant.augmentsJson
                },
                ddragonVersion: latestVersion,
                player: participant.player
                  ? {
                      name: participant.player.riotIdName,
                      tag: participant.player.riotIdTag,
                      profileIconUrl: participant.player.profileIconId
                        ? getProfileIconUrl(participant.player.profileIconId, latestVersion)
                        : undefined
                    }
                  : undefined
              };
              return <MatchRow key={participant.id} match={matchData} />;
            })}
          </div>
        </section>

        <section className="rounded-lg border border-line bg-panel shadow-xl shadow-black/20 overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-4 py-4 sm:px-5">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-widest text-stone-400">Top of board</h2>
              <p className="mt-1 text-sm text-stone-500">The strongest tracked players right now</p>
            </div>
            <Link
              href="/leaderboard"
              className="interactive inline-flex items-center gap-1.5 text-sm font-semibold text-gold hover:text-white"
            >
              Open board
              <ArrowUpRight size={16} />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead className="bg-black/20 text-xs uppercase tracking-widest text-stone-500">
                <tr>
                  <th className="px-4 py-3 sm:px-5 w-12">#</th>
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
                  const rankLabel = player.isPlaced
                    ? (promoLabel ?? getTierLabel(player.rawMmr).label)
                    : "Unranked";

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
                        {!player.isPlaced ? (
                          <div className="text-xs text-stone-500">Placement in progress</div>
                        ) : null}
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
    </div>
  );
}

export default function HomePage() {
  return (
    <section className="mx-auto min-h-[calc(100vh-170px)] max-w-6xl px-4 py-8 sm:py-12">
      <div className="grid gap-8">
        <div className=" min-w-0">
          <p className="mb-3 inline-flex rounded border border-gold/40 bg-gold/10 px-3 py-1 text-sm font-semibold text-gold">
            EUW Mayhem tracker
          </p>
          <h1 className="font-display max-w-4xl text-4xl font-black leading-tight text-white sm:text-6xl">
            GameFive
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-stone-300 sm:lg">
            Search a Riot ID to view Mayhem MMR, recent games, champion stats, and lobby performance.
          </p>

          <div className="mt-7 w-full rounded-lg border border-line bg-panel p-4 shadow-2xl shadow-black/20 sm:p-5">
            <SearchForm />
          </div>
        </div>
      </div>
      <Suspense fallback={<PageLoader text="Loading recent games and leaderboard..." />}>
        <HomeLoader />
      </Suspense>
    </section>
  );
}
