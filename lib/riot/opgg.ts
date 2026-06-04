import { rankedToMmr } from "@/lib/mmr/ranked";

export type OpggHistoricalRank = {
  season: string;
  tier: string;
  division: string | null;
  lp: number | null;
};

type OpggSeasonRow = {
  season: string;
  rank_entries?: {
    rank_info?: {
      tier?: string;
      lp?: string | number | null;
    };
  };
};

function normalizeTierLabel(label: string | null | undefined): {
  tier: string | null;
  division: string | null;
} {
  if (!label) {
    return { tier: null, division: null };
  }

  const [tier, division] = label.trim().split(/\s+/, 2);

  return {
    tier: tier?.toUpperCase() ?? null,
    division: division?.toUpperCase() ?? null
  };
}

function extractBalancedJsonObject(text: string, startIndex: number) {
  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = startIndex; i < text.length; i += 1) {
    const char = text[i];

    if (inString) {
      if (escape) {
        escape = false;
      } else if (char === "\\") {
        escape = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;

      if (depth === 0) {
        return text.slice(startIndex, i + 1);
      }
    }
  }

  return null;
}

export function extractBestHistoricalRankFromOpggRsc(payload: string): OpggHistoricalRank | null {
  const marker = '{"data":[{"season":"';
  let searchIndex = 0;

  while (searchIndex < payload.length) {
    const startIndex = payload.indexOf(marker, searchIndex);

    if (startIndex === -1) {
      return null;
    }

    const fragment = extractBalancedJsonObject(payload, startIndex);

    if (!fragment) {
      searchIndex = startIndex + marker.length;
      continue;
    }

    try {
      const parsed = JSON.parse(fragment) as { data?: OpggSeasonRow[] };
      const rows = parsed.data ?? [];
      const candidates = rows
        .map((row) => {
          const rankLabel = row.rank_entries?.rank_info?.tier?.trim();
          if (!rankLabel) {
            return null;
          }

          const normalized = normalizeTierLabel(rankLabel);
          if (!normalized.tier) {
            return null;
          }

          const mmr = rankedToMmr(normalized.tier, normalized.division);
          if (mmr === null) {
            return null;
          }

          return {
            season: row.season,
            tier: normalized.tier,
            division: normalized.division,
            lp: parseOpggLp(row.rank_entries?.rank_info?.lp),
            mmr
          };
        })
        .filter((row): row is { season: string; tier: string; division: string | null; lp: number | null; mmr: number } => Boolean(row));

      if (candidates.length > 0) {
        return candidates.reduce((best, current) => (current.mmr > best.mmr ? current : best));
      }
    } catch {
      // Keep scanning for the next serialized data block.
    }

    searchIndex = startIndex + marker.length;
  }

  return null;
}

function parseOpggLp(value: string | number | null | undefined): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export function buildOpggProfileUrl(region: string, gameName: string, tagLine: string) {
  const safeRegion = region.trim().toLowerCase();
  const safeGameName = encodeURIComponent(gameName.trim());
  const safeTagLine = encodeURIComponent(tagLine.trim());

  return `https://op.gg/lol/summoners/${safeRegion}/${safeGameName}-${safeTagLine}`;
}

export async function fetchOpggHistoricalRank(region: string, gameName: string, tagLine: string) {
  const response = await fetch(`${buildOpggProfileUrl(region, gameName, tagLine)}?_rsc=1`, {
    headers: {
      RSC: "1",
      Accept: "*/*",
      "User-Agent": "Mozilla/5.0"
    },
    cache: "no-store",
    signal: AbortSignal.timeout(5000)
  });

  if (!response.ok) {
    throw new Error(`OP.GG historical rank request failed with ${response.status}`);
  }

  const payload = await response.text();
  return extractBestHistoricalRankFromOpggRsc(payload);
}
