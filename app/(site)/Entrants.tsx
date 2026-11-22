import { FadeIfOverflow } from "./FadeIfOverflow";
import { ScrollToMe } from "./ScrollToMe";
import { appConfig } from "@/lib/config";
import { D, H2, N, Steps, downloadButton } from "./ui";

type Entrant = { id: string; riotIdName: string; riotIdTag: string };

// Shown only to the logged-in Entrant, in the prototype's Entrant status style.
export const EnteredLine = ({ me }: { me: string | null }) =>
  me && (
    <p className="enter mx-auto mt-8 flex w-fit items-center gap-3 border border-[#0AC8B9]/40 px-5 py-4 text-left text-[#F0E6D2]">
      <span aria-hidden="true" className="h-2 w-2 shrink-0 rotate-45 bg-[#0AC8B9] shadow-[0_0_8px_#0AC8B9]" />
      You&apos;re entered to play in GameFive: One Last Chance.
    </p>
  );

// The sign-up steps and download; "You're not in yet" only for visitors who aren't a logged-in Entrant.
export const SignUp = ({ me }: { me: string | null }) => (
  <section>
    {!me && <H2>You&apos;re not in yet</H2>}
    <Steps />
    <a href={appConfig.companionDownloadUrl} className={downloadButton}>Download the Companion</a>
    <p className="mt-3">Reinstalling it is the sign-up. Windows only.</p>
  </section>
);

// The Entrant list, newest first; the logged-in Entrant's own row (by player id) gets the boards' gold "You" treatment and is scrolled into view.
export const EntrantList = ({ names, me }: { names: Entrant[]; me: string | null }) => (
  <div className="flex flex-col lg:absolute lg:inset-0">
    <H2>Entrants</H2>
    <p className="mt-4 flex items-baseline gap-2">
      <span className={`${N} text-4xl text-[#F0E6D2]`}>{names.length}</span>
      <span>signed up so far</span>
    </p>
    <ol className="relative mt-4 max-h-[22rem] min-h-0 flex-1 overflow-y-auto px-2 data-[overflow]:[mask-image:linear-gradient(180deg,#000_85%,transparent)] [scrollbar-color:#785A28_transparent] [scrollbar-width:thin] lg:max-h-none">
      {names.map((e, k) => {
        const mine = e.id === me;
        return (
          <li key={e.id} className={`enter group relative flex items-center gap-4 py-3 ${mine ? "bg-gradient-to-r from-[#C8AA6E]/25 to-transparent pl-2 shadow-[inset_2px_0_0_#C8AA6E]" : ""}`} style={{ animationDelay: `${200 + k * 50}ms` }}>
            <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-[#C8AA6E]/50 to-transparent" />
            <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rotate-45 border border-[#C8AA6E] transition-colors duration-300 group-hover:bg-[#C8AA6E]" />
            <span className={`${D} min-w-0 truncate text-xl text-[#F0E6D2] transition-transform duration-300 group-hover:translate-x-1`}>{e.riotIdName}<span className="text-[0.65em] text-[#A09B8C]"> #{e.riotIdTag}</span></span>
            {mine && <span className="ml-auto shrink-0 text-sm text-[#C8AA6E]">You<ScrollToMe /></span>}
          </li>
        );
      })}
    </ol>
    <FadeIfOverflow />
  </div>
);
