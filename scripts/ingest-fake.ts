import fs from 'fs';

async function ingest() {
  const payload = JSON.parse(fs.readFileSync('./fake_match.json', 'utf8'));
  console.log('Sending fake match...');
  try {
    const response = await fetch('https://game-five-kohl.vercel.app/api/ingest/match', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer game-five-383'
      },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
        const errorText = await response.text();
        console.error('Ingestion failed:', response.status, errorText);
    } else {
        const data = await response.json();
        console.log('Ingestion result:', data);
    }
  } catch (err) {
    console.error('Failed to connect to ingestion API. Is "npm run dev" running?', err);
  }
}

ingest();
