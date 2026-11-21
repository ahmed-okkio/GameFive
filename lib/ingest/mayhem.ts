import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { findPlayerByPuuid, isEntrant } from "@/lib/entrants";
import { scoreMatch } from "@/lib/mmr/performance-score";

const MAYHEM_QUEUE_ID = 2400;
const MAYHEM_GAME_TYPE = "MATCHED_GAME";
const REMAKE_SECONDS = 240;

// Only identity fields are validated; everything else is optional, unlimited and kept as sent (looseObject).
export const companionMatchPayloadSchema = z.looseObject({
  uploaderPuuid: z.string().min(1),
  gameId: z.number().int().positive(),
  queueId: z.number().int(),
  gameType: z.string(),
  gameCreation: z.number().int().positive(),
  gameDuration: z.number().int().nonnegative(),
  // The uploader's own end-of-game stats block, read by the Companion when the game ends.
  endOfGameStats: z.record(z.string(), z.unknown()).nullish(),
  participants: z
    .array(
      z.looseObject({
        puuid: z.string().min(1),
        teamId: z.number().int(),
        championId: z.number().int(),
        win: z.boolean()
      })
    )
    .min(1)
});

export type CompanionMatchPayload = z.infer<typeof companionMatchPayloadSchema>;

export type IngestStatus = "stored" | "duplicate" | "not_mayhem" | "remake" | "not_entrant";

function int(value: unknown) {
  return Number.isSafeInteger(value) ? (value as number) : undefined;
}

