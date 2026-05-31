# GameFive Spec Update — Ranked System Redesign

## Context

You have already received the GameFive technical specification (GameFive_Specification.md) and the companion app architecture update (GameFive_SpecUpdate_Prompt.md). This prompt supersedes and replaces the MMR formula sections of those documents. Read this in full before implementing anything related to MMR calculation, rank display, or the placement system.

---

## Overview of the change

The original spec described a complex weighted formula that permanently blended Solo/Duo rank, Flex rank, ARAM history, Mayhem win rate, and Mayhem performance stats. This is replaced with a two-phase system:

- **Phase 1 — Placements:** First 10 Mayhem games. No rank shown. Formula used once at the end to establish a starting MMR.
- **Phase 2 — Established:** 10+ games. Traditional ELO-style LP gain/loss per game. Formula is never used again.

Performance stats (KDA, damage share, kill participation, healing) are not used anywhere in this system. It is impossible to fairly judge performance without knowing a player's champion role — a tank or support will always look statistically poor compared to a carry. Win/loss and opponent difficulty are the only signals that matter.

---

## Phase 1 — Placement (0 to 9 Mayhem games stored)

### What to display
Show "Unranked — X placement games remaining" on the player's profile. No tier emblem, no MMR number, no rank label. Just a placement progress indicator e.g. "4 / 10 placement games complete".

### What to do in the background
Record every game silently as it arrives from the companion app. Store all game data as normal. Do not calculate or display any MMR during this phase.

### After the 10th game is stored
Run the placement formula once to establish a starting MMR. This is the only time the full formula runs. Use the following inputs and weights:

**Placement formula inputs and weights:**

| Input | Weight | Source |
|---|---|---|
| Solo/Duo rank | 50% | Riot API — current season |
| Flex rank | 20% | Riot API — current season |
| Mayhem win rate | 30% | Win/loss record across 10 placement games |

**Ranked fallback priority (applied to both Solo/Duo and Flex inputs):**
1. Current season rank — fetch from Riot API
2. If unranked in current season, check previous seasons via Riot API going back up to 5 seasons. Use the highest rank found across any season.
3. If no ranked history exists across any season for either mode, use global median MMR for the entire ranked component combined.

**Weight redistribution if no Solo/Duo rank exists:**
- Redistribute Solo/Duo's 50% as: Flex 30%, Mayhem win rate 20% (total Mayhem win rate becomes 50%)

**Weight redistribution if no ranked data at all (current or historical):**
- Mayhem win rate takes 100% of the weight. Starting MMR is determined purely by win/loss across placement games, anchored around the global median.

Convert ranked tier/division to MMR estimate using the conversion table from the original spec (Section 3.4).

Once starting MMR is calculated, map it to a tier and division using the dynamic percentile boundaries (Section 4.2 of original spec). Display the player's rank immediately. The placement formula is never run again for this player.

---

## Phase 2 — Established (10+ Mayhem games stored)

### Core mechanic
Each new Mayhem game uploaded by the companion triggers a simple LP delta calculation. The player gains LP on a win and loses LP on a loss. The amount gained or lost depends only on opponent difficulty and streak. Performance stats play no role.

The full placement formula is never used again. Ranked and ARAM signals are completely ignored from this point forward.

### LP Delta Formula

```
base_lp = 25

opponent_factor = lobby_avg_mmr / player_current_mmr
// If opponent_factor > 1.0 the lobby was harder than expected — gain more, lose less
// If opponent_factor < 1.0 the lobby was easier — gain less, lose more
// Cap opponent_factor between 0.5 and 2.0

streak_multiplier = 1 + (0.05 * min(consecutive_streak_length, 5))
// Maximum 1.25x at 5+ game streak
// Applies to both win streaks and loss streaks

lp_delta = base_lp * opponent_factor * streak_multiplier

on win:  new_lp = current_lp + lp_delta
on loss: new_lp = current_lp - lp_delta
```

LP and MMR move together — LP is the display value within a division, MMR is the underlying number. When LP reaches 100 within a division, the player promotes to the next division. When LP hits 0 and a game is lost, the player demotes to the previous division. Mirror League's promotion/demotion rules exactly — no demotion protection beyond what League itself uses.

For Master+ players, LP just keeps accumulating above the Master threshold with no division cap.

### Opponent difficulty calculation — priority order

