import { getChampionIconUrl, getLatestDDragonVersion } from "@/lib/riot/ddragon";

let championJson: Record<string, { key: string; name: string; image: { full: string } }> = {};
let championVersion: string | null = null;
let cachedMap: Record<number, string> | null = null;
let cachedAssetMap: Record<number, { name: string; imageUrl: string }> | null = null;

async function getLatestDDragon() {
   if (Object.keys(championJson).length > 0) { return championJson; }
   
   const version = await getLatestDDragonVersion();
   championVersion = version;
   const response = await fetch(`https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/champion.json`);
   const data = await response.json();
   championJson = data["data"] as Record<string, { key: string; name: string; image: { full: string } }>;
   return championJson;
}

export async function refreshChampionMap() {
    championJson = {};
    cachedMap = null;
    cachedAssetMap = null;
    return await getChampionMap();
}

export async function getChampionMap(): Promise<Record<number, string>> {
   if (cachedMap) return cachedMap;

   const champions = await getLatestDDragon();
   const map: Record<number, string> = {};

   for (const championName in champions) {
      if (!champions.hasOwnProperty(championName)) { continue; }
      const champion = champions[championName];
      map[parseInt(champion.key)] = champion.name;
   }

   cachedMap = map;
   return cachedMap;
}

export async function getChampionAssetMap(): Promise<Record<number, { name: string; imageUrl: string }>> {
   if (cachedAssetMap) return cachedAssetMap;

   const champions = await getLatestDDragon();
   const version = championVersion ?? await getLatestDDragonVersion();
   const map: Record<number, { name: string; imageUrl: string }> = {};

   for (const championName in champions) {
      if (!champions.hasOwnProperty(championName)) { continue; }
      const champion = champions[championName];
      map[parseInt(champion.key)] = {
         name: champion.name,
         imageUrl: getChampionIconUrl(champion.image.full, version)
      };
   }

   cachedAssetMap = map;
   return cachedAssetMap;
}

export async function getChampionNameByKey(key: number | string): Promise<string> {
   const keyStr = key.toString();

   const champions = await getLatestDDragon();
   for (const championName in champions) {
      if (!champions.hasOwnProperty(championName)) { continue; }
      if (champions[championName]["key"] === keyStr) {
         return champions[championName]["name"];
      }
   }
   return `Champion ${keyStr}`;
}
