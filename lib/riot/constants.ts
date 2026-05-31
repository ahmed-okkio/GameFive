export const RIOT_PLATFORM = "euw1";
export const RIOT_REGION = "europe";
export const RIOT_PLATFORM_URL = `https://${RIOT_PLATFORM}.api.riotgames.com`;
export const RIOT_REGION_URL = `https://${RIOT_REGION}.api.riotgames.com`;

export const QUEUE_IDS = {
  ARAM: 450,
  ARAM_MAYHEM: 2400
} as const;

export const RANKED_QUEUES = {
  SOLO_DUO: "RANKED_SOLO_5x5",
  FLEX: "RANKED_FLEX_SR"
} as const;
