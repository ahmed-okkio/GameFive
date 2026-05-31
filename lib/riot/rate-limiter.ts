import Redis from "ioredis";
import { appConfig } from "@/lib/config";

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 45;

let redis: Redis | null = null;
let localTimestamps: number[] = [];

function getRedis() {
  if (!appConfig.redisUrl) {
    return null;
  }

  redis ??= new Redis(appConfig.redisUrl, {
    maxRetriesPerRequest: null
  });

  return redis;
}

async function wait(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function acquireRedisSlot(client: Redis) {
  const key = "gamefive:riot-rate-limit";

  while (true) {
    const now = Date.now();
    const min = now - WINDOW_MS;

    const result = await client
      .multi()
      .zremrangebyscore(key, 0, min)
      .zcard(key)
      .exec();

    const count = Number(result?.[1]?.[1] ?? 0);

    if (count < MAX_REQUESTS) {
      await client.zadd(key, now, `${now}:${Math.random()}`);
      await client.pexpire(key, WINDOW_MS);
      return;
    }

    const oldest = await client.zrange(key, 0, 0, "WITHSCORES");
    const oldestScore = Number(oldest[1] ?? now);
    await wait(Math.max(250, oldestScore + WINDOW_MS - now));
  }
}

async function acquireLocalSlot() {
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

export async function acquireRiotSlot() {
  const client = getRedis();

  if (client) {
    await acquireRedisSlot(client);
    return;
  }

  await acquireLocalSlot();
}
