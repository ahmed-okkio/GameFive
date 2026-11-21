import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EVENT_START, timeLeft } from "@/lib/countdown";
import { StatusLine } from "@/app/(site)/companion/StatusLine";

describe("R5.2 countdown clock", () => {
  it("counts down to 2026-12-25T00:00:00Z", () => {
    expect(EVENT_START).toBe(Date.parse("2026-12-25T00:00:00Z"));
    expect(timeLeft(Date.parse("2026-12-09T18:41:53Z"))).toEqual([15, 5, 18, 7]);
    expect(timeLeft(Date.parse("2026-12-24T23:59:59.5Z"))).toEqual([0, 0, 0, 0]);
    expect(timeLeft(Date.parse("2026-12-24T23:59:59Z"))).toEqual([0, 0, 0, 1]);
    expect(timeLeft(Date.parse("2026-12-26T00:00:00Z"))).toEqual([0, 0, 0, 0]);
  });
});

describe("R5.5 Companion status line", () => {
  const now = new Date("2026-12-09T18:42:00Z"); // a Wednesday
  const entrant = { registeredAt: new Date("2026-12-01T10:00:00Z") };
  const render = (lastGameAt: Date | null, who: typeof entrant | null = entrant) =>
    renderToStaticMarkup(createElement(StatusLine, { entrant: who, lastGameAt, now }));

  it("shows when a recent game arrived", () => {
    expect(render(new Date("2026-12-09T18:39:00Z"))).toContain("Your Companion is connected. Its last game arrived 3 minutes ago.");
    expect(render(new Date("2026-12-09T13:00:00Z"))).toContain("Its last game arrived 5 hours ago.");
  });

  it("warns once the Companion has gone quiet", () => {
    const html = render(new Date("2026-12-08T12:00:00Z"));
    expect(html).toContain("Your Companion hasn&#x27;t sent a game since Tuesday.");
    expect(html).not.toContain("connected");
    expect(render(null)).toContain("since 1 December."); // no game yet: quiet since sign-up, beyond the week so the date
  });

  it("renders nothing for a visitor", () => {
    expect(render(null, null)).toBe("");
  });
});
