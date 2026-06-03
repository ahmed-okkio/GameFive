const fs = require('fs');

const API_URL = "https://game-five-kohl.vercel.app/api/ingest/match";
const LOG_PATH = "E:\\Downloads\\diagnostic.log";

async function ingest() {
    const logContent = fs.readFileSync(LOG_PATH, 'utf8');
    
    // Split by the START marker
    const blocks = logContent.split('MATCH_PAYLOAD_START');
    
    for (const block of blocks) {
        if (!block.includes('MATCH_PAYLOAD_END')) continue;

        // The JSON starts after the timestamp and [INFO] tag, 
        // which appear on every line. We need to strip the prefix from each line.
        const lines = block.split('MATCH_PAYLOAD_END')[0].split('\n');
        
        const jsonLines = lines.map(line => {
            // Find the index of the first '{' character
            const braceIndex = line.indexOf('{');
            return braceIndex !== -1 ? line.substring(braceIndex) : '';
        }).join('');

        try {
            const payload = JSON.parse(jsonLines);
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
