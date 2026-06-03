// scripts/debug-log-parser.ts
const fs = require('fs');

const LOG_PATH = "E:\\Downloads\\diagnostic.log";

function parse() {
    const logContent = fs.readFileSync(LOG_PATH, 'utf8');
    const matchBlocks = logContent.split('MATCH_PAYLOAD_START');

    for (let i = 1; i < matchBlocks.length; i++) {
        const block = matchBlocks[i];
        if (!block.includes('MATCH_PAYLOAD_END')) continue;

        const rawJsonPart = block.split('MATCH_PAYLOAD_END')[0].trim();
        
        // The logs contain "[INFO] " prefix on every line.
        // We need to remove "[INFO] " from the start of every line in the rawJsonPart.
        const cleanedJson = rawJsonPart
            .split('\n')
            .map(line => line.replace(/^.*?\[INFO\]\s*/, ''))
            .join('')
            .trim();

        console.log(`--- Block ${i} ---`);
        console.log("Cleaned JSON Preview:", cleanedJson.substring(0, 100));
        
        try {
            const payload = JSON.parse(cleanedJson);
            console.log("Successfully parsed JSON for gameId:", payload.gameId);
        } catch (e) {
            console.error("Parse Error:", e);
        }
    }
}

parse();
