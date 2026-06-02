# LCU Mayhem Data Ingestion Notes

This document summarizes the data available from the local League Client API (LCU) for ARAM Mayhem games and the changes needed to ingest it into GameFive.

LCU means League Client Update: the local HTTPS API exposed by the running League of Legends client on `127.0.0.1:{port}`. The connection details come from the League install `lockfile`, formatted as:

```text
LeagueClient:{pid}:{port}:{password}:{protocol}
```

Use HTTP basic auth with username `riot` and the lockfile password. The client uses a self-signed certificate, so local requests must skip certificate verification.

## Current Repo Path

The companion already calls LCU match history:

- `companion/LcuClient.cs`
- `companion/LcuModels.cs`
- `companion/MatchMapper.cs`
- `companion/CompanionUploadModels.cs`
- `lib/ingest/mayhem.ts`

Current implementation fetches the latest match and detailed match payload, then uploads only a small subset of participant stats: identity, champion, team, win, KDA, damage, healing, and gold.

It does not currently model or upload final item slots, Mayhem augments, runes/perks, team objective stats, or participant timeline delta fields.

## Relevant LCU Endpoints

### Current Summoner

```http
GET /lol-summoner/v1/current-summoner
```

Use this to get the uploader's current `puuid`.

Observed useful fields:

- `puuid`
- `gameName`
- `tagLine`
- `summonerId`
- `accountId`
- `profileIconId`
- `summonerLevel`

### Recent LoL Matches

```http
GET /lol-match-history/v1/products/lol/{puuid}/matches?begIndex=0&endIndex=20
```

Use this to scan recent games and find the newest Mayhem game.

Mayhem detection:

- `queueId === 2400`
- or `gameMode === "KIWI"`

Observed note: the endpoint returned 21 games for `begIndex=0&endIndex=20`, so do not assume the count is exactly `endIndex - begIndex`.

### Game Details

```http
GET /lol-match-history/v1/games/{gameId}
```

This is the primary ingestion endpoint. It returned the full Mayhem game details including all participants, identities, final item slots, augments, and team objective stats.

Fallback used in the current companion:

```http
GET /lol-match-history/v1/game/{gameId}
```

Keep the fallback unless testing proves it is obsolete.

### Game Timeline

```http
GET /lol-match-history/v1/game-timelines/{gameId}
```

This endpoint was available for the observed Mayhem match, but only returned `BUILDING_KILL` and `CHAMPION_KILL` events. It did not return item purchase/sell/undo events for the observed match.

Use this for kill/building event analysis if needed, but final builds should come from `participants[].stats.item0..item6`.

## Observed Mayhem Game Details Shape

Observed latest Mayhem match:

```text
gameId: 7873636429
queueId: 2400
gameMode: KIWI
gameType: MATCHED_GAME
mapId: 12
platformId: EUW1
gameCreationUtc: 2026-06-01T23:01:30.327Z
gameDuration: 1406
gameVersion: 16.11.782.1492
participants: 10
participantIdentities: 10
```

Top-level keys observed from `GET /lol-match-history/v1/games/{gameId}`:

```text
endOfGameResult
gameCreation
gameCreationDate
gameDuration
gameId
gameMode
gameModeMutators
gameType
gameVersion
mapId
participantIdentities
participants
platformId
queueId
seasonId
teams
```

## Participant Identity Data

Path:

```text
participantIdentities[].player
```

Observed keys:

```text
accountId
currentAccountId
currentPlatformId
gameName
matchHistoryUri
platformId
profileIcon
puuid
summonerId
summonerName
tagLine
```

Recommended ingestion:

- Continue resolving players by `puuid`.
- Prefer Riot ID from `gameName` + `tagLine`.
- Keep `summonerName` as fallback.
- Store/update `profileIcon`, `summonerId`, and possibly `accountId` if useful.

## Participant Data

Path:

```text
participants[]
```

Observed participant keys:

```text
championId
highestAchievedSeasonTier
participantId
spell1Id
spell2Id
stats
teamId
timeline
```

Recommended ingestion additions:

- `spell1Id`
- `spell2Id`
- `highestAchievedSeasonTier` if non-empty
- participant `timeline` deltas if useful for summaries

## Participant Final Stats

Path:

```text
participants[].stats
```

Observed stats contained 118 fields.

Core combat/stat fields:

