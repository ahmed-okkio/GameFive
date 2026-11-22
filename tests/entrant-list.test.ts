import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Real local Postgres only (e.g. `npx prisma dev`), never production: set TEST_DATABASE_URL to a localhost URL.
const testDbUrl = process.env.TEST_DATABASE_URL ?? "";
const isLocalDb = /@(localhost|127\.0\.0\.1)[:/]/.test(testDbUrl);
process.env.DATABASE_URL = isLocalDb ? testDbUrl : "postgresql://invalid:invalid@127.0.0.1:1/none";

const { prisma } = await import("@/lib/prisma");
const { listEntrants } = await import("@/lib/entrants");

const tag = "M5TEST";

describe.skipIf(!isLocalDb)("M5 Entrant list (local Postgres)", () => {
  const clean = () => prisma.player.deleteMany({ where: { riotIdTag: tag } });
  beforeAll(clean);
  afterAll(async () => {
    await clean();
    await prisma.$disconnect();
  });

  it("R5.3/R5.9 lists current Entrants newest first; removed and never-registered players are absent", async () => {
    const at = (d: string) => new Date(`2026-12-0${d}T12:00:00Z`);
    await prisma.player.createMany({
      data: [
        { riotIdName: "Older", riotIdTag: tag, registeredAt: at("2") },
        { riotIdName: "Newer", riotIdTag: tag, registeredAt: at("4") },
        { riotIdName: "Removed", riotIdTag: tag, registeredAt: at("3"), removedAt: at("5") },
        { riotIdName: "History only", riotIdTag: tag, mayhemGames: 40 }
      ]
    });
    const mine = (await listEntrants()).filter((e) => e.riotIdTag === tag).map((e) => e.riotIdName);
    expect(mine).toEqual(["Newer", "Older"]);
  });

});
