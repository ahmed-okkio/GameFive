import { NextResponse } from "next/server";
import { enqueueProfileCalculation } from "@/lib/jobs/enqueue";
import { getPlayerByRiotId } from "@/lib/players";

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
  const player = await getPlayerByRiotId(gameName, tagLine);

  if (player?.manualRefreshAt && Date.now() - player.manualRefreshAt.getTime() < 30 * 60 * 1000) {
    return NextResponse.json(
      {
        error: "Manual refresh is available every 30 minutes."
      },
      {
        status: 429
      }
    );
  }

  const job = await enqueueProfileCalculation(gameName, tagLine, true);

  if (player) {
    await import("@/lib/prisma").then(({ prisma }) =>
      prisma.player.update({
        where: {
          id: player.id
        },
        data: {
          manualRefreshAt: new Date()
        }
      })
    );
  }

  return NextResponse.json({
    job
  });
}
