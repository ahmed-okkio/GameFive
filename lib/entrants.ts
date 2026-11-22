import type { Player, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// An Entrant is a player who has registered through the Companion and has not been removed by an admin.
export const entrantWhere = { registeredAt: { not: null }, removedAt: null } satisfies Prisma.PlayerWhereInput;

export function isEntrant(player: Pick<Player, "registeredAt" | "removedAt"> | null | undefined) {
  return !!player?.registeredAt && !player.removedAt;
}

export async function findPlayerByPuuid(puuid: string) {
  // Oldest row wins if legacy data holds duplicates for one PUUID.
  return prisma.player.findFirst({ where: { puuid }, orderBy: { createdAt: "asc" } });
}

// Identity is the PUUID only: the Riot ID is display data and is refreshed on every register.
export async function registerEntrant(input: {
  puuid: string;
  riotIdName: string;
  riotIdTag: string;
  companionVersion?: string | null;
}) {
  const existing = await findPlayerByPuuid(input.puuid);
  const data = {
    riotIdName: input.riotIdName,
    riotIdTag: input.riotIdTag,
    companionVersion: input.companionVersion ?? undefined
  };

  if (existing) {
    return prisma.player.update({
      where: { id: existing.id },
      data: { ...data, registeredAt: existing.registeredAt ?? new Date() }
    });
  }

  // shortcut: no unique index on puuid (legacy rows may collide), so two simultaneous first registers could create two rows; add @unique once production data is deduplicated.
  return prisma.player.create({ data: { ...data, puuid: input.puuid, registeredAt: new Date() } });
}

// A stored game counts for an Entrant only if it ended after they registered.
export function countsForEntrant(player: Pick<Player, "id" | "registeredAt" | "removedAt">): Prisma.MatchParticipantWhereInput {
  if (!isEntrant(player)) return { id: { in: [] } };
  return { playerId: player.id, match: { gameEndedAt: { gt: player.registeredAt! } } };
}

// The Entrant list: every current Entrant, newest sign-up first.
export function listEntrants() {
  return prisma.player.findMany({ where: entrantWhere, orderBy: { registeredAt: "desc" }, select: { id: true, riotIdName: true, riotIdTag: true } });
}

