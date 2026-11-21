import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Real local Postgres only (e.g. `npx prisma dev`), never production: set TEST_DATABASE_URL to a localhost URL.
const testDbUrl = process.env.TEST_DATABASE_URL ?? "";
const isLocalDb = /@(localhost|127\.0\.0\.1)[:/]/.test(testDbUrl);
process.env.DATABASE_URL = isLocalDb ? testDbUrl : "postgresql://invalid:invalid@127.0.0.1:1/none";
delete process.env.COMPANION_INGEST_TOKEN;

const root = path.resolve(__dirname, "..");

const { prisma } = await import("@/lib/prisma");
const { registerEntrant, countsForEntrant } = await import("@/lib/entrants");
const { ingestCompanionMayhemMatch, companionMatchPayloadSchema } = await import("@/lib/ingest/mayhem");
const { POST } = await import("@/app/api/ingest/match/route");

const UPLOADER = "puuid-uploader-0000000000";
let nextGameId = 1000;

function payload(overrides: Record<string, unknown> = {}) {
  return {
    source: "lcu",
    uploaderPuuid: UPLOADER,
    gameId: nextGameId++,
    queueId: 2400,
    gameType: "MATCHED_GAME",
    gameMode: "KIWI",
    gameCreation: Date.now() + 60_000,
    gameDuration: 1200,
    endOfGameStats: { totalHealOnTeammates: 4321, totalDamageShieldedOnTeammates: 1234, totalTimeSpentDead: 77 },
    participants: Array.from({ length: 10 }, (_, i) => ({
      puuid: i === 0 ? UPLOADER : `puuid-other-${i}-0000000000`,
      gameName: i === 0 ? "Uploader" : `Other${i}`,
      tagLine: "EUW",
      participantId: i + 1,
      teamId: i < 5 ? 100 : 200,
      championId: 1 + i,
      win: i < 5,
      kills: i,
      deaths: 1,
      assists: 2,
      totalDamageDealtToChampions: 1000 * i,
      totalHeal: 100,
      items: [1, 2, 3],
      augments: [10, 20]
    })),
    ...overrides
  };
}

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/ingest/match", {
      method: "POST",
      headers: { authorization: "Bearer dev-local-token", "content-type": "application/json" },
      body: JSON.stringify(body)
    })
  );
}

async function ingest(body: ReturnType<typeof payload>) {
  return ingestCompanionMayhemMatch(companionMatchPayloadSchema.parse(body));
}

