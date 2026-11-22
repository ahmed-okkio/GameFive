import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EVENT_START, timeLeft } from "@/lib/countdown";
import { EnteredLine, EntrantList, SignUp } from "@/app/(site)/Entrants";

describe("R5.2 countdown clock", () => {
  it("counts down to 2026-12-25T00:00:00Z", () => {
    expect(EVENT_START).toBe(Date.parse("2026-12-25T00:00:00Z"));
    expect(timeLeft(Date.parse("2026-12-09T18:41:53Z"))).toEqual([15, 5, 18, 7]);
    expect(timeLeft(Date.parse("2026-12-24T23:59:59.5Z"))).toEqual([0, 0, 0, 0]);
    expect(timeLeft(Date.parse("2026-12-24T23:59:59Z"))).toEqual([0, 0, 0, 1]);
    expect(timeLeft(Date.parse("2026-12-26T00:00:00Z"))).toEqual([0, 0, 0, 0]);
  });
});

describe("R5.5 logged-in Entrant on home", () => {
  const names = [
    { id: "a", riotIdName: "Brightside", riotIdTag: "EUW" },
    { id: "b", riotIdName: "Okkio", riotIdTag: "EUW" },
    { id: "c", riotIdName: "Okkio", riotIdTag: "EUW2" } // same name, another player: marked by id, not name
  ];
  const render = (me: string | null) => renderToStaticMarkup(createElement("div", null, createElement(EnteredLine, { me }), createElement(SignUp, { me }), createElement(EntrantList, { names, me })));

  it("shows the entered line and marks only the Entrant's own row", () => {
    const html = render("b");
    expect(html).toContain("You&#x27;re entered to play in GameFive: One Last Chance.");
    expect(html.match(/>You</g)).toHaveLength(1);
    const rows = html.split("<li").filter((r) => r.includes("text-[0.65em]"));
    expect(rows[1]).toContain(">You<");
    expect(rows[1]).toContain("shadow-[inset_2px_0_0_#C8AA6E]");
    expect(rows[2]).not.toContain(">You<");
    expect(html).not.toContain("not in yet");
    expect(html).toContain("Download the Companion");
  });

  it("shows neither to a logged-out visitor", () => {
    const html = render(null);
    expect(html).not.toContain("entered to play");
    expect(html).not.toContain(">You<");
    expect(html).not.toContain("inset_2px");
    expect(html).toContain("You&#x27;re not in yet");
  });
});
