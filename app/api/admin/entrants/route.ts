import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { entrantWhere } from "@/lib/entrants";
import { prisma } from "@/lib/prisma";

// Removing an Entrant only sets removedAt: the row and their matches stay as history.
export async function DELETE(request: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const { count } = await prisma.player.updateMany({ where: { id, ...entrantWhere }, data: { removedAt: new Date() } });
  if (!count) return NextResponse.json({ error: "Not an Entrant" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
