import { getLatestDDragonVersion } from "@/lib/riot/ddragon";

let championJson: Record<string, { key: string; name: string }> = {};

async function getLatestDDragon() {
   if (Object.keys(championJson).length > 0) { return championJson; }
   
   const version = await getLatestDDragonVersion();
   const response = await fetch(`https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/champion.json`);
   const data = await response.json();
   championJson = data["data"] as Record<string, { key: string; name: string }>;
   return championJson;
}

export async function getChampionMap(): Promise<Record<number, string>> {
   const champions = await getLatestDDragon();
   const map: Record<number, string> = {
      804: "Yunara" // Explicit fallback
   };

   for (const championName in champions) {
      if (!champions.hasOwnProperty(championName)) { continue; }
      const champion = champions[championName];
      map[parseInt(champion.key)] = champion.name;
   }

   return map;
}

export async function getChampionNameByKey(key: number | string): Promise<string> {
   const keyStr = key.toString();
   if (keyStr === "804") return "Yunara";

   const champions = await getLatestDDragon();
   for (const championName in champions) {
      if (!champions.hasOwnProperty(championName)) { continue; }
      if (champions[championName]["key"] === keyStr) {
         return champions[championName]["name"];
      }
   }
   return `Champion ${keyStr}`;
}
