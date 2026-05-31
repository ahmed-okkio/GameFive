# GameFive — Technical Specification

> Private unofficial ARAM Mayhem MMR tracker for League of Legends.
> Version 1.0 — EUW region only.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [MMR Formula](#3-mmr-formula)
4. [Rank Display System](#4-rank-display-system)
5. [API Architecture & Caching](#5-api-architecture--caching)
6. [Data Models](#6-data-models)
7. [Pages & UI](#7-pages--ui)
8. [Admin Panel](#8-admin-panel)
9. [Backend Services](#9-backend-services)
10. [Edge Cases & Rules](#10-edge-cases--rules)
11. [Environment Variables](#11-environment-variables)
12. [Hosting & Infrastructure](#12-hosting--infrastructure)

---

## 1. Project Overview

GameFive is a web application that calculates and displays an unofficial MMR and rank for players in the League of Legends ARAM Mayhem game mode. ARAM Mayhem has no official ranked system, so GameFive derives MMR entirely from match history data, ranked signals, and performance stats pulled from the Riot Games API.

The site is intended for private use by a small friend group of 10–15 players on EUW. It is built for longevity and accuracy, with a caching and enrichment system that improves in accuracy the more it is used.

**Key constraints:**
- EUW region only — clearly labelled throughout the UI
- Riot Games free developer API key — 100 requests per 2 minutes
- Small user base — up to 5 simultaneous users in worst case
- First-time profile load acceptable up to ~2 hours
- Subsequent loads must be fast via caching
- Private friend-group tool — not marketed or positioned as an official ranked ladder
- Include Riot's required unofficial-product disclaimer in a visible app location

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js (React) |
| Backend | Node.js (Next.js API routes or separate Express server) |
| Database | PostgreSQL |
| Job Queue | Redis + BullMQ |
| ORM | Prisma |
| Hosting | Railway (backend + DB + Redis) or equivalent |
| Styling | Tailwind CSS |
| Auth (admin) | NextAuth.js with credentials provider |

---

## 3. MMR Formula

### 3.1 Overview

A player's GameFive MMR is calculated from up to five input signals. The weight of each signal shifts dynamically based on how many Mayhem games the player has played. As Mayhem-specific data accumulates, external signals (ranked, ARAM) fade out entirely.

### 3.2 Input Signal Priority Stack

| Signal | Description |
|---|---|
| Solo/Duo rank | Riot ranked Solo/Duo tier and division |
| Flex rank | Riot ranked Flex tier and division |
| ARAM history | Win rate and performance stats from regular ARAM games |
| Mayhem win rate | Win/loss record across Mayhem games |
| Mayhem performance | KDA, damage share, kill participation, healing per game |

**ARAM history substitution rule:** If a player has fewer than 100 Mayhem games, fill the gap with ARAM games. For example, if a player has 55 Mayhem games, use those 55 plus their 45 most recent ARAM games to form a 100-game dataset. If total Mayhem + ARAM games is still under 100, use all available games.

### 3.3 Weight Distribution by Games Played

| Mayhem games played | Solo/Duo | Flex | ARAM history | Mayhem win rate | Mayhem performance |
|---|---|---|---|---|---|
| 0–5 | 55% | 15% | 20% | 5% | 5% |
| 6–20 | 30% | 10% | 20% | 20% | 20% |
| 21–50 | 10% | 5% | 15% | 30% | 40% |
| 50+ | 0% | 0% | 0% | 35% | 65% |

### 3.4 Ranked Signal Conversion

Convert Solo/Duo and Flex tier/division to a base MMR estimate using the following table. Use the midpoint of each division range for the conversion.

| Tier | Division | Estimated MMR |
|---|---|---|
| Iron | IV | 100 |
| Iron | III | 200 |
| Iron | II | 300 |
| Iron | I | 400 |
| Bronze | IV | 500 |
| Bronze | III | 600 |
| Bronze | II | 700 |
| Bronze | I | 800 |
| Silver | IV | 900 |
| Silver | III | 1000 |
| Silver | II | 1100 |
| Silver | I | 1200 |
| Gold | IV | 1300 |
| Gold | III | 1400 |
| Gold | II | 1500 |
| Gold | I | 1600 |
| Platinum | IV | 1700 |
| Platinum | III | 1800 |
| Platinum | II | 1900 |
| Platinum | I | 2000 |
| Emerald | IV | 2100 |
| Emerald | III | 2200 |
| Emerald | II | 2300 |
| Emerald | I | 2400 |
| Diamond | IV | 2500 |
| Diamond | III | 2600 |
| Diamond | II | 2700 |
| Diamond | I | 2800 |
| Master | — | 2900 |
| Grandmaster | — | 3000 |
| Challenger | — | 3100 |
| Unranked | — | median MMR of all known players |

If a player has no Solo/Duo rank, fall back to Flex rank. If neither exists, use the global median MMR of all cached players.

### 3.5 Performance Score Calculation (Per Game)

For each Mayhem (or ARAM substitute) game, calculate a raw performance score between 0 and 1:

```
kill_participation = (kills + assists) / max(team_total_kills, 1)
damage_share = player_damage / max(team_total_damage, 1)
healing_share = player_healing / max(team_total_healing, 1)  // only for supports/healers, else 0
kda = (kills + assists) / max(deaths, 1)
kda_normalised = min(kda / 5, 1)  // cap at 5 KDA = 1.0

raw_performance = (
  kill_participation * 0.35 +
  damage_share * 0.35 +
  kda_normalised * 0.20 +
  healing_share * 0.10
)
```

### 3.6 Opponent Quality Normalisation

Each game's contribution to MMR is adjusted based on the average MMR of all players in that lobby.

```
lobby_avg_mmr = average MMR of all 9 other players in the game
global_median_mmr = median MMR of all players in the database
opponent_factor = lobby_avg_mmr / global_median_mmr

adjusted_performance = raw_performance * opponent_factor
adjusted_win_value = (win ? 1.0 : 0.0) * opponent_factor
```

A win against a high-MMR lobby is worth more. A poor performance against a high-MMR lobby is penalised less.

For any opponent whose MMR is not yet cached, use their Solo/Duo or Flex rank as a provisional MMR estimate (see Section 3.4). If they have no rank data, use global median MMR.

### 3.7 Recency Weighting

Games are weighted by how recently they were played. Apply a decay factor per game:

```
days_ago = (current_date - game_date) in days
recency_weight = e^(-0.02 * days_ago)
```

This means a game from 30 days ago has roughly 55% the weight of a game played today. A game from 90 days ago has roughly 16% the weight.

### 3.8 Streak Detection

Detect win and loss streaks across the most recent games. Apply a momentum multiplier to accelerate MMR movement during streaks:

```
streak_length = count of consecutive wins or losses in most recent games
streak_multiplier = 1 + (0.05 * min(streak_length, 5))
```

Maximum streak multiplier is 1.25 (at 5+ game streak). Apply this multiplier to the MMR delta of each game in the streak.

### 3.9 Confidence / Uncertainty Buffer

The MMR displayed to the user is not the raw calculated MMR. It is the raw MMR minus an uncertainty penalty that shrinks as more games are played:

```
uncertainty = max(0, 500 * (1 - (games_played / 100)))
displayed_mmr = raw_mmr - uncertainty
```

At 0 games: displayed MMR is 500 below raw MMR.
At 50 games: displayed MMR is 250 below raw MMR.
At 100+ games: displayed MMR equals raw MMR, full confidence.

### 3.10 Inactivity Decay

Decay is calculated on demand when a player's profile is loaded, not in a background job.

```
days_inactive = (current_date - date_of_last_mayhem_game) in days
decay_amount = raw_mmr * (0.005 * days_inactive)
decayed_mmr = max(raw_mmr - decay_amount, emerald_floor_mmr)
```

The decay floor is the MMR equivalent of Emerald IV (2100). A player's displayed MMR will never decay below this value regardless of inactivity.

Store the player's tier at the time of their last game. If their current displayed MMR is lower than that stored tier's MMR range due to decay, show a badge: "Decayed from [stored tier]" e.g. "Decayed from Diamond".

### 3.11 Final MMR Calculation

```
game_score(game) = (
  adjusted_performance * performance_weight +
  adjusted_win_value * winrate_weight
) * recency_weight * streak_multiplier

base_mmr = weighted_average(game_score for all games in lookback window)
           scaled to MMR range (0–3500)

ranked_contribution = (solo_duo_mmr * solo_duo_weight) + (flex_mmr * flex_weight)
aram_contribution = aram_performance_score * aram_weight

raw_mmr = (
  base_mmr * (mayhem_winrate_weight + mayhem_performance_weight) +
  ranked_contribution +
  aram_contribution
)

displayed_mmr = max(raw_mmr - uncertainty - decay_amount, emerald_floor_mmr)
```

Weights are sourced from Section 3.3 based on games played.

---

## 4. Rank Display System

### 4.1 Tier Structure

Tiers and divisions mirror League of Legends exactly:

| Tier | Divisions | Display example |
|---|---|---|
| Iron | IV, III, II, I | Iron IV |
| Bronze | IV, III, II, I | Bronze II |
| Silver | IV, III, II, I | Silver I |
| Gold | IV, III, II, I | Gold III |
| Platinum | IV, III, II, I | Platinum IV |
| Emerald | IV, III, II, I | Emerald II |
| Diamond | IV, III, II, I | Diamond I |
| Master | none | Master 247 LP |
| Grandmaster | none | Grandmaster 1,204 LP |
| Challenger | none | Challenger 2,847 LP |

### 4.2 Dynamic Tier Boundaries

Tier boundaries are percentile-based and recalculated whenever a new player is added to the database. They mirror League of Legends' approximate player distribution:

| Tier | Approximate percentile |
|---|---|
| Iron | Bottom 5% |
| Bronze | 5–25% |
| Silver | 25–50% |
| Gold | 50–70% |
| Platinum | 70–83% |
| Emerald | 83–93% |
| Diamond | 93–98% |
| Master+ | Top 2% |

Within Master+, Grandmaster and Challenger are the top percentiles of the Master+ pool. These thresholds can be tuned as the player database grows.

### 4.3 LP System for Master+

Once a player crosses the Diamond I threshold they enter Master with 0 LP. LP is calculated as:

```
lp = (displayed_mmr - master_threshold_mmr) * lp_scale_factor
```

`lp_scale_factor` should be tuned so that LP increments feel meaningful (suggested: 1 LP per MMR point above master threshold).

### 4.4 Division Display

Always display the full label e.g. "Gold II" not just "Gold". This ensures players can see progression within a tier.

---

## 5. API Architecture & Caching

### 5.1 Riot API Endpoints Used

| Endpoint | Purpose |
|---|---|
| `GET /riot/account/v1/accounts/by-riot-id/{gameName}/{tagLine}` | Resolve Riot ID to PUUID |
| `GET /lol/summoner/v4/summoners/by-puuid/{encryptedPUUID}` | Get summoner profile |
| `GET /lol/league/v4/entries/by-puuid/{puuid}` | Get Solo/Duo and Flex rank |
| `GET /lol/match/v5/matches/by-puuid/{puuid}/ids?queue=450&count=100` | Get ARAM match IDs (queue 450) |
| `GET /lol/match/v5/matches/{matchId}` | Get full match details |
| `GET /lol/champion-mastery/v4/champion-masteries/by-puuid/{puuid}` | Get champion mastery (optional future use) |

All requests use the EUW1 regional endpoint and the europe routing value for match v5.

Rate limit: 100 requests per 2 minutes. Implement a rate limiter middleware that queues requests and enforces this limit globally across all jobs and page loads.

### 5.2 Depth 0 — Immediate Profile Load

Triggered when a player's profile is visited for the first time or their cache is stale.

**Steps:**
1. Resolve Riot ID to PUUID — 1 call
2. Fetch summoner profile — 1 call
3. Fetch Solo/Duo and Flex rank — 1 call
4. Fetch ARAM match IDs and details up to the number needed to fill the 100-game confidence window
5. Retrieve stored Mayhem games for this player from the database. Mayhem games are uploaded by the companion app and are not fetched from Riot Match-V5.
6. For every opponent in stored Mayhem games not already cached, fetch their Solo/Duo + Flex rank as a provisional MMR estimate
7. Convert opponent ranks to provisional MMR estimates
8. Calculate player MMR using available companion Mayhem data plus Riot ranked/ARAM signals
9. Store result in database, mark as "provisional"
10. Enqueue background enrichment job for this player

**Total worst-case calls:** depends on ARAM fill count and known Mayhem opponents. Mayhem match data does not consume Riot API calls.
**Estimated time at 45 calls/min:** first profile loads are much lighter than the original Match-V5 Mayhem crawl, but still depend on ARAM fill count and opponent ranked lookups.
**What user sees:** Progress bar — "Calculating provisional rank... 45/101 steps complete"

**Cold start note:** Since the companion only captures games from the date of installation forward, all players start with zero uploaded Mayhem history. Ranked and ARAM signals carry the score until enough companion Mayhem games accumulate.

### 5.3 Background Enrichment Queue

A single global FIFO queue powered by BullMQ + Redis. Only one enrichment job runs at a time to avoid exceeding rate limits.

When a job completes, it moves to the next in queue automatically.

**Queue display on profile page:**
- If player is in queue: "Provisional rank shown — Enrichment queue position 3, approximately 47 minutes remaining"
- If enrichment is in progress for this player: "Refining rank — enrichment 34% complete"
- Estimated time is calculated from: `(remaining_calls_in_job / 45) + (sum of estimated_calls for all jobs ahead in queue / 45)`

**Enrichment depths:**

| Depth | Who | Games fetched per player | Max new players encountered |
|---|---|---|---|
| 1 | All opponents from depth 0 games | 50 | 450 |
| 2 | All opponents from depth 1 games | 20 | 180 |
| 3 | All opponents from depth 2 games | 10 | 90 |
| 4 | All opponents from depth 3 games | 5 | 45 |
| 5 | All opponents from depth 4 games | 0 — ranked proxy only | chain terminates |

At each depth, always check the cache first. Skip any player that has been cached within 24 hours. Real-world overlap between friend group match histories means actual call counts will be dramatically lower than theoretical maximums.

When enrichment for a player completes, recalculate their MMR using real cached opponent MMR values instead of provisional ranked proxies. Remove "provisional" label. Update their stored tier for decay tracking.

### 5.4 Cache Rules

| Event | Action |
|---|---|
| Profile page loaded | Serve cached data if cache is under 10 minutes old |
| Profile page loaded, cache > 10 minutes old | Trigger fresh depth 0 recalculation |
| Manual refresh button clicked | Only allowed if last manual refresh was > 30 minutes ago. Triggers fresh depth 0 recalculation. |
| Enrichment job completes | Silently updates cached MMR, no page reload required |
| Player not searched in > 24 hours | Enrichment reruns on next page load |

Always display a "Last updated X minutes ago" timestamp on every profile.

### 5.5 Inactivity Decay — On Demand

Decay is not stored in the database. It is calculated at display time:

```
displayed_mmr = stored_mmr - decay_amount(days_since_last_game)
```

This means no background jobs are needed for decay. The stored MMR is always the peak calculated value. Decay is purely a display-time adjustment.

---

## 6. Data Models

### players
```
id                  UUID primary key
puuid               TEXT unique
riot_id_name        TEXT
riot_id_tag         TEXT
summoner_id         TEXT
profile_icon_id     INT
summoner_level      INT
region              TEXT default 'EUW'
solo_duo_tier       TEXT nullable
solo_duo_division   TEXT nullable
flex_tier           TEXT nullable
flex_division       TEXT nullable
raw_mmr             FLOAT
is_provisional      BOOLEAN default true
enrichment_depth    INT default 0
last_game_date      TIMESTAMP
last_game_tier      TEXT nullable  -- tier at time of last game, for decay badge
cache_updated_at    TIMESTAMP
enrichment_completed_at TIMESTAMP nullable
created_at          TIMESTAMP
```

### matches
```
id                  UUID primary key
match_id            TEXT unique
game_mode           TEXT  -- 'MAYHEM' or 'ARAM'
game_date           TIMESTAMP
duration_seconds    INT
queue_id            INT
lobby_avg_mmr       FLOAT nullable  -- calculated and stored after enrichment
created_at          TIMESTAMP
```

### match_participants
```
id                  UUID primary key
match_id            UUID foreign key -> matches
player_id           UUID foreign key -> players
team                INT  -- 100 or 200
win                 BOOLEAN
champion_id         INT
kills               INT
deaths              INT
assists             INT
damage_to_champions INT
healing_done        INT
kill_participation  FLOAT
damage_share        FLOAT
healing_share       FLOAT
performance_score   FLOAT  -- calculated raw performance 0-1
created_at          TIMESTAMP
```

### enrichment_queue
```
id                  UUID primary key
player_id           UUID foreign key -> players
status              TEXT  -- 'pending', 'processing', 'complete', 'failed'
depth_reached       INT default 0
total_calls_estimate INT
calls_made          INT default 0
queued_at           TIMESTAMP
started_at          TIMESTAMP nullable
completed_at        TIMESTAMP nullable
```

### friends_leaderboard
```
id                  UUID primary key
player_id           UUID foreign key -> players
added_by            TEXT  -- admin username
added_at            TIMESTAMP
display_order       INT nullable
```

---

## 7. Pages & UI

### 7.1 General UI Rules

- Dark mode by default, light mode toggle in top navigation bar
- EUW region label clearly visible in the top navigation bar on every page — e.g. a small badge reading "EUW"
- Private-use/unofficial Riot disclaimer visible in the app chrome or footer
- Mobile responsive — all pages must work on screens 375px and above
- GameFive branding — bold competitive aesthetic, gold and dark tones, Worlds-inspired without copying Riot assets
- Tier emblems may use Riot's published ranked emblem assets from the Riot developer documentation, with the required unofficial-product disclaimer shown in the app

### 7.2 Home Page

**Route:** `/`

**Contents:**
- GameFive logo and name prominently displayed
- Single search input: "Enter Riot ID (e.g. PlayerName#EUW)"
- Search button
- Brief description of what GameFive is — "Unofficial ARAM Mayhem MMR tracker"
- EUW region badge

**Behaviour:**
- On submit, navigate to `/player/[gameName]/[tagLine]`
- Validate input format (must contain #) before submitting

### 7.3 Player Profile Page

**Route:** `/player/[gameName]/[tagLine]`

**Layout:** Three tabs — Profile, Champions, Match History

---

**Profile tab (default):**

Top section — rank card:
- Tier emblem (original GameFive artwork)
- Full tier label e.g. "Gold II" or "Master 247 LP"
- Raw MMR number displayed smaller beneath e.g. "1,542 MMR"
- Decay badge if applicable — "Decayed from Diamond" shown as a muted warning badge
- Last updated timestamp + manual refresh button (disabled with countdown if < 30 min since last manual refresh)
- Enrichment status indicator if applicable:
  - "Provisional rank — enrichment queue position 3, ~47 min remaining"
  - "Refining rank — 34% complete"
  - No indicator once enrichment is complete and provisional label is removed

Recent form strip — last 5 games shown as small W/L pills

"How is this calculated?" expandable section:
- Confidence indicator — progress bar from 0 to 100 games, label e.g. "Low confidence — 8 games played" or "High confidence — 94 games played"
- Current input weight breakdown — visual representation of active weights e.g. "Solo/Duo 30% · ARAM history 20% · Mayhem win rate 20% · Mayhem performance 30%"
- Opponent quality context — "Average lobby MMR you've faced: 1,340" with a note on whether this is above or below the global median
- Recency note — "X of your last 100 games were played in the last 30 days"

---

**Champions tab:**

Table or card grid showing:
- Champion name and icon
- Games played in Mayhem
- Win rate
- Average KDA
- Average damage per game
- Average healing per game

Sorted by games played descending by default. Allow sorting by any column.

---

**Match history tab:**

List of last 100 Mayhem games (and ARAM substitutes if applicable), most recent first.

Each match shows by default:
- Date and duration
- Champion played
- Win/loss indicator
- KDA
- Lobby average MMR badge — e.g. "Avg lobby 1,420 MMR"

Clicking a match expands it to show all 10 players with:
- Summoner name (clickable — navigates to their profile page)
- Champion played
- KDA
- Damage dealt
- Healing done
- Win/loss side indicator

### 7.4 Friends Leaderboard Page

**Route:** `/leaderboard`

**Contents:**
- Ranked list of all players added by the admin
- Each entry shows: position, summoner name (clickable), tier emblem, full tier label, raw MMR
- Sorted by displayed MMR descending
- Auto-refreshes on page load using cached data (same 10-minute cache rule)
- "Last updated" timestamp shown

### 7.5 First Time Load — Progress Screen

When a player is searched for the first time, show a dedicated progress screen before the profile tabs appear:

- Player's summoner name and profile icon (fetched in first 2 API calls)
- Progress bar — "Calculating provisional rank... 45 / ~1,001 steps"
- Brief explainer — "We're fetching your match history and estimating opponent skill levels. This takes around 20 minutes the first time."
- Once depth 0 is complete, progress screen transitions to the full profile page with provisional rank shown and enrichment queue indicator

---

## 8. Admin Panel

**Route:** `/admin`

Protected by NextAuth.js credentials login. Single hardcoded admin account — credentials stored as environment variables.

**Features:**
- View all players currently on the friends leaderboard
- Add a player by Riot ID (gameName#tagLine)
- Remove a player from the leaderboard
- View enrichment queue status — list of queued and in-progress jobs with estimated completion times
- No other admin features required at launch

---

## 9. Backend Services

### 9.1 Rate Limiter

A global singleton rate limiter must wrap every outbound Riot API call. It enforces a maximum of 45 requests per minute (conservative buffer below the 100/2min limit) across all concurrent jobs and page loads.

Implement using a token bucket or sliding window algorithm. All API calls must go through this limiter — no direct fetches.

### 9.2 Enrichment Queue Worker

A BullMQ worker process that:
- Pulls one job at a time from the enrichment queue
- Processes enrichment depths 1–5 for the given player
- Updates progress in the database after each depth
- On completion, triggers MMR recalculation with real opponent data
- Removes "provisional" flag from player record
- Moves to next job in queue

The worker runs as a separate long-lived process alongside the Next.js server.

### 9.3 MMR Calculation Service

A pure function service (no side effects) that accepts a player's full match history, opponent MMR map, ranked data, and game count, and returns a calculated MMR value. Called:
- After depth 0 completes (provisional)
- After enrichment completes (final)
- On every page load at display time (to apply on-demand decay)

### 9.4 Tier Boundary Recalculation

Triggered whenever a new player is fully enriched and added to the database. Recalculates the MMR values that correspond to each tier boundary based on the percentile distribution of all players in the database. Stored in a config table or in-memory cache.

---

## 10. Edge Cases & Rules

| Scenario | Behaviour |
|---|---|
| Player has 0 Mayhem games and 0 ARAM games | Use Solo/Duo or Flex rank only. If also unranked, assign global median MMR with maximum uncertainty penalty. |
| Player is unranked in both Solo/Duo and Flex | Use global median MMR as provisional base. |
| Player appears in someone else's match history but has never been searched | Calculate provisional MMR from ranked proxy at depth 1+. Do not display a public profile until they are directly searched. |
| Two players searched simultaneously for the first time | Run both depth 0 jobs in parallel (they are independent). Enqueue their enrichment jobs sequentially. |
| Player's cache is being refreshed when someone else visits their profile | Serve the existing cached data immediately. Do not trigger a second refresh. |
| A player in the enrichment queue is also an opponent in another player's active depth 0 | Use their current cached provisional MMR as the opponent estimate. Do not block depth 0 on their enrichment. |
| Riot API returns an error or rate limit response | Retry with exponential backoff. Do not count failed requests against the rate limit. |
| Player has not played Mayhem in over 6 months | Decay floor of Emerald IV applies. Always show decay badge. |
| New champion released by Riot | No action needed — champion data is stored by ID. Name and icon resolution can be handled via the Riot Data Dragon static asset CDN. |
| Player changes their Riot ID | PUUID remains the same. Update stored gameName and tagLine on next profile load. |

---

## 11. Environment Variables

```
# Riot API
RIOT_API_KEY=

# Database
DATABASE_URL=

# Redis
REDIS_URL=

# Admin credentials
ADMIN_USERNAME=
ADMIN_PASSWORD_HASH=

# NextAuth
NEXTAUTH_SECRET=
NEXTAUTH_URL=

# App
NEXT_PUBLIC_REGION=EUW
```

---

## 12. Hosting & Infrastructure

**Recommended setup on Railway (free tier or minimal cost):**

| Service | Railway component |
|---|---|
| Next.js app | Web service |
| BullMQ worker | Worker service (same repo, different start command) |
| PostgreSQL | Railway PostgreSQL plugin |
| Redis | Railway Redis plugin |

**Deployment:**
- Single GitHub repository
- `npm run dev` for local development
- `npm run start` for Next.js production server
- `npm run worker` for the BullMQ enrichment worker process
- Railway auto-deploys on push to main branch

**Static assets:**
- Champion icons and spell images served from Riot's Data Dragon CDN — no hosting cost
- Tier emblems served from the Next.js public folder. These may be Riot's published ranked emblem assets from the Riot developer documentation.

---

*End of GameFive Technical Specification v1.0*
