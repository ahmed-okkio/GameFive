import { NextResponse } from "next/server";
import { getEventSettings, isCompanionAuthorized, recordCompanionVersion } from "@/lib/companion";
import { companionMatchPayloadSchema, ingestCompanionMayhemMatch } from "@/lib/ingest/mayhem";

export async function POST(request: Request) {
  if (!isCompanionAuthorized(request)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  // Maintenance pause: store nothing; the Companion's offline queue retries on 5xx.
  if ((await getEventSettings()).maintenance) {
    return NextResponse.json({ error: "Maintenance pause" }, { status: 503, headers: { "Retry-After": "300" } });
  }

  const body = await request.json().catch(() => null);
  const payload = companionMatchPayloadSchema.safeParse(body);

  if (!payload.success) {
    return NextResponse.json(
      { error: "Invalid match payload", issues: payload.error.issues },
      { status: 400 }
    );
  }

  try {
    await recordCompanionVersion(payload.data.uploaderPuuid, request);
    return NextResponse.json(await ingestCompanionMayhemMatch(payload.data));
  } catch (error) {
    // Nothing was saved (single transaction); the Companion's offline queue retries on 5xx.
    console.error("[Ingest] Failed to store match", error);
    return NextResponse.json({ error: "Failed to store match" }, { status: 500 });
  }
}
