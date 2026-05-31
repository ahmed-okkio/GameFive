import { NextResponse } from "next/server";
import { readPlayerProfileStatus } from "@/lib/players";
import { CHAMPION_MAP } from "@/lib/riot/champions";

type Context = {
  params: Promise<{
    gameName: string;
    tagLine: string;
  }>;
};

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, context: Context) {
  const params = await context.params;
  const profile = await readPlayerProfileStatus(decodeURIComponent(params.gameName), decodeURIComponent(params.tagLine));

  if (profile.state === "awaiting") {
    return NextResponse.json({
      state: "awaiting",
      job: profile.job
    });
  }

  return NextResponse.json({
    state: "ready",
    player: profile.player,
    mmr: profile.mmr,
    tier: profile.tier,
    matches: profile.matches.map(m => ({
        id: m.id,
        win: m.win,
        kills: m.kills,
        deaths: m.deaths,
        assists: m.assists,
        lpDelta: m.lpDelta,
        championId: m.championId,
        championName: CHAMPION_MAP[m.championId] ?? `Champion ${m.championId}`,
        damageToChampions: m.damageToChampions,
        healingDone: m.healingDone,
        match: {
            gameDate: m.match.gameDate.toISOString()
        }
    })),
    champions: profile.champions,
    activeJob: profile.activeJob,
    latestProfileJob: profile.latestProfileJob
  });
}
