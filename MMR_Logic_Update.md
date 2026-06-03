# GameFive MMR and LP Calculation Logic

This document outlines the current logic for MMR estimation and LP delta calculations.

## 1. Initial Placement MMR (`calculatePlacementMmr`)

When a player has played fewer than 10 Mayhem games they are "unplaced." Once they reach 10 games their starting MMR is calculated as follows.

### Anchor Selection
The primary anchor is the average of `lobbyAvgMmr` across all 10 placement games, using only games where `lobbyAvgMmr` was calculable (i.e. at least one opponent had ranked or GameFive data). Games where no opponent had any data are excluded from the average.

If `lobbyAnchorMmr` cannot be calculated, fall back to the player's best current ranked signal — Solo/Duo first, then Flex.

If neither is available, defer placement entirely. Do not guess. There are no hardcoded baseline fallback values — no magic numbers.

```
anchorMmr = lobbyAnchorMmr ?? bestCurrentRanked ?? defer placement
```

### Mayhem Performance Component (`mayhemMmr`)
Anchored to `anchorMmr` and adjusted by win rate across the 10 placement games:
```
mayhemMmr = anchorMmr + ((mayhemWins - 5) * 100)
```
This produces a bonus/penalty of +100 MMR per win above 5 and -100 per win below 5.

### Final Weighting
Ranked signals are still used as weighted inputs in the final blend even though they are no longer the primary anchor:

| Ranked data available | Weighting |
|---|---|
| Solo/Duo exists | 50% Solo/Duo + 20% Flex (or Solo as fallback) + 30% mayhemMmr |
| No Solo/Duo, Flex exists | 50% Flex + 50% mayhemMmr |
| No ranked data at all | 100% mayhemMmr |

### Historical Rank
Not used. Historical rank data is not available via the Riot API. Removed from the formula entirely.

---

## 2. LP Delta Calculation (`calculateLpDelta`)

When a placed player completes a match their LP gain/loss is calculated as follows.

### Base LP
```
BASE_LP = 25
```

### Opponent Factor
```
opponentFactor = lobbyAvgMmr / playerCurrentMmr
opponentFactor = clamp(opponentFactor, 0.5, 2.0)
```
If `lobbyAvgMmr` is null or uncalculable, the opponent factor defaults to `1.0` — neutral, no adjustment. The player gains or loses base LP only. The streak multiplier still applies.

### Streak Multiplier
```
streakMultiplier = 1 + (0.05 * min(consecutiveStreak, 5))
```
Maximum multiplier is 1.25 at a 5+ game streak. Applies to both wins and losses, mirroring League of Legends behaviour. No loss mitigation system.

### Final Formula
```
lpDelta = BASE_LP * opponentFactor * streakMultiplier

on win:  newMmr = currentMmr + lpDelta
on loss: newMmr = currentMmr - lpDelta
```

---

## 3. Lobby Average MMR (`lobbyAvgMmr`)

Calculated during match ingestion. For each opponent resolve their MMR using this priority:

1. Their stored GameFive `rawMmr` if `isPlaced === true`
2. Their Solo/Duo rank converted to MMR via `rankedToMmr`
3. Their Flex rank converted to MMR via `rankedToMmr`
4. If none of the above return a value — exclude them from the average entirely

`lobbyAvgMmr` is the average MMR of only the opponents for whom data was available. If zero opponents have any data, `lobbyAvgMmr` is stored as `null`.

There is no hardcoded fallback value. Null means uncalculable and propagates cleanly into both the LP delta formula (neutral factor) and the placement anchor (game excluded from average).

---

## 4. Promotion and Demotion Rules

- **Between divisions** (e.g. Gold II → Gold I): automatic at 100 LP, no series
- **Between tiers** (e.g. Gold I → Platinum IV): promotion series required, mirroring League of Legends
- **Demotion**: immediate at 0 LP on a loss, no shield
- **Master+**: no divisions, LP accumulates freely above the Master threshold

---

## 5. Decisions Summary

| Decision | Outcome |
|---|---|
| Placement anchor | Average lobbyAvgMmr across placement games |
| Placement fallback | bestCurrentRanked → defer, no magic number |
| Global median | Removed entirely |
| Historical rank | Removed entirely |
| Hardcoded baseline | Removed entirely |
| Lobby calculation | Real data only, exclude unknowns, null if no data |
| LP when lobby null | Neutral factor 1.0, base 25 LP |
| Opponent factor clamp | 0.5x–2.0x |
| Streak multiplier | Applies to wins and losses, max 1.25x |
| Loss mitigation | None |
| Promotion series | Tier boundaries only, not divisions |
| Demotion | Immediate at 0 LP, no shield |
