import type { ReactNode } from "react";
import { Marcellus, Spectral } from "next/font/google";
import { Backdrop } from "./Backdrop";
import { Splash } from "./Splash";
import { Ambience } from "./Ambience";
import { getEventSettings } from "@/lib/companion";
import { MaintenanceNotice, siteStyles } from "./ui";

const display = Marcellus({ subsets: ["latin"], weight: "400", variable: "--b-display" });
const body = Spectral({ subsets: ["latin"], weight: ["400", "600"], style: ["normal", "italic"], variable: "--b-body" });

// Reads the maintenance pause on every request, so no public page is prerendered.
export const dynamic = "force-dynamic";

// Shared by every public page, so the splash plays once per full load and not on client navigation.
export default async function SiteLayout({ children }: { children: ReactNode }) {
  const { maintenance } = await getEventSettings();
  return (
    <div
      className={`${display.variable} ${body.variable} relative min-h-screen bg-[#010A13] text-[17px] lining-nums text-[#A09B8C] [font-family:var(--b-body)]`}
      style={{ backgroundImage: "radial-gradient(ellipse 80% 480px at 30% 0, #0A1E36, transparent)" }}
    >
      <style>{siteStyles}</style>
      <Splash />
      <Backdrop />
      <Ambience />
      <MaintenanceNotice on={maintenance} />
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">{children}</div>
    </div>
  );
}
