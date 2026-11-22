import { AdminLogin, AdminPanel } from "@/components/AdminPanel";
import { isAdmin } from "@/lib/auth";
import { getEventSettings } from "@/lib/companion";
import { entrantWhere } from "@/lib/entrants";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!(await isAdmin())) {
    return (
      <section className="mx-auto max-w-4xl px-4 py-8">
        <AdminLogin />
      </section>
    );
  }

  const [entrants, matches, settings] = await Promise.all([
    prisma.player.findMany({ where: entrantWhere, orderBy: { registeredAt: "desc" }, select: { id: true, riotIdName: true, riotIdTag: true } }),
    // shortcut: latest 100 matches only; add paging or search if the admin needs older ones.
    prisma.match.findMany({
      orderBy: { gameDate: "desc" },
      take: 100,
      select: { id: true, matchId: true, gameDate: true, participants: { select: { playerRiotIdName: true, playerRiotIdTag: true } } }
    }),
    getEventSettings()
  ]);

  return (
    <section className="mx-auto max-w-4xl px-4 py-8">
      <AdminPanel
        entrants={entrants}
        matches={matches.map((m) => ({
          id: m.id,
          matchId: m.matchId,
          gameDate: m.gameDate.toISOString(),
          players: m.participants.map((p) => `${p.playerRiotIdName ?? "?"}#${p.playerRiotIdTag ?? "?"}`)
        }))}
        settings={settings}
      />
    </section>
  );
}
