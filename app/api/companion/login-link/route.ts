import { NextResponse } from "next/server";
import { z } from "zod";
import { isCompanionAuthorized, issueLoginToken, recordCompanionVersion, safeRedirect } from "@/lib/companion";
import { findPlayerByPuuid, isEntrant } from "@/lib/entrants";

const loginLinkSchema = z.object({ puuid: z.string().min(1), redirect: z.string().optional() });

export async function POST(request: Request) {
  if (!isCompanionAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = loginLinkSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Invalid login-link payload", issues: body.error.issues }, { status: 400 });

  const player = await findPlayerByPuuid(body.data.puuid);
  if (!player || !isEntrant(player)) return NextResponse.json({ error: "Not an Entrant" }, { status: 404 });
  await recordCompanionVersion(body.data.puuid, request);

  const token = await issueLoginToken(player.id, safeRedirect(body.data.redirect));
  const url = new URL("/api/companion/login", request.url);
  url.searchParams.set("token", token);
  return NextResponse.json({ url: url.toString() });
}
