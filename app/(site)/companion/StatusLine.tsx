import type { Player } from "@prisma/client";

const QUIET_AFTER = 24 * 3_600_000; // a Companion with no game in a day gets the warning

const ago = (ms: number) => {
  const minutes = Math.max(1, Math.round(ms / 60_000));
  const rtf = new Intl.RelativeTimeFormat("en");
  return minutes < 60 ? rtf.format(-minutes, "minute") : rtf.format(-Math.floor(minutes / 60), "hour");
};

// "Tuesday" within the week, "8 December" beyond it (GMT).
const day = (at: Date, now: Date) =>
  at.toLocaleDateString("en-GB", { timeZone: "UTC", ...(now.getTime() - at.getTime() < 6 * 86_400_000 ? { weekday: "long" } : { day: "numeric", month: "long" }) });

// The logged-in Entrant's Companion status on /companion: connected and when their last game arrived, or the warning once it has gone quiet.
export function StatusLine({ entrant, lastGameAt, now }: { entrant: Pick<Player, "registeredAt"> | null; lastGameAt: Date | null; now: Date }) {
  if (!entrant?.registeredAt) return null;
  const since = lastGameAt ?? entrant.registeredAt; // no game yet: quiet since sign-up
  const stale = now.getTime() - since.getTime() > QUIET_AFTER;
  return (
    <p className={`enter mt-8 flex items-center gap-3 border px-5 py-4 ${stale ? "border-[#E9A06A]/50 text-[#F0E6D2]" : "border-[#0AC8B9]/40 text-[#F0E6D2]"}`}>
      <span aria-hidden="true" className={`h-2 w-2 shrink-0 rotate-45 ${stale ? "bg-[#E9A06A]" : "bg-[#0AC8B9] shadow-[0_0_8px_#0AC8B9]"}`} />
      {stale
        ? `Your Companion hasn't sent a game since ${day(since, now)}. Check it's running in the tray; if it isn't there, download and run it again.`
        : `Your Companion is connected.${lastGameAt ? ` Its last game arrived ${ago(now.getTime() - lastGameAt.getTime())}.` : ""}`}
    </p>
  );
}
