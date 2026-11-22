import type { Metadata } from "next";
import Link from "next/link";
import { getPlayerSession } from "@/lib/companion";
import { appConfig } from "@/lib/config";
import { lastGameEndedAt } from "@/lib/entrants";
import { D, Frame, H2, LogoMark, Steps, caps, downloadButton, focus, quiet, tilt, winEdge } from "../ui";
import { StatusLine } from "./StatusLine";

export const metadata: Metadata = { title: "The Companion | GameFive" };

const states = [
  { on: true, title: "Connected", body: "League is open and the Companion sees it. Mayhem games will upload." },
  { on: false, title: "Disconnected", body: "League is closed or not found yet. Nothing to do; it reconnects on its own." }
];

// What the Companion is, how to install it, and what state yours is in.
export default async function CompanionPage() {
  const entrant = await getPlayerSession();
  const lastGameAt = entrant && (await lastGameEndedAt(entrant.id));
  return (
    <>
      <header className="flex flex-wrap items-baseline gap-x-10 gap-y-3 border-b border-[#463714] pt-4">
        <Link href="/" className={`${caps} flex items-center gap-2.5 self-center pb-4 ${focus}`}>
          <LogoMark size={26} />
          <span><span className="text-[#F0E6D2]">Game</span><span className="text-[#C8AA6E]">Five</span></span>
        </Link>
      </header>
      <main className="pb-32 pt-12">
        <h1 className={`${D} text-[clamp(2.2rem,5vw,3.5rem)] leading-[1.05] text-[#F0E6D2]`}>The Companion</h1>
        <p className="mt-3 max-w-[64ch] text-lg leading-snug">A small Windows tray app. It watches the League client and sends each Mayhem game here when it ends. Installing it is how you enter GameFive: One Last Chance.</p>

        <StatusLine entrant={entrant} lastGameAt={lastGameAt} now={new Date()} />

        <div className="mt-12 grid gap-x-14 gap-y-12 lg:grid-cols-[minmax(0,1fr)_21rem]">
          <section>
            <H2>Get set up</H2>
            <Steps />
            <a href={appConfig.companionDownloadUrl} className={downloadButton}>Download for Windows</a>
            <p className="mt-3">There&rsquo;s no window: look for its icon by the Windows clock. Leave it running while you play.</p>
          </section>
          <section className="space-y-4">
            <H2>What the tray icon means</H2>
            {states.map((s) => (
              <div key={s.title} className={tilt}>
                <Frame edge={s.on ? winEdge : quiet} rim soft className="flex gap-4 p-5">
                  <span aria-hidden="true" className={`mt-2 h-2 w-2 shrink-0 rotate-45 ${s.on ? "bg-[#0AC8B9] shadow-[0_0_8px_#0AC8B9]" : "bg-[#785A28]"}`} />
                  <span className="leading-snug">
                    <span className={`${D} block text-lg text-[#F0E6D2]`}>{s.title}</span>
                    {s.body}
                  </span>
                </Frame>
              </div>
            ))}
            <p className="pt-2 leading-snug">After a game, give it a minute: the result, your LP and any quest progress show up on Today.</p>
          </section>
        </div>
      </main>
    </>
  );
}
