import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin } from "@/lib/auth";
import { setEventSettings } from "@/lib/companion";

const settingsSchema = z
  .object({
    retire: z.boolean().optional(),
    // The Companion shell-opens this on every player's PC at retirement: absolute http(s) only.
    ceremonyUrl: z.url({ protocol: /^https?$/ }).nullable().optional(),
    minVersion: z.string().min(1).nullable().optional(),
    maintenance: z.boolean().optional()
  })
  .strict();

export async function PATCH(request: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = settingsSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Invalid settings", issues: body.error.issues }, { status: 400 });

  const { retire, ceremonyUrl, minVersion, maintenance } = await setEventSettings(body.data);
  return NextResponse.json({ retire, ceremonyUrl, minVersion, maintenance });
}
