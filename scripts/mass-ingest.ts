// scripts/mass-ingest.ts
const fs = require('fs');
const path = require('path');

const API_URL = "https://game-five-kohl.vercel.app/api/ingest/match";
const LOG_PATH = "E:\\Downloads\\diagnostic.log";

async function ingest() {
    if (!fs.existsSync(LOG_PATH)) {
        console.error(`diagnostic.log not found at ${LOG_PATH}!`);
        return;
    }

    const logContent = fs.readFileSync(LOG_PATH, 'utf8');
    const matchBlocks = logContent.split('MATCH_PAYLOAD_START');

    for (const block of matchBlocks) {
        if (!block.includes('MATCH_PAYLOAD_END')) continue;
        
        const jsonStr = block.split('MATCH_PAYLOAD_END')[0].trim();
        try {
            const payload = JSON.parse(jsonStr);
            
            // Ensure payload has the correct source field for ingestion
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
