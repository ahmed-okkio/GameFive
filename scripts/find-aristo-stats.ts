// scripts/find-aristo-stats.ts
const fs = require('fs');

// Read the log file
const logContent = fs.readFileSync('companion/diagnostic.log', 'utf8');

// The log contains blocks starting with MATCH_PAYLOAD_START and ending with MATCH_PAYLOAD_END
const matchBlocks = logContent.split('MATCH_PAYLOAD_START');

for (const block of matchBlocks) {
    if (!block.includes('MATCH_PAYLOAD_END')) continue;
    
    const jsonStr = block.split('MATCH_PAYLOAD_END')[0];
    try {
        const match = JSON.parse(jsonStr);
        const aristoIdentity = match.participantIdentities.find((pi: any) => pi.player.puuid === 'e1d87b48-7323-5fda-9fb9-d2564745c736');
        
        if (aristoIdentity) {
            const participant = match.participants.find((p: any) => p.participantId === aristoIdentity.participantId);
            console.log(`Match: ${match.gameId} | Aristo Stats: ${participant.stats.kills}/${participant.stats.deaths}/${participant.stats.assists}`);
        }
    } catch (e) {
        // Ignore JSON parse errors
    }
}
