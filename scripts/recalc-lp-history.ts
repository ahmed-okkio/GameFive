import { PrismaClient } from "@prisma/client";
import { calculateLpDelta } from "../lib/mmr/calculate";

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: "postgresql://postgres:YasuoisGam383@db.opqknegnedfypkctcbuh.supabase.co:6543/postgres?pgbouncer=true"
        }
    }
});

async function recalculateHistory() {
    console.log("Starting full LP delta recalculation...");

    // 1. Reset all players to a baseline (or re-process from scratch)
    // Actually, to do this accurately, we should reset all rawMmr to a starting point 
    // and re-ingest/re-calculate chronologically. 
    // Given the complexity, let's reset to a baseline and calculate forward.
    
    // For now, let's just do a simple pass: 
    // Reset all players to isPlaced=false, rawMmr=0, and then re-process all matches in order.
    
    await prisma.matchParticipant.updateMany({ data: { lpDelta: 0 } });
    await prisma.player.updateMany({ 
        data: { 
            rawMmr: 0, 
            currentLp: 0, 
            isPlaced: false, 
            lastGameTier: null,
            mayhemGames: 0
        } 
    });

    const matches = await prisma.match.findMany({
        orderBy: { gameDate: "asc" },
        include: { participants: { include: { player: true } } }
    });

    for (const match of matches) {
        console.log(`Processing match ${match.matchId}...`);
        
        // Calculate lobby average MMR for this match based on current player data
        const validOpponents = match.participants.filter(p => 
            p.player && (p.player.soloDuoTier || p.player.flexTier)
        );

        // Calculate lobbyAvgMmr if not already done, or re-verify
        // ... (Using existing valid logic)
        
        // Update each participant's LP and Player MMR
        for (const p of match.participants) {
            if (!p.player || !p.player.isPlaced) continue;

            // This is complex because we need the player's MMR *at the time of the match*.
            // Since we reset everything to 0, we are replaying history.
            // This script is getting too complex to be safe in one go.
        }
    }
    console.log("Migration complete.");
}

// Due to complexity and risk of data corruption, I will NOT run a destructive script 
// that resets all history without absolute confirmation and a tested path.
// I recommend we start by just recalculating for the user's main account first.
