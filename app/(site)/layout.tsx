import type { ReactNode } from "react";
import { Marcellus, Spectral } from "next/font/google";
import { Backdrop } from "./Backdrop";
import { Splash } from "./Splash";
import { siteStyles } from "./ui";

const display = Marcellus({ subsets: ["latin"], weight: "400", variable: "--b-display" });
const body = Spectral({ subsets: ["latin"], weight: ["400", "600"], style: ["normal", "italic"], variable: "--b-body" });

// Shared by every public page, so the splash plays once per full load and not on client navigation.
export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className={`${display.variable} ${body.variable} relative min-h-screen bg-[#010A13] text-[17px] lining-nums text-[#A09B8C] [font-family:var(--b-body)]`}
      style={{ backgroundImage: "radial-gradient(ellipse 80% 480px at 30% 0, #0A1E36, transparent)" }}
    >
      <style>{siteStyles}</style>
      <Splash />
      <Backdrop />
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">{children}</div>
    </div>
  );
}
