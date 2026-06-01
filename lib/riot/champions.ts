import { getLatestDDragonVersion } from "@/lib/riot/ddragon";

let cachedMap: Record<number, string> | null = null;

export async function getChampionMap(): Promise<Record<number, string>> {
  if (cachedMap) return cachedMap;

  const version = await getLatestDDragonVersion();
  const response = await fetch(`https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/champion.json`);
  const data = await response.json();

  const map: Record<number, string> = {};
  const champions = data.data as Record<string, { key: string; name: string }>;
  for (const champion of Object.values(champions)) {
    map[parseInt(champion.key)] = champion.name;
  }

  cachedMap = map;
  return map;
}
