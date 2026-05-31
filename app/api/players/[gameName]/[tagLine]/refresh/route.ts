import { NextResponse } from "next/server";
import { getPlayerByRiotId } from "@/lib/players";
import { calculateAndStoreProfile } from "@/lib/mmr/calculate-profile";
import { prisma } from "@/lib/prisma";
import { riotClient } from "@/lib/riot/client";

type Context = {
  params: Promise<{
    gameName: string;
    tagLine: string;
  }>;
};

export async function POST(_request: Request, context: Context) {
  const params = await context.params;
  const gameName = decodeURIComponent(params.gameName);
  const tagLine = decodeURIComponent(params.tagLine);
  let player = await getPlayerByRiotId(gameName, tagLine);

  if (!player) {
      try {
        const account = await riotClient.getAccountByRiotId(gameName, tagLine);
        if (account) {
            player = await prisma.player.upsert({
                where: { puuid: account.puuid },
                update: {
                    riotIdName: account.gameName,
                    riotIdTag: account.tagLine
                },
                create: {
                    puuid: account.puuid,
                    riotIdName: account.gameName,
                    riotIdTag: account.tagLine
                }
            });
        }
      } catch (e) {
          return NextResponse.json({ error: "Player not found." }, { status: 404 });
      }
  }

  if (player?.manualRefreshAt && Date.now() - player.manualRefreshAt.getTime() < 30 * 60 * 1000) {
    return NextResponse.json(
      { error: "Manual refresh is available every 30 minutes." },
      { status: 429 }
    );
  }

  if (player) {
    await calculateAndStoreProfile(player);
    await prisma.player.update({
        where: { id: player.id },
        data: { manualRefreshAt: new Date() }
    });
  } else {
    return NextResponse.json({ error: "Player not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
