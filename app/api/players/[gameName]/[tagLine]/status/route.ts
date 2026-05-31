import { NextResponse } from "next/server";
import { getPlayerProfile } from "@/lib/players";
import { calculateAndStoreProfile } from "@/lib/mmr/calculate-profile";
import { prisma } from "@/lib/prisma";

type Context = {
  params: Promise<{
    gameName: string;
    tagLine: string;
  }>;
};

export async function GET(_request: Request, context: Context) {
  const params = await context.params;
  const gameName = decodeURIComponent(params.gameName);
  const tagLine = decodeURIComponent(params.tagLine);
  
  // Directly calculate synchronously on request
  const profile = await getPlayerProfile(gameName, tagLine);
  
  if (profile.state === "ready" && profile.player) {
      const fullPlayer = await prisma.player.findUnique({ where: { id: profile.player.id } });
      if (fullPlayer) {
          await calculateAndStoreProfile(fullPlayer);
      }
      // Fetch fresh data after calculation
      const freshProfile = await getPlayerProfile(gameName, tagLine);
      return NextResponse.json(freshProfile);
  }

  return NextResponse.json(profile);
}
