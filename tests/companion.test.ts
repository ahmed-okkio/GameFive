import { createHash } from "node:crypto";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Real local Postgres only (e.g. `npx prisma dev`), never production: set TEST_DATABASE_URL to a localhost URL.
const testDbUrl = process.env.TEST_DATABASE_URL ?? "";
const isLocalDb = /@(localhost|127\.0\.0\.1)[:/]/.test(testDbUrl);
process.env.DATABASE_URL = isLocalDb ? testDbUrl : "postgresql://invalid:invalid@127.0.0.1:1/none";
delete process.env.COMPANION_INGEST_TOKEN;

const { prisma } = await import("@/lib/prisma");
const { registerEntrant } = await import("@/lib/entrants");
const companion = await import("@/lib/companion");
const register = await import("@/app/api/companion/register/route");
const loginLink = await import("@/app/api/companion/login-link/route");
const login = await import("@/app/api/companion/login/route");
const inbox = await import("@/app/api/companion/inbox/route");
const status = await import("@/app/api/companion/status/route");
const ingest = await import("@/app/api/ingest/match/route");

const PUUID = "puuid-companion-000000000";
const GOOD = { authorization: "Bearer dev-local-token", "x-companion-version": "5.0.0" };

function req(path: string, init: { method?: string; headers?: Record<string, string>; body?: unknown } = {}) {
  return new Request(`http://localhost${path}`, {
    method: init.method ?? (init.body === undefined ? "GET" : "POST"),
    headers: { "content-type": "application/json", ...(init.headers ?? GOOD) },
    body: init.body === undefined ? undefined : JSON.stringify(init.body)
  });
}

async function linkToken(redirect?: string) {
  const res = await loginLink.POST(req("/api/companion/login-link", { body: { puuid: PUUID, redirect } }));
  expect(res.status).toBe(200);
  const { url } = await res.json();
  return new URL(url);
}

const open = (url: URL) => login.GET(new Request(url));

