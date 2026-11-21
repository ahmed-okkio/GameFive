import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const entries = await prisma.leaderboardBlacklist.findMany({
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

  return NextResponse.json({
    entries
  });
}

// No POST: nothing inserts into leaderboard_blacklist during the Countdown (R2.10).

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  await prisma.leaderboardBlacklist.delete({
    where: { id }
  });

  return NextResponse.json({ ok: true });
}
