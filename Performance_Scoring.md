(10 players, 5v5, Riot match-v4-style JSON: participants[] with nested stats{}).
  It produces a 0–100 score per player where 50 = lobby-average; players are ranked
  by score within a single match. Implementation reference: scoreMatch() in
  performanceScore.tsx.

  ## Normalization (the foundation)

  Every stat is converted to a robust z-score ACROSS ALL 10 PLAYERS in the lobby
  (not within each team):

      z(x) = clamp( (x − lobby_median) / (1.4826 × MAD), −2.5, +2.5 )

  - Median/MAD instead of mean/stddev so one outlier game (e.g. a 36-kill stomp)
    cannot drag down everyone else's relative score.
  - If MAD = 0, fall back to mean/stddev; if that is also 0, z = 0.
  - The ±2.5 cap bounds how much any single stat can contribute.

  ## Score terms

      perf = 0.40 × z(totalDamageDealtToChampions)            // damage
           + 0.30 × z(kills + 0.25 × assists)                 // impact: a kill ≈ 4 assists
           + 0.10 × z((kills + assists) / teamKills)          // kill participation
           + 0.05 × (0.6 × z(goldEarned) + 0.4 × z(champLevel)) // economy
           − 0.10 × z(deaths)                                 // death penalty (soft: Brawl is mayhem)
           + specialistBonus                                  // see below

      specialistBonus = max( 0.25 × max(0, utility − 1.0),
                             0.15 × max(0, tankEff − 1.0) )

      utility = 0.5 × z(gatedHeal) + 0.5 × z(timeCCingOthers)
      gatedHeal = totalHeal × clamp((totalUnitsHealed − 1) / 3, 0, 1)
          // pure self-heal (lifesteal) counts ~0; healing 4+ distinct allies counts fully
      tankEff = z( (totalDamageTaken + damageSelfMitigated) / max(deaths, 1) )
          // tanking per LIFE — dying repeatedly while soaking damage earns nothing

      clutch = min(6, 0.5×doubles + 1.5×triples + 3×quadras + 5×pentas)  // flat points

      score = clamp( 50 + 18 × perf + clutch, 0, 100 )

  ## Design rationale (why it looks like this)

  - Deliberately biased toward damage and kills (75% of the linear weights):
    scores should match what players intuitively expect from the scoreboard.
  - Tank/CC/heal specialists are NOT scored through the main weights; they earn a
    bonus that only fires when their tank or utility z-score exceeds +1σ — an
    ordinary tank game adds nothing, an exceptional one ranks mid-table or higher.
  - The specialist bonus takes the max of the tank and utility paths, never the
    sum, so a tanky CC champion can't double-dip.
  - No win/loss bonus: lobby-wide normalization already encodes winning (winners
    have more gold, kills, levels).
  - Kill participation rewards presence (supports, roamers) and is bounded by
    team kills, so assist-farming can't inflate it.
  - timeCCingOthers is used, NOT totalTimeCrowdControlDealt (the latter counts
    slows and is inflated ~10x).
  - Death penalty is mild (0.10) because the mode is high-death by design.