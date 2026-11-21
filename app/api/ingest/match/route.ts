import { NextResponse } from "next/server";
import { appConfig } from "@/lib/config";
import { companionMatchPayloadSchema, ingestCompanionMayhemMatch } from "@/lib/ingest/mayhem";

function bearerToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const [scheme, token] = authorization.split(" ");

  return scheme?.toLowerCase() === "bearer" ? token : null;
}

export async function POST(request: Request) {
  if (bearerToken(request) !== appConfig.companionIngestToken) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
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
    return NextResponse.json(await ingestCompanionMayhemMatch(payload.data));
  } catch (error) {
    // Nothing was saved (single transaction); the Companion's offline queue retries on 5xx.
    console.error("[Ingest] Failed to store match", error);
    return NextResponse.json({ error: "Failed to store match" }, { status: 500 });
  }
}
