export const DEFAULT_DDRAGON_VERSION = "16.1.1";

export async function getLatestDDragonVersion(): Promise<string> {
  console.log("getLatestDDragonVersion called");
  try {
    const response = await fetch("https://ddragon.leagueoflegends.com/api/versions.json", {
      next: { revalidate: 3600 }
    });

    if (!response.ok) {
        console.error(`DDragon version fetch failed: ${response.status} ${response.statusText}`);
        return DEFAULT_DDRAGON_VERSION;
    }

    const versions = await response.json();
    return versions[0];
  } catch (error) {
    console.error("Error fetching DDragon version:", error);
    return DEFAULT_DDRAGON_VERSION;
  }
}

export function getProfileIconUrl(iconId: number, version: string) {
  return `https://ddragon.leagueoflegends.com/cdn/${version}/img/profileicon/${iconId}.png`;
}

export function getChampionIconUrl(imageFull: string, version: string) {
  return `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${imageFull}`;
}

export function getItemIconUrl(itemId: number, version: string) {
  return `https://ddragon.leagueoflegends.com/cdn/${version}/img/item/${itemId}.png`;
}

export function getCDragonItemIconUrl(itemId: number) {
  return `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/assets/items/icons2d/${itemId}.png`;
}

export function getSpellIconUrl(spellName: string, version: string) {
  return `https://ddragon.leagueoflegends.com/cdn/${version}/img/spell/${spellName}.png`;
}
