# GameFive MMR and LP Calculation Logic

This document outlines the current logic for MMR estimation and LP delta calculations.

## 1. Initial Placement MMR (`calculatePlacementMmr`)
When a player has played fewer than 10 Mayhem games, they are "unplaced." Once they reach 10 games, their starting MMR is calculated as follows:

1.  **Anchor Selection:**
    *   The anchor is the average of `lobbyAvgMmr` across all 10 placement games, using only games where `lobbyAvgMmr` was calculable.
    *   **Fallback:** If `lobbyAnchorMmr` is null, the anchor defaults to a fixed **Gold III MMR (1400)**.

2.  **Mayhem Performance (`mayhemMmr`):**
    *   Anchored to the `anchorMmr` and adjusted by win rate across the 10 placement games:
        ```
        mayhemMmr = anchorMmr + ((mayhemWins - 5) * 100)
        ```
    *   This produces a bonus/penalty of +100 MMR per win above 5 and -100 per win below 5.

3.  **Ranked Signals:**
    *   Ranked signals (Solo/Duo/Flex) are **not used** in the placement MMR calculation.

## 2. LP Delta Calculation (`calculateLpDelta`)
When a placed player completes a match, their LP gain/loss is calculated:

1.  **Base LP:** 25.

2.  **Opponent Factor:**
    *   Calculated as `lobbyAvgMmr / playerCurrentMmr`.
    *   Clamped between `0.5x` and `2.0x`.
    *   `lobbyAvgMmr` is the average of opponents' official Riot rank data.
    *   **Important:** GameFive's `rawMmr` is **never** used in the `lobbyAvgMmr` calculation; it is a display-only value.

3.  **Streak Multiplier:**
    *   `1 + (0.05 * min(consecutiveStreak, 5))`.

4.  **Final Formula:** `25 * OpponentFactor * StreakMultiplier`.

## 3. Lobby Average MMR (`lobbyAvgMmr`)
*   Calculated during match ingestion.
*   Only considers opponents with established **official Riot ranked data**:
    *   For each opponent, resolve MMR for both `Solo/Duo` and `Flex`.
    *   Use `Math.max()` to pick the **highest** of the available ranks.
*   **Fallback:** If no opponents have any usable rank data, the lobby average defaults to the **uploader's own `rawMmr`** (resulting in a neutral factor of 1.0 and base 25 LP gain/loss).
