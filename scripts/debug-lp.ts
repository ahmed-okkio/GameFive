import { calculateLpDelta } from "../lib/mmr/calculate";

async function main() {
    // Mimic the ingestion logic for a win
    const playerMmr = 2000;
    const lobbyMmr = 1500;
    const streak = 1;
    const isWin = true;

    const delta = calculateLpDelta({
        playerCurrentMmr: playerMmr,
        lobbyAvgMmr: lobbyMmr,
        consecutiveStreak: streak,
        win: isWin
    });

    console.log("Calculated Delta (Win):", Math.round(isWin ? delta : -delta));

    const isLoss = false;
    const deltaLoss = calculateLpDelta({
        playerCurrentMmr: playerMmr,
        lobbyAvgMmr: lobbyMmr,
        consecutiveStreak: 0,
        win: isLoss
    });
    console.log("Calculated Delta (Loss):", Math.round(isLoss ? deltaLoss : -deltaLoss));
}

main();
