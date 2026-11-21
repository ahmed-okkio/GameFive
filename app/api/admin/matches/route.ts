import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// One DELETE statement: match_participants go with it via ON DELETE CASCADE, atomically.
export async function DELETE(request: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const { count } = await prisma.match.deleteMany({ where: { id } });
  if (!count) return NextResponse.json({ error: "Match not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