describe.skipIf(!isLocalDb)("M3 Companion API (local Postgres)", () => {
  beforeEach(async () => {
    await prisma.$executeRawUnsafe('TRUNCATE "player_tokens", "event_settings", "match_participants", "matches", "players" CASCADE');
    await registerEntrant({ puuid: PUUID, riotIdName: "Tray", riotIdTag: "EUW" });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("R3.1 every token endpoint rejects a missing or wrong token with 401", async () => {
    const calls = [
      (h: Record<string, string>) => register.POST(req("/api/companion/register", { headers: h, body: { puuid: PUUID, gameName: "A", tagLine: "B" } })),
      (h: Record<string, string>) => loginLink.POST(req("/api/companion/login-link", { headers: h, body: { puuid: PUUID } })),
      (h: Record<string, string>) => inbox.GET(req(`/api/companion/inbox?puuid=${PUUID}`, { headers: h })),
      (h: Record<string, string>) => ingest.POST(req("/api/ingest/match", { headers: h, body: {} }))
    ];
    for (const call of calls) {
      for (const headers of [{} as Record<string, string>, { authorization: "Bearer wrong-token" }, { authorization: "Bearer dev-local-tokenX" }, { authorization: "dev-local-token" }]) {
        expect((await call(headers)).status).toBe(401);
      }
    }
    expect((await login.GET(new Request("http://localhost/api/companion/login"))).status).toBe(401);
    expect((await login.GET(new Request("http://localhost/api/companion/login?token=nope"))).status).toBe(401);
  });

  it("register creates or refreshes the Entrant, Riot ID and version, idempotently", async () => {
    for (const [name, version] of [["New", "5.0.0"], ["New", "5.0.0"], ["Renamed", "5.0.1"]]) {
      const res = await register.POST(req("/api/companion/register", { body: { puuid: "puuid-reg-00000000", gameName: name, tagLine: "NA1", version } }));
      expect(res.status).toBe(200);
    }
    const rows = await prisma.player.findMany({ where: { puuid: "puuid-reg-00000000" } });
    expect(rows).toHaveLength(1);
    expect([rows[0].riotIdName, rows[0].riotIdTag, rows[0].companionVersion]).toEqual(["Renamed", "NA1", "5.0.1"]);
    expect(rows[0].registeredAt).toBeInstanceOf(Date);
    expect((await register.POST(req("/api/companion/register", { body: { puuid: "x" } }))).status).toBe(400);
  });

  it("R3.2 a login link works once, sets a 30-day session cookie and redirects; stored only hashed", async () => {
    const url = await linkToken("/player/abc?tab=games#top");
    const token = url.searchParams.get("token")!;
    expect(url.pathname).toBe("/api/companion/login");

    const stored = await prisma.playerToken.findMany();
    expect(stored).toHaveLength(1);
    expect(stored[0].tokenHash).toBe(createHash("sha256").update(token).digest("hex"));
    expect(JSON.stringify(stored)).not.toContain(token);

    const res = await open(url);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("http://localhost/player/abc?tab=games#top");
    const cookie = res.headers.get("set-cookie")!;
    expect(cookie).toMatch(new RegExp(`^${companion.PLAYER_SESSION_COOKIE}=`));
    expect(cookie).toMatch(/Max-Age=2592000/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=lax/i);
    expect(cookie).not.toMatch(/next-auth/);

    const sessionToken = cookie.split(";")[0].split("=")[1];
    expect((await companion.entrantFromSessionToken(sessionToken))?.puuid).toBe(PUUID);
    expect(JSON.stringify(await prisma.playerToken.findMany())).not.toContain(sessionToken);

    expect((await open(url)).status).toBe(401);
  });

  it("R3.2 a login link fails after 5 minutes", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-12-01T12:00:00Z"));
    const url = await linkToken();
    vi.setSystemTime(new Date("2026-12-01T12:05:00.001Z"));
    expect((await open(url)).status).toBe(401);

    vi.setSystemTime(new Date("2026-12-01T13:00:00Z"));
    const fresh = await linkToken();
    vi.setSystemTime(new Date("2026-12-01T13:04:59Z"));
    const res = await open(fresh);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("http://localhost/");

    // The session itself lasts 30 days.
    const sessionToken = res.headers.get("set-cookie")!.split(";")[0].split("=")[1];
    vi.setSystemTime(new Date("2026-12-31T13:04:00Z"));
    expect(await companion.entrantFromSessionToken(sessionToken)).not.toBeNull();
    vi.setSystemTime(new Date("2026-12-31T13:05:00Z"));
    expect(await companion.entrantFromSessionToken(sessionToken)).toBeNull();
  });

  it("login-link only redirects to same-site paths and only for Entrants", async () => {
    for (const evil of ["https://evil.example/", "//evil.example/x", "/\\evil.example", "javascript:alert(1)", "evil"]) {
      const res = await open(await linkToken(evil));
      expect(res.headers.get("location")).toBe("http://localhost/");
    }
    const res = await loginLink.POST(req("/api/companion/login-link", { body: { puuid: "puuid-stranger-0000000" } }));
    expect(res.status).toBe(404);
  });

  it("a removed Entrant's session no longer resolves", async () => {
    const res = await open(await linkToken());
    const sessionToken = res.headers.get("set-cookie")!.split(";")[0].split("=")[1];
    await prisma.player.updateMany({ where: { puuid: PUUID }, data: { removedAt: new Date() } });
    expect(await companion.entrantFromSessionToken(sessionToken)).toBeNull();
  });

  it("R3.3 inbox answers {items: [], now} during the Countdown and accepts since and briefing", async () => {
    for (const query of [`puuid=${PUUID}`, `puuid=${PUUID}&since=2026-12-01T10:00:00Z&briefing=1`, `puuid=${PUUID}&since=2026-12-01T10:00:00.000Z&briefing=0`]) {
      const res = await inbox.GET(req(`/api/companion/inbox?${query}`));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.items).toEqual([]);
      expect(new Date(body.now).toISOString()).toBe(body.now);
    }
    for (const bad of ["since=2026-12-01", `puuid=${PUUID}&since=garbage`, `puuid=${PUUID}&briefing=2`]) {
      expect((await inbox.GET(req(`/api/companion/inbox?${bad}`))).status).toBe(400);
    }
    const item: import("@/lib/companion").InboxItem = { id: "1", title: "t", body: "b", url: "/" };
    expect(Object.keys(item)).toEqual(["id", "title", "body", "url"]);
  });

  it("R3.4 status answers without a token and retire follows the admin flag", async () => {
    expect(await (await status.GET()).json()).toEqual({ retire: false, ceremonyUrl: null, minVersion: null, maintenance: false });
    await companion.setEventSettings({ retire: true, ceremonyUrl: "https://gamefive.example/ceremony", minVersion: "5.0.0" });
    expect(await (await status.GET()).json()).toEqual({ retire: true, ceremonyUrl: "https://gamefive.example/ceremony", minVersion: "5.0.0", maintenance: false });
    await companion.setEventSettings({ retire: false });
    expect((await (await status.GET()).json()).retire).toBe(false);
  });

  it("R3.5 each Companion request's X-Companion-Version is stored as the latest version", async () => {
    const version = async () => (await prisma.player.findFirstOrThrow({ where: { puuid: PUUID } })).companionVersion;
    const as = (v: string) => ({ ...GOOD, "x-companion-version": v });

    await register.POST(req("/api/companion/register", { headers: as("5.0.1"), body: { puuid: PUUID, gameName: "Tray", tagLine: "EUW" } }));
    expect(await version()).toBe("5.0.1");
    await loginLink.POST(req("/api/companion/login-link", { headers: as("5.0.2"), body: { puuid: PUUID } }));
    expect(await version()).toBe("5.0.2");
    await inbox.GET(req(`/api/companion/inbox?puuid=${PUUID}`, { headers: as("5.0.3") }));
    expect(await version()).toBe("5.0.3");

    const upload = {
      source: "lcu", uploaderPuuid: PUUID, gameId: 4242, queueId: 3270, gameType: "CUSTOM_GAME", gameMode: "KIWI",
      gameCreation: Date.now(), gameDuration: 1200,
      participants: [{ puuid: PUUID, gameName: "Tray", tagLine: "EUW", participantId: 1, teamId: 100, championId: 1, win: true }]
    };
    expect((await ingest.POST(req("/api/ingest/match", { headers: as("5.0.4"), body: upload }))).status).toBe(200);
    expect(await version()).toBe("5.0.4");
  });
});