function str(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function result(status: IngestStatus, matchId?: string) {
  return { status, accepted: status === "stored" || status === "duplicate", duplicate: status === "duplicate", matchId };
}

export async function ingestCompanionMayhemMatch(payload: CompanionMatchPayload) {
  if (payload.queueId !== MAYHEM_QUEUE_ID || payload.gameType !== MAYHEM_GAME_TYPE) {
    return result("not_mayhem");
  }

  if (payload.gameDuration < REMAKE_SECONDS) {
    return result("remake");
  }

  const uploader = await findPlayerByPuuid(payload.uploaderPuuid);
  if (!isEntrant(uploader)) {
    return result("not_entrant");
  }

  const matchId = `LCU_${payload.gameId}`;
  if (await prisma.match.findUnique({ where: { matchId }, select: { id: true } })) {
    return result("duplicate", matchId);
  }

  // Identity is the PUUID only: participants attach to existing rows by PUUID, never by Riot name.
  const knownPlayers = await prisma.player.findMany({
    where: { puuid: { in: payload.participants.map((p) => p.puuid) } },
    orderBy: { createdAt: "asc" }
  });
  const playerByPuuid = new Map<string, (typeof knownPlayers)[number]>();
  for (const player of knownPlayers) {
    if (player.puuid && !playerByPuuid.has(player.puuid)) playerByPuuid.set(player.puuid, player);
  }

  const gameDate = new Date(payload.gameCreation);
  const gameEndedAt = new Date(payload.gameCreation + payload.gameDuration * 1000);
  const eog = payload.endOfGameStats ?? null;

  type Participant = (typeof payload.participants)[number] & Record<string, unknown>;
  const participants = payload.participants.map((p: Participant, index) => ({
    ...p,
    participantId: int(p.participantId) ?? index + 1,
    gameName: str(p.gameName) ?? str(p.summonerName),
    tagLine: str(p.tagLine),
    isUploader: p.puuid === payload.uploaderPuuid
  }) as Participant & { participantId: number; gameName?: string; tagLine?: string; isUploader: boolean });

  const scores = scoreMatch({
    participants: participants.map((p) => ({
      participantId: p.participantId,
      teamId: p.teamId,
      stats: {
        win: p.win,
        kills: int(p.kills) ?? 0,
        deaths: int(p.deaths) ?? 0,
        assists: int(p.assists) ?? 0,
        totalDamageDealtToChampions: int(p.totalDamageDealtToChampions) ?? 0,
        totalDamageTaken: int(p.damageTaken) ?? 0,
        damageSelfMitigated: int(p.selfMitigated) ?? 0,
        totalHeal: int(p.totalHeal) ?? 0,
        totalUnitsHealed: int(p.totalUnitsHealed) ?? 0,
        timeCCingOthers: 0,
        goldEarned: int(p.goldEarned) ?? 0,
        champLevel: int(p.champLevel) ?? 0,
        doubleKills: int(p.doubleKills) ?? 0,
        tripleKills: int(p.tripleKills) ?? 0,
        quadraKills: int(p.quadraKills) ?? 0,
        pentaKills: int(p.pentaKills) ?? 0
      }
    })),
    participantIdentities: participants.map((p) => ({
      participantId: p.participantId,
      player: { gameName: p.gameName ?? "Unknown" }
    }))
  });

  // Pick up Riot ID renames, but never let an old (backfilled) game overwrite a newer name.
  const renames = participants.flatMap((p) => {
    const player = playerByPuuid.get(p.puuid);
    if (!player || !p.gameName || !p.tagLine || gameEndedAt <= player.updatedAt) return [];
    if (player.riotIdName === p.gameName && player.riotIdTag === p.tagLine) return [];
    return [prisma.player.update({ where: { id: player.id }, data: { riotIdName: p.gameName, riotIdTag: p.tagLine } })];
  });

  const createMatch = prisma.match.create({
    data: {
      matchId,
      gameMode: "MAYHEM",
      gameDate,
      gameEndedAt,
      durationSeconds: payload.gameDuration,
      queueId: payload.queueId,
      teamsJson: Array.isArray(payload.teams) ? (payload.teams as Prisma.InputJsonValue) : undefined,
      rawPayload: payload as Prisma.InputJsonValue,
      participants: {
        create: participants.map((p) => {
          const player = playerByPuuid.get(p.puuid);
          // The uploader's end-of-game block is the source for teammate healing/shielding.
          const stats: Record<string, unknown> = p.isUploader && eog ? eog : p;
          return {
            playerId: player?.id,
            playerRiotIdName: player ? null : p.gameName ?? null,
            playerRiotIdTag: player ? null : p.tagLine ?? null,
            team: p.teamId,
            win: p.win,
            championId: p.championId,
            kills: int(p.kills) ?? 0,
            deaths: int(p.deaths) ?? 0,
            assists: int(p.assists) ?? 0,
            damageToChampions: int(p.totalDamageDealtToChampions) ?? 0,
            healingDone: int(p.totalHeal) ?? 0,
            killParticipation: 0,
            damageShare: 0,
            healingShare: 0,
            performanceScore: scores.find((s) => s.participantId === p.participantId)?.score ?? 0,
            totalTimeCrowdControlDealt: int(p.totalTimeCrowdControlDealt) ?? 0,
            totalHealOnTeammates: int(stats.totalHealOnTeammates) ?? int(p.totalHealOnTeammates) ?? 0,
            totalDamageShieldedOnTeammates:
              int(stats.totalDamageShieldedOnTeammates) ?? int(p.totalDamageShieldedOnTeammates) ?? 0,
            endOfGameStats: p.isUploader && eog ? (eog as Prisma.InputJsonValue) : undefined,
            itemsJson: Array.isArray(p.items) ? (p.items as Prisma.InputJsonValue) : undefined,
            augmentsJson: Array.isArray(p.augments) ? (p.augments as Prisma.InputJsonValue) : undefined,
            spell1Id: int(p.spell1Id),
            spell2Id: int(p.spell2Id),
            champLevel: int(p.champLevel),
            goldEarned: int(p.goldEarned),
            goldSpent: int(p.goldSpent),
            damageTaken: int(p.damageTaken),
            selfMitigated: int(p.selfMitigated),
            minionsKilled: int(p.minionsKilled),
            doubleKills: int(p.doubleKills),
            tripleKills: int(p.tripleKills),
            quadraKills: int(p.quadraKills),
            pentaKills: int(p.pentaKills),
            totalUnitsHealed: int(p.totalUnitsHealed)
          };
        })
      }
    }
  });

  try {
    // One transaction: the match, its participants and any renames are saved together or not at all.
    await prisma.$transaction([createMatch, ...renames]);
  } catch (error) {
    // A simultaneous upload of the same game won the unique match_id race.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return result("duplicate", matchId);
    }
    throw error;
  }

  return result("stored", matchId);
}
