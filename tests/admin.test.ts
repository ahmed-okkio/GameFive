import bcrypt from "bcryptjs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Real local Postgres only (e.g. `npx prisma dev`), never production: set TEST_DATABASE_URL to a localhost URL.
const testDbUrl = process.env.TEST_DATABASE_URL ?? "";
const isLocalDb = /@(localhost|127\.0\.0\.1)[:/]/.test(testDbUrl);
process.env.DATABASE_URL = isLocalDb ? testDbUrl : "postgresql://invalid:invalid@127.0.0.1:1/none";

// The seam every admin route uses: next-auth's getServerSession (via isAdmin in lib/auth).
const session = vi.hoisted(() => ({ current: null as null | { user: { name: string } } }));
vi.mock("next-auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next-auth")>()),
  getServerSession: vi.fn(async () => session.current)
}));

const { prisma } = await import("@/lib/prisma");
const { registerEntrant, entrantWhere } = await import("@/lib/entrants");
const entrants = await import("@/app/api/admin/entrants/route");
const matches = await import("@/app/api/admin/matches/route");
const settings = await import("@/app/api/admin/settings/route");
const status = await import("@/app/api/companion/status/route");
const ingest = await import("@/app/api/ingest/match/route");
const { MaintenanceNotice } = await import("@/app/(site)/ui");

const ADMIN = { user: { name: "Admin" } };
const req = (path: string, method: string, body?: unknown) =>
  new Request(`http://localhost${path}`, { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });

async function seedMatch(playerId: string) {
  const stat = { team: 100, win: true, championId: 1, kills: 1, deaths: 1, assists: 1, damageToChampions: 1, healingDone: 1, killParticipation: 0.5, damageShare: 0.1, healingShare: 0.1 };
  return prisma.match.create({
    data: {
      matchId: "EUW1_1",
      gameMode: "KIWI",
      gameDate: new Date(),
      gameEndedAt: new Date(),
      durationSeconds: 900,
      queueId: 2400,
      participants: { create: [{ ...stat, playerId }, { ...stat, team: 200, win: false }] }
    }
  });
}

