import { NextResponse } from "next/server";
import { z } from "zod";
import { isCompanionAuthorized } from "@/lib/companion";
import { registerEntrant } from "@/lib/entrants";

const registerSchema = z.object({
  puuid: z.string().min(1),
  gameName: z.string().min(1),
  tagLine: z.string().min(1),
  version: z.string().min(1).optional()
});

export async function POST(request: Request) {
  if (!isCompanionAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = registerSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Invalid register payload", issues: body.error.issues }, { status: 400 });

  const { puuid, gameName, tagLine, version } = body.data;
  const entrant = await registerEntrant({
    puuid,
    riotIdName: gameName,
    riotIdTag: tagLine,
    companionVersion: version ?? request.headers.get("x-companion-version")
  });
  return NextResponse.json({ ok: true, registeredAt: entrant.registeredAt });
}
