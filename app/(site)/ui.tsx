// The site's look, ported from prototype/visual-direction (fd0046b, app/prototype/home/VariantB.tsx): the "Augment Offer" style.
import type { ReactNode } from "react";

// Hextech night #010A13 (page), panel #0A1428, line #463714, gold #C8AA6E, parchment #F0E6D2 (text), stone #A09B8C (quiet text), magic #0AC8B9 (the one action).
// Tiers as augment rarities: silver #B4C2CC, gold #E7B94C, prismatic (mint to violet to pink).
export const D = "[font-family:var(--b-display)]";
export const caps = `${D} uppercase tracking-[0.12em]`;
export const N = "font-semibold tabular-nums"; // figures stay in Spectral: Marcellus zeros read as the letter O
export const focus = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-[#F0E6D2]";
export const goldEdge = "linear-gradient(180deg,#F6D879,#8A6418)";
export const quiet = "linear-gradient(180deg,#785A28,#463714)";
export const winEdge = "linear-gradient(180deg,#7FF0E0,#0A8A80)";
const cut = "polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px)";
// Hover: the card lifts and tilts toward a corner while light travels across its rim and face.
// Lift, tilt and light share one duration and curve, so the light moves with the tilt both ways.
const rimLight = "linear-gradient(110deg,transparent 40%,rgba(255,255,255,.3) 50%,transparent 60%)";
const rimLightSoft = "linear-gradient(110deg,transparent 40%,rgba(255,255,255,.12) 50%,transparent 60%)";
const faceLight = "linear-gradient(110deg,transparent 30%,rgba(255,255,255,.025) 50%,transparent 70%)";
export const tilt = "group motion-safe:transition-transform motion-safe:duration-1000 motion-safe:ease-[cubic-bezier(.2,.7,.2,1)] motion-safe:hover:[transform:perspective(900px)_translateY(-2px)_rotateX(3deg)_rotateY(-3deg)]";

export const siteStyles = `.sweep{background-position:97% 0}
.group:hover .sweep{background-position:3% 0}
@media (prefers-reduced-motion:no-preference){.sweep{transition:background-position 1000ms cubic-bezier(.2,.7,.2,1)}}
@keyframes enter{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.enter{animation:enter 480ms cubic-bezier(.2,.7,.2,1) both}
.flow-prism{display:inline-block;color:transparent;-webkit-background-clip:text;background-clip:text;background-image:linear-gradient(90deg,#7FF0E0,#B59CFF,#FF9CD6,#B59CFF,#7FF0E0);background-size:200% 100%;filter:drop-shadow(0 0 3px rgba(181,156,255,.35));animation:flow 6s linear infinite}
@keyframes flow{to{background-position:200% 0}}
.sp-flash,.sp-final{opacity:0}
.go.splash{animation:splash-out .25s ease 1.1s forwards}
@keyframes splash-out{to{opacity:0;visibility:hidden}}
.go .sp-move{animation:sp-move .5s cubic-bezier(.45,0,.25,1) both}
@keyframes sp-move{from{transform:translateX(-70px)}to{transform:translateX(70px)}}
.go .sp-shine{animation:sp-shine .5s linear both}
@keyframes sp-shine{0%,80%{opacity:1}100%{opacity:0}}
.go .sp-flash{animation:sp-flash 1s ease both}
@keyframes sp-flash{0%,50%{opacity:0}62%,70%{opacity:1}95%,100%{opacity:0}}
.go .sp-final{animation:sp-final 1s ease both}
@keyframes sp-final{0%,70%{opacity:0}95%,100%{opacity:1}}
.go .sp-mark{animation:sp-glow 1s ease both}
@keyframes sp-glow{0%,50%{filter:none}65%{filter:drop-shadow(0 0 16px rgba(181,156,255,.75))}100%{filter:drop-shadow(0 0 4px rgba(181,156,255,.2))}}
@media (prefers-reduced-motion:reduce){.splash{display:none}.enter,.flow-prism{animation:none}}`;

// A chamfered panel with a 1px gradient edge (a border can't follow a clip-path).
// rim: on hover of the parent .group, light travels across the edge (behind the panel) and faintly across the face (above it).
export function Frame({ edge, rim = false, soft = false, className = "", children }: { edge: string; rim?: boolean; soft?: boolean; className?: string; children: ReactNode }) {
  const light = (image: string) => <span aria-hidden="true" className="sweep pointer-events-none absolute inset-0" style={{ backgroundImage: image, backgroundSize: "250% 100%" }} />;
  return (
    <div style={{ clipPath: cut, background: edge, padding: 1 }} className="relative h-full">
      {rim && light(soft ? rimLightSoft : rimLight)}
      <div style={{ clipPath: cut }} className={`relative h-full bg-[linear-gradient(180deg,#0E1B30,#050C16)] ${className}`}>{children}</div>
      {rim && !soft && light(faceLight)}
    </div>
  );
}

export const H2 = ({ children }: { children: ReactNode }) => (
  <h2 className={`${caps} flex items-center gap-3 text-lg text-[#F0E6D2]`}>
    {children}
    <span aria-hidden="true" className="h-px flex-1 bg-gradient-to-r from-[#C8AA6E]/70 to-transparent" />
  </h2>
);

// The chosen logo: gold chamfered crest, prismatic V.
export function LogoMark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id="logo-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#F6D879" /><stop offset="1" stopColor="#8A6418" /></linearGradient>
        <linearGradient id="logo-p" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#7FF0E0" /><stop offset=".5" stopColor="#B59CFF" /><stop offset="1" stopColor="#FF9CD6" /></linearGradient>
      </defs>
      <path d="M14 2H62V50L50 62H2V14Z" fill="#0A1428" stroke="url(#logo-g)" strokeWidth="2.5" />
      <path d="M15 18H25L32 40L39 18H49L36 50H28Z" fill="url(#logo-p)" />
    </svg>
  );
}

const steps = [
  { title: "Download the Companion", body: "Windows only. One exe, installs itself." },
  { title: "Open League and log in", body: "The Companion needs to see your client once." },
  { title: "You're an Entrant", body: "Your name appears on the Entrant list. That's it." }
];

export const Steps = () => (
  <ol className="mt-2">
    {steps.map((s, k) => (
      <li key={s.title} className="flex items-center gap-5 border-b border-[#463714]/70 py-4">
        <span aria-hidden="true" className="flex h-9 w-9 shrink-0 rotate-45 items-center justify-center border border-[#C8AA6E]">
          <span className={`${D} -rotate-45 text-lg text-[#C8AA6E]`}>{k + 1}</span>
        </span>
        <span className="leading-snug">
          <span className={`${D} block text-xl text-[#F0E6D2]`}>{s.title}</span>
          {s.body}
        </span>
      </li>
    ))}
  </ol>
);

export const downloadButton = `${caps} mt-6 inline-block border border-[#0AC8B9] bg-[#0A323C] px-8 py-4 text-[#CDFAFA] hover:bg-[#0D4855] hover:shadow-[0_0_24px_rgba(10,200,185,0.35)] ${focus}`;

// One plain line while the admin has the maintenance pause on.
export function MaintenanceNotice({ on }: { on: boolean }) {
  if (!on) return null;
  return (
    <p role="status" className="relative border-b border-[#463714] bg-[#0A1428] px-4 py-2 text-center text-sm text-[#F0E6D2]">
      Maintenance pause: game uploads are on hold for now.
    </p>
  );
}
