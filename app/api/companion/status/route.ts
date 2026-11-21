import { NextResponse } from "next/server";
import { getEventSettings } from "@/lib/companion";

export const dynamic = "force-dynamic";

// Global and unauthenticated.
export async function GET() {
  return NextResponse.json(await getEventSettings());
}
