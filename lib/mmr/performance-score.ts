// Performance score (v11) for League of Legends Brawl matches.
// Lobby-wide robust z-scores (median/MAD, capped ±2.5), biased toward damage
// and kills, with a specialist bonus so exceptional tank/CC/heal games still
// rank, teammate-gated healing, kill participation, and a capped multikill
// clutch bonus. 50 ≈ lobby-average performance, scale 0–100.

export interface ParticipantStats {
  win: boolean;
  kills: number;
  deaths: number;
  assists: number;
  totalDamageDealtToChampions: number;
  totalDamageTaken: number;
  damageSelfMitigated: number;
  totalHeal: number;
  totalUnitsHealed: number;
  timeCCingOthers: number;
  goldEarned: number;
  champLevel: number;
  doubleKills: number;
  tripleKills: number;
  quadraKills: number;
  pentaKills: number;
}

export interface Participant {
  participantId: number;
  teamId: number;
  stats: ParticipantStats;
}

export interface ParticipantIdentity {
  participantId: number;
  player: { gameName: string };
}

export interface Match {
  participants: Participant[];
  participantIdentities: ParticipantIdentity[];
}

export interface PlayerScore {
  participantId: number;
  name: string;
  teamId: number;
  win: boolean;
  kda: string;
  score: number;
  components: {
    damage: number;
    impact: number;
    killParticipation: number;
    economy: number;
    deaths: number;
    specialistBonus: number;
    clutch: number;
  };
}

const WEIGHTS = {
  damage: 0.4,
  impact: 0.35 - 0.05, // 0.30 — kills + 0.25*assists
  killParticipation: 0.1,
  economy: 0.05,
  deaths: 0.1, // subtracted
  utilityBonus: 0.25, // per σ above the +1σ threshold
  tankBonus: 0.15,
  bonusThreshold: 1.0,
  scale: 18, // perf σ → score points
  clutchCap: 6,
  assistValue: 0.25, // a kill ≈ 4 assists
  zCap: 2.5,
} as const;

const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

const clamp = (x: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, x));

/**
 * Robust z-scores across the lobby: (x − median) / (1.4826 * MAD),
 * capped at ±2.5 so one outlier game (a 36-kill stomp) cannot distort
 * everyone else's score. Falls back to mean/stddev when MAD is zero.
 */
const robustZ = (xs: number[]): number[] => {
  const med = median(xs);
  const mad = median(xs.map((x) => Math.abs(x - med)));
  let scale = 1.4826 * mad;
  let center = med;
  if (scale === 0) {
    center = xs.reduce((a, b) => a + b, 0) / xs.length;
    scale = Math.sqrt(
      xs.reduce((a, x) => a + (x - center) ** 2, 0) / xs.length,
    );
    if (scale === 0) return xs.map(() => 0);
  }
  return xs.map((x) => clamp((x - center) / scale, -WEIGHTS.zCap, WEIGHTS.zCap));
};

export function scoreMatch(match: Match): PlayerScore[] {
  const players = match.participants;
  const names = new Map(
    match.participantIdentities.map((pi) => [pi.participantId, pi.player.gameName]),
  );

  const teamKills = new Map<number, number>();
  for (const p of players) {
    teamKills.set(p.teamId, (teamKills.get(p.teamId) ?? 0) + p.stats.kills);
  }

  const zDamage = robustZ(players.map((p) => p.stats.totalDamageDealtToChampions));
  const zImpact = robustZ(
    players.map((p) => p.stats.kills + WEIGHTS.assistValue * p.stats.assists),
  );
  const zKp = robustZ(
    players.map(
      (p) => (p.stats.kills + p.stats.assists) / Math.max(teamKills.get(p.teamId) ?? 0, 1),
    ),
  );
  const zGold = robustZ(players.map((p) => p.stats.goldEarned));
  const zLevel = robustZ(players.map((p) => p.stats.champLevel));
  const zDeaths = robustZ(players.map((p) => p.stats.deaths));
  // Tanking measured per life — a punching bag who feeds 17 deaths gets no
  // credit for the damage it soaked on the way down.
  const zTankEff = robustZ(
    players.map(
      (p) =>
        (p.stats.totalDamageTaken + p.stats.damageSelfMitigated) /
        Math.max(p.stats.deaths, 1),
    ),
  );
  // Healing gated by how many distinct teammates were healed: pure
  // self-sustain (lifesteal) counts ~0, healing 4+ allies counts in full.
  const zHeal = robustZ(
    players.map(
      (p) => p.stats.totalHeal * Math.min(1, (p.stats.totalUnitsHealed - 1) / 3),
    ),
  );
  const zCc = robustZ(players.map((p) => p.stats.timeCCingOthers));

  return players
    .map((p, i) => {
      const s = p.stats;
      const utility = 0.5 * zHeal[i] + 0.5 * zCc[i];
      // Fires only for clearly exceptional (>1σ) tank or CC/heal games, so
      // dedicated supports and tanks can rank without diluting the
      // damage/kills bias for everyone else.
      const specialistBonus = Math.max(
        WEIGHTS.utilityBonus * Math.max(0, utility - WEIGHTS.bonusThreshold),
        WEIGHTS.tankBonus * Math.max(0, zTankEff[i] - WEIGHTS.bonusThreshold),
      );
      const economy = 0.6 * zGold[i] + 0.4 * zLevel[i];
      const clutch = Math.min(
        WEIGHTS.clutchCap,
        0.5 * s.doubleKills + 1.5 * s.tripleKills + 3 * s.quadraKills + 5 * s.pentaKills,
      );

      const perf =
        WEIGHTS.damage * zDamage[i] +
        WEIGHTS.impact * zImpact[i] +
        WEIGHTS.killParticipation * zKp[i] +
        WEIGHTS.economy * economy -
        WEIGHTS.deaths * zDeaths[i] +
        specialistBonus;

      const score = clamp(50 + WEIGHTS.scale * perf + clutch, 0, 100);

      return {
        participantId: p.participantId,
        name: names.get(p.participantId) ?? `Player ${p.participantId}`,
        teamId: p.teamId,
        win: s.win,
        kda: `${s.kills}/${s.deaths}/${s.assists}`,
        score: Math.round(score * 10) / 10,
        components: {
          damage: zDamage[i],
          impact: zImpact[i],
          killParticipation: zKp[i],
          economy,
          deaths: zDeaths[i],
          specialistBonus,
          clutch,
        },
      };
    })
    .sort((a, b) => b.score - a.score);
}