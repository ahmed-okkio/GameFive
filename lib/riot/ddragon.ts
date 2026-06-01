export async function getLatestDDragonVersion(): Promise<string> {
  const response = await fetch("https://ddragon.leagueoflegends.com/api/versions.json", {
    next: { revalidate: 3600 } // Cache for 1 hour
  });
  const versions = await response.json();
  return versions[0];
}

export function getProfileIconUrl(iconId: number, version: string) {
  return `https://ddragon.leagueoflegends.com/cdn/${version}/img/profileicon/${iconId}.png`;
}
