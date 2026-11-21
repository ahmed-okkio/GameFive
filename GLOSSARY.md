# GameFive

Private, unofficial ARAM Mayhem ladder for a small EUW friend group, plus the time-boxed events run on top of it.

## Ladder

**MMR**:
An Entrant's hidden skill rating on the ladder, built only from their own Mayhem results; their visible rank chases it.
_Avoid_: Elo, rating

**LP**:
The visible points an Entrant gains or loses per Mayhem game on the ladder, which starts fresh each Mayhem Week. LP never counts toward Event Points.
_Avoid_: Points (ambiguous with Event Points)

**Placement**:
An Entrant's first 5 ladder games of Mayhem Week, during which their rank is hidden; it is revealed after the fifth.
_Avoid_: Provisional games, promos

**Companion**:
The Windows tray app that captures a player's Mayhem games from their local League client and uploads them.
_Avoid_: Client, tracker app

## Events

**Mayhem Week**:
The week-long event (Fri Dec 25 – Thu Dec 31 2026) in which entrants race for Event Points and Awards. Branded on the site as "GAMEFIVE: One Last Chance".
_Avoid_: Tournament, season

**Countdown**:
The pre-event period (from Dec 1) when the site is live, counting down to Mayhem Week and taking sign-ups.
_Avoid_: Pre-season, hype period

**Entrant**:
A player who signed up for Mayhem Week by running the Companion with their League client logged in; only Entrants appear on the site, and only their games after sign-up count.
_Avoid_: Participant (already means a player in a match), contestant

**Event Points**:
The race score for Mayhem Week: fixed points won or lost per event game, the same for every Entrant, plus quest and bonus points.
_Avoid_: EP, score, XP

**Points Entry**:
One record of Event Points given to or taken from an Entrant: for one source on one event day, such as a game result, a quest, a bonus or an admin adjustment. An Entrant's Event Points are the sum of their Points Entries.
_Avoid_: transaction, log line

**Award**:
A titled win in one stat category at the end of Mayhem Week, serious or joke; it pays no Event Points. The highest-ranked player holds one.
_Avoid_: Prize, achievement

**Event Winner**:
The Entrant with the most Event Points when Mayhem Week ends; the grand prize, revealed last in the Ceremony as "GameFive Winner".
_Avoid_: Race leader (that is whoever leads at a given moment), champion

**Ceremony**:
The designed reveal of Award winners that replaces the whole site when Mayhem Week ends.
_Avoid_: Results page

**Lockdown**:
The state after Mayhem Week where the site shows only the Ceremony and, once it has aired, a read-only archive of the final standings; the Companion retires itself, pointing to it.
_Avoid_: Shutdown, takedown

**Squad**:
Two or more Entrants on the same team in the same game.
_Avoid_: Party, premade, team

**Squad Contract**:
A daily shared goal claimed by the first Squad whose game meets it; it pays Event Points to every member of that Squad and is then gone for the day.
_Avoid_: Group goal, team quest

**Hidden Contract**:
A Squad Contract whose condition is shown only as a hint until a Squad claims it.
_Avoid_: Secret contract, mystery contract

**Daily Quest**:
One of the personal goals an Entrant rolls from the quest pool each day of Mayhem Week.
_Avoid_: Challenge, mission (Riot's own term)

**Record Bounty**:
A pinned single-game stat record that pays Event Points to whoever takes it from the current holder.
_Avoid_: Bounty (alone), record

**Daily MVP**:
The Entrant with the best single-game performance of the day.
_Avoid_: Player of the day

**Steal**:
Taking a Record Bounty by strictly beating its current value; only a steal pays, and raising your own record does not.
_Avoid_: Claim (used for Squad Contracts), break

**Mayhem Week First**:
A one-off feat, such as the week's first pentakill, that pays Event Points only to the first Entrant to achieve it during Mayhem Week.
_Avoid_: Achievement, milestone

**Full Squad**:
A Squad of five Entrants, all on one team.
_Avoid_: Five-stack, full premade

**Full Squad Contract**:
The one daily Squad Contract only a Full Squad can claim; it is paid on top of a regular Squad Contract from the same game.
_Avoid_: Five-stack contract

**Player Above**:
The Entrant directly above you in the Event Points race at any moment; player-facing copy names them plainly ("You're 4th, 85 behind Sam") rather than using this term.
_Avoid_: Pace Rival, rival, nemesis

**Feed Event**:
One public or personal happening during Mayhem Week, such as a steal, a contract claim or an overtake, shown on the live feed and/or as a tray toast to the Entrants it concerns.
_Avoid_: Notification (that is only the toast), activity, log entry

**Secret Quest**:
A hidden quest whose condition is unannounced until an Entrant first completes it.
_Avoid_: Hidden achievement, easter egg

**Twist Day**:
An event day with its own game-themed name and one rule change that boosts or reshapes bonus sources, revealed at that day's reset; the win/loss value never changes.
_Avoid_: Theme day, special day

**Blackout**:
The final day of Mayhem Week, from its reset until the Premiere, when every Entrant's totals and places, on the race and the ranked ladder, are hidden (their own included) while per-game gains stay visible; it is never announced beforehand.
_Avoid_: Freeze, hidden leaderboard

**Premiere**:
The fixed moment the Ceremony starts for everyone at once: the evening of Fri Jan 1 2027, GMT.
_Avoid_: Reveal time, launch

## Testing

**Rehearsal**:
A private, automated run of Mayhem Week on a separate copy of the site, with the clock moved and recorded games replayed, to prove the event works end to end; no Entrant ever sees it.
_Avoid_: Dry run, staging, test event

**Scenario**:
One scripted Rehearsal: the full week or a slice of it (sign-up, a twist day, the Blackout, the Ceremony), with the steps to take and what must be true after each.
_Avoid_: Test case, script

**Golden Snapshot**:
The owner-approved final outcome of the full-week Scenario (final board, Award winners, Wrapped cards) that every later Rehearsal is compared against.
_Avoid_: Baseline, fixture
