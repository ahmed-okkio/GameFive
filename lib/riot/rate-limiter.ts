const WINDOW_MS = 60_000;
const MAX_REQUESTS = 45;

// shortcut: per-instance limit, not shared across serverless instances; upgrade if Riot 429s become common.
let localTimestamps: number[] = [];

async function wait(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function acquireRiotSlot() {
  while (true) {
    const now = Date.now();
    localTimestamps = localTimestamps.filter((timestamp) => timestamp > now - WINDOW_MS);

    if (localTimestamps.length < MAX_REQUESTS) {
      localTimestamps.push(now);
      return;
    }

    await wait(Math.max(250, localTimestamps[0] + WINDOW_MS - now));
  }
}
