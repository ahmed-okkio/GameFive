import { getPlayerSession } from "@/lib/companion";
import { EVENT_START } from "@/lib/countdown";
import { listEntrants } from "@/lib/entrants";
import { Clock } from "./Clock";
import { EnteredLine, EntrantList, SignUp } from "./Entrants";
import { D } from "./ui";

export const dynamic = "force-dynamic";

const goldRule = (dir: "l" | "r") => (
  <span aria-hidden="true" className={`flex max-w-[4rem] flex-1 items-center ${dir === "r" ? "flex-row-reverse" : ""}`}>
    <span className={`h-px flex-1 ${dir === "r" ? "bg-[linear-gradient(270deg,transparent,#C8AA6E)]" : "bg-[linear-gradient(90deg,transparent,#C8AA6E)]"}`} />
  </span>
);

// The Countdown title: GAMEFIVE between short gold rules, One Last Chance large in flowing prismatic, a thin prismatic streak under it.
const CountdownTitle = () => (
  <h1 className={`${D} text-[#F0E6D2]`}>
    <span className="flex items-center justify-center gap-4">
      {goldRule("l")}
      <span className="text-[clamp(1rem,1.6vw,1.25rem)] tracking-[0.3em]">GAME<span className="text-[#C8AA6E]">FIVE</span><span className="sr-only">:</span></span>
      {goldRule("r")}
    </span>
    <span className="flow-prism mt-2 pb-[0.12em] text-[clamp(2.5rem,7vw,5.25rem)] leading-none">One Last Chance</span>
    <span aria-hidden="true" className="mx-auto mt-3 block h-px max-w-2xl bg-[linear-gradient(90deg,transparent,#7FF0E0,#B59CFF,#FF9CD6,transparent)]" />
  </h1>
);

// The Countdown title is the brand, so the page drops the header bar.
export default async function Home() {
  // eslint-disable-next-line react-hooks/purity -- a server component renders once per request; the clock starts from this time
  const now = Date.now();
  // A plain holding line once Mayhem Week starts, until the Event spec replaces this page.
  if (now >= EVENT_START)
    return (
      <main className="pb-6 pt-10 text-center">
        <CountdownTitle />
        <p className={`${D} mt-6 text-xl text-[#F0E6D2]`}>Mayhem Week has started. The boards are on their way.</p>
      </main>
    );

  const [names, player] = await Promise.all([listEntrants(), getPlayerSession()]);
  const me = player?.id ?? null;
  return (
    <main className="pb-6">
      <section className="pt-10 text-center">
        <CountdownTitle />
        <Clock now={now} />
        {/* What GameFive is, as the clock's caption: the name is the pitch. */}
        <p className={`${D} mt-6 text-xl text-[#F0E6D2]`}>Seven days. Every game is Game 5.</p>
        <p className="mt-1">Fri Dec 25 to Thu Dec 31, GMT</p>
        <EnteredLine me={me} />
      </section>

      <div className="mt-10 grid gap-x-14 gap-y-12 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <SignUp me={me} />
        {/* On wide screens the list fills the sign-up column's height and scrolls inside it, so the page itself doesn't grow with sign-ups; min height = header (6.25rem) + the mobile list cap (22rem), so a short list never scrolls. */}
        <section className="lg:relative lg:min-h-[28.25rem]">
          <EntrantList names={names} me={me} />
        </section>
      </div>
    </main>
  );
}