```text
win
kills
deaths
assists
champLevel
goldEarned
goldSpent
totalDamageDealt
totalDamageDealtToChampions
totalDamageTaken
damageSelfMitigated
totalHeal
totalUnitsHealed
totalMinionsKilled
neutralMinionsKilled
neutralMinionsKilledTeamJungle
neutralMinionsKilledEnemyJungle
timeCCingOthers
totalTimeCrowdControlDealt
visionScore
wardsPlaced
wardsKilled
```

Damage breakdown fields:

```text
physicalDamageDealt
physicalDamageDealtToChampions
physicalDamageTaken
magicDamageDealt
magicDamageDealtToChampions
magicalDamageTaken
trueDamageDealt
trueDamageDealtToChampions
trueDamageTaken
```

Multi-kill and objective fields:

```text
doubleKills
tripleKills
quadraKills
pentaKills
unrealKills
killingSprees
largestKillingSpree
largestMultiKill
largestCriticalStrike
longestTimeSpentLiving
turretKills
inhibitorKills
damageDealtToObjectives
damageDealtToTurrets
```

Surrender/behavior flags:

```text
causedEarlySurrender
earlySurrenderAccomplice
gameEndedInEarlySurrender
gameEndedInSurrender
gameEndedInIGNBSurrender
causedGameEndFromIGNBSurrender
teamEarlySurrendered
wasSevereTransgressor
```

## Final Items

Path:

```text
participants[].stats.item0
participants[].stats.item1
participants[].stats.item2
participants[].stats.item3
participants[].stats.item4
participants[].stats.item5
participants[].stats.item6
```

These are final item IDs. Slot `item6` is the trinket/special slot.

Observed example for `Okkio#ETU`:

```text
items: 3089,6696,6653,2503,3118,3116,2052
```

Recommended storage:

- Prefer a structured JSON column for item IDs if the app only needs display/analysis.
- Prefer a child table only if item-level querying by slot or item ID becomes important.

Suggested JSON shape:

```json
{
  "slots": [3089, 6696, 6653, 2503, 3118, 3116],
  "trinket": 2052
}
```

## Mayhem Augments

Path:

```text
participants[].stats.playerAugment1
participants[].stats.playerAugment2
participants[].stats.playerAugment3
participants[].stats.playerAugment4
participants[].stats.playerAugment5
participants[].stats.playerAugment6
```

Observed example for `Okkio#ETU`:

```text
augments: 1045,1048,1092,1415,0,0
```

Only four augment slots were populated in the observed match. Store non-zero IDs as selected augments; keep zero values only if preserving raw payloads.

Recommended storage:

```json
[1045, 1048, 1092, 1415]
```

## Runes/Perks

Path:

```text
participants[].stats.perk0..perk5
participants[].stats.perk0Var1..perk5Var3
participants[].stats.perkPrimaryStyle
participants[].stats.perkSubStyle
```

Observed Mayhem match had perk IDs as `0`, but the fields exist. Model these as optional or store in a raw stats JSON blob.

## Team Stats

Path:

```text
teams[]
```

Observed team keys:

```text
bans
baronKills
dominionVictoryScore
dragonKills
firstBaron
firstBlood
firstDargon
firstInhibitor
firstTower
hordeKills
inhibitorKills
riftHeraldKills
teamId
towerKills
vilemawKills
win
```

Note: the key is spelled `firstDargon` in the observed LCU payload.

Recommended ingestion:

- Store team objective totals on a team-level table or JSON column.
- `hordeKills` may be relevant to the mode/map and should be preserved.
- Bans may be empty or irrelevant for Mayhem, but retain if present.

## Participant Timeline Deltas

Path:

```text
participants[].timeline
```

Observed keys:

```text
creepsPerMinDeltas
csDiffPerMinDeltas
damageTakenDiffPerMinDeltas
damageTakenPerMinDeltas
goldPerMinDeltas
lane
participantId
role
xpDiffPerMinDeltas
xpPerMinDeltas
```

These are summary timeline deltas, not event history. They may be useful for charts, but are lower priority than final stats/items/augments.

## Game Timeline Events

Path:

```text
GET /lol-match-history/v1/game-timelines/{gameId}
```

Observed top-level keys:

```text
frames
```

Observed event types in Mayhem:

```text
BUILDING_KILL
CHAMPION_KILL
```

Observed no item timeline events:

```text
itemEventCount: 0
```

Recommendation:

- Do not depend on this endpoint for builds.
- Use it only for optional kill/building timeline features.
- Store raw timeline JSON only if planning replay-style analysis.

