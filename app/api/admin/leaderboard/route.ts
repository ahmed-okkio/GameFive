import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const entries = await prisma.friendsLeaderboard.findMany({
    include: {
      player: true
    },
    orderBy: [
      {
        player: {
          rawMmr: "desc"
        }
      },
      {
        displayOrder: "asc"
      }
    ]
  });

  const queue = await prisma.enrichmentQueue.findMany({
    include: {
      player: true
    },
    orderBy: {
      queuedAt: "asc"
    },
    take: 20
  });

  return NextResponse.json({
    entries,
    queue
  });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { playerId?: string; riotId?: string };
  let playerId = body.playerId;

  if (!playerId && body.riotId) {
    const [gameName, tagLine] = body.riotId.split("#");

    if (!gameName?.trim() || !tagLine?.trim()) {
      return NextResponse.json({ error: "Use Riot ID format: PlayerName#EUW" }, { status: 400 });
    }

    const player = await prisma.player.findFirst({
      where: {
        riotIdName: {
          equals: gameName.trim()
        },
        riotIdTag: {
          equals: tagLine.trim()
        }
      }
    });

    if (!player) {
      const { enqueueProfileCalculation } = await import("@/lib/jobs/enqueue");
      await enqueueProfileCalculation(gameName.trim(), tagLine.trim());
      return NextResponse.json(
        {
          error: "Player calculation queued. Add them after the provisional profile is ready."
        },
        {
          status: 202
        }
      );
    }

    playerId = player.id;
  }

  if (!playerId) {
    return NextResponse.json({ error: "playerId or riotId is required" }, { status: 400 });
  }

  const entry = await prisma.friendsLeaderboard.upsert({
    where: {
      playerId
    },
    create: {
      playerId,
      addedBy: session.user?.name ?? "admin"
    },
    update: {}
  });

  return NextResponse.json({ entry });
}

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

  await prisma.friendsLeaderboard.delete({
    where: {
      id
    }
  });

  return NextResponse.json({ ok: true });
}
