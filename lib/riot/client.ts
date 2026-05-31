import { appConfig, requireEnv } from "@/lib/config";
import { acquireRiotSlot } from "@/lib/riot/rate-limiter";
import { QUEUE_IDS, RIOT_PLATFORM_URL, RIOT_REGION_URL } from "@/lib/riot/constants";
import type { RiotAccount, RiotLeagueEntry, RiotMatch, RiotSummoner } from "@/lib/riot/types";

type Routing = "platform" | "region";

async function riotFetch<T>(routing: Routing, path: string, attempt = 0): Promise<T> {
  const apiKey = requireEnv("riotApiKey");
  const baseUrl = routing === "platform" ? RIOT_PLATFORM_URL : RIOT_REGION_URL;

  await acquireRiotSlot();

  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      "X-Riot-Token": apiKey
    },
    cache: "no-store"
  });

  if ((response.status === 429 || response.status >= 500) && attempt < 4) {
    const retryAfter = Number(response.headers.get("Retry-After"));
    const backoffMs = Number.isFinite(retryAfter)
      ? retryAfter * 1000
      : Math.min(30_000, 1000 * 2 ** attempt);

    await new Promise((resolve) => setTimeout(resolve, backoffMs));
    return riotFetch<T>(routing, path, attempt + 1);
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Riot API ${response.status} for ${path}: ${body}`);
  }

  return response.json() as Promise<T>;
}

function encodePart(value: string) {
  if (!value) {
    throw new Error("Riot API path value is missing");
  }

  return encodeURIComponent(value.trim());
}

export const riotClient = {
  getAccountByRiotId(gameName: string, tagLine: string) {
    return riotFetch<RiotAccount>(
      "region",
      `/riot/account/v1/accounts/by-riot-id/${encodePart(gameName)}/${encodePart(tagLine)}`
    );
  },

  getAccountByPuuid(puuid: string) {
    return riotFetch<RiotAccount>("region", `/riot/account/v1/accounts/by-puuid/${encodePart(puuid)}`);
  },

  getSummonerByPuuid(puuid: string) {
    return riotFetch<RiotSummoner>("platform", `/lol/summoner/v4/summoners/by-puuid/${encodePart(puuid)}`);
  },

  getLeagueEntries(summonerId: string) {
    return riotFetch<RiotLeagueEntry[]>(
      "platform",
      `/lol/league/v4/entries/by-summoner/${encodePart(summonerId)}`
    );
  },

  getLeagueEntriesByPuuid(puuid: string) {
    return riotFetch<RiotLeagueEntry[]>(
      "platform",
      `/lol/league/v4/entries/by-puuid/${encodePart(puuid)}`
    );
  },

  getMatchIds(puuid: string, queueId: number, count: number) {
    return riotFetch<string[]>(
      "region",
      `/lol/match/v5/matches/by-puuid/${encodePart(puuid)}/ids?queue=${queueId}&count=${count}`
    );
  },

  getAramMatchIds(puuid: string, count = 100) {
    return this.getMatchIds(puuid, QUEUE_IDS.ARAM, count);
  },

  getMatch(matchId: string) {
    return riotFetch<RiotMatch>("region", `/lol/match/v5/matches/${encodePart(matchId)}`);
  }
};

export function hasRiotKey() {
  return Boolean(appConfig.riotApiKey);
}
