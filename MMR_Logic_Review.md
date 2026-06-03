# GameFive MMR and LP Calculation Logic

This document outlines the current logic for MMR estimation and LP delta calculations.

## 1. Initial Placement MMR (`calculatePlacementMmr`)
When a player has played fewer than 10 Mayhem games, they are "unplaced." Once they reach 10 games, their starting MMR is calculated as follows:

1.  **Rank Signal Resolution:**
    *   `soloDuoMmr`: Converted from current Solo/Duo rank.
    *   `flexMmr`: Converted from current Flex rank.
    *   `historicalMmr`: Converted from the highest historical rank stored in the database.

2.  **Anchor Selection:**
    *   The system uses the highest available rank signal (`Solo/Duo` > `Flex` > `Historical`).
    *   If **no** rank data exists across all three, it uses a hardcoded `PLACEMENT_BASELINE_MMR` of **1100** (equivalent to Silver II).

3.  **Mayhem Performance (`mayhemMmr`):**
    *   Anchored to the selected Rank Signal (or the 1100 baseline).
    *   Adjusted by win rate: `+100` for each win above 5, `-100` for each loss below 5.

4.  **Final Weighting:**
    *   **With Solo/Duo rank:** 50% Solo, 20% Flex/Hist, 30% Mayhem.
    *   **Without Solo/Duo rank:** 50% Flex/Hist, 50% Mayhem.
    *   **Without any rank:** 100% Mayhem.

## 2. LP Delta Calculation (`calculateLpDelta`)
When a placed player completes a match, their LP gain/loss is calculated:

1.  **Base LP:** 25.

2.  **Opponent Factor:**
    *   Calculated as `lobbyAvgMmr / playerCurrentMmr`.
    *   Clamped between `0.5x` (playing against much weaker opponents) and `2.0x` (playing against much stronger opponents).

3.  **Streak Multiplier:**
    *   `1 + (0.05 * min(consecutiveStreak, 5))`.
    *   Rewards win/loss streaks up to 5 games.

4.  **Final Formula:** `25 * OpponentFactor * StreakMultiplier`.

## 3. Lobby Average MMR (`lobbyAvgMmr`)
*   Calculated during match ingestion.
*   Only considers opponents with established **official Riot ranked data**:
    *   `Solo/Duo` rank MMR.
    *   `Flex` rank MMR.
*   **Fallback:** If no opponents have any usable rank data, the lobby average defaults to the **uploader's own `rawMmr`** (resulting in a neutral factor of 1.0 and base 25 LP gain/loss).
