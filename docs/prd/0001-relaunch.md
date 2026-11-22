# PRD 0001: Relaunch

Bring GameFive back on **Tue Dec 1 2026** as the **Countdown** to Mayhem Week (GAMEFIVE: One Last Chance, Fri Dec 25 – Thu Dec 31 2026, GMT), with a revived **Companion** whose first run is the sign-up.

- Acceptance contract: [0001-relaunch-contract.md](0001-relaunch-contract.md)
- Build manifest: [0001-relaunch-build.md](0001-relaunch-build.md)
- Vocabulary: [GLOSSARY.md](../../GLOSSARY.md). Decisions and their reasons live in the Mayhem Week map, [.wayfinder/mayhem-week/map.md](../../.wayfinder/mayhem-week/map.md); each section below names the ticket it comes from.

## Out of this spec (Event spec)

Event Points, Daily Quests, Squad Contracts, Record Bounties, Daily MVP, firsts, twist days, the live feed and toast content, the ranked ladder (ticket 20), Blackout, Lockdown, the Ceremony, the Rehearsal harness, and the augment/item table refresh after 26.24 (Dec 9). This spec only leaves the hooks they plug into: stored matches with full stats, Entrants, the inbox endpoint, and the retirement flag.

## 1. Revival (tickets 01, 16)

- Revert the takedown: `988a3c5`, `55f3d82` (layout and home page), `bf58613` (delete `middleware.ts`), and the self-destruct part of `167d61a` in `companion/Program.cs` (keep `StartupRegistration.Unregister`, which retirement reuses). Leave `405a1c1` and `08f9b87`.
- Upgrade dependencies until `npm audit --omit=dev` shows no critical or high findings (Next, next-auth/@auth, Prisma, postcss, sharp, …). `zod` 4 only if it costs nothing.
- Remove `npm run worker`, `QUEUE_DRIVER`, `REDIS_URL` and `appConfig.queueDriver`/`redisUrl`. Scoring is inline (ticket 14).
- Prisma on Vercel uses the Supabase **pooler** connection string (IPv4); the direct host is IPv6-only.
- The restored data (18 players, 326 matches) stays in the database as history. It is never shown on the site (ticket 13).

## 2. Entrants and identity (ticket 13; PUUID rule from ticket 20)

- A player becomes an **Entrant** on the Companion's first `register` call. Store `registeredAt` on the player row; a player with no `registeredAt` (or one an admin removed) is not an Entrant. An old player who registers reuses their row, matched by PUUID.
- **Identity is the PUUID only.** No lookup by Riot name, no PUUID overwrite. A Riot ID rename is picked up on the next `register` or upload.
- Only games that **end after** an Entrant's `registeredAt` count for that Entrant. Non-Entrants' games are ignored.
- **Login:** the tray is the only login. The Companion asks the server for a one-time login link for the connected account; opening it sets a session cookie that lasts 30 days or until 2027-01-02 00:00 GMT (after the Ceremony), whichever is later. No passwords, no Riot sign-in for players. Admin login stays as it is.
- **No impersonation protection.** The shared `COMPANION_INGEST_TOKEN` authorises `register`, uploads, inbox and login links (owner accepts the risk).
- **Admin removal:** an admin can remove an Entrant. There is no self-withdraw.
- Every Companion request sends `X-Companion-Version`; the server stores the latest version per player. No heartbeat, no online status.

## 3. Ingest (tickets 14, 18, 02; ladder parts from ticket 20)

- **Accept only** queue `2400` with gameType `MATCHED_GAME`, hard-coded. Everything else is rejected as `not_mayhem` (closes the custom-game hole).
- **Validate only identity fields:** gameId, queueId, gameType, gameCreation, gameDuration; per participant puuid, teamId, championId, win. Every other field is optional with no count limits (drop `items.max(7)` and `augments.max(6)`). Unknown augment and item ids are stored as they are.
- **Store the raw payload** and the uploader's full end-of-game `stats` object as JSON, as well as the mapped columns, including healing on teammates and shielding on teammates from the end-of-game block.
- Remakes (under 240 s) are still skipped.
- **Accept only uploads from Entrants** (the uploader's PUUID has a `registeredAt` and isn't removed). The whole 10-player game is stored, so every Entrant in it is covered.
- **Dedup:** the first upload of a game is stored; later uploads answer `duplicate`. Two simultaneous uploads must not 500: catch the unique-constraint error and answer `duplicate`.
- **Atomic save:** the match and its participants are written in one transaction. On failure nothing is saved, ingest returns 500, and the Companion's offline queue retries.
- **No rank lookups.** Ingest makes no Riot or OP.GG calls (`resolveRank`, `fetchOpggHistoricalRank` and the team/lobby MMR averages go).
- **No LP during the Countdown.** Ingest computes no LP and no placement. The ladder starts on Dec 25 and its formula belongs to the Event spec. Delete the old placement paths (`lib/mmr/calculate-profile.ts` and its callers in the player `status`/`refresh` routes, the `leaderboard_blacklist` insert) and the promo code (`lib/mmr/promos.ts`). Drop the promo columns.
- **Do not auto-create players** from uploads. Only `register` creates an Entrant.

## 4. Companion API (tickets 10, 13)

All endpoints take the shared token. JSON in and out.

- `POST /api/companion/register` `{puuid, gameName, tagLine, version}`: creates or refreshes the Entrant, updates the Riot ID, stores the version. Idempotent; the Companion calls it on every League client connect.
- `POST /api/companion/login-link` `{puuid}`: returns a single-use URL. The token is stored hashed and expires 5 minutes after it's issued. Opening it sets the session cookie (see §2) and redirects to the requested page (default: home).
- `GET /api/companion/inbox?puuid=&since=&briefing=0|1`: returns `{items: [{id, title, body, url}], now}`. **Empty during the Countdown.** The Event spec fills it. `briefing=1` is sent on the first connect of each GMT day.
- `GET /api/companion/status`: global, unauthenticated, returns `{retire, ceremonyUrl, minVersion}`. `retire` comes from an admin flag; the Event spec sets it automatically at Lockdown.