## Proposed Ingestion Changes

### Companion Models

Add fields to `LcuParticipantStats` in `companion/LcuModels.cs`:

```csharp
[JsonPropertyName("item0")]
public int Item0 { get; set; }

[JsonPropertyName("item1")]
public int Item1 { get; set; }

[JsonPropertyName("item2")]
public int Item2 { get; set; }

[JsonPropertyName("item3")]
public int Item3 { get; set; }

[JsonPropertyName("item4")]
public int Item4 { get; set; }

[JsonPropertyName("item5")]
public int Item5 { get; set; }

[JsonPropertyName("item6")]
public int Item6 { get; set; }

[JsonPropertyName("playerAugment1")]
public int PlayerAugment1 { get; set; }

[JsonPropertyName("playerAugment2")]
public int PlayerAugment2 { get; set; }

[JsonPropertyName("playerAugment3")]
public int PlayerAugment3 { get; set; }

[JsonPropertyName("playerAugment4")]
public int PlayerAugment4 { get; set; }

[JsonPropertyName("playerAugment5")]
public int PlayerAugment5 { get; set; }

[JsonPropertyName("playerAugment6")]
public int PlayerAugment6 { get; set; }
```

Also consider adding:

- `ChampLevel`
- `GoldSpent`
- `TotalDamageTaken`
- `DamageSelfMitigated`
- `TotalMinionsKilled`
- damage breakdowns
- multi-kill counts
- `Spell1Id` and `Spell2Id` on participant upload
- raw stats JSON for forward compatibility

### Upload Payload

Add to `CompanionParticipantUpload`:

```json
{
  "spell1Id": 4,
  "spell2Id": 14,
  "items": [3089, 6696, 6653, 2503, 3118, 3116, 2052],
  "augments": [1045, 1048, 1092, 1415],
  "champLevel": 18,
  "goldSpent": 19650,
  "totalDamageTaken": 53363,
  "damageSelfMitigated": 0,
  "totalMinionsKilled": 88
}
```

Use arrays for items and augments rather than seven/six separate API fields unless the server schema strongly prefers flat fields.

### Server Validation

Update `companionMatchPayloadSchema` in `lib/ingest/mayhem.ts`:

- Add optional `spell1Id`, `spell2Id`
- Add optional `items: z.array(z.number().int().nonnegative()).max(7)`
- Add optional `augments: z.array(z.number().int().positive()).max(6)`
- Add optional numeric stat fields listed above
- Keep unknown future fields out unless explicitly storing `rawStats`

### Database

Current `MatchParticipant` has no item or augment storage.

Suggested Prisma additions:

```prisma
itemsJson       Json? @map("items_json")
augmentsJson    Json? @map("augments_json")
spell1Id        Int?  @map("spell1_id")
spell2Id        Int?  @map("spell2_id")
champLevel      Int?  @map("champ_level")
goldEarned      Int?  @map("gold_earned")
goldSpent       Int?  @map("gold_spent")
damageTaken     Int?  @map("damage_taken")
selfMitigated   Int?  @map("self_mitigated")
minionsKilled   Int?  @map("minions_killed")
rawStatsJson    Json? @map("raw_stats_json")
```

`goldEarned` is currently accepted by the ingest schema but not stored. Either store it or remove it from the upload payload.

### Mapper

Update `companion/MatchMapper.cs` to map:

- item slots into an array
- non-zero augments into an array
- summoner spells
- expanded final stats

Preserve current filtering:

```csharp
.Where(participant => !string.IsNullOrWhiteSpace(participant.Puuid))
```

## Priority Order

1. Add final items and augments.
2. Store summoner spells, champion level, gold earned/spent, damage taken, self-mitigated, and minion kills.
3. Store team objective stats.
4. Optionally store raw participant stats JSON for future-proofing.
5. Optionally ingest timeline events for kills/buildings.

## Validation Checklist

After implementation, verify against a live Mayhem match:

- The companion still detects Mayhem with `queueId 2400` or `gameMode KIWI`.
- The upload includes 10 participants.
- Each participant has 7 item slots, with `0` allowed for empty slots.
- Each participant has up to 6 augment slots, with zero values filtered or consistently stored.
- Server accepts the payload and persists items/augments.
- Duplicate match ingestion still short-circuits by `LCU_{gameId}`.
- Existing MMR/LP updates still apply only to the uploader.

