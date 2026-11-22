import { appConfig } from "@/lib/config";
import { EVENT_START } from "@/lib/countdown";
import { listEntrants } from "@/lib/entrants";
import { Clock } from "./Clock";
import { D, H2, N, Steps, downloadButton } from "./ui";

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

  const names = await listEntrants();
  return (
    <main className="pb-6">
      <section className="pt-10 text-center">
        <CountdownTitle />
        <Clock now={now} />
        {/* What GameFive is, as the clock's caption: the name is the pitch. */}
        <p className={`${D} mt-6 text-xl text-[#F0E6D2]`}>Seven days. Every game is Game 5.</p>
        <p className="mt-1">Fri Dec 25 to Thu Dec 31, GMT</p>
      </section>

      <div className="mt-10 grid gap-x-14 gap-y-12 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <section>
          <H2>You&apos;re not in yet</H2>
          <Steps />
          <a href={appConfig.companionDownloadUrl} className={downloadButton}>Download the Companion</a>
          <p className="mt-3">Reinstalling it is the sign-up. Windows only.</p>
        </section>
        {/* On wide screens the list fills the sign-up column's height and scrolls inside it, so the page itself doesn't grow with sign-ups. */}
        <section className="lg:relative">
          <div className="flex flex-col lg:absolute lg:inset-0">
            <H2>Entrants</H2>
            <p className="mt-4 flex items-baseline gap-2">
              <span className={`${N} text-4xl text-[#F0E6D2]`}>{names.length}</span>
              <span>signed up so far</span>
            </p>
            <ol className="mt-4 max-h-[22rem] min-h-0 flex-1 overflow-y-auto pr-2 [mask-image:linear-gradient(180deg,#000_85%,transparent)] [scrollbar-color:#785A28_transparent] [scrollbar-width:thin] lg:max-h-none">
              {names.map((e, k) => (
                <li key={e.id} className="enter group relative flex items-center gap-4 py-3" style={{ animationDelay: `${200 + k * 50}ms` }}>
                  <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-[#C8AA6E]/50 to-transparent" />
                  <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rotate-45 border border-[#C8AA6E] transition-colors duration-300 group-hover:bg-[#C8AA6E]" />
                  <span className={`${D} min-w-0 truncate text-xl text-[#F0E6D2] transition-transform duration-300 group-hover:translate-x-1`}>{e.riotIdName}<span className="text-[0.65em] text-[#A09B8C]"> #{e.riotIdTag}</span></span>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </div>
    </main>
  );
}