For each of the 9 opponents in a Mayhem game, determine their MMR estimate using the following priority:

1. **Their stored GameFive MMR** — if they are already an established player in the database, use their current MMR directly
2. **Current season Solo/Duo rank** — fetch from Riot API, convert using the rank-to-MMR table from original spec Section 3.4
3. **Current season Flex rank** — fetch from Riot API if no Solo/Duo rank exists
4. **Previous seasons ranked history** — check up to 5 seasons back via Riot API, use the highest rank found across any season and any mode
5. **Global median MMR** — if no ranked history exists across any season, assign the current global median MMR of all players in the database

Calculate `lobby_avg_mmr` as the average of all 9 opponents' MMR estimates using the above priority.

Cache each opponent's rank lookup for 24 hours to avoid redundant API calls.

---

## What to remove from the original spec entirely

- The dynamic weight table (Section 3.3) — weights shifting from 0–5 games through 50+ games
- The performance score calculation (Section 3.5) — KDA, damage share, kill participation, healing — not used anywhere
- The confidence/uncertainty buffer system (Section 3.9) — replaced by the placement phase display
- ARAM history as a weighted MMR input — ARAM data is not used in any MMR calculation. Remove all ARAM match fetching from the MMR pipeline. ARAM history Riot API endpoints can be removed entirely.
- The enrichment queue and all depth 1–5 crawling — no longer needed. The system is fully reactive.
- Recency weighting (Section 3.7) — not applicable to an ELO system where only the current MMR value matters
- The opponent quality normalisation formula (Section 3.6) — replaced by the simpler opponent_factor above

Keep inactivity decay exactly as originally specified. It still applies to the stored MMR value and the decay badge still shows.

---

## Simplify depth 0 profile load to

1. Resolve Riot ID to PUUID — 1 Riot API call
2. Fetch summoner profile — 1 Riot API call
3. Fetch current season Solo/Duo and Flex rank — 1 Riot API call
4. Retrieve all stored Mayhem games for this player from the database
5. If fewer than 10 games stored: show placement screen, no MMR calculation
6. If 10 or more games stored and no MMR exists yet: run placement formula, store result, display rank
7. If MMR already stored: display current rank, apply inactivity decay at display time
8. For each opponent in stored games whose rank is not cached: fetch their ranked data — 1 Riot API call per opponent, cached for 24 hours

---

## Profile page display changes

### During placements (0–9 games)
- Large "Unranked" label where the tier emblem would be
- Placement progress bar — "4 / 10 placement games complete"
- No MMR number shown
- No "How is this calculated?" section shown yet
- Recent form strip still shows last 5 games as W/L pills

### After placements (10+ games)
- Full tier emblem + division label e.g. "Gold II"
- Raw MMR number shown beneath e.g. "1,542 MMR"
- LP shown within division e.g. "67 LP"
- Inactivity decay badge if applicable — "Decayed from Diamond"
- "How is this calculated?" expandable section shows:
  - One-time summary of how placement starting rank was determined
  - LP gained/lost in last 5 games
  - Average opponent difficulty of recent lobbies
  - Current streak if active

---

## What does NOT change

- Rank display system — tiers, divisions, Master+ LP (original spec Section 4) — unchanged
- Dynamic percentile tier boundaries — unchanged
- Inactivity decay — unchanged, still applies to stored MMR, still shown as "Decayed from [tier]" badge
- All pages and UI structure — unchanged
- Friends leaderboard — unchanged
- Admin panel — unchanged
- Companion app (C# .NET) — unchanged
- Caching rules — unchanged
- Tech stack — unchanged
- Hosting — unchanged
- The `POST /api/ingest/match` endpoint — unchanged, still triggers MMR update on each upload

---

## Summary of what the agent needs to implement

1. Two-phase system: placement (0–9 games, no rank shown) then ELO LP gain/loss (10+ games)
2. Placement formula uses Solo/Duo rank (50%), Flex rank (20%), Mayhem win rate (30%) — no performance stats
3. LP delta formula uses base LP × opponent factor × streak multiplier — no performance modifier
4. Opponent difficulty resolved via: GameFive MMR → Solo/Duo → Flex → historical seasons (up to 5) → global median
5. Remove ARAM history, performance stats, enrichment queue, recency weighting, and uncertainty buffer entirely
6. Everything else proceeds as written in the original spec and companion update prompt