describe.skipIf(!isLocalDb)("M6 admin tools (local Postgres)", () => {
  let playerId = "";

  beforeEach(async () => {
    await prisma.$executeRawUnsafe('TRUNCATE "player_tokens", "event_settings", "match_participants", "matches", "players" CASCADE');
    playerId = (await registerEntrant({ puuid: "puuid-admin-0000000000", riotIdName: "Tray", riotIdTag: "EUW" })).id;
    session.current = ADMIN;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("R6.1 every admin action answers 401 without an admin session and changes nothing", async () => {
    const match = await seedMatch(playerId);
    session.current = null;
    expect((await entrants.DELETE(req(`/api/admin/entrants?id=${playerId}`, "DELETE"))).status).toBe(401);
    expect((await matches.DELETE(req(`/api/admin/matches?id=${match.id}`, "DELETE"))).status).toBe(401);
    expect((await settings.PATCH(req("/api/admin/settings", "PATCH", { retire: true }))).status).toBe(401);
    expect((await settings.PATCH(req("/api/admin/settings", "PATCH", { maintenance: true }))).status).toBe(401);
    expect((await (await status.GET()).json()).maintenance).toBe(false);
    expect(await prisma.player.count({ where: entrantWhere })).toBe(1);
    expect(await prisma.matchParticipant.count()).toBe(2);
    expect((await (await status.GET()).json()).retire).toBe(false);
  });

  it("R6.1 removing an Entrant drops them from entrantWhere but keeps the row and their matches", async () => {
    await seedMatch(playerId);
    expect((await entrants.DELETE(req(`/api/admin/entrants?id=${playerId}`, "DELETE"))).status).toBe(200);
    expect(await prisma.player.count({ where: entrantWhere })).toBe(0);
    expect((await prisma.player.findUnique({ where: { id: playerId } }))?.removedAt).toBeInstanceOf(Date);
    expect(await prisma.matchParticipant.count({ where: { playerId } })).toBe(1);
    // Already removed, unknown and missing ids.
    expect((await entrants.DELETE(req(`/api/admin/entrants?id=${playerId}`, "DELETE"))).status).toBe(404);
    expect((await entrants.DELETE(req("/api/admin/entrants?id=nope", "DELETE"))).status).toBe(404);
    expect((await entrants.DELETE(req("/api/admin/entrants", "DELETE"))).status).toBe(400);
    // Re-registering through the Companion does not undo a removal.
    await registerEntrant({ puuid: "puuid-admin-0000000000", riotIdName: "Tray", riotIdTag: "EUW" });
    expect(await prisma.player.count({ where: entrantWhere })).toBe(0);
  });

  it("R6.1 deleting a match leaves no participants", async () => {
    const match = await seedMatch(playerId);
    expect((await matches.DELETE(req(`/api/admin/matches?id=${match.id}`, "DELETE"))).status).toBe(200);
    expect(await prisma.match.count()).toBe(0);
    expect(await prisma.matchParticipant.count()).toBe(0);
    expect(await prisma.player.count({ where: entrantWhere })).toBe(1);
    expect((await matches.DELETE(req(`/api/admin/matches?id=${match.id}`, "DELETE"))).status).toBe(404);
  });

  it("R6.1 flipping the retirement flag changes the Companion status", async () => {
    let res = await settings.PATCH(req("/api/admin/settings", "PATCH", { retire: true, ceremonyUrl: "https://example.com/ceremony", minVersion: "5.1.0" }));
    expect(res.status).toBe(200);
    expect(await (await status.GET()).json()).toEqual({ retire: true, ceremonyUrl: "https://example.com/ceremony", minVersion: "5.1.0", maintenance: false });

    res = await settings.PATCH(req("/api/admin/settings", "PATCH", { retire: false, ceremonyUrl: null }));
    expect(await res.json()).toEqual({ retire: false, ceremonyUrl: null, minVersion: "5.1.0", maintenance: false });
    expect((await (await status.GET()).json()).retire).toBe(false);

    for (const bad of [{ retire: "yes" }, { maintenance: "on" }, { ceremonyUrl: "not a url" }, { ceremonyUrl: "javascript:alert(1)" }, { ceremonyUrl: "file:///C:/Windows/System32/calc.exe" }, { ceremonyUrl: "/relative" }, { other: 1 }, null]) {
      expect((await settings.PATCH(req("/api/admin/settings", "PATCH", bad))).status).toBe(400);
    }
  });

  it("R6.1 maintenance pause: ingest answers 503 and stores nothing while on, and resumes when off", async () => {
    const upload = (gameId: number) =>
      ingest.POST(
        new Request("http://localhost/api/ingest/match", {
          method: "POST",
          headers: { authorization: "Bearer dev-local-token", "content-type": "application/json" },
          body: JSON.stringify({
            source: "lcu",
            uploaderPuuid: "puuid-admin-0000000000",
            gameId,
            queueId: 2400,
            gameType: "MATCHED_GAME",
            gameMode: "KIWI",
            gameCreation: Date.now() + 60_000,
            gameDuration: 1200,
            participants: Array.from({ length: 10 }, (_, i) => ({
              puuid: i === 0 ? "puuid-admin-0000000000" : `puuid-m6-other-${i}`,
              gameName: `P${i}`,
              tagLine: "EUW",
              participantId: i + 1,
              teamId: i < 5 ? 100 : 200,
              championId: 1 + i,
              win: i < 5,
              kills: i,
              deaths: 1,
              assists: 2,
              totalDamageDealtToChampions: 1000,
              totalHeal: 100
            }))
          })
        })
      );

    expect((await settings.PATCH(req("/api/admin/settings", "PATCH", { maintenance: true }))).status).toBe(200);
    expect((await (await status.GET()).json()).maintenance).toBe(true);
    const paused = await upload(5001);
    expect(paused.status).toBe(503);
    expect(await prisma.match.count()).toBe(0);
    expect(await prisma.matchParticipant.count()).toBe(0);

    // A bad token still gets 401 first, so the pause leaks nothing to strangers.
    const stranger = await ingest.POST(new Request("http://localhost/api/ingest/match", { method: "POST", headers: { authorization: "Bearer nope" }, body: "{}" }));
    expect(stranger.status).toBe(401);

    expect((await settings.PATCH(req("/api/admin/settings", "PATCH", { maintenance: false }))).status).toBe(200);
    const resumed = await upload(5001);
    expect(resumed.status).toBe(200);
    expect(await prisma.match.count()).toBe(1);
  });
});

describe("M6 maintenance notice", () => {
  it("renders one line only while the pause is on", () => {
    expect(renderToStaticMarkup(createElement(MaintenanceNotice, { on: true }))).toContain("Maintenance pause");
    expect(renderToStaticMarkup(createElement(MaintenanceNotice, { on: false }))).toBe("");
  });
});

describe("M6 security hardening", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  const bearer = (token: string) => new Request("http://localhost/api/companion/status", { headers: { authorization: `Bearer ${token}` } });

  it("Companion token fails closed in production when COMPANION_INGEST_TOKEN is unset", async () => {
    vi.stubEnv("COMPANION_INGEST_TOKEN", undefined);
    vi.stubEnv("NODE_ENV", "production");
    vi.resetModules();
    const { appConfig } = await import("@/lib/config");
    const { isCompanionAuthorized } = await import("@/lib/companion");
    expect(appConfig.companionIngestToken).toBe("");
    expect(isCompanionAuthorized(bearer("dev-local-token"))).toBe(false);
    expect(isCompanionAuthorized(bearer(""))).toBe(false);
  });

  it("Companion token keeps the dev fallback outside production, and uses the configured token when set", async () => {
    vi.stubEnv("COMPANION_INGEST_TOKEN", undefined);
    vi.stubEnv("NODE_ENV", "development");
    vi.resetModules();
    expect((await import("@/lib/companion")).isCompanionAuthorized(bearer("dev-local-token"))).toBe(true);

    vi.stubEnv("COMPANION_INGEST_TOKEN", "real-secret");
    vi.stubEnv("NODE_ENV", "production");
    vi.resetModules();
    const { isCompanionAuthorized } = await import("@/lib/companion");
    expect(isCompanionAuthorized(bearer("real-secret"))).toBe(true);
    expect(isCompanionAuthorized(bearer("dev-local-token"))).toBe(false);
  });

  async function check(stored: string | undefined, username: string, password: string) {
    vi.stubEnv("ADMIN_USERNAME", "boss");
    vi.stubEnv("ADMIN_PASSWORD_HASH", stored);
    vi.resetModules();
    return (await import("@/lib/auth")).checkAdminCredentials(username, password);
  }

  it("admin login accepts a plaintext ADMIN_PASSWORD_HASH only with the right username and password", async () => {
    expect(await check("hunter22", "boss", "hunter22")).toBe(true);
    expect(await check("hunter22", "admin", "hunter22")).toBe(false);
    expect(await check("hunter22", "boss", "hunter2")).toBe(false);
    expect(await check("hunter22", "boss", "")).toBe(false);
    expect(await check(undefined, "boss", "")).toBe(false);
    expect(await check("", "boss", "")).toBe(false);
  });

  it("admin login verifies a bcrypt ADMIN_PASSWORD_HASH with bcrypt", async () => {
    const hash = bcrypt.hashSync("hunter22", 4);
    expect(await check(hash, "boss", "hunter22")).toBe(true);
    expect(await check(hash, "boss", hash)).toBe(false);
    expect(await check(hash, "boss", "wrong")).toBe(false);
  });
});
