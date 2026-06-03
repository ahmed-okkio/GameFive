// scripts/mass-ingest-fixed.ts
const fs = require('fs');

const API_URL = "https://game-five-kohl.vercel.app/api/ingest/match";
const LOG_PATH = "E:\\Downloads\\diagnostic.log";

async function ingest() {
    const logContent = fs.readFileSync(LOG_PATH, 'utf8');
    const matchBlocks = logContent.split('MATCH_PAYLOAD_START');

    for (let i = 1; i < matchBlocks.length; i++) {
        const block = matchBlocks[i];
        if (!block.includes('MATCH_PAYLOAD_END')) continue;

        // Extract the JSON lines, remove prefixes, and join
        const lines = block.split('MATCH_PAYLOAD_END')[0].split('\n');
        
        // This is a bit brute force but let's just find the first '{' and last '}'
        const fullBlock = lines.join('\n');
        const firstBrace = fullBlock.indexOf('{');
        const lastBrace = fullBlock.lastIndexOf('}');
        
        if (firstBrace === -1 || lastBrace === -1) continue;
        
        const jsonStr = fullBlock.substring(firstBrace, lastBrace + 1)
            .replace(/\[INFO\] /g, '')
            .replace(/\r/g, ''); // Remove carriage returns

        try {
            const payload = JSON.parse(jsonStr);
            payload.source = "lcu";
            
            console.log(`Ingesting match ${payload.gameId}...`);
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer game-five-383' 
                },
                body: JSON.stringify(payload)
            });
            console.log(`Result: ${response.status} ${await response.text()}`);
        } catch (e) {
            console.error("Failed to parse/ingest match payload:", e);
        }
    }
}

ingest();
