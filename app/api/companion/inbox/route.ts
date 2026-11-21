import { NextResponse } from "next/server";
import { isCompanionAuthorized, recordCompanionVersion, type InboxItem } from "@/lib/companion";

export async function GET(request: Request) {
  if (!isCompanionAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const puuid = params.get("puuid");
  const since = params.get("since");
  const briefing = params.get("briefing");
  if (!puuid || (since && Number.isNaN(Date.parse(since))) || (briefing && briefing !== "0" && briefing !== "1")) {
    return NextResponse.json({ error: "Invalid inbox query" }, { status: 400 });
  }
  await recordCompanionVersion(puuid, request);

  // Empty during the Countdown; the Event spec fills items from since/briefing.
  const items: InboxItem[] = [];
  return NextResponse.json({ items, now: new Date().toISOString() });
}
