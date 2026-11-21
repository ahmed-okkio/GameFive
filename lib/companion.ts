import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { appConfig } from "@/lib/config";
import { isEntrant } from "@/lib/entrants";
import { prisma } from "@/lib/prisma";

export const PLAYER_SESSION_COOKIE = "gamefive_player_session";
export const LOGIN_TOKEN_TTL_MS = 5 * 60 * 1000;
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

// Inbox item shape; the Event spec fills the inbox.
export type InboxItem = { id: string; title: string; body: string; url: string };

const sha256 = (value: string) => createHash("sha256").update(value).digest();
const hashToken = (token: string) => sha256(token).toString("hex");

// Shared COMPANION_INGEST_TOKEN check for every Companion endpoint, in constant time.
export function isCompanionAuthorized(request: Request) {
  const [scheme, token] = (request.headers.get("authorization") ?? "").split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token || !appConfig.companionIngestToken) return false;
  return timingSafeEqual(sha256(token), sha256(appConfig.companionIngestToken));
}

// Stores the X-Companion-Version header (or an explicit version) as the player's latest version.
export async function recordCompanionVersion(puuid: string, request: Request, version?: string | null) {
  const latest = version || request.headers.get("x-companion-version");
  if (latest) await prisma.player.updateMany({ where: { puuid }, data: { companionVersion: latest } });
}

// Only same-site relative paths; anything else falls back to home.
export function safeRedirect(redirect: unknown) {
  if (typeof redirect !== "string" || !redirect.startsWith("/") || redirect.startsWith("//") || redirect.includes("\\")) return "/";
  const url = new URL(redirect, "http://site.invalid");
  return url.origin === "http://site.invalid" ? url.pathname + url.search + url.hash : "/";
}

export async function issueLoginToken(playerId: string, redirect: string) {
  const token = randomBytes(32).toString("base64url");
  const now = Date.now();
  await prisma.playerToken.deleteMany({ where: { expiresAt: { lt: new Date(now) } } });
  await prisma.playerToken.create({
    data: { tokenHash: hashToken(token), kind: "login", playerId, redirect, expiresAt: new Date(now + LOGIN_TOKEN_TTL_MS) }
  });
  return token;
}

// Single use: the login row is deleted on first open; a session row with a fresh token replaces it.
export async function consumeLoginToken(token: string) {
  const row = await prisma.playerToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!row || row.kind !== "login") return null;
  const { count } = await prisma.playerToken.deleteMany({ where: { id: row.id, expiresAt: { gt: new Date() } } });
  if (count !== 1) return null;

  const sessionToken = randomBytes(32).toString("base64url");
  await prisma.playerToken.create({
    data: { tokenHash: hashToken(sessionToken), kind: "session", playerId: row.playerId, expiresAt: new Date(Date.now() + SESSION_TTL_MS) }
  });
  return { sessionToken, redirect: row.redirect ?? "/" };
}

export async function entrantFromSessionToken(token: string | undefined) {
  if (!token) return null;
  const row = await prisma.playerToken.findUnique({ where: { tokenHash: hashToken(token) }, include: { player: true } });
  if (!row || row.kind !== "session" || row.expiresAt <= new Date()) return null;
  return isEntrant(row.player) ? row.player : null;
}

// The logged-in Entrant for the current request, or null. Separate from the admin next-auth session.
export async function getPlayerSession() {
  return entrantFromSessionToken((await cookies()).get(PLAYER_SESSION_COOKIE)?.value);
}

export async function getEventSettings() {
  const row = await prisma.eventSettings.findUnique({ where: { id: 1 } });
  return { retire: row?.retire ?? false, ceremonyUrl: row?.ceremonyUrl ?? null, minVersion: row?.minVersion ?? null };
}

// Admin setter (UI in M6; the Event spec flips it at Lockdown).
export async function setEventSettings(data: { retire?: boolean; ceremonyUrl?: string | null; minVersion?: string | null }) {
  return prisma.eventSettings.upsert({ where: { id: 1 }, create: { id: 1, ...data }, update: data });
}