## 5. The Companion 5.0.0 (tickets 10, 01, 02)

- **.NET 10**, one self-contained single-file exe, unsigned. On first run it copies itself to `%LocalAppData%\GameFive\`, registers autostart from there and relaunches. No installer.
- **Version 5.0.0**, published as the GitHub **Latest** release (above the demoted 4.0.0) so `releases/latest` and the updater serve it.
- **Self-destruct removed.** Retirement replaces it: at startup and every 6 h (same timer as the update check, whether or not League is open) it calls `status`. Only an explicit `retire: true` retires it; a network failure never does. On retire it drains the upload queue, calls `StartupRegistration.Unregister`, shows one toast linking to `ceremonyUrl`, then deletes its exe and AppData.
- **Updates** from `releases/latest` at startup and every 6 h, applied only when the gameflow phase is not ChampSelect or InProgress. If `minVersion` is above the running version, check for an update straight away.
- **Register** on every League client connect (see §4). The first time a PUUID registers on an install, the Companion opens a login link to the home page in the default browser by itself, once per install and PUUID (remembered in AppData), so installing lands the player on the site already logged in. The tray acts as the Entrant only while the client is connected; nothing is cached.
- **Uploads:** only queue 2400 `MATCHED_GAME`, on both the live path (`LcuService`) and the tray backfill (`MatchUploaderService`, "Upload recent games"). The upload carries the match-history game (all 10 participants) plus the player's own end-of-game `stats` block, read when the game ends (`totalHealOnTeammates`, `totalDamageShieldedOnTeammates`, time spent dead and the rest). Pings are not needed (ticket 12). Every request sends `X-Companion-Version`.
- **Toasts:** while the client is connected, poll `inbox` every 60 s and right after each upload; show one item per poll with `NotifyIcon.ShowBalloonTip`; a click opens the item's `url` through a fresh login link. Missed items are dropped, not replayed. Nothing is polled while the client is closed. On the first connect of each GMT day, poll with `briefing=1`.
- **Tray menu:** status line (connection and version), **Open Mayhem Week** (opens the site home via a login link), Upload recent games, Check for updates, Open log, Exit. Reconnect is removed. No quest rolling anywhere in the tray.
- **Icons:** the crest icons `connected.ico` / `disconnected.ico` from `prototype/visual-direction` commit `fd0046b`, plus `public/companion-icon.ico`.
- `ServerBaseUrl` is the relaunch URL (§8).

## 6. The site during the Countdown (ticket 11, ticket 13)

The branch `prototype/visual-direction` (fd0046b, never merge) is the visual spec, **pixel for pixel**, including copy, spacing and motion. Port its components (`app/prototype/home/VariantB.tsx`, `Backdrop.tsx`, the logo) and swap `mock.ts` for real data. Drop only the prototype controls (mode/backdrop switcher, "Reset (prototype)", the `variant`/`mode`/`you` URL params).

- **Home (`/`)** is the Countdown from Dec 1 until Fri Dec 25 00:00 GMT: no header bar; the title lockup; the four-card clock counting down to Dec 25 00:00 GMT; "Seven days. Every game is Game 5." and "Fri Dec 25 to Thu Dec 31, GMT"; the three sign-up steps and **Download the Companion** (the `releases/latest` exe) with "Reinstalling it is the sign-up. Windows only."; the **Entrant list**: count plus names and tags, newest first, no states. A logged-in Entrant sees the line "You're entered to play in GameFive: One Last Chance." and their own row marked as theirs (gold, "You"); the "hasn't sent a game since …" warning shows there when their Companion has gone quiet.
- **Splash:** the logo sweep on a full page load, as in the prototype (skipped for reduced motion, not replayed on client navigation).
- **Removed:** the old home, `/companion` (the home page covers download and sign-up), `/leaderboard`, `/player/...` profiles, the Riot ID search and the `players/.../status` and `refresh` APIs. Their URLs redirect to `/`. The Event spec brings back profiles and boards in the new look.
- **Tab icon and header logo:** the crest.
- After Dec 25 00:00 GMT, home shows a plain holding line until the Event spec ships (it must ship before then).

## 7. Admin (ticket 14 subset)

The existing admin page, reduced to the tools the Countdown needs:
- Remove an Entrant.
- Delete a match.
- Flip the Companion retirement flag.
- Maintenance pause: an admin toggle stored with the event settings (replaces the env-only `MAINTENANCE_MODE`, which is removed). While on, ingest answers 503 so the Companion's offline queue retries later, and the site shows a one-line notice.

The Event spec adds points adjustment, rescoring, day close and early Lockdown.

## 8. Hosting and release (tickets 01, 16)

- **Vercel:** create a new project named **`game-five-kohl`** so it gets `https://game-five-kohl.vercel.app` back, which every old Companion already points at. It was free on 2026-11-21 (`DEPLOYMENT_NOT_FOUND`). If Vercel refuses the name, take the assigned URL and put it in `ServerBaseUrl` before building 5.0.0.
- Env vars re-entered from the local `.env`: `DATABASE_URL` (pooler), `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `COMPANION_INGEST_TOKEN`, `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`. `RIOT_API_KEY` only if something still uses it after §3. Free plans, no extra monitoring.
- **Supabase:** free plan, no keep-alive. If the project is paused, restore it by hand before deploying.
- **Release order:** deploy the site, confirm the URL, build and publish Companion 5.0.0 as Latest, then run one real Mayhem game end to end.