describe.skipIf(!isLocalDb)("M2 entrants and ingest (local Postgres)", () => {
  const fetchSpy = vi.fn(() => {
    throw new Error("Outbound HTTP is not allowed in ingest");
  });

  beforeAll(() => {
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterAll(async () => {
    vi.unstubAllGlobals();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE "match_participants", "matches", "leaderboard_blacklist", "players" CASCADE'
    );
    await registerEntrant({ puuid: UPLOADER, riotIdName: "Uploader", riotIdTag: "EUW" });
  });

  it("R2.1 register creates, renames keeping registeredAt, and reuses an old row by PUUID", async () => {
    const first = await registerEntrant({ puuid: "puuid-new-0000000000", riotIdName: "Old", riotIdTag: "EUW" });
    expect(first.registeredAt).toBeInstanceOf(Date);

    const renamed = await registerEntrant({ puuid: "puuid-new-0000000000", riotIdName: "New", riotIdTag: "NA1" });
    expect(renamed.id).toBe(first.id);
    expect(renamed.riotIdName).toBe("New");
    expect(renamed.riotIdTag).toBe("NA1");
    expect(renamed.registeredAt).toEqual(first.registeredAt);

    const restored = await prisma.player.create({
      data: { puuid: "puuid-restored-0000000000", riotIdName: "Vet", riotIdTag: "EUW", rawMmr: 1500 }
    });
    expect(restored.registeredAt).toBeNull();
    const registered = await registerEntrant({ puuid: "puuid-restored-0000000000", riotIdName: "Vet", riotIdTag: "EUW" });
    expect(registered.id).toBe(restored.id);
    expect(registered.registeredAt).toBeInstanceOf(Date);
  });

  it("R2.2 a known Riot name with a new PUUID does not attach to the old player or overwrite its PUUID", async () => {
    const old = await registerEntrant({ puuid: "puuid-alice-old-000000", riotIdName: "Alice", riotIdTag: "EUW" });
    const body = payload();
    body.participants[3] = { ...body.participants[3], puuid: "puuid-alice-new-000000", gameName: "Alice", tagLine: "EUW" };

    expect((await ingest(body)).status).toBe("stored");

    const after = await prisma.player.findUniqueOrThrow({ where: { id: old.id } });
    expect(after.puuid).toBe("puuid-alice-old-000000");
    expect(await prisma.matchParticipant.count({ where: { playerId: old.id } })).toBe(0);
    const row = await prisma.matchParticipant.findFirstOrThrow({ where: { playerRiotIdName: "Alice" } });
    expect(row.playerId).toBeNull();
    expect(await prisma.player.count()).toBe(2);
  });

  it("R2.3 accepts only queue 2400 MATCHED_GAME and skips remakes", async () => {
    expect((await ingest(payload())).status).toBe("stored");
    expect((await ingest(payload({ queueId: 3270, gameType: "CUSTOM_GAME" }))).status).toBe("not_mayhem");
    expect((await ingest(payload({ gameType: "CUSTOM_GAME" }))).status).toBe("not_mayhem");
    expect((await ingest(payload({ gameDuration: 239 }))).status).toBe("remake");
    expect(await prisma.match.count()).toBe(1);
  });

  it("R2.4 accepts unlimited items/augments, unknown ids and extra fields; rejects missing puuid or win", async () => {
    const body = payload({ someNewRiotField: { nested: true } });
    body.participants[0] = {
      ...body.participants[0],
      items: [1, 2, 3, 4, 5, 6, 7, 8, 999999],
      augments: [1, 2, 3, 4, 5, 6, 7, 888888],
      brandNewStat: 42
    } as (typeof body.participants)[number];
    const ok = await post(body);
    expect(ok.status).toBe(200);
    expect((await ok.json()).status).toBe("stored");
    const row = await prisma.matchParticipant.findFirstOrThrow({ where: { championId: 1 } });
    expect(row.itemsJson).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 999999]);
    expect(row.augmentsJson).toEqual([1, 2, 3, 4, 5, 6, 7, 888888]);

    for (const field of ["puuid", "win"] as const) {
      const bad = payload();
      delete (bad.participants[2] as Partial<(typeof bad.participants)[number]>)[field];
      expect((await post(bad)).status).toBe(400);
    }
  });

  it("R2.5 stores the raw payload, the uploader's end-of-game stats and the teammate heal/shield columns", async () => {
    const body = payload({ extraTopLevel: "kept" });
    expect((await ingest(body)).status).toBe("stored");

    const match = await prisma.match.findUniqueOrThrow({ where: { matchId: `LCU_${body.gameId}` } });
    expect(match.rawPayload).toMatchObject({ extraTopLevel: "kept", gameId: body.gameId, endOfGameStats: body.endOfGameStats });
    expect(match.gameEndedAt?.getTime()).toBe(body.gameCreation + body.gameDuration * 1000);

    const uploaderRow = await prisma.matchParticipant.findFirstOrThrow({ where: { matchId: match.id, championId: 1 } });
    expect(uploaderRow.endOfGameStats).toEqual(body.endOfGameStats);
    expect(uploaderRow.totalHealOnTeammates).toBe(4321);
    expect(uploaderRow.totalDamageShieldedOnTeammates).toBe(1234);
    expect(await prisma.matchParticipant.count({ where: { matchId: match.id } })).toBe(10);
  });

  it("R2.6 rejects uploads from non-Entrants without creating players", async () => {
    expect((await ingest(payload({ uploaderPuuid: "puuid-stranger-00000000" }))).status).toBe("not_entrant");

    await prisma.player.updateMany({ where: { puuid: UPLOADER }, data: { removedAt: new Date() } });
    expect((await ingest(payload())).status).toBe("not_entrant");

    await prisma.player.create({ data: { puuid: "puuid-unregistered-0000", riotIdName: "U", riotIdTag: "EUW" } });
    expect((await ingest(payload({ uploaderPuuid: "puuid-unregistered-0000" }))).status).toBe("not_entrant");

    expect(await prisma.match.count()).toBe(0);
    expect(await prisma.player.count()).toBe(2);
  });

  it("R2.7 concurrent uploads of one game: one stored, one duplicate, no 500", async () => {
    const body = payload();
    const responses = await Promise.all([post(body), post(body)]);
    expect(responses.map((r) => r.status)).toEqual([200, 200]);
    const statuses = (await Promise.all(responses.map((r) => r.json()))).map((j) => j.status).sort();
    expect(statuses).toEqual(["duplicate", "stored"]);
    expect(await prisma.match.count()).toBe(1);
  });

  it("R2.7 a lost unique-constraint race (P2002) answers duplicate", async () => {
    const body = payload();
    expect((await ingest(body)).status).toBe("stored");
    // Simulate both uploads passing the pre-check. Not restored: restoring a spy on a Prisma model breaks the model.
    vi.spyOn(prisma.match, "findUnique").mockResolvedValueOnce(null);
    const res = await post(body);
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe("duplicate");
    expect(await prisma.match.count()).toBe(1);
  });

  it("R2.8 a failing participant write leaves no match row and answers 500", async () => {
    const body = payload();
    body.participants[9] = { ...body.participants[9], championId: 3_000_000_000 }; // overflows the INT column
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await post(body);
    quiet.mockRestore();
    expect(res.status).toBe(500);
    expect(await prisma.match.count()).toBe(0);
    expect(await prisma.matchParticipant.count()).toBe(0);
  });

  it("R2.9 ingest makes no outbound HTTP calls and the rank lookups are gone", async () => {
    fetchSpy.mockClear();
    expect((await ingest(payload())).status).toBe("stored");
    expect(fetchSpy).not.toHaveBeenCalled();

    const source = readFileSync(path.join(root, "lib/ingest/mayhem.ts"), "utf8");
    for (const gone of ["resolveRank", "fetchOpggHistoricalRank", "riotClient", "lobbyAvgMmr", "team100AvgMmr", "getChampionMap"]) {
      expect(source).not.toContain(gone);
    }
  });

  it("R2.10 ingest writes no LP or placement; placement and promo code is gone", async () => {
    const veteran = await prisma.player.create({
      data: { puuid: "puuid-other-1-0000000000", riotIdName: "Other1", riotIdTag: "EUW", rawMmr: 1700, currentLp: 55, mayhemGames: 9 }
    });
    expect((await ingest(payload())).status).toBe("stored");

    const after = await prisma.player.findUniqueOrThrow({ where: { id: veteran.id } });
    expect([after.rawMmr, after.currentLp, after.isPlaced, after.mayhemGames]).toEqual([1700, 55, false, 9]);
    expect(await prisma.matchParticipant.count({ where: { OR: [{ lpDelta: { not: 0 } }, { isPlacement: true }] } })).toBe(0);
    expect(await prisma.leaderboardBlacklist.count()).toBe(0);

    expect(existsSync(path.join(root, "lib/mmr/calculate-profile.ts"))).toBe(false);
    expect(existsSync(path.join(root, "lib/mmr/promos.ts"))).toBe(false);
    expect(readFileSync(path.join(root, "prisma/schema.prisma"), "utf8")).not.toMatch(/promo/i);
  });

  it("R2.11 counts-for-Entrant excludes games that ended before registration", async () => {
    const entrant = await prisma.player.findFirstOrThrow({ where: { puuid: UPLOADER } });
    const t = entrant.registeredAt!.getTime();
    const before = payload({ gameCreation: t - 1200_000 - 1000 }); // ends 1 s before T
    const after = payload({ gameCreation: t - 1200_000 + 1000 }); // ends 1 s after T
    expect((await ingest(before)).status).toBe("stored");
    expect((await ingest(after)).status).toBe("stored");

    const counted = await prisma.matchParticipant.findMany({ where: countsForEntrant(entrant), include: { match: true } });
    expect(counted.map((p) => p.match.matchId)).toEqual([`LCU_${after.gameId}`]);

    const removed = await prisma.player.update({ where: { id: entrant.id }, data: { removedAt: new Date() } });
    expect(await prisma.matchParticipant.count({ where: countsForEntrant(removed) })).toBe(0);
  });
});
