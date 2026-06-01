import { NextResponse } from "next/server";
import { ensurePlayerExists } from "@/lib/players";
import { calculateAndStoreProfile } from "@/lib/mmr/calculate-profile";
import { prisma } from "@/lib/prisma";

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
  
  const player = await ensurePlayerExists(gameName, tagLine);

  if (!player) {
    return NextResponse.json({ error: "Player not found." }, { status: 404 });
  }

  if (player.manualRefreshAt && Date.now() - player.manualRefreshAt.getTime() < 3 * 60 * 1000) {
    return NextResponse.json(
      { error: "Manual refresh is available every 3 minutes." },
      { status: 429 }
    );
  }

  await calculateAndStoreProfile(player);
  await prisma.player.update({
      where: { id: player.id },
      data: { manualRefreshAt: new Date() }
  });

  return NextResponse.json({ ok: true });
}
